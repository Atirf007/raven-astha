const http = require("http");
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};
const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});
if (!process.env.TEST_LOGIN_EMAIL || !process.env.TEST_LOGIN_PASSWORD) {
  throw new Error('Defina TEST_LOGIN_EMAIL e TEST_LOGIN_PASSWORD para executar este smoke test');
}
req.write(JSON.stringify({email: process.env.TEST_LOGIN_EMAIL, password: process.env.TEST_LOGIN_PASSWORD}));
req.end();
