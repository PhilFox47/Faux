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
      ai_persona TEXT, -- Description of who they are impersonating
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
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
      prob_message REAL DEFAULT 5.0
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

    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      request_payload TEXT,
      response_payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

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

  // Handle schema migrations for comments
  try {
    db.prepare('SELECT parent_id FROM comments').get();
  } catch (e) {
    db.exec("ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL");
  }

  // Handle schema migrations for posts
  try {
    db.prepare('SELECT image_url FROM posts').get();
  } catch (e) {
    db.exec("ALTER TABLE posts ADD COLUMN image_url TEXT");
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

  // Insert default settings
  db.prepare("INSERT OR IGNORE INTO settings (id, ai_enabled, model_name, image_model_name, timezone, api_key) VALUES (1, 1, 'zai-org/glm-5', 'z-image-turbo', 'UTC', '')").run();

  // Insert the real user if not exists
  const stmt = db.prepare('SELECT id FROM users WHERE username = ?');
  const user = stmt.get('real_user');
  if (!user) {
    db.prepare(`
      INSERT INTO users (username, display_name, bio, is_ai, ai_persona)
      VALUES (?, ?, ?, ?, ?)
    `).run('real_user', 'You', 'This is your real account.', 0, null);
  }
}

export default db;
