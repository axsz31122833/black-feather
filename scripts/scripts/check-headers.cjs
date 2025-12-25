const http = require('http');
http.get('http://localhost:3000/', (res) => {
  console.log('statusCode:', res.statusCode);
  console.log('headers:', res.headers);
  res.resume();
}).on('error', (err) => {
  console.error('request error:', err.message);
  process.exit(1);
});