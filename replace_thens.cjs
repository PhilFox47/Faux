const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/\.then\(\(r\) => r\.json\(\)\)\s*\.then\((set[A-Za-z]+)\)/g, (match, p1) => {
    return `.then((r) => r.json())\n      .then((data) => { if (Array.isArray(data)) ${p1}(data); })`;
});

fs.writeFileSync('src/App.tsx', code);
