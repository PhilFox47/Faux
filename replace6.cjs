const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf8");

content = content.replace(/updateDMState\(typeof realUser \!== \"undefined\" \? realUser\.id : author\.id, randomAi\.id, dmData\);/g, (match, offset) => {
    // 5372, 5423, 5473 use realUser.id; 6257 uses author.id
    if (offset < 6000) {
        return "updateDMState(realUser.id, randomAi.id, dmData);";
    } else {
        return "updateDMState(author.id, randomAi.id, dmData);";
    }
});

fs.writeFileSync("server.ts", content);
