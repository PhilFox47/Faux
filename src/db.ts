import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'faux.db');
const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      bio TEXT,
      avatar_url TEXT,
      is_ai BOOLEAN DEFAULT 1,
      is_active BOOLEAN DEFAULT 0,
      ai_persona TEXT, -- Description of who they are impersonating
      online_times TEXT DEFAULT '[]', -- JSON array of time windows
      activity_level INTEGER DEFAULT 5, -- Scale of 1-10
      current_online_status INTEGER DEFAULT 0,
      status_expires_at INTEGER DEFAULT 0,
      dm_frequency TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      image_prompt TEXT,
      post_type TEXT DEFAULT 'life_update',
      event_id INTEGER,
      is_visible BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      participants TEXT NOT NULL, -- JSON array of user IDs
      remaining_participants TEXT NOT NULL, -- JSON array of user IDs who haven't posted yet
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      parent_id INTEGER DEFAULT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_id) REFERENCES comments(id)
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id INTEGER NOT NULL,
      followed_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, followed_id),
      FOREIGN KEY (follower_id) REFERENCES users(id),
      FOREIGN KEY (followed_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (actor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ai_enabled BOOLEAN DEFAULT 1,
      model_name TEXT DEFAULT 'zai-org/glm-5',
      image_model_name TEXT DEFAULT 'z-image-turbo',
      vision_model_name TEXT DEFAULT 'zai-org/glm-5-vision',
      timezone TEXT DEFAULT 'UTC',
      api_key TEXT DEFAULT '',
      prob_post REAL DEFAULT 100.0,
      prob_image_post REAL DEFAULT 30.0,
      prob_comment REAL DEFAULT 1000.0,
      prob_message REAL DEFAULT 5.0,
      prob_favorite_dm REAL DEFAULT 50.0,
      cross_universe_prob REAL DEFAULT 50.0,
      allow_nsfw BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS universes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id_1 INTEGER NOT NULL,
      user_id_2 INTEGER NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id_1) REFERENCES users(id),
      FOREIGN KEY (user_id_2) REFERENCES users(id),
      UNIQUE(user_id_1, user_id_2)
    );

    CREATE TABLE IF NOT EXISTS group_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_chat_members (
      group_chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_chat_id, user_id),
      FOREIGN KEY (group_chat_id) REFERENCES group_chats(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_chat_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_chat_id) REFERENCES group_chats(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      request_payload TEXT,
      response_payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS post_archetypes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      probability REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dm_favorites (
      user_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      is_group BOOLEAN NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, target_id, is_group),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS relationship_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id_1 INTEGER NOT NULL,
      user_id_2 INTEGER NOT NULL,
      interaction_threshold INTEGER NOT NULL,
      result BOOLEAN NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id_1, user_id_2, interaction_threshold),
      FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_is_visible ON posts(is_visible);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON comments(post_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
    CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_likes_post_user ON likes(post_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_user ON comment_likes(comment_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON direct_messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON direct_messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON direct_messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_follows_followed_id ON follows(followed_id);
    CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_relationships_user_1 ON relationships(user_id_1);
    CREATE INDEX IF NOT EXISTS idx_relationships_user_2 ON relationships(user_id_2);
    CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_chat_id ON group_chat_messages(group_chat_id);
    CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_chat_id_created_at ON group_chat_messages(group_chat_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_group_chat_messages_created_at ON group_chat_messages(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_group_chat_members_user_id ON group_chat_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_is_ai_is_active ON users(is_ai, is_active);
    CREATE INDEX IF NOT EXISTS idx_users_is_ai ON users(is_ai);
    CREATE INDEX IF NOT EXISTS idx_users_universe_id ON users(universe_id);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_receiver ON direct_messages(sender_id, receiver_id);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_sender ON direct_messages(receiver_id, sender_id);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_receiver_id ON direct_messages(sender_id, receiver_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_sender_id ON direct_messages(receiver_id, sender_id, id DESC);
  `);

  // Initialize default archetypes if table is empty
  const archetypeCount = db.prepare("SELECT COUNT(*) as count FROM post_archetypes").get() as any;
  if (archetypeCount.count === 0) {
    const defaultArchetypes = [
      { id: 'life_update', name: 'Life Update', description: 'A character posting about something they are doing or something they have experienced.', probability: 30 },
      { id: 'image_post', name: 'Image Post', description: 'A post that makes sense to have an image attached to it. The image should have a proper reason to be there.', probability: 15 },
      { id: 'question', name: 'Question', description: 'A Character asking a question.', probability: 10 },
      { id: 'random_thought', name: 'Random Thought', description: 'A random thought a character had they want to share on Faux.', probability: 10 },
      { id: 'discussion', name: 'Discussion', description: 'Similar to a Question, but with more arguing in the comments.', probability: 5 },
      { id: 'recommendation', name: 'Recommendation', description: 'A Character recommending a Book, TV Show, Movie and so on.', probability: 5 },
      { id: 'follow_up', name: 'Follow up', description: 'A character following up on a previous post. Sharing an update on their previous live update, thanking users for answering a previous question and so on. Always make sure it references a previous post of that character in some way.', probability: 5 },
      { id: 'picking_up_trend', name: 'Picking up a Trend', description: 'Check what other characters have been posing about recently. If you notice a pattern, comment on it or even continue the "Trend".', probability: 5 },
      { id: 'mention', name: 'Mention', description: 'A Character mentioning another character (with their @username) about something which leads to that mentioned character to react in a comment.', probability: 5 },
      { id: 'joke', name: 'Joke', description: 'A character making a joke, that fits their personality.', probability: 5 },
      { id: 'shitpost', name: 'Shitpost / Rage Bait', description: 'A shitpost or rage bait.', probability: 5 },
      { id: 'venting', name: 'Venting', description: 'A character venting about something that made them angry.', probability: 5 },
      { id: 'dm_invitation', name: 'DM Invitation', description: 'A Character mentions something and invites other users to contact them via DM.', probability: 2 },
      { id: 'event', name: 'Event', description: 'Something that affects multiple characters has happened and they are now reacting to it.', probability: 2 },
      { id: 'meetup', name: 'Meetup', description: 'A meetup between 2-5 characters. If they are from different universes, this MUST be a digital meetup (gaming, video call, etc). If they are from the same universe, it can be a real-world meetup.', probability: 2 }
    ];
    
    const insertArchetype = db.prepare("INSERT INTO post_archetypes (id, name, description, probability) VALUES (?, ?, ?, ?)");
    for (const arch of defaultArchetypes) {
      insertArchetype.run(arch.id, arch.name, arch.description, arch.probability);
    }
  } else {
    // Update meetup description for existing databases
    db.prepare("UPDATE post_archetypes SET description = ? WHERE id = 'meetup' AND description = 'A meetup between 2-5 characters.'").run('A meetup between 2-5 characters. If they are from different universes, this MUST be a digital meetup (gaming, video call, etc). If they are from the same universe, it can be a real-world meetup.');
  }

  // Add last_read_at column if it doesn't exist
  try {
    db.exec("ALTER TABLE group_chat_members ADD COLUMN last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  } catch (e) {
    // Column might already exist
  }

  // Add is_update column to relationship_checks if it doesn't exist
  try {
    db.exec("ALTER TABLE relationship_checks ADD COLUMN is_update BOOLEAN DEFAULT 0");
  } catch (e) {
    // Column might already exist
  }

  // Handle schema migrations for settings if model_name doesn't exist
  try {
    db.prepare('SELECT model_name FROM settings').get();
  } catch (e) {
    db.exec("ALTER TABLE settings ADD COLUMN model_name TEXT DEFAULT 'zai-org/glm-5'");
  }

  try {
    db.prepare('SELECT timezone FROM settings').get();
  } catch (e) {
    db.exec("ALTER TABLE settings ADD COLUMN timezone TEXT DEFAULT 'UTC'");
  }

  // Handle schema migrations for users
  try {
    db.prepare('SELECT universe_id FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN universe_id INTEGER REFERENCES universes(id)");
  }

  try {
    db.prepare('SELECT pin FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN pin TEXT");
  }

  try {
    db.prepare('SELECT role FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    db.exec("UPDATE users SET role = 'admin' WHERE id = 1");
  }

  try {
    db.prepare('SELECT description FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN description TEXT");
    db.exec("ALTER TABLE users ADD COLUMN writing_style TEXT");
  }

  try {
    db.prepare('SELECT physical_appearance FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN physical_appearance TEXT");
    db.exec("ALTER TABLE users ADD COLUMN clothing_style TEXT");
  }

  try {
    db.prepare('SELECT artstyle FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN artstyle TEXT");
  }

  try {
    db.prepare('SELECT is_active FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 0");
  }

  try {
    db.prepare('SELECT online_times FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN online_times TEXT DEFAULT '[]'");
  }

  try {
    db.prepare('SELECT activity_level FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN activity_level INTEGER DEFAULT 5");
  }

  try {
    db.prepare('SELECT current_online_status FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN current_online_status INTEGER DEFAULT 0");
  }

  try {
    db.prepare('SELECT status_expires_at FROM users').get();
  } catch (e) {
    db.exec("ALTER TABLE users ADD COLUMN status_expires_at INTEGER DEFAULT 0");
  }

  try {
    db.prepare('SELECT prob_favorite_dm FROM settings').get();
  } catch (e) {
    db.exec("ALTER TABLE settings ADD COLUMN prob_favorite_dm REAL DEFAULT 50.0");
  }

  try {
    db.prepare('SELECT event_id FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN event_id INTEGER REFERENCES events(id)");
  }

  // Handle schema migrations for comments
  try {
    db.prepare('SELECT parent_id FROM comments').get();
  } catch (e) {
    db.exec("ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL");
  }

  try {
    db.prepare('SELECT op_ignored FROM comments').get();
  } catch (e) {
    db.exec("ALTER TABLE comments ADD COLUMN op_ignored BOOLEAN DEFAULT 0");
  }

  try {
    db.prepare('SELECT mention_ignored FROM comments').get();
  } catch (e) {
    db.exec("ALTER TABLE comments ADD COLUMN mention_ignored BOOLEAN DEFAULT 0");
  }

  // Handle schema migrations for posts
  try {
    db.prepare('SELECT image_url FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN image_url TEXT");
  }

  try {
    db.prepare('SELECT image_prompt FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN image_prompt TEXT");
  }

  try {
    db.prepare('SELECT mention_ignored FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN mention_ignored BOOLEAN DEFAULT 0");
  }

  try {
    db.prepare('SELECT post_type FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN post_type TEXT DEFAULT 'life_update'");
  }

  try {
    db.prepare('SELECT is_visible FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN is_visible BOOLEAN DEFAULT 1");
  }

  // Handle schema migrations for settings
  try {
    db.prepare('SELECT api_key FROM settings').get();
  } catch (e) {
    db.exec("ALTER TABLE settings ADD COLUMN api_key TEXT DEFAULT ''");
  }

  try {
    db.prepare('SELECT prob_post FROM settings').get();
  } catch (e) {
    db.exec("ALTER TABLE settings ADD COLUMN prob_post REAL DEFAULT 100.0");
    db.exec("ALTER TABLE settings ADD COLUMN prob_image_post REAL DEFAULT 30.0");
    db.exec("ALTER TABLE settings ADD COLUMN prob_comment REAL DEFAULT 1000.0");
    db.exec("ALTER TABLE settings ADD COLUMN prob_message REAL DEFAULT 5.0");
  }

  try {
    db.exec("ALTER TABLE settings ADD COLUMN image_model_name TEXT DEFAULT 'z-image-turbo'");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE settings ADD COLUMN vision_model_name TEXT DEFAULT 'zai-org/glm-5-vision'");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE settings ADD COLUMN allow_nsfw BOOLEAN DEFAULT 0");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE settings ADD COLUMN cross_universe_prob REAL DEFAULT 50.0");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE users ADD COLUMN dm_frequency TEXT DEFAULT 'medium'");
  } catch (e) {}

  try {
    db.exec("ALTER TABLE users ADD COLUMN reference_images TEXT DEFAULT '[]'");
  } catch (e) {}

  // Insert default settings
  db.prepare("INSERT OR IGNORE INTO settings (id, ai_enabled, model_name, image_model_name, timezone, api_key, allow_nsfw) VALUES (1, 1, 'zai-org/glm-5', 'z-image-turbo', 'UTC', '', 0)").run();

  // Insert the real user if not exists
  const stmt = db.prepare('SELECT id FROM users WHERE is_ai = 0');
  const user = stmt.get();
  if (!user) {
    db.prepare(`
      INSERT INTO users (username, display_name, bio, is_ai, ai_persona, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('admin', 'Admin', 'This is the admin account.', 0, null, 'admin');
  }

  // Ensure the first real user is an admin
  const firstUser = db.prepare('SELECT id FROM users WHERE is_ai = 0 ORDER BY id ASC LIMIT 1').get() as any;
  if (firstUser) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', firstUser.id);
  }
}

export default db;
