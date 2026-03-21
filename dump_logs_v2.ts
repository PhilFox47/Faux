import db from './src/db';

const logs = db.prepare("SELECT * FROM api_logs ORDER BY id DESC LIMIT 20").all();
console.log(JSON.stringify(logs, null, 2));
