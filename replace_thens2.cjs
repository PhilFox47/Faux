const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /\.then\(\(r\) => r\.json\(\)\)\s*\.then\(\(data\) => \{\s*(set[A-Za-z]+)\(data\);\s*\}\)/g;
code = code.replace(regex, (match, p1) => {
    return `.then((r) => r.json())\n      .then((data) => { if (Array.isArray(data)) ${p1}(data); })`;
});

fs.writeFileSync('src/App.tsx', code);
