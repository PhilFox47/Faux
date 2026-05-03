const http = require('http');
http.get('http://0.0.0.0:3000/api/real-users', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => console.log("STATUS:", res.statusCode, "\nDATA:", data));
});
