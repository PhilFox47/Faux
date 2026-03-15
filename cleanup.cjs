const Database = require('better-sqlite3');
const db = new Database('faux.db');
const realUsers = db.prepare('SELECT * FROM users WHERE is_ai = 0 ORDER BY id ASC').all();
console.log("Real users:", realUsers);
if (realUsers.length > 1) {
  const keepId = realUsers[0].id;
  for (let i = 1; i < realUsers.length; i++) {
    db.prepare('DELETE FROM users WHERE id = ?').run(realUsers[i].id);
    console.log("Deleted duplicate real user:", realUsers[i].id);
  }
}
