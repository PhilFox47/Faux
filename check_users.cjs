const Database = require('better-sqlite3');
const db = new Database('faux.db');
const users = db.prepare('SELECT * FROM users').all();
console.log(users.map(u => ({ id: u.id, username: u.username, is_ai: u.is_ai })));
