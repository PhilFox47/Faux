import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import db, { initDb } from "./src/db";
import { generatePost, generateComment, generateDM, replyToDM, testConnection, generatePersona, generateImage } from "./src/ai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
    const { ai_enabled, model_name, timezone, api_key } = req.body;
    if (ai_enabled !== undefined) {
      db.prepare("UPDATE settings SET ai_enabled = ? WHERE id = 1").run(ai_enabled ? 1 : 0);
    }
    if (model_name !== undefined) {
      db.prepare("UPDATE settings SET model_name = ? WHERE id = 1").run(model_name);
    }
    if (timezone !== undefined) {
      db.prepare("UPDATE settings SET timezone = ? WHERE id = 1").run(timezone);
    }
    if (api_key !== undefined) {
      db.prepare("UPDATE settings SET api_key = ? WHERE id = 1").run(api_key);
    }
    res.json({ success: true });
  });

  app.post("/api/reset-db", (req, res) => {
    try {
      db.prepare("DELETE FROM comment_likes").run();
      db.prepare("DELETE FROM likes").run();
      db.prepare("DELETE FROM comments").run();
      db.prepare("DELETE FROM direct_messages").run();
      db.prepare("DELETE FROM notifications").run();
      db.prepare("DELETE FROM posts").run();
      db.prepare("DELETE FROM follows").run();
      db.prepare("DELETE FROM user_tags").run();
      db.prepare("DELETE FROM users WHERE username != 'real_user'").run();
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
      const tags = db.prepare("SELECT name FROM tags").all().map((t: any) => t.name);
      
      const persona = await generatePersona(name, extraInfo, tags);
      res.json(persona);
    } catch (e: any) {
      console.error("Error in generate-persona:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Users
  app.get("/api/users", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    const users = db.prepare(`
      SELECT u.*, 
      (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND followed_id = u.id) as is_followed,
      (SELECT json_group_array(t.name) FROM user_tags ut JOIN tags t ON ut.tag_id = t.id WHERE ut.user_id = u.id) as tags
      FROM users u ORDER BY u.created_at DESC
    `).all(user?.id || 0);
    
    const parsedUsers = users.map((u: any) => ({
      ...u,
      tags: u.tags ? JSON.parse(u.tags).filter((t: any) => t !== null) : []
    }));
    
    res.json(parsedUsers);
  });

  app.get("/api/tags", (req, res) => {
    const tags = db.prepare("SELECT name FROM tags ORDER BY name ASC").all();
    res.json(tags.map((t: any) => t.name));
  });

  app.put("/api/users/:id", (req, res) => {
    const { display_name, username, bio, avatar_url, description, writing_style, physical_appearance, clothing_style, tags } = req.body;
    try {
      db.prepare(`
        UPDATE users 
        SET display_name = ?, username = ?, bio = ?, avatar_url = ?, description = ?, writing_style = ?, physical_appearance = ?, clothing_style = ?
        WHERE id = ?
      `).run(display_name, username, bio, avatar_url, description, writing_style, physical_appearance, clothing_style, req.params.id);

      if (tags && Array.isArray(tags)) {
        db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(req.params.id);
        const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
        const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
        const insertUserTag = db.prepare("INSERT INTO user_tags (user_id, tag_id) VALUES (?, ?)");
        
        for (const tag of tags) {
          insertTag.run(tag);
          const tagRecord = getTag.get(tag) as any;
          if (tagRecord) {
            insertUserTag.run(req.params.id, tagRecord.id);
          }
        }
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/users", (req, res) => {
    const { username, display_name, bio, avatar_url, ai_persona, description, writing_style, physical_appearance, clothing_style, tags } = req.body;
    try {
      const stmt = db.prepare(`
        INSERT INTO users (username, display_name, bio, avatar_url, is_ai, ai_persona, description, writing_style, physical_appearance, clothing_style)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(username, display_name, bio, avatar_url, ai_persona, description, writing_style, physical_appearance, clothing_style);
      const userId = info.lastInsertRowid;
      
      if (tags && Array.isArray(tags)) {
        const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
        const getTag = db.prepare("SELECT id FROM tags WHERE name = ?");
        const insertUserTag = db.prepare("INSERT INTO user_tags (user_id, tag_id) VALUES (?, ?)");
        
        for (const tag of tags) {
          insertTag.run(tag);
          const tagRecord = getTag.get(tag) as any;
          if (tagRecord) {
            insertUserTag.run(userId, tagRecord.id);
          }
        }
      }

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
        SELECT p.content, u.display_name 
        FROM posts p JOIN users u ON p.user_id = u.id 
        ORDER BY p.created_at DESC LIMIT 5
      `).all() as any[];
      const contextStr = recentContext.map(p => p.content).join(" | ");
      
      const postContent = await generatePost(aiUser, contextStr);
      if (postContent) {
        let imageUrl = null;
        if (type === 'image') {
          const imagePrompt = `A picture taken by ${aiUser.display_name}. Context: ${postContent}. Style: realistic, social media photo.`;
          imageUrl = await generateImage(imagePrompt);
        }
        db.prepare("INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)")
          .run(aiUser.id, postContent, imageUrl);
        res.json({ success: true });
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

  app.post("/api/posts", (req, res) => {
    const { content } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    const stmt = db.prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)");
    const info = stmt.run(user.id, content);
    res.json({ id: info.lastInsertRowid });
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
    const postId = req.params.id;
    db.prepare("DELETE FROM comment_likes WHERE comment_id IN (SELECT id FROM comments WHERE post_id = ?)").run(postId);
    db.prepare("DELETE FROM comments WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM likes WHERE post_id = ?").run(postId);
    db.prepare("DELETE FROM notifications WHERE type = 'post_like' AND reference_id = ?").run(postId);
    db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
    res.json({ success: true });
  });

  app.put("/api/posts/:id", (req, res) => {
    const { content } = req.body;
    db.prepare("UPDATE posts SET content = ? WHERE id = ?").run(content, req.params.id);
    res.json({ success: true });
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
    const commentId = req.params.id;
    db.prepare("DELETE FROM comment_likes WHERE comment_id = ?").run(commentId);
    db.prepare("DELETE FROM comments WHERE parent_id = ?").run(commentId);
    db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
    res.json({ success: true });
  });

  app.put("/api/comments/:id", (req, res) => {
    const { content } = req.body;
    db.prepare("UPDATE comments SET content = ? WHERE id = ?").run(content, req.params.id);
    res.json({ success: true });
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

  // DMs
  app.get("/api/dms", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    // Get latest message per conversation
    const conversations = db.prepare(`
      SELECT 
        u.id as other_user_id, u.username, u.display_name, u.avatar_url,
        dm.content as last_message, dm.created_at, dm.is_read,
        dm.sender_id
      FROM users u
      JOIN direct_messages dm ON (dm.sender_id = u.id AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = u.id)
      WHERE dm.id IN (
        SELECT MAX(id) FROM direct_messages 
        WHERE sender_id = u.id OR receiver_id = u.id
        GROUP BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
      )
      AND u.id != ?
      ORDER BY dm.created_at DESC
    `).all(user.id, user.id, user.id, user.id);
    res.json(conversations);
  });

  app.get("/api/dms/:userId", (req, res) => {
    const user = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
    if (!user) return res.status(401).json({ error: "User not found" });

    const messages = db.prepare(`
      SELECT * FROM direct_messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `).all(user.id, req.params.userId, req.params.userId, user.id);
    
    // Mark as read
    db.prepare("UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0")
      .run(req.params.userId, user.id);

    res.json(messages);
  });

  app.post("/api/dms/:userId", async (req, res) => {
    try {
      const { content } = req.body;
      const user = db.prepare("SELECT id, display_name FROM users WHERE is_ai = 0").get() as any;
      if (!user) return res.status(401).json({ error: "User not found" });

      const receiverId = req.params.userId;
      db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
        .run(user.id, receiverId, content);
      
      res.json({ success: true });

      // AI Reply logic
      const receiver = db.prepare("SELECT * FROM users WHERE id = ? AND is_ai = 1").get(receiverId) as any;
      if (receiver) {
        // Get recent history
        const history = db.prepare(`
          SELECT sender_id, content FROM direct_messages
          WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
          ORDER BY created_at DESC LIMIT 10
        `).all(user.id, receiverId, receiverId, user.id).reverse();

        const formattedHistory = history.map((msg: any) => ({
          role: msg.sender_id === receiverId ? 'assistant' : 'user',
          content: msg.content
        }));

        const reply = await replyToDM(receiver, user.display_name, formattedHistory);
        if (reply) {
          db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
            .run(receiverId, user.id, reply);
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
      const settings = db.prepare("SELECT ai_enabled FROM settings WHERE id = 1").get() as any;
      if (!settings || !settings.ai_enabled) return;

      const aiUsers = db.prepare("SELECT * FROM users WHERE is_ai = 1").all() as any[];
      if (aiUsers.length === 0) return;

      const randomAi = aiUsers[Math.floor(Math.random() * aiUsers.length)];
      const roll = Math.random();

      console.log(`AI Worker running for ${randomAi.display_name}. Roll: ${roll}`);

      // Local actions (Likes & Follows) - Doesn't use API tokens
      if (Math.random() < 0.3) {
        // 30% chance to do some local actions
        const recentPosts = db.prepare("SELECT id, user_id FROM posts ORDER BY created_at DESC LIMIT 50").all() as any[];
        if (recentPosts.length > 0) {
          const postToLike = recentPosts[Math.floor(Math.random() * recentPosts.length)];
          try {
            db.prepare("INSERT INTO likes (post_id, user_id) VALUES (?, ?)").run(postToLike.id, randomAi.id);
            // Notify real user if they own the post
            const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
            if (realUser && postToLike.user_id === realUser.id) {
              db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'like_post', ?)")
                .run(realUser.id, randomAi.id, postToLike.id);
            }
          } catch (e) {} // Already liked
        }

        const recentComments = db.prepare("SELECT id, user_id FROM comments ORDER BY created_at DESC LIMIT 50").all() as any[];
        if (recentComments.length > 0) {
          const commentToLike = recentComments[Math.floor(Math.random() * recentComments.length)];
          try {
            db.prepare("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)").run(commentToLike.id, randomAi.id);
            // Notify real user if they own the comment
            const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
            if (realUser && commentToLike.user_id === realUser.id) {
              db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'like_comment', ?)")
                .run(realUser.id, randomAi.id, commentToLike.id);
            }
          } catch (e) {} // Already liked
        }

        // Randomly follow someone
        const otherAiUsers = aiUsers.filter(u => u.id !== randomAi.id);
        if (otherAiUsers.length > 0) {
          let userToFollow = otherAiUsers[Math.floor(Math.random() * otherAiUsers.length)];
          
          // Try to find someone with shared tags
          const aiTags = db.prepare("SELECT tag_id FROM user_tags WHERE user_id = ?").all(randomAi.id).map((t: any) => t.tag_id);
          if (aiTags.length > 0) {
            const placeholders = aiTags.map(() => '?').join(',');
            const similarUsers = db.prepare(`
              SELECT user_id, COUNT(*) as shared_tags 
              FROM user_tags 
              WHERE tag_id IN (${placeholders}) AND user_id != ?
              GROUP BY user_id 
              ORDER BY shared_tags DESC 
              LIMIT 5
            `).all(...aiTags, randomAi.id) as any[];
            
            if (similarUsers.length > 0) {
              // 70% chance to pick from similar users
              if (Math.random() < 0.7) {
                const pickedSimilar = similarUsers[Math.floor(Math.random() * similarUsers.length)];
                const foundUser = otherAiUsers.find(u => u.id === pickedSimilar.user_id);
                if (foundUser) userToFollow = foundUser;
              }
            }
          }

          try {
            db.prepare("INSERT INTO follows (follower_id, followed_id) VALUES (?, ?)").run(randomAi.id, userToFollow.id);
          } catch (e) {} // Already following
        }
      }

      const doAiPost = async (aiUser: any) => {
        const recentContext = db.prepare("SELECT content FROM posts ORDER BY created_at DESC LIMIT 3").all() as any[];
        const contextStr = recentContext.map(p => p.content).join(" | ");
        
        const postContent = await generatePost(aiUser, contextStr);
        if (postContent) {
          let imageUrl = null;
          if (Math.random() < 0.3) {
            const imagePrompt = `A picture taken by ${aiUser.display_name}. Context: ${postContent}. Style: realistic, social media photo.`;
            imageUrl = await generateImage(imagePrompt);
          }
          db.prepare("INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)")
            .run(aiUser.id, postContent, imageUrl);
          console.log(`${aiUser.display_name} created a post`);
        }
      };

      if (roll < 0.0025) {
        // 0.25% chance to DM (approx 3-4 times a day if running every minute)
        const realUser = db.prepare("SELECT * FROM users WHERE is_ai = 0").get() as any;
        if (realUser) {
          const dmContent = await generateDM(randomAi, realUser.display_name);
          if (dmContent) {
            db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
              .run(randomAi.id, realUser.id, dmContent);
            console.log(`${randomAi.display_name} sent a DM to real_user`);
          }
        }
      } else if (roll < 0.0725) {
        // 7% chance to Post (approx 100 posts a day)
        await doAiPost(randomAi);
      } else {
        // ~92.75% chance to Comment (approx 1335 comments a day, ~13 per post)
        // Weight newer posts higher and check if already commented
        const recentPosts = db.prepare(`
          SELECT p.*, u.display_name as author_name,
          (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND followed_id = p.user_id) as is_followed,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND user_id = ?) as already_commented
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          WHERE p.user_id != ? -- Don't comment on own posts
          ORDER BY p.created_at DESC LIMIT 50
        `).all(randomAi.id, randomAi.id, randomAi.id) as any[];
        
        if (recentPosts.length > 0) {
          // Simple weighting: newer posts (lower index) get more entries in the selection array
          // Also exclude posts already commented on unless we want to reply to a comment
          let weightedPosts: any[] = [];
          recentPosts.forEach((post, index) => {
            if (post.already_commented > 0) return; // Only one top-level comment per post

            const weight = Math.max(1, 10 - Math.floor(index / 5)); // Newer posts get more weight
            const followBonus = post.is_followed ? 3 : 1;
            
            for (let i = 0; i < weight * followBonus; i++) {
              weightedPosts.push({ type: 'post', data: post });
            }
          });

          // Also consider replying to existing comments
          const recentComments = db.prepare(`
            SELECT c.*, u.display_name as author_name, p.content as post_content,
            (SELECT COUNT(*) FROM comments WHERE parent_id = c.id AND user_id = ?) as already_replied
            FROM comments c
            JOIN users u ON c.user_id = u.id
            JOIN posts p ON c.post_id = p.id
            WHERE c.user_id != ? -- Don't reply to own comments
            ORDER BY c.created_at DESC LIMIT 30
          `).all(randomAi.id, randomAi.id) as any[];

          recentComments.forEach((comment, index) => {
            if (comment.already_replied > 0) return; // Only reply to a comment once
            
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
              weightedPosts.push({ type: 'comment', data: comment });
            }
          });

          if (weightedPosts.length > 0) {
            const choice = weightedPosts[Math.floor(Math.random() * weightedPosts.length)];
            
            let skipComment = false;
            let totalComments = 0;
            
            if (choice.type === 'post') {
              totalComments = (db.prepare("SELECT COUNT(*) as count FROM comments WHERE post_id = ?").get(choice.data.id) as any).count;
            } else {
              totalComments = (db.prepare("SELECT COUNT(*) as count FROM comments WHERE post_id = ?").get(choice.data.post_id) as any).count;
            }

            if (totalComments >= 20) {
              skipComment = Math.random() < 0.50;
            } else if (totalComments >= 10) {
              skipComment = Math.random() < 0.30;
            } else if (totalComments >= 5) {
              skipComment = Math.random() < 0.10;
            }

            if (skipComment) {
              console.log(`${randomAi.display_name} skipped commenting due to too many comments. Creating a post instead.`);
              await doAiPost(randomAi);
              return;
            }
            
            if (choice.type === 'post') {
              const randomPost = choice.data;
              // Get other comments for context
              const otherComments = db.prepare("SELECT content FROM comments WHERE post_id = ? LIMIT 5").all(randomPost.id).map((c: any) => c.content).join(" | ");
              
              const commentContent = await generateComment(randomAi, randomPost.content, randomPost.author_name, otherComments);
              if (commentContent) {
                db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
                  .run(randomPost.id, randomAi.id, commentContent);
                console.log(`${randomAi.display_name} commented on post ${randomPost.id}`);

                // Notify real user if they own the post
                const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
                if (realUser && randomPost.user_id === realUser.id) {
                  db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'comment', ?)")
                    .run(realUser.id, randomAi.id, randomPost.id);
                }
              }
            } else {
              const randomComment = choice.data;
              const replyContent = await generateComment(randomAi, randomComment.content, randomComment.author_name, "", true);
              if (replyContent) {
                db.prepare("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)")
                  .run(randomComment.post_id, randomAi.id, replyContent, randomComment.id);
                console.log(`${randomAi.display_name} replied to comment ${randomComment.id}`);

                // Notify real user if they own the comment
                const realUser = db.prepare("SELECT id FROM users WHERE is_ai = 0").get() as any;
                if (realUser && randomComment.user_id === realUser.id) {
                  db.prepare("INSERT INTO notifications (user_id, actor_id, type, reference_id) VALUES (?, ?, 'reply', ?)")
                    .run(realUser.id, randomAi.id, randomComment.post_id);
                }
              }
            }
          }
        }
      }
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
