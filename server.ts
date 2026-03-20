import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import db, { initDb } from "./src/db";
import { generatePost, generateComment, generateDM, replyToDM, testConnection, generatePersona, generateImage, generateImagePrompt, generateGroupChatReply, pickBestCommenter, pickArchetype } from "./src/ai";

function isUserOnline(user: any, timezone: string) {
  if (!user.online_times || user.online_times === '[]') return true;
  let onlineTimes;
  try {
    onlineTimes = JSON.parse(user.online_times);
  } catch (e) {
    return true;
  }
  if (!onlineTimes || onlineTimes.length === 0) return true;

  const now = new Date();
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false
  }).format(now);
  let currentHour = parseInt(localTime);
  if (currentHour === 24) currentHour = 0;

  return onlineTimes.some((window: string) => {
    const parts = window.split('-').map(t => parseInt(t.trim().split(':')[0]));
    if (parts.length !== 2) return false;
    const [start, end] = parts;
    if (start < end) {
      return currentHour >= start && currentHour < end;
    } else {
      // Overnight window (e.g., 23:00 - 04:00)
      return currentHour >= start || currentHour < end;
    }
  });
}

function pickWeightedRandomUser(users: any[]) {
  if (!users || users.length === 0) return null;
  const totalWeight = users.reduce((sum, u) => sum + (u.activity_level ?? 5), 0);
  let random = Math.random() * totalWeight;
  for (const user of users) {
    random -= (user.activity_level ?? 5);
    if (random <= 0) return user;
  }
  return users[users.length - 1];
}

function addLikesToPostOrComment(postId: number, commentId: number | null, count: number) {
  const aiUsers = db.prepare("SELECT id FROM users WHERE is_ai = 1 AND is_active = 1").all() as any[];
  if (aiUsers.length === 0) return;

  const shuffled = aiUsers.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, aiUsers.length));

  for (const user of selected) {
    try {
      if (commentId) {
        db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(commentId, user.id);
      } else {
        db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").run(postId, user.id);
      }
    } catch (e) {
      // Already liked
    }
  }
}

async function triggerPostComments(postId: number, postType: string) {
  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
  if (!settings || !settings.ai_enabled) return;

  const count = (postType === 'question' || postType === 'discussion') ? 5 : 3;
  const commentedUserIds = new Set<number>();
  
  for (let i = 0; i < count; i++) {
    // Wait a bit to simulate typing/reading
    await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 10000));
    
    const post = db.prepare(`
      SELECT p.*, u.display_name as author_name, u.bio as author_bio 
      FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?
    `).get(postId) as any;
    
    if (!post) break;

    const aiUsers = db.prepare("SELECT * FROM users WHERE is_ai = 1 AND is_active = 1 AND id != ?").all(post.user_id) as any[];
    const existingRepliers = db.prepare("SELECT user_id FROM comments WHERE post_id = ? AND parent_id IS NULL").all(postId).map((r: any) => r.user_id);
    const availableAiUsers = aiUsers.filter(u => {
      const isOnline = isUserOnline(u, settings.timezone || 'UTC');
      return isOnline && !commentedUserIds.has(u.id) && !existingRepliers.includes(u.id);
    });
    if (availableAiUsers.length === 0) continue;

    const chosenAiId = await pickBestCommenter(post, availableAiUsers);
    const randomAi = availableAiUsers.find(u => u.id === chosenAiId) || availableAiUsers[0];
    commentedUserIds.add(randomAi.id);

    const otherComments = db.prepare("SELECT content, created_at FROM comments WHERE post_id = ? LIMIT 5").all(postId).map((c: any) => `[${c.created_at}] ${c.content}`).join(" | ");
    const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, post.user_id) as any;
    const relContext = rel ? rel.description : '';

    const commentContent = await generateComment(randomAi, post.content, post.author_name, otherComments, false, relContext, post.user_id, post.image_prompt, post.created_at);
    if (commentContent) {
      const info = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
        .run(postId, randomAi.id, commentContent);
      console.log(`${randomAi.display_name} auto-commented on post ${postId}`);

      // Add 1-5 likes to the post
      addLikesToPostOrComment(postId, null, Math.floor(Math.random() * 5) + 1);

      const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
      if (realUser && post.user_id === realUser.id) {
        db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'comment', ?)")
          .run(realUser.id, randomAi.id, info.lastInsertRowid);
      }
    }
  }
}

function buildThreadContext(commentId: number): string {
  let context = [];
  let currentCommentId = commentId;
  while (currentCommentId) {
    const comment = db.prepare(`
      SELECT c.*, u.display_name, p.content as post_content, p.created_at as post_created_at, pu.display_name as post_author
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN posts p ON c.post_id = p.id
      JOIN users pu ON p.user_id = pu.id
      WHERE c.id = ?
    `).get(currentCommentId) as any;
    
    if (!comment) break;
    
    context.unshift(`[${comment.created_at}] ${comment.display_name}: "${comment.content}"`);
    
    if (!comment.parent_id) {
      context.unshift(`[${comment.post_created_at}] Original Post by ${comment.post_author}: "${comment.post_content}"`);
      break;
    }
    currentCommentId = comment.parent_id;
  }
  return context.join('\n');
}

async function handleOPReplies() {
  const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
  if (!settings || !settings.ai_enabled) return;

  const unansweredComments = db.prepare(`
    SELECT c.*, p.user_id as op_id, p.content as post_content, u.display_name as author_name, u.is_ai as author_is_ai
    FROM comments c
    JOIN posts p ON c.post_id = p.id
    JOIN users u ON c.user_id = u.id
    JOIN users op ON p.user_id = op.id
    WHERE op.is_ai = 1 AND op.is_active = 1
    AND c.user_id != op.id
    AND c.op_ignored = 0
    AND p.id IN (SELECT id FROM posts ORDER BY created_at DESC LIMIT 10)
    AND NOT EXISTS (
      SELECT 1 FROM comments reply 
      WHERE reply.parent_id = c.id AND reply.user_id = op.id
    )
    ORDER BY c.created_at DESC LIMIT 20
  `).all() as any[];

  for (const comment of unansweredComments) {
    // Real user comments: 100% reply. AI comments: 65% reply.
    const shouldReply = comment.author_is_ai === 0 ? true : Math.random() < 0.65;
    
    if (shouldReply) {
      const opUser = db.prepare("SELECT * FROM users WHERE id = ?").get(comment.op_id) as any;
      if (!opUser) continue;

      if (!isUserOnline(opUser, settings.timezone || 'UTC')) continue;

      const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(opUser.id, comment.user_id) as any;
      const relContext = rel ? rel.description : '';

      const threadContext = buildThreadContext(comment.id);

      const replyContent = await generateComment(opUser, comment.content, comment.author_name, threadContext, true, relContext, comment.user_id, undefined, comment.created_at);
      if (replyContent) {
        const info = db.prepare("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)")
          .run(comment.post_id, opUser.id, replyContent, comment.id);
        console.log(`OP ${opUser.display_name} replied to comment ${comment.id}`);

        // Add 1-5 likes to the comment being replied to
        addLikesToPostOrComment(comment.post_id, comment.id, Math.floor(Math.random() * 5) + 1);

        if (comment.author_is_ai === 0) {
          db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'reply', ?)")
            .run(comment.user_id, opUser.id, info.lastInsertRowid);
        }
      }
    } else {
      // Mark as ignored so we don't keep trying
      db.prepare("UPDATE comments SET op_ignored = 1 WHERE id = ?").run(comment.id);
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Initialize Database
  initDb();

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get();
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const { ai_enabled, model_name, image_model_name, timezone, api_key, prob_post, prob_image_post, prob_comment, prob_message } = req.body;
    if (ai_enabled !== undefined) {
      db.prepare("UPDATE settings SET ai_enabled = ? WHERE id = 1").run(ai_enabled ? 1 : 0);
    }
    if (model_name !== undefined) {
      db.prepare("UPDATE settings SET model_name = ? WHERE id = 1").run(model_name);
    }
    if (image_model_name !== undefined) {
      db.prepare("UPDATE settings SET image_model_name = ? WHERE id = 1").run(image_model_name);
    }
    if (timezone !== undefined) {
      db.prepare("UPDATE settings SET timezone = ? WHERE id = 1").run(timezone);
    }
    if (api_key !== undefined) {
      db.prepare("UPDATE settings SET api_key = ? WHERE id = 1").run(api_key);
    }
    if (prob_post !== undefined) {
      db.prepare("UPDATE settings SET prob_post = ? WHERE id = 1").run(prob_post);
    }
    if (prob_image_post !== undefined) {
      db.prepare("UPDATE settings SET prob_image_post = ? WHERE id = 1").run(prob_image_post);
    }
    if (prob_comment !== undefined) {
      db.prepare("UPDATE settings SET prob_comment = ? WHERE id = 1").run(prob_comment);
    }
    if (prob_message !== undefined) {
      db.prepare("UPDATE settings SET prob_message = ? WHERE id = 1").run(prob_message);
    }
    res.json({ success: true });
  });

  app.post("/api/reset-db", (req, res) => {
    try {
      db.prepare("DELETE FROM comment_likes").run();
      db.prepare("DELETE FROM likes").run();
      db.prepare("DELETE FROM comments").run();
      db.prepare("DELETE FROM direct_messages").run();
      db.prepare("DELETE FROM group_chat_messages").run();
      db.prepare("DELETE FROM group_chat_members").run();
      db.prepare("DELETE FROM group_chats").run();
      db.prepare("DELETE FROM notifications").run();
      db.prepare("DELETE FROM posts").run();
      db.prepare("DELETE FROM follows").run();
      db.prepare("DELETE FROM relationships").run();
      db.prepare("DELETE FROM users WHERE is_ai = 1").run();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/reset-content", (req, res) => {
    try {
      db.prepare("DELETE FROM comment_likes").run();
      db.prepare("DELETE FROM likes").run();
      db.prepare("DELETE FROM comments").run();
      db.prepare("DELETE FROM direct_messages").run();
      db.prepare("DELETE FROM group_chat_messages").run();
      db.prepare("DELETE FROM group_chat_members").run();
      db.prepare("DELETE FROM group_chats").run();
      db.prepare("DELETE FROM notifications").run();
      db.prepare("DELETE FROM posts").run();
      db.prepare("UPDATE users SET is_active = 0 WHERE is_ai = 1").run();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/test-ai", async (req, res) => {
    try {
      const result = await testConnection();
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/generate-persona", async (req, res) => {
    try {
      const { name, extraInfo } = req.body;
      const universes = db.prepare("SELECT name FROM universes").all().map((u: any) => u.name);
      
      const persona = await generatePersona(name, extraInfo, universes);
      res.json(persona);
    } catch (e: any) {
      console.error("Error in generate-persona:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Users
  app.get("/api/users/:id/posts", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    const userId = user ? user.id : 0;
    const posts = db.prepare(`
      SELECT p.*, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `).all(userId, req.params.id);
    res.json(posts);
  });

  app.get("/api/users/:id/followers", (req, res) => {
    const followers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.followed_id = ?
    `).all(req.params.id);
    res.json(followers);
  });

  app.get("/api/users/:id/following", (req, res) => {
    const following = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url
      FROM follows f
      JOIN users u ON f.followed_id = u.id
      WHERE f.follower_id = ?
    `).all(req.params.id);
    res.json(following);
  });

  app.get("/api/users", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    const users = db.prepare(`
      SELECT u.*, 
      (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND followed_id = u.id) as is_followed,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
      (SELECT COUNT(*) FROM follows WHERE followed_id = u.id) as follower_count
      FROM users u ORDER BY u.created_at DESC
    `).all(user?.id || 0);
    
    res.json(users);
  });

  app.get("/api/users/:id/relationships", (req, res) => {
    const relationships = db.prepare(`
      SELECT r.*, u.display_name as other_name, u.username as other_username, u.avatar_url as other_avatar
      FROM relationships r
      JOIN users u ON r.user_id_2 = u.id
      WHERE r.user_id_1 = ?
    `).all(req.params.id);
    res.json(relationships);
  });

  app.post("/api/users/:id/relationships", (req, res) => {
    const { user_id_2, description } = req.body;
    const user_id_1 = req.params.id;
    try {
      // Two-sided relationship
      db.prepare("INSERT OR REPLACE INTO relationships (user_id_1, user_id_2, description) VALUES (?, ?, ?)").run(user_id_1, user_id_2, description);
      db.prepare("INSERT OR REPLACE INTO relationships (user_id_1, user_id_2, description) VALUES (?, ?, ?)").run(user_id_2, user_id_1, description);
      
      // Mutual follow
      db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)").run(user_id_1, user_id_2);
      db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)").run(user_id_2, user_id_1);
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id/relationships/:otherId", (req, res) => {
    const user_id_1 = req.params.id;
    const user_id_2 = req.params.otherId;
    try {
      db.prepare("DELETE FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").run(user_id_1, user_id_2);
      db.prepare("DELETE FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").run(user_id_2, user_id_1);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    try {
      // Don't delete the real user
      const user = db.prepare("SELECT is_ai FROM users WHERE id = ?").get(userId) as any;
      if (!user || user.is_ai === 0) {
        return res.status(400).json({ error: "Cannot delete real user" });
      }

      // Delete all related data
      db.prepare("DELETE FROM comment_likes WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM likes WHERE user_id = ?").run(userId);
      db.prepare("DELETE FROM notifications WHERE user_id = ? OR actor_id = ?").run(userId, userId);
      db.prepare("DELETE FROM follows WHERE follower_id = ? OR followed_id = ?").run(userId, userId);
      db.prepare("DELETE FROM relationships WHERE user_id_1 = ? OR user_id_2 = ?").run(userId, userId);
      
      // Delete comments and their likes/notifications
      const comments = db.prepare("SELECT id FROM comments WHERE user_id = ?").all(userId) as any[];
      for (const c of comments) {
        db.prepare("DELETE FROM comment_likes WHERE comment_id = ?").run(c.id);
        db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id = ?").run(c.id);
        db.prepare("DELETE FROM comments WHERE parent_id = ?").run(c.id);
        db.prepare("DELETE FROM comments WHERE id = ?").run(c.id);
      }

      // Delete posts and their comments/likes/notifications
      const posts = db.prepare("SELECT id FROM posts WHERE user_id = ?").all(userId) as any[];
      for (const p of posts) {
        db.prepare("DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)").run(p.id);
        db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id IN (SELECT id FROM comments WHERE post_id = ?)").run(p.id);
        db.prepare("DELETE FROM comments WHERE post_id = ?").run(p.id);
        db.prepare("DELETE FROM likes WHERE post_id = ?").run(p.id);
        db.prepare("DELETE FROM notifications WHERE type IN ('like_post', 'comment', 'reply') AND reference_id = ?").run(p.id);
        db.prepare("DELETE FROM posts WHERE id = ?").run(p.id);
      }

      // Delete DMs
      db.prepare("DELETE FROM direct_messages WHERE sender_id = ? OR receiver_id = ?").run(userId, userId);

      // Finally delete user
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Universes
  app.get("/api/universes", (req, res) => {
    const universes = db.prepare(`
      SELECT u.*, (SELECT COUNT(*) FROM users WHERE universe_id = u.id) as character_count
      FROM universes u
      ORDER BY u.name ASC
    `).all();
    res.json(universes);
  });

  app.post("/api/universes", (req, res) => {
    const { name, description, image_url } = req.body;
    try {
      const info = db.prepare("INSERT INTO universes (name, description, image_url) VALUES (?, ?, ?)").run(name, description || '', image_url || '');
      res.json({ id: info.lastInsertRowid, name, description, image_url });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/universes/:id", (req, res) => {
    const { description, image_url } = req.body;
    try {
      db.prepare("UPDATE universes SET description = ?, image_url = ? WHERE id = ?").run(description || '', image_url || '', req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/universes/:id/characters", (req, res) => {
    const characters = db.prepare("SELECT id, username, display_name, avatar_url, bio FROM users WHERE universe_id = ?").all(req.params.id);
    res.json(characters);
  });

  app.put("/api/users/:id", (req, res) => {
    const { display_name, username, bio, avatar_url, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id, online_times, activity_level } = req.body;
    try {
      db.prepare(`
        UPDATE users 
        SET display_name = ?, username = ?, bio = ?, avatar_url = ?, description = ?, writing_style = ?, physical_appearance = ?, clothing_style = ?, artstyle = ?, universe_id = ?, online_times = ?, activity_level = ?
        WHERE id = ?
      `).run(display_name, username, bio, avatar_url, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id || null, online_times || '[]', activity_level ?? 5, req.params.id);

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/users", (req, res) => {
    const { username, display_name, bio, avatar_url, ai_persona, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id, online_times, activity_level } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO users (username, display_name, bio, avatar_url, is_ai, ai_persona, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id, online_times, activity_level)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(username, display_name, bio, avatar_url, ai_persona, description, writing_style, physical_appearance, clothing_style, artstyle, universe_id || null, online_times || '[]', activity_level ?? 5);
      const userId = info.lastInsertRowid;
      
      // Real user follows new character by default, and character follows real user
      const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
      if (user) {
        db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)").run(user.id, userId);
        db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)").run(userId, user.id);
      }

      res.json({ id: userId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/users/:id/follow", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    try {
      db.prepare("INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)").run(user.id, req.params.id);
      res.json({ success: true, followed: true });
    } catch (e) {
      db.prepare("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?").run(user.id, req.params.id);
      res.json({ success: true, followed: false });
    }
  });

  // Notifications
  app.get("/api/notifications", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    const notifications = db.prepare(`
      SELECT n.*, u.display_name as actor_name, u.avatar_url as actor_avatar
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(user.id);
    res.json(notifications);
  });

  app.post("/api/notifications/read", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(user.id);
    res.json({ success: true });
  });

  app.post("/api/users/:id/force-post", async (req, res) => {
    try {
      const { type } = req.body; // 'text' or 'image'
      const aiUser = db.prepare("SELECT * FROM users WHERE id = ? AND is_ai = 1").get(req.params.id) as any;
      if (!aiUser) return res.status(404).json({ error: "AI User not found" });

      const recentContext = db.prepare(`
        SELECT p.content, p.created_at, u.display_name 
        FROM posts p JOIN users u ON p.user_id = u.id 
        ORDER BY p.created_at DESC LIMIT 5
      `).all() as any[];
      const contextStr = recentContext.map(p => `[${p.created_at}] ${p.display_name}: ${p.content}`).join(" | ");
      
      const rels = db.prepare(`
        SELECT u.display_name, r.description 
        FROM relationships r 
        JOIN users u ON r.user_id_2 = u.id 
        WHERE r.user_id_1 = ?
      `).all(aiUser.id) as any[];
      const relStr = rels.map(r => `${r.display_name}: ${r.description}`).join(", ");

      const isFirstPost = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE user_id = ?").get(aiUser.id) as any).count === 0;
      const archetype = pickArchetype(isFirstPost, type === 'image');
      const allUsers = db.prepare("SELECT username FROM users WHERE id != ?").all(aiUser.id) as any[];
      const availableUsernames = allUsers.map(u => u.username).join(', ');
      const postContent = await generatePost(aiUser, contextStr, relStr, archetype, availableUsernames, isFirstPost);
      if (postContent) {
        const info = db.prepare("INSERT INTO posts (user_id, content, post_type) VALUES (?, ?, ?)").run(aiUser.id, postContent, archetype.id);
        const postId = info.lastInsertRowid;
        
        if (!aiUser.is_active) {
          db.prepare("UPDATE users SET is_active = 1 WHERE id = ?").run(aiUser.id);
        }

        // Respond immediately so UI doesn't hang
        res.json({ success: true, postId });

        // Generate image in background
        if (archetype.id === 'image_post') {
          try {
            const imagePrompt = await generateImagePrompt(aiUser, postContent);
            const imageUrl = await generateImage(imagePrompt);
            if (imageUrl) {
              db.prepare("UPDATE posts SET image_url = ?, image_prompt = ? WHERE id = ?").run(imageUrl, imagePrompt, postId);
            }
          } catch (err) {
            console.error("Failed to generate image for post", postId, err);
          }
        }
      } else {
        res.status(500).json({ error: "Failed to generate post" });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Posts
  app.get("/api/posts", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    const userId = user ? user.id : 0;
    
    const posts = db.prepare(`
      SELECT p.*, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id AND user_id = ?) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 50
    `).all(userId);
    res.json(posts);
  });

  app.post("/api/posts", async (req, res) => {
    const { content, post_type } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    const stmt = db.prepare("INSERT INTO posts (user_id, content, post_type) VALUES (?, ?, ?)");
    const info = stmt.run(user.id, content, post_type || 'life_update');
    const postId = info.lastInsertRowid;
    
    res.json({ id: postId });

    if (post_type === 'image_post') {
      try {
        const imagePrompt = await generateImagePrompt(user, content);
        const imageUrl = await generateImage(imagePrompt);
        if (imageUrl) {
          db.prepare("UPDATE posts SET image_url = ?, image_prompt = ? WHERE id = ?").run(imageUrl, imagePrompt, postId);
        }
      } catch (e) {
        console.error("Failed to generate image for user post:", e);
      }
    }

    triggerPostComments(postId, post_type || 'life_update');
  });

  // Comments
  app.get("/api/posts/:id/comments", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    const userId = user ? user.id : 0;

    const comments = db.prepare(`
      SELECT c.*, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id) as like_count,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND user_id = ?) as is_liked
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(userId, req.params.id);
    res.json(comments);
  });

  app.post("/api/posts/:id/comments", (req, res) => {
    const { content, parent_id } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    const stmt = db.prepare("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)");
    const info = stmt.run(req.params.id, user.id, content, parent_id || null);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/posts/:id/likers", (req, res) => {
    const likers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url
      FROM likes l
      JOIN users u ON l.user_id = u.id
      WHERE l.post_id = ?
    `).all(req.params.id);
    res.json(likers);
  });

  app.get("/api/comments/:id/likers", (req, res) => {
    const likers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar_url
      FROM comment_likes cl
      JOIN users u ON cl.user_id = u.id
      WHERE cl.comment_id = ?
    `).all(req.params.id);
    res.json(likers);
  });

  // Delete and Edit Posts
  app.get("/api/posts/:id", (req, res) => {
    const post = db.prepare(`
      SELECT p.*, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments,
      EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = (SELECT id FROM users WHERE is_ai = 0)) as is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(req.params.id);
    if (post) {
      res.json(post);
    } else {
      res.status(404).json({ error: "Post not found" });
    }
  });

  app.delete("/api/posts/:id", (req, res) => {
    try {
      const postId = req.params.id;
      db.prepare("DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)").run(postId);
      db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id IN (SELECT id FROM comments WHERE post_id = ?)").run(postId);
      db.prepare("DELETE FROM comments WHERE post_id = ?").run(postId);
      db.prepare("DELETE FROM likes WHERE post_id = ?").run(postId);
      db.prepare("DELETE FROM notifications WHERE type IN ('like_post', 'comment', 'reply') AND reference_id = ?").run(postId);
      db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/posts/:id", (req, res) => {
    try {
      const { content } = req.body;
      db.prepare("UPDATE posts SET content = ? WHERE id = ?").run(content, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete and Edit Comments
  app.get("/api/comments/:id", (req, res) => {
    const comment = db.prepare(`
      SELECT c.*, u.username, u.display_name, u.avatar_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(req.params.id);
    if (comment) {
      res.json(comment);
    } else {
      res.status(404).json({ error: "Comment not found" });
    }
  });

  app.delete("/api/comments/:id", (req, res) => {
    try {
      const commentId = req.params.id;
      db.prepare("DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE parent_id = ?)").run(commentId);
      db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id IN (SELECT id FROM comments WHERE parent_id = ?)").run(commentId);
      db.prepare("DELETE FROM comment_likes WHERE comment_id = ?").run(commentId);
      db.prepare("DELETE FROM notifications WHERE type = 'like_comment' AND reference_id = ?").run(commentId);
      db.prepare("DELETE FROM comments WHERE parent_id = ?").run(commentId);
      db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/comments/:id", (req, res) => {
    try {
      const { content } = req.body;
      db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(content, req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Likes
  app.post("/api/posts/:id/like", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    try {
      db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").run(req.params.id, user.id);
      res.json({ success: true });
    } catch (e) {
      // Already liked, so unlike
      db.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?").run(req.params.id, user.id);
      res.json({ success: true, unliked: true });
    }
  });

  app.post("/api/comments/:id/like", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    try {
      db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(req.params.id, user.id);
      res.json({ success: true });
    } catch (e) {
      db.prepare("DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?").run(req.params.id, user.id);
      res.json({ success: true, unliked: true });
    }
  });

  // Group Chats
  app.get("/api/group-chats", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    const groups = db.prepare(`
      SELECT gc.*, 
      (SELECT content FROM group_chat_messages WHERE group_chat_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM group_chat_messages WHERE group_chat_id = gc.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM group_chat_messages WHERE group_chat_id = gc.id AND created_at > gcm.last_read_at) as unread_count
      FROM group_chats gc
      JOIN group_chat_members gcm ON gc.id = gcm.group_chat_id
      WHERE gcm.user_id = ?
      ORDER BY last_message_time DESC NULLS LAST, gc.created_at DESC
    `).all(user.id);

    for (const group of groups as any[]) {
      group.members = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_ai
        FROM users u
        JOIN group_chat_members gcm ON u.id = gcm.user_id
        WHERE gcm.group_chat_id = ?
      `).all(group.id);
    }

    res.json(groups);
  });

  app.post("/api/group-chats", (req, res) => {
    const { name, member_ids } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    try {
      const stmt = db.prepare("INSERT INTO group_chats (name) VALUES (?)");
      const info = stmt.run(name);
      const groupId = info.lastInsertRowid;

      const insertMember = db.prepare("INSERT INTO group_chat_members (group_chat_id, user_id) VALUES (?, ?)");
      insertMember.run(groupId, user.id);
      for (const memberId of member_ids) {
        insertMember.run(groupId, memberId);
      }

      res.json({ id: groupId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/group-chats/:id/messages", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (user) {
      db.prepare("UPDATE group_chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE group_chat_id = ? AND user_id = ?").run(req.params.id, user.id);
    }

    const limit = parseInt(req.query.limit as string) || 40;
    const beforeId = req.query.before_id ? parseInt(req.query.before_id as string) : null;

    let query = `
      SELECT m.*, u.display_name, u.username, u.avatar_url
      FROM group_chat_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_chat_id = ?
    `;
    const params: any[] = [req.params.id];

    if (beforeId) {
      query += " AND m.id < ?";
      params.push(beforeId);
    }

    query += ` ORDER BY m.id DESC LIMIT ?`;
    params.push(limit);

    const messages = db.prepare(`SELECT * FROM (${query}) ORDER BY id ASC`).all(...params);
    res.json(messages);
  });

  app.post("/api/group-chats/:id/messages", async (req, res) => {
    const { content } = req.body;
    const user = db.prepare("SELECT id, display_name FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    const groupId = req.params.id;
    try {
      db.prepare("INSERT INTO group_chat_messages (group_chat_id, sender_id, content) VALUES (?, ?, ?)")
        .run(groupId, user.id, content);
      
      res.json({ success: true });

      // AI Reply logic
      const group = db.prepare("SELECT * FROM group_chats WHERE id = ?").get(groupId) as any;
      if (!group) return;

      const members = db.prepare(`
        SELECT u.* FROM users u
        JOIN group_chat_members gcm ON u.id = gcm.user_id
        WHERE gcm.group_chat_id = ? AND u.is_ai = 1 AND u.is_active = 1
      `).all(groupId) as any[];

      const history = db.prepare(`
        SELECT m.sender_id, m.content, u.display_name, m.created_at
        FROM group_chat_messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.group_chat_id = ?
        ORDER BY m.created_at DESC LIMIT 15
      `).all(groupId).reverse();

      const formattedHistory = history.map((msg: any) => ({
        role: msg.sender_id === user.id ? 'user' : 'assistant',
        content: `[${msg.created_at}] [${msg.display_name}]: ${msg.content}`
      }));

      // Let each AI decide if they want to reply (e.g. based on activity level or if mentioned)
      const settings = db.prepare("SELECT timezone FROM settings WHERE id = 1").get() as any;
      const timezone = settings?.timezone || 'UTC';

      for (const aiUser of members) {
        if (!isUserOnline(aiUser, timezone)) continue;

        const isMentioned = content.toLowerCase().includes(aiUser.display_name.toLowerCase()) || content.toLowerCase().includes(aiUser.username.toLowerCase());
        const activityLevel = aiUser.activity_level ?? 5;
        // Base probability between 5% and 50% depending on activity level
        const baseProb = (activityLevel / 10) * 0.5;
        const shouldReply = isMentioned || Math.random() < baseProb;
        
        if (shouldReply) {
          const otherMembers = db.prepare(`
            SELECT u.* FROM users u
            JOIN group_chat_members gcm ON u.id = gcm.user_id
            WHERE gcm.group_chat_id = ? AND u.id != ?
          `).all(groupId, aiUser.id) as any[];

          const reply = await generateGroupChatReply(aiUser, group.name, formattedHistory, otherMembers);
          if (reply) {
            db.prepare("INSERT INTO group_chat_messages (group_chat_id, sender_id, content) VALUES (?, ?, ?)")
              .run(groupId, aiUser.id, reply);
            
            // Add this reply to history for the next AI
            formattedHistory.push({
              role: 'assistant',
              content: `[${new Date().toISOString()}] [${aiUser.display_name}]: ${reply}`
            });
          }
        }
      }

    } catch (e: any) {
      console.error("Error in /api/group-chats/:id/messages:", e);
    }
  });

  // DMs
  app.get("/api/dms", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    // Get latest message per conversation
    const conversations = db.prepare(`
      SELECT 
        u.id as other_user_id, u.username, u.display_name, u.avatar_url,
        dm.content as last_message, dm.created_at, dm.is_read,
        dm.sender_id,
        (SELECT COUNT(*) FROM direct_messages WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread_count
      FROM users u
      JOIN direct_messages dm ON (dm.sender_id = u.id AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = u.id)
      WHERE dm.id IN (
        SELECT MAX(id) FROM direct_messages 
        WHERE sender_id = u.id OR receiver_id = u.id
        GROUP BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
      )
      AND u.id != ?
      ORDER BY dm.created_at DESC
    `).all(user.id, user.id, user.id, user.id, user.id);
    res.json(conversations);
  });

  app.get("/api/dms/:userId", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    const limit = parseInt(req.query.limit as string) || 40;
    const beforeId = req.query.before_id ? parseInt(req.query.before_id as string) : null;

    let query = `
      SELECT * FROM direct_messages
      WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
    `;
    const params: any[] = [user.id, req.params.userId, req.params.userId, user.id];

    if (beforeId) {
      query += " AND id < ?";
      params.push(beforeId);
    }

    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    const messages = db.prepare(`SELECT * FROM (${query}) ORDER BY id ASC`).all(...params);
    
    // Mark as read
    db.prepare("UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0")
      .run(req.params.userId, user.id);

    res.json(messages);
  });

  app.delete("/api/dms/:userId", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    db.prepare("DELETE FROM direct_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)")
      .run(user.id, req.params.userId, req.params.userId, user.id);
    
    res.json({ success: true });
  });

  app.post("/api/dms/:userId", async (req, res) => {
    try {
      const { content } = req.body;
      const user = db.prepare("SELECT id, display_name FROM users WHERE is_ai = 0").get() as any;
      if (!user) return res.status(401).json({ error: "User not found" });

      const receiverId = req.params.userId;
      db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
        .run(user.id, receiverId, content.trim());
      
      res.json({ success: true });

      // AI Reply logic
      const receiver = db.prepare("SELECT * FROM users WHERE id = ? AND is_ai = 1 AND is_active = 1").get(receiverId) as any;
      const settings = db.prepare("SELECT timezone FROM settings WHERE id = 1").get() as any;
      if (receiver && isUserOnline(receiver, settings?.timezone || 'UTC')) {
        // Get recent history
        const history = db.prepare(`
          SELECT sender_id, content, created_at FROM direct_messages
          WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
          ORDER BY created_at DESC LIMIT 10
        `).all(user.id, receiverId, receiverId, user.id).reverse();

        const formattedHistory = history.map((msg: any) => ({
          role: msg.sender_id === receiverId ? 'assistant' : 'user',
          content: msg.content,
          created_at: msg.created_at
        }));

        const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(receiverId, user.id) as any;
        const relContext = rel ? rel.description : '';

        const reply = await replyToDM(receiver, user.display_name, formattedHistory, relContext, user.id);
        if (reply) {
          db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
            .run(receiverId, user.id, reply.trim());
        }
      }
    } catch (e: any) {
      console.error("Error in /api/dms/:userId:", e);
      if (!res.headersSent) {
        res.status(500).json({ error: e.message });
      }
    }
  });

  // Background Worker for AI Activity
  setInterval(async () => {
    try {
      await handleOPReplies();
      
      const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
      if (!settings || !settings.ai_enabled) return;

      const allAiUsers = db.prepare("SELECT * FROM users WHERE is_ai = 1").all() as any[];
      const activeAiUsers = allAiUsers.filter(u => u.is_active === 1 && isUserOnline(u, settings.timezone || 'UTC'));
      if (allAiUsers.length === 0) return;

      const probPost = (settings.prob_post ?? 100) / 1440;
      const probImagePost = (settings.prob_image_post ?? 30) / 1440;
      const probComment = (settings.prob_comment ?? 1000) / 1440;
      const probMessage = (settings.prob_message ?? 5) / 1440;

      // Local actions (Likes & Follows) - Doesn't use API tokens
      if (Math.random() < 0.3 && activeAiUsers.length > 0) {
        const randomAi = pickWeightedRandomUser(activeAiUsers);
        // 30% chance to do some local actions
        const recentPosts = db.prepare("SELECT id, user_id FROM posts ORDER BY created_at DESC LIMIT 10").all() as any[];
        if (recentPosts.length > 0) {
          const postToLike = recentPosts[Math.floor(Math.random() * recentPosts.length)];
          try {
            db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").run(postToLike.id, randomAi.id);
          } catch (e) {} // Already liked
        }

        const recentComments = db.prepare("SELECT id, user_id FROM comments ORDER BY created_at DESC LIMIT 10").all() as any[];
        if (recentComments.length > 0) {
          const commentToLike = recentComments[Math.floor(Math.random() * recentComments.length)];
          try {
            db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(commentToLike.id, randomAi.id);
          } catch (e) {} // Already liked
        }

        // Randomly follow someone
        const otherAiUsers = activeAiUsers.filter(u => u.id !== randomAi.id);
        if (otherAiUsers.length > 0) {
          const totalAiUsersCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_ai = 1").get() as any;
          const followingCountA = db.prepare("SELECT COUNT(*) as c FROM follows WHERE follower_id = ? AND followed_id IN (SELECT id FROM users WHERE is_ai = 1)").get(randomAi.id) as any;
          
          const followingRatio = followingCountA.c / Math.max(1, totalAiUsersCount.c);
          
          let shouldFollow = false;
          if (followingRatio < 0.01) {
              shouldFollow = true;
          } else if (followingRatio < 0.40) {
              if (followingRatio < 0.10) {
                  shouldFollow = Math.random() < 0.8;
              } else if (followingRatio < 0.30) {
                  shouldFollow = Math.random() < 0.3;
              } else {
                  shouldFollow = Math.random() < 0.05;
              }
          }

          if (shouldFollow) {
            let userToFollow = pickWeightedRandomUser(otherAiUsers);
            
            // Try to find someone from the same universe
            if (randomAi.universe_id) {
              const sameUniverseUsers = db.prepare(`
                SELECT id as user_id
                FROM users 
                WHERE universe_id = ? AND id != ? AND is_ai = 1
                LIMIT 5
              `).all(randomAi.universe_id, randomAi.id) as any[];
              
              if (sameUniverseUsers.length > 0) {
                // 70% chance to pick from same universe users
                if (Math.random() < 0.7) {
                  const pickedSimilar = sameUniverseUsers[Math.floor(Math.random() * sameUniverseUsers.length)];
                  const foundUser = otherAiUsers.find(u => u.id === pickedSimilar.user_id);
                  if (foundUser) userToFollow = foundUser;
                }
              }
            }

            if (userToFollow) {
              // Follower scaling for userToFollow
              const followerCountB = db.prepare("SELECT COUNT(*) as c FROM follows WHERE followed_id = ? AND follower_id IN (SELECT id FROM users WHERE is_ai = 1)").get(userToFollow.id) as any;
              const followedRatio = followerCountB.c / Math.max(1, totalAiUsersCount.c);
              
              // The more followers, the harder to gain new ones.
              const followSuccessProb = Math.max(0.01, 1 - followedRatio);

              if (Math.random() < followSuccessProb) {
                try {
                  db.prepare("INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)").run(randomAi.id, userToFollow.id);
                } catch (e) {} // Already following
              }
            }
          }
        }
      }

      const doAiPost = async (aiUser: any, isImage: boolean) => {
        const recentContext = db.prepare("SELECT content, created_at FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 3").all(aiUser.id) as any[];
        const contextStr = recentContext.map(p => `[${p.created_at}] ${p.content}`).join(" | ");
        
        const rels = db.prepare(`
          SELECT u.display_name, r.description 
          FROM relationships r 
          JOIN users u ON r.user_id_2 = u.id 
          WHERE r.user_id_1 = ?
        `).all(aiUser.id) as any[];
        const relStr = rels.map(r => `${r.display_name}: ${r.description}`).join(", ");

        const isFirstPost = (db.prepare("SELECT COUNT(*) as count FROM posts WHERE user_id = ?").get(aiUser.id) as any).count === 0;
        const archetype = pickArchetype(isFirstPost, isImage);
        const allUsers = db.prepare("SELECT username FROM users WHERE id != ?").all(aiUser.id) as any[];
        const availableUsernames = allUsers.map(u => u.username).join(', ');
        const postContent = await generatePost(aiUser, contextStr, relStr, archetype, availableUsernames, isFirstPost);
        if (postContent) {
          const info = db.prepare("INSERT INTO posts (user_id, content, post_type) VALUES (?, ?, ?)").run(aiUser.id, postContent, archetype.id);
          const postId = info.lastInsertRowid;
          console.log(`${aiUser.display_name} created a post (${archetype.id})`);

          if (isFirstPost) {
            db.prepare("UPDATE users SET is_active = 1 WHERE id = ?").run(aiUser.id);
          }

          if (archetype.id === 'image_post') {
            try {
              const imagePrompt = await generateImagePrompt(aiUser, postContent);
              const imageUrl = await generateImage(imagePrompt);
              if (imageUrl) {
                db.prepare("UPDATE posts SET image_url = ?, image_prompt = ? WHERE id = ?").run(imageUrl, imagePrompt, postId);
                console.log(`Image attached to post ${postId} by ${aiUser.display_name}`);
              }
            } catch (err) {
              console.error("Failed to generate image for auto post", postId, err);
            }
          }

          if (archetype.id === 'event' || archetype.id === 'meetup') {
            // Trigger other characters to react
            const count = archetype.id === 'event' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 4) + 1;
            const otherAis = activeAiUsers.filter(u => u.id !== aiUser.id);
            if (otherAis.length > 0) {
              const selectedAis = [];
              let availableAis = [...otherAis];
              for (let i = 0; i < count && availableAis.length > 0; i++) {
                const picked = pickWeightedRandomUser(availableAis);
                selectedAis.push(picked);
                availableAis = availableAis.filter(u => u.id !== picked.id);
              }
              
              // These characters will comment on the post shortly
              for (const otherAi of selectedAis) {
                setTimeout(async () => {
                  const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(otherAi.id, aiUser.id) as any;
                  const relContext = rel ? rel.description : '';
                  const post = db.prepare("SELECT created_at FROM posts WHERE id = ?").get(postId) as any;
                  const commentContent = await generateComment(otherAi, postContent, aiUser.display_name, '', false, relContext, aiUser.id, undefined, post?.created_at);
                  if (commentContent) {
                    db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
                      .run(postId, otherAi.id, commentContent);
                    console.log(`${otherAi.display_name} reacted to ${archetype.id} by ${aiUser.display_name}`);
                  }
                }, 5000 + Math.random() * 30000);
              }
            }
          }

          triggerPostComments(postId, archetype.id);
        }
      };

      if (Math.random() < probMessage && activeAiUsers.length > 0) {
        const realUser = db.prepare("SELECT * FROM users WHERE is_ai = 0").get() as any;
        if (realUser) {
          let randomAi: any;
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          
          // 50% chance to pick someone who talked in the last 7 days
          if (Math.random() < 0.5) {
            const recentContacts = db.prepare(`
              SELECT DISTINCT u.* 
              FROM users u
              JOIN direct_messages dm ON (dm.sender_id = u.id AND dm.receiver_id = ?) 
                                     OR (dm.sender_id = ? AND dm.receiver_id = u.id)
              WHERE u.is_ai = 1 AND u.is_active = 1 AND dm.created_at > ?
            `).all(realUser.id, realUser.id, sevenDaysAgo) as any[];

            if (recentContacts.length > 0) {
              randomAi = pickWeightedRandomUser(recentContacts);
            } else {
              randomAi = pickWeightedRandomUser(activeAiUsers);
            }
          } else {
            randomAi = pickWeightedRandomUser(activeAiUsers);
          }

          const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, realUser.id) as any;
          const relContext = rel ? rel.description : '';
          
          // Fetch message history
          const messageHistory = db.prepare(`
            SELECT sender_id, content, created_at 
            FROM direct_messages 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
            ORDER BY created_at ASC
          `).all(randomAi.id, realUser.id, realUser.id, randomAi.id).map((m: any) => ({
            role: m.sender_id === randomAi.id ? 'assistant' : 'user',
            content: m.content,
            created_at: m.created_at
          }));

          const dmContent = await generateDM(randomAi, realUser.display_name, relContext, realUser.id, '', messageHistory);
          if (dmContent) {
            db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
              .run(randomAi.id, realUser.id, dmContent.trim());
            console.log(`${randomAi.display_name} sent a DM to real_user`);
          }
        }
      } 

      // Handle unreplied DMs from real user
      const realUser = db.prepare("SELECT id, display_name FROM users WHERE is_ai = 0").get() as any;
      if (realUser && activeAiUsers.length > 0) {
        const unrepliedDms = db.prepare(`
          SELECT dm.*, u.online_times
          FROM direct_messages dm
          JOIN users u ON dm.receiver_id = u.id
          WHERE dm.receiver_id IN (SELECT id FROM users WHERE is_ai = 1 AND is_active = 1)
          AND dm.sender_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM direct_messages reply 
            WHERE reply.sender_id = dm.receiver_id AND reply.receiver_id = dm.sender_id AND reply.id > dm.id
          )
        `).all(realUser.id) as any[];

        const onlineUnrepliedDms = unrepliedDms.filter(dm => isUserOnline(dm, settings.timezone || 'UTC'));
        
        for (const dm of onlineUnrepliedDms) {
          if (Math.random() < 0.5) { // 50% chance to reply per worker tick to not spam
            const aiUser = activeAiUsers.find(u => u.id === dm.receiver_id);
            if (aiUser) {
              const history = db.prepare(`
                SELECT sender_id, content, created_at FROM direct_messages
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                ORDER BY created_at DESC LIMIT 10
              `).all(realUser.id, aiUser.id, aiUser.id, realUser.id).reverse();

              const formattedHistory = history.map((msg: any) => ({
                role: msg.sender_id === aiUser.id ? 'assistant' : 'user',
                content: msg.content,
                created_at: msg.created_at
              }));

              const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(aiUser.id, realUser.id) as any;
              const relContext = rel ? rel.description : '';

              const reply = await replyToDM(aiUser, realUser.display_name, formattedHistory, relContext, realUser.id, true);
              if (reply) {
                db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
                  .run(aiUser.id, realUser.id, reply);
                console.log(`${aiUser.display_name} replied to pending DM from real_user`);
              }
            }
          }
        }
      }
      
      if (Math.random() < probPost && allAiUsers.length > 0) {
        const onlineAiUsers = allAiUsers.filter(u => isUserOnline(u, settings.timezone || 'UTC'));
        if (onlineAiUsers.length > 0) {
          const randomAi = pickWeightedRandomUser(onlineAiUsers);
          await doAiPost(randomAi, false);
        }
      }
      
      if (Math.random() < probImagePost && allAiUsers.length > 0) {
        const onlineAiUsers = allAiUsers.filter(u => isUserOnline(u, settings.timezone || 'UTC'));
        if (onlineAiUsers.length > 0) {
          const randomAi = pickWeightedRandomUser(onlineAiUsers);
          await doAiPost(randomAi, true);
        }
      }

      // Handle Group Chat Replies (AI talking to AI or continuing conversation)
      if (Math.random() < 0.3 && activeAiUsers.length > 0) {
        // Find a recent group chat
        const recentGroups = db.prepare(`
          SELECT gc.id, gc.name, MAX(gcm.created_at) as last_msg_time
          FROM group_chats gc
          JOIN group_chat_messages gcm ON gc.id = gcm.group_chat_id
          GROUP BY gc.id
          ORDER BY last_msg_time DESC LIMIT 5
        `).all() as any[];

        if (recentGroups.length > 0) {
          const group = recentGroups[Math.floor(Math.random() * recentGroups.length)];
          
          // Get members
          const members = db.prepare(`
            SELECT u.* FROM users u
            JOIN group_chat_members gcm ON u.id = gcm.user_id
            WHERE gcm.group_chat_id = ? AND u.is_ai = 1 AND u.is_active = 1
          `).all(group.id) as any[];

          const onlineMembers = members.filter(m => isUserOnline(m, settings.timezone || 'UTC'));
          
          if (onlineMembers.length > 0) {
            // Pick an AI to reply based on activity level
            const totalActivity = onlineMembers.reduce((sum, m) => sum + (m.activity_level ?? 5), 0);
            let random = Math.random() * totalActivity;
            let selectedAi = onlineMembers[0];
            for (const m of onlineMembers) {
              random -= (m.activity_level ?? 5);
              if (random <= 0) {
                selectedAi = m;
                break;
              }
            }

            // Check if the last message was already from this AI
            const lastMsg = db.prepare("SELECT sender_id FROM group_chat_messages WHERE group_chat_id = ? ORDER BY created_at DESC LIMIT 1").get(group.id) as any;
            
            if (lastMsg && lastMsg.sender_id !== selectedAi.id) {
              const history = db.prepare(`
                SELECT m.sender_id, m.content, u.display_name, m.created_at
                FROM group_chat_messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.group_chat_id = ?
                ORDER BY m.created_at DESC LIMIT 15
              `).all(group.id).reverse();

              const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
              const formattedHistory = history.map((msg: any) => ({
                role: msg.sender_id === realUser?.id ? 'user' : 'assistant',
                content: `[${msg.created_at}] [${msg.display_name}]: ${msg.content}`
              }));

              const otherMembers = db.prepare(`
                SELECT u.* FROM users u
                JOIN group_chat_members gcm ON u.id = gcm.user_id
                WHERE gcm.group_chat_id = ? AND u.id != ?
              `).all(group.id, selectedAi.id) as any[];

              const reply = await generateGroupChatReply(selectedAi, group.name, formattedHistory, otherMembers);
              if (reply) {
                db.prepare("INSERT INTO group_chat_messages (group_chat_id, sender_id, content) VALUES (?, ?, ?)")
                  .run(group.id, selectedAi.id, reply);
                console.log(`${selectedAi.display_name} replied in group chat ${group.name}`);
              }
            }
          }
        }
      }
      
      // Handle mentions
      const unrepliedMentions = db.prepare(`
        SELECT p.id as post_id, NULL as comment_id, p.content, u.id as ai_user_id, p.user_id as author_id, u.online_times
        FROM posts p
        JOIN users u ON p.content LIKE '%@' || u.username || '%'
        WHERE u.is_ai = 1 AND u.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.user_id = u.id AND c.parent_id IS NULL
        )
        UNION ALL
        SELECT c.post_id, c.id as comment_id, c.content, u.id as ai_user_id, c.user_id as author_id, u.online_times
        FROM comments c
        JOIN users u ON c.content LIKE '%@' || u.username || '%'
        WHERE u.is_ai = 1 AND u.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM comments c2 WHERE c2.parent_id = c.id AND c2.user_id = u.id
        )
      `).all() as any[];

      const onlineMentions = unrepliedMentions.filter(m => isUserOnline(m, settings.timezone || 'UTC'));

      let handledMention = false;
      if (onlineMentions.length > 0 && Math.random() < 0.8 && activeAiUsers.length > 0) { // 80% chance to prioritize a mention if one exists
        const mention = onlineMentions[Math.floor(Math.random() * onlineMentions.length)];
        const randomAi = activeAiUsers.find(u => u.id === mention.ai_user_id);
        if (randomAi && mention.author_id !== randomAi.id) {
          handledMention = true;
          
          if (mention.comment_id) {
            // Reply to comment
            const commentData = db.prepare(`
              SELECT c.*, u.display_name as author_name, p.content as post_content
              FROM comments c
              JOIN users u ON c.user_id = u.id
              JOIN posts p ON c.post_id = p.id
              WHERE c.id = ?
            `).get(mention.comment_id) as any;
            
            if (commentData) {
              const threadContext = buildThreadContext(mention.comment_id);
              
              const rels = db.prepare(`
                SELECT u.display_name, r.description 
                FROM relationships r 
                JOIN users u ON r.user_id_2 = u.id 
                WHERE r.user_id_1 = ? AND r.user_id_2 = ?
              `).all(randomAi.id, commentData.user_id) as any[];
              const relStr = rels.length > 0 ? rels[0].description : '';

              const commentContent = await generateComment(randomAi, commentData.content, commentData.author_name, threadContext, true, relStr, commentData.user_id, undefined, commentData.created_at);
              if (commentContent) {
                const info = db.prepare("INSERT INTO comments (post_id, user_id, parent_id, content) VALUES (?, ?, ?, ?)").run(commentData.post_id, randomAi.id, commentData.id, commentContent);
                console.log(`${randomAi.display_name} replied to mention in comment ${commentData.id}`);

                // Add 1-5 likes to the comment being replied to
                addLikesToPostOrComment(commentData.post_id, commentData.id, Math.floor(Math.random() * 5) + 1);

                const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
                if (realUser && commentData.user_id === realUser.id) {
                  db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'reply', ?)")
                    .run(realUser.id, randomAi.id, info.lastInsertRowid);
                }
              }
            }
          } else {
            // Reply to post
            const postData = db.prepare(`
              SELECT p.*, u.display_name as author_name, u.bio as author_bio
              FROM posts p 
              JOIN users u ON p.user_id = u.id 
              WHERE p.id = ?
            `).get(mention.post_id) as any;

            if (postData) {
              const otherComments = db.prepare("SELECT c.content, u.display_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.post_id = ? AND c.parent_id IS NULL").all(mention.post_id) as any[];
              const commentsStr = otherComments.map(c => `${c.display_name}: ${c.content}`).join(" | ");
              
              const rels = db.prepare(`
                SELECT u.display_name, r.description 
                FROM relationships r 
                JOIN users u ON r.user_id_2 = u.id 
                WHERE r.user_id_1 = ? AND r.user_id_2 = ?
              `).all(randomAi.id, postData.user_id) as any[];
              const relStr = rels.length > 0 ? rels[0].description : '';

              const commentContent = await generateComment(randomAi, postData.content, postData.author_name, commentsStr, false, relStr, postData.user_id, postData.image_prompt, postData.created_at);
              if (commentContent) {
                const info = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)").run(postData.id, randomAi.id, commentContent);
                console.log(`${randomAi.display_name} replied to mention in post ${postData.id}`);

                // Add 1-5 likes to the post being replied to
                addLikesToPostOrComment(postData.id, null, Math.floor(Math.random() * 5) + 1);

                const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
                if (realUser && postData.user_id === realUser.id) {
                  db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'comment', ?)")
                    .run(realUser.id, randomAi.id, info.lastInsertRowid);
                }
              }
            }
          }
        }
      }

      if (!handledMention && Math.random() < probComment && activeAiUsers.length > 0) {
        // Pick a recent post or comment to reply to
        const recentPosts = db.prepare(`
          SELECT p.*, u.display_name as author_name, u.bio as author_bio,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          ORDER BY p.created_at DESC LIMIT 10
        `).all() as any[];
        
        const recentPostIds = recentPosts.map(p => p.id);
        const placeholders = recentPostIds.map(() => '?').join(',');
        
        let recentComments: any[] = [];
        if (recentPostIds.length > 0) {
          recentComments = db.prepare(`
            SELECT c.*, u.display_name as author_name, p.content as post_content,
            (SELECT COUNT(*) FROM comments WHERE parent_id = c.id) as reply_count
            FROM comments c
            JOIN users u ON c.user_id = u.id
            JOIN posts p ON c.post_id = p.id
            WHERE c.post_id IN (${placeholders})
            ORDER BY c.created_at DESC LIMIT 30
          `).all(...recentPostIds) as any[];
        }

        let weightedItems: any[] = [];
        
        recentPosts.forEach((post, index) => {
          let weight = Math.max(1, 10 - Math.floor(index / 2));
          if (post.post_type === 'question') weight *= 3;
          if (post.post_type === 'discussion') weight *= 5;
          if (post.post_type === 'shitpost') weight *= 2;
          if (post.post_type === 'mention') weight *= 2;
          if (post.post_type === 'dm_invitation') weight *= 2;
          for (let i = 0; i < weight; i++) {
            weightedItems.push({ type: 'post', data: post });
          }
        });

        recentComments.forEach((comment, index) => {
          // Check thread depth
          let depth = 1;
          let currentComment = comment;
          while (currentComment.parent_id) {
            depth++;
            currentComment = db.prepare("SELECT parent_id FROM comments WHERE id = ?").get(currentComment.parent_id) as any;
            if (!currentComment) break;
          }
          if (depth >= 5) return; // Limit thread to 5 levels

          const weight = Math.max(1, 5 - Math.floor(index / 6));
          for (let i = 0; i < weight; i++) {
            weightedItems.push({ type: 'comment', data: comment });
          }
        });

        let choice: any = null;
        let availableAis: any[] = [];
        let attempts = 0;

        while (weightedItems.length > 0 && attempts < 10) {
          attempts++;
          const choiceIndex = Math.floor(Math.random() * weightedItems.length);
          choice = weightedItems[choiceIndex];
          
          if (choice.type === 'post' && choice.data.post_type === 'dm_invitation') {
            const otherAiUsers = activeAiUsers.filter(u => u.id !== choice.data.user_id);
            if (otherAiUsers.length > 0) {
              const randomAi = pickWeightedRandomUser(otherAiUsers);
              const author = db.prepare("SELECT * FROM users WHERE id = ?").get(choice.data.user_id) as any;
              const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, author.id) as any;
              const relContext = rel ? rel.description : '';
              const dmContext = `You saw their post: "${choice.data.content}" and decided to DM them about it.`;
              
              // Fetch message history
              const messageHistory = db.prepare(`
                SELECT sender_id, content, created_at 
                FROM direct_messages 
                WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
                ORDER BY created_at ASC
              `).all(randomAi.id, author.id, author.id, randomAi.id).map((m: any) => ({
                role: m.sender_id === randomAi.id ? 'assistant' : 'user',
                content: m.content,
                created_at: m.created_at
              }));

              const dmContent = await generateDM(randomAi, author.display_name, relContext, author.id, dmContext, messageHistory);
              if (dmContent) {
                db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
                  .run(randomAi.id, author.id, dmContent);
                console.log(`${randomAi.display_name} sent a DM to ${author.display_name} in response to a dm_invitation post`);
              }
            }
            return;
          }

          const targetUserId = choice.data.user_id;
          
          let existingRepliers: number[] = [];
          if (choice.type === 'post') {
            existingRepliers = db.prepare("SELECT user_id FROM comments WHERE post_id = ? AND parent_id IS NULL").all(choice.data.id).map((r: any) => r.user_id);
          } else {
            existingRepliers = db.prepare("SELECT user_id FROM comments WHERE parent_id = ?").all(choice.data.id).map((r: any) => r.user_id);
          }

          availableAis = activeAiUsers.filter(u => u.id !== targetUserId && !existingRepliers.includes(u.id));

          if (availableAis.length > 0) {
            break; // Found a valid choice with available AIs
          } else {
            // Remove this choice from weightedItems and try again
            weightedItems = weightedItems.filter(item => item.data.id !== choice.data.id || item.type !== choice.type);
            choice = null;
          }
        }

        if (choice && availableAis.length > 0) {
          // Now pick the best commenter
          const chosenAiId = await pickBestCommenter(choice.data, availableAis);
          const randomAi = availableAis.find(u => u.id === chosenAiId) || availableAis[0];

          if (choice.type === 'post') {
            const randomPost = choice.data;
            // Get other comments for context
            const otherComments = db.prepare("SELECT content, created_at FROM comments WHERE post_id = ? LIMIT 5").all(randomPost.id).map((c: any) => `[${c.created_at}] ${c.content}`).join(" | ");
            
            // Get relationship context
            const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, randomPost.user_id) as any;
            const relContext = rel ? rel.description : '';

            const commentContent = await generateComment(randomAi, randomPost.content, randomPost.author_name, otherComments, false, relContext, randomPost.user_id, randomPost.image_prompt, randomPost.created_at);
            if (commentContent) {
              const info = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
                .run(randomPost.id, randomAi.id, commentContent);
              console.log(`${randomAi.display_name} commented on post ${randomPost.id}`);

              // Add 1-5 likes to the post
              addLikesToPostOrComment(randomPost.id, null, Math.floor(Math.random() * 5) + 1);

              // Notify real user if they own the post
              const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
              if (realUser && randomPost.user_id === realUser.id) {
                db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'comment', ?)")
                  .run(realUser.id, randomAi.id, info.lastInsertRowid);
              }
            }
          } else {
            const randomComment = choice.data;
            // Get relationship context
            const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, randomComment.user_id) as any;
            const relContext = rel ? rel.description : '';

            const threadContext = buildThreadContext(randomComment.id);

            const replyContent = await generateComment(randomAi, randomComment.content, randomComment.author_name, threadContext, true, relContext, randomComment.user_id, undefined, randomComment.created_at);
            if (replyContent) {
              const info = db.prepare("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)")
                .run(randomComment.post_id, randomAi.id, replyContent, randomComment.id);
              console.log(`${randomAi.display_name} replied to comment ${randomComment.id}`);

              // Add 1-5 likes to the comment
              addLikesToPostOrComment(randomComment.post_id, randomComment.id, Math.floor(Math.random() * 5) + 1);

              // Notify real user if they own the comment
              const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
              if (realUser && randomComment.user_id === realUser.id) {
                db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'reply', ?)")
                  .run(realUser.id, randomAi.id, info.lastInsertRowid);
              }
            }
          }
        }
      }
      
      // Clean up old API logs
      db.prepare("DELETE FROM api_logs WHERE created_at < datetime('now', '-1 day')").run();
    } catch (error) {
      console.error("Error in AI worker:", error);
    }
  }, 60000); // Every 60 seconds

  app.get("/api/logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM api_logs ORDER BY created_at DESC LIMIT 50").all();
    res.json(logs);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
