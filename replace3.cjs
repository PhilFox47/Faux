const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf8");

content = content.replace(/if \(dmData\) \{\s*db\.prepare\(\s*\"INSERT INTO direct_messages/g, 'if (dmData) {\n  updateDMState(realUser ? realUser.id : author.id, randomAi.id, dmData);\n  db.prepare(\n    "INSERT INTO direct_messages');

fs.writeFileSync("server.ts", content);
