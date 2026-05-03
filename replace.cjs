const fs = require("fs");
let content = fs.readFileSync("server.ts", "utf8");
content = content.replace(/const rel = db\s*\.prepare\(\s*\"SELECT description FROM relationships WHERE user_id_1 = \? AND user_id_2 = \?\"\,?\s*\)\s*\.get\(([^,]+),\s*([^)]+)\)\s*as\s*any;\s*const relContext = rel \? rel\.description : \"\";/g, "const relContext = getFullRelContext($1, $2);");
fs.writeFileSync("server.ts", content);
