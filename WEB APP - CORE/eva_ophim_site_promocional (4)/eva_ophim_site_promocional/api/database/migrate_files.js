require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const {pool} = require('./connection');


const sql = `
  CREATE TABLE IF NOT EXISTS material_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    material_id INT NOT NULL,
    category ENUM('product_3d','machinery_3d','manual','electrical','mechanical','other') NOT NULL DEFAULT 'other',
    filename VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) DEFAULT NULL,
    file_data LONGTEXT DEFAULT NULL,
    file_url VARCHAR(1000) DEFAULT NULL,
    description VARCHAR(500) DEFAULT NULL,
    file_size_kb INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
  )
`;

pool.query(sql).then(() => {
  console.log('TABLE material_files: OK');
  return pool.query('DESCRIBE material_files');
}).then(([rows]) => {
  rows.forEach(c => console.log(c.Field, '-', c.Type));
  pool.end();
}).catch(e => {
  console.error('Error:', e.message);
  pool.end();
  process.exit(1);
});
