const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf8");

content = content.replace(/updateDMState\(author\.id, randomAi\.id, dmData\);/g, (match, offset) => {
    if (offset < 215000) {
        return "updateDMState(realUser.id, randomAi.id, dmData);";
    } else {
        return "updateDMState(author.id, randomAi.id, dmData);";
    }
});

fs.writeFileSync("server.ts", content);
