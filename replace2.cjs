const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf8");

content = content.replace(/const \{ content: replyContent, internal_thought \} = replyData;/g, 'const { content: replyContent, internal_thought } = replyData;\n                  updateDMState(user?.id || realUser?.id || receiverId, receiverId || aiUser?.id || randomAi?.id, replyData);');

content = content.replace(/const \{ content: replyContent, internal_thought \} =\s*replyData;/g, 'const { content: replyContent, internal_thought } = replyData;\n                      updateDMState(realUser?.id || author?.id, aiUser?.id || randomAi?.id, replyData);');

content = content.replace(/if \(dmData\) \{\s*db\.prepare\(\s*\"INSERT INTO direct_messages/g, 'if (dmData) {\n                      updateDMState(realUser?.id || author?.id, randomAi?.id, dmData);\n                      db.prepare(\n                        "INSERT INTO direct_messages');

fs.writeFileSync("server.ts", content);
