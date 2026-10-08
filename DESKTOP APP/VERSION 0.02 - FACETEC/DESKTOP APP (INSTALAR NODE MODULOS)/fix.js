const fs = require('fs');
let c = fs.readFileSync('api/routes/auth.js', 'utf8');
c = c.replace(/require\('bcrypt'\)/g, "require('bcryptjs')");
fs.writeFileSync('api/routes/auth.js', c);
