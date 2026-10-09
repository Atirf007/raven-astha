const fs = require('fs');
let content = fs.readFileSync('api/routes/auth.js', 'utf8');

// Fix GET /me
content = content.replace(
  /u\.avatar_url, u\.org_id, u\.sector, u\.created_at, u\.setup_done, u\.position_label,/g,
  "u.avatar_url, u.org_id, u.sector, u.created_at, u.setup_done, u.position_label, u.dob, u.gender, u.country,"
);

// Fix PUT /profile
content = content.replace(
  /const { name, surname, company, phone, sector, avatar_url } = req\.body;/g,
  "const { name, surname, company, phone, sector, avatar_url, dob, gender, country } = req.body;"
);

content = content.replace(
  /`UPDATE users SET name=\?, surname=\?, company=\?, phone=\?, sector=\?, avatar_url=\? WHERE id=\?`/g,
  "`UPDATE users SET name=?, surname=?, company=?, phone=?, sector=?, avatar_url=?, dob=?, gender=?, country=? WHERE id=?`"
);

content = content.replace(
  /\[name, surname \|\| '', company \|\| '', phone \|\| '', sector \|\| '', avatar_url \|\| null, req\.user\.id\]/g,
  "[name, surname || '', company || '', phone || '', sector || '', avatar_url || null, dob || null, gender || null, country || null, req.user.id]"
);

fs.writeFileSync('api/routes/auth.js', content, 'utf8');
