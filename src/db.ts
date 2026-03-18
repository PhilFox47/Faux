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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      post_type TEXT DEFAULT 'life_update',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
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
      timezone TEXT DEFAULT 'UTC',
      api_key TEXT DEFAULT '',
      prob_post REAL DEFAULT 100.0,
      prob_image_post REAL DEFAULT 30.0,
      prob_comment REAL DEFAULT 1000.0,
      prob_message REAL DEFAULT 5.0,
      allow_nsfw BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_tags (
      user_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, tag_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tag_id) REFERENCES tags(id)
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
  `);

  // Add last_read_at column if it doesn't exist
  try {
    db.exec("ALTER TABLE group_chat_members ADD COLUMN last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP");
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

  // Handle schema migrations for posts
  try {
    db.prepare('SELECT image_url FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN image_url TEXT");
  }

  try {
    db.prepare('SELECT post_type FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN post_type TEXT DEFAULT 'life_update'");
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
    db.exec("ALTER TABLE settings ADD COLUMN allow_nsfw BOOLEAN DEFAULT 0");
  } catch (e) {}

  // Insert default settings
  db.prepare("INSERT OR IGNORE INTO settings (id, ai_enabled, model_name, image_model_name, timezone, api_key, allow_nsfw) VALUES (1, 1, 'zai-org/glm-5', 'z-image-turbo', 'UTC', '', 0)").run();

  // Insert the real user if not exists
  const stmt = db.prepare('SELECT id FROM users WHERE is_ai = 0');
  const user = stmt.get();
  if (!user) {
    db.prepare(`
      INSERT INTO users (username, display_name, bio, is_ai, ai_persona)
      VALUES (?, ?, ?, ?, ?)
    `).run('real_user', 'You', 'This is your real account.', 0, null);
  }

  // Cleanup duplicate real users, keeping the oldest one but updating its profile with the newest one's data
  const realUsers = db.prepare('SELECT * FROM users WHERE is_ai = 0 ORDER BY id ASC').all() as any[];
  if (realUsers.length > 1) {
    const oldestUser = realUsers[0];
    const newestUser = realUsers[realUsers.length - 1];
    
    // Update oldest user with newest user's profile data (ohne username)
    db.prepare(`
      UPDATE users 
      SET display_name = ?, bio = ?, avatar_url = ?, description = ?, writing_style = ?, physical_appearance = ?, clothing_style = ?, artstyle = ?
      WHERE id = ?
    `).run(newestUser.display_name, newestUser.bio, newestUser.avatar_url, newestUser.description, newestUser.writing_style, newestUser.physical_appearance, newestUser.clothing_style, newestUser.artstyle, oldestUser.id);

    // Reassign all records from duplicates to the oldest user
    for (let i = 1; i < realUsers.length; i++) {
      const duplicateId = realUsers[i].id;
      
      const tables = [
        { name: 'posts', col: 'user_id' },
        { name: 'comments', col: 'user_id' },
        { name: 'likes', col: 'user_id' },
        { name: 'comment_likes', col: 'user_id' },
        { name: 'follows', col: 'follower_id' },
        { name: 'follows', col: 'followed_id' },
        { name: 'notifications', col: 'user_id' },
        { name: 'notifications', col: 'actor_id' },
        { name: 'direct_messages', col: 'sender_id' },
        { name: 'direct_messages', col: 'receiver_id' },
        { name: 'user_tags', col: 'user_id' },
        { name: 'relationships', col: 'user_id_1' },
        { name: 'relationships', col: 'user_id_2' },
        { name: 'group_chat_members', col: 'user_id' },
        { name: 'group_chat_messages', col: 'sender_id' }
      ];

      for (const table of tables) {
        try {
          db.prepare(`UPDATE OR IGNORE ${table.name} SET ${table.col} = ? WHERE ${table.col} = ?`).run(oldestUser.id, duplicateId);
        } catch (e) {}
      }
      
      db.prepare('DELETE FROM users WHERE id = ?').run(duplicateId);
    }
  }
}

export default db;
