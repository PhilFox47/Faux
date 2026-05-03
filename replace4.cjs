const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf8");

content = content.replace(/realUser \? realUser\.id : author\.id/g, 'typeof realUser !== "undefined" ? realUser.id : author.id');
content = content.replace(/realUser \? realUser\.id : receiverId/g, 'typeof realUser !== "undefined" ? realUser.id : receiverId');

fs.writeFileSync("server.ts", content);
