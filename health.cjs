const http = require('http');
http.get('http://0.0.0.0:3000/api/health2', (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => console.log("DATA:", data));
});
