const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf8");

content = content.replace(/user\?\.id \|\| realUser\?\.id \|\| receiverId/g, 'typeof user !== "undefined" ? user.id : (typeof realUser !== "undefined" ? realUser.id : receiverId)');
content = content.replace(/receiverId \|\| aiUser\?\.id \|\| randomAi\?\.id/g, 'typeof receiverId !== "undefined" ? receiverId : (typeof aiUser !== "undefined" ? aiUser.id : randomAi.id)');
content = content.replace(/realUser\?\.id \|\| author\?\.id/g, 'typeof realUser !== "undefined" ? realUser.id : author.id');
content = content.replace(/aiUser\?\.id \|\| randomAi\?\.id/g, 'typeof aiUser !== "undefined" ? aiUser.id : randomAi.id');

fs.writeFileSync("server.ts", content);
