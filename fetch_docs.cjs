const fs = require('fs');
fetch('https://docs.nano-gpt.com/api-reference/endpoint/image-generation-openai')
  .then(r => r.text())
  .then(t => fs.writeFileSync('docs.html', t));
