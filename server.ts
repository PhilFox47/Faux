import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import db, { initDb } from "./src/db";
import { generatePost, generateComment, generateDM, replyToDM, testConnection, generatePersona, generateImage, generateImagePrompt, generateGroupChatReply, pickBestCommenter } from "./src/ai";

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
      db.prepare("DELETE FROM notifications").run();
      db.prepare("DELETE FROM posts").run();
      db.prepare("DELETE FROM follows").run();
      db.prepare("DELETE FROM user_tags").run();
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
      db.prepare("DELETE FROM notifications").run();
      db.prepare("DELETE FROM posts").run();
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
      (SELECT COUNT(*) FROM follows WHERE followed_id = u.id) as follower_count,
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
      db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(userId);
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
      
      const rels = db.prepare(`
        SELECT u.display_name, r.description 
        FROM relationships r 
        JOIN users u ON r.user_id_2 = u.id 
        WHERE r.user_id_1 = ?
      `).all(aiUser.id) as any[];
      const relStr = rels.map(r => `${r.display_name}: ${r.description}`).join(", ");

      const postContent = await generatePost(aiUser, contextStr, relStr, type === 'image');
      if (postContent) {
        const info = db.prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)").run(aiUser.id, postContent);
        const postId = info.lastInsertRowid;
        
        // Respond immediately so UI doesn't hang
        res.json({ success: true, postId });

        // Generate image in background
        if (type === 'image') {
          try {
            const imagePrompt = await generateImagePrompt(aiUser, postContent);
            const imageUrl = await generateImage(imagePrompt);
            if (imageUrl) {
              db.prepare("UPDATE posts SET image_url = ? WHERE id = ?").run(imageUrl, postId);
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

    const messages = db.prepare(`
      SELECT m.*, u.display_name, u.username, u.avatar_url
      FROM group_chat_messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_chat_id = ?
      ORDER BY m.created_at ASC
    `).all(req.params.id);
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
        WHERE gcm.group_chat_id = ? AND u.is_ai = 1
      `).all(groupId) as any[];

      const history = db.prepare(`
        SELECT m.sender_id, m.content, u.display_name
        FROM group_chat_messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.group_chat_id = ?
        ORDER BY m.created_at DESC LIMIT 15
      `).all(groupId).reverse();

      const formattedHistory = history.map((msg: any) => ({
        role: msg.sender_id === user.id ? 'user' : 'assistant',
        content: `[${msg.display_name}]: ${msg.content}`
      }));

      // Let each AI decide if they want to reply (e.g. 50% chance, or if mentioned)
      for (const aiUser of members) {
        const isMentioned = content.toLowerCase().includes(aiUser.display_name.toLowerCase()) || content.toLowerCase().includes(aiUser.username.toLowerCase());
        const shouldReply = isMentioned || Math.random() < 0.4;
        
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
              content: `[${aiUser.display_name}]: ${reply}`
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

        const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(receiverId, user.id) as any;
        const relContext = rel ? rel.description : '';

        const reply = await replyToDM(receiver, user.display_name, formattedHistory, relContext, user.id);
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
      const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
      if (!settings || !settings.ai_enabled) return;

      const aiUsers = db.prepare("SELECT * FROM users WHERE is_ai = 1").all() as any[];
      if (aiUsers.length === 0) return;

      const probPost = (settings.prob_post ?? 100) / 1440;
      const probImagePost = (settings.prob_image_post ?? 30) / 1440;
      const probComment = (settings.prob_comment ?? 1000) / 1440;
      const probMessage = (settings.prob_message ?? 5) / 1440;

      // Local actions (Likes & Follows) - Doesn't use API tokens
      if (Math.random() < 0.3) {
        const randomAi = aiUsers[Math.floor(Math.random() * aiUsers.length)];
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

      const doAiPost = async (aiUser: any, isImage: boolean) => {
        const recentContext = db.prepare("SELECT content FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 3").all(aiUser.id) as any[];
        const contextStr = recentContext.map(p => p.content).join(" | ");
        
        const rels = db.prepare(`
          SELECT u.display_name, r.description 
          FROM relationships r 
          JOIN users u ON r.user_id_2 = u.id 
          WHERE r.user_id_1 = ?
        `).all(aiUser.id) as any[];
        const relStr = rels.map(r => `${r.display_name}: ${r.description}`).join(", ");

        const postContent = await generatePost(aiUser, contextStr, relStr, isImage);
        if (postContent) {
          const info = db.prepare("INSERT INTO posts (user_id, content) VALUES (?, ?)").run(aiUser.id, postContent);
          const postId = info.lastInsertRowid;
          console.log(`${aiUser.display_name} created a post`);

          if (isImage) {
            try {
              const imagePrompt = await generateImagePrompt(aiUser, postContent);
              const imageUrl = await generateImage(imagePrompt);
              if (imageUrl) {
                db.prepare("UPDATE posts SET image_url = ? WHERE id = ?").run(imageUrl, postId);
                console.log(`Image attached to post ${postId} by ${aiUser.display_name}`);
              }
            } catch (err) {
              console.error("Failed to generate image for auto post", postId, err);
            }
          }
        }
      };

      if (Math.random() < probMessage) {
        const randomAi = aiUsers[Math.floor(Math.random() * aiUsers.length)];
        const realUser = db.prepare("SELECT * FROM users WHERE is_ai = 0").get() as any;
        if (realUser) {
          const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, realUser.id) as any;
          const relContext = rel ? rel.description : '';
          const dmContent = await generateDM(randomAi, realUser.display_name, relContext, realUser.id);
          if (dmContent) {
            db.prepare("INSERT INTO direct_messages (sender_id, receiver_id, content) VALUES (?, ?, ?)")
              .run(randomAi.id, realUser.id, dmContent);
            console.log(`${randomAi.display_name} sent a DM to real_user`);
          }
        }
      } 
      
      if (Math.random() < probPost) {
        const randomAi = aiUsers[Math.floor(Math.random() * aiUsers.length)];
        await doAiPost(randomAi, false);
      }
      
      if (Math.random() < probImagePost) {
        const randomAi = aiUsers[Math.floor(Math.random() * aiUsers.length)];
        await doAiPost(randomAi, true);
      }
      
      if (Math.random() < probComment) {
        // Pick a recent post or comment to reply to
        const recentPosts = db.prepare(`
          SELECT p.*, u.display_name as author_name, u.bio as author_bio,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
          FROM posts p 
          JOIN users u ON p.user_id = u.id 
          ORDER BY p.created_at DESC LIMIT 50
        `).all() as any[];
        
        const recentComments = db.prepare(`
          SELECT c.*, u.display_name as author_name, p.content as post_content,
          (SELECT COUNT(*) FROM comments WHERE parent_id = c.id) as reply_count
          FROM comments c
          JOIN users u ON c.user_id = u.id
          JOIN posts p ON c.post_id = p.id
          ORDER BY c.created_at DESC LIMIT 30
        `).all() as any[];

        let weightedItems: any[] = [];
        
        recentPosts.forEach((post, index) => {
          const weight = Math.max(1, 10 - Math.floor(index / 5));
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

        if (weightedItems.length > 0) {
          const choice = weightedItems[Math.floor(Math.random() * weightedItems.length)];
          
          let skipComment = false;
          let totalComments = choice.type === 'post' ? choice.data.comment_count : (db.prepare("SELECT COUNT(*) as count FROM comments WHERE post_id = ?").get(choice.data.post_id) as any).count;

          if (totalComments >= 20) {
            skipComment = Math.random() < 0.50;
          } else if (totalComments >= 10) {
            skipComment = Math.random() < 0.30;
          } else if (totalComments >= 5) {
            skipComment = Math.random() < 0.10;
          }

          if (skipComment) {
            const randomAi = aiUsers[Math.floor(Math.random() * aiUsers.length)];
            console.log(`${randomAi.display_name} skipped commenting due to too many comments. Creating a post instead.`);
            await doAiPost(randomAi, false);
            return;
          }
          
          // Now pick the best commenter
          const targetUserId = choice.type === 'post' ? choice.data.user_id : choice.data.user_id;
          const availableAis = aiUsers.filter(u => u.id !== targetUserId);
          
          if (availableAis.length > 0) {
            const chosenAiId = await pickBestCommenter(choice.data, availableAis);
            const randomAi = availableAis.find(u => u.id === chosenAiId) || availableAis[0];

            if (choice.type === 'post') {
              const randomPost = choice.data;
              // Get other comments for context
              const otherComments = db.prepare("SELECT content FROM comments WHERE post_id = ? LIMIT 5").all(randomPost.id).map((c: any) => c.content).join(" | ");
              
              // Get relationship context
              const rel = db.prepare("SELECT description FROM relationships WHERE user_id_1 = ? AND user_id_2 = ?").get(randomAi.id, randomPost.user_id) as any;
              const relContext = rel ? rel.description : '';

              const commentContent = await generateComment(randomAi, randomPost.content, randomPost.author_name, otherComments, false, relContext, randomPost.user_id);
              if (commentContent) {
                const info = db.prepare("INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)")
                  .run(randomPost.id, randomAi.id, commentContent);
                console.log(`${randomAi.display_name} commented on post ${randomPost.id}`);

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

              const replyContent = await generateComment(randomAi, randomComment.content, randomComment.author_name, "", true, relContext, randomComment.user_id);
              if (replyContent) {
                const info = db.prepare("INSERT INTO comments (post_id, user_id, content, parent_id) VALUES (?, ?, ?, ?)")
                  .run(randomComment.post_id, randomAi.id, replyContent, randomComment.id);
                console.log(`${randomAi.display_name} replied to comment ${randomComment.id}`);

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
