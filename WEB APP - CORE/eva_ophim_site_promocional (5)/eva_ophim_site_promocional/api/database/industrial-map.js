'use strict';
/* Additive, idempotent migration. No changes to existing tables or data. */
module.exports=async function ensureIndustrialMap(db){
 const [tables]=await db.execute("SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('warehouse_model_imports','warehouse_map_revisions','warehouse_map_drafts')");
 if(tables.length===3)return;

 await db.execute(`CREATE TABLE IF NOT EXISTS warehouse_model_imports (
  id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,layout_id INT NOT NULL,
  name VARCHAR(120) NOT NULL,source_origin VARCHAR(300) NOT NULL,license_text VARCHAR(300) NOT NULL,
  source_hash CHAR(64) NOT NULL,source_bytes INT NOT NULL,triangles INT NOT NULL,
  geometry_json MEDIUMTEXT NOT NULL,created_by INT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_map_import_owner (org_id,layout_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await db.execute(`CREATE TABLE IF NOT EXISTS warehouse_map_revisions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,layout_id INT NOT NULL,
  revision_number INT NOT NULL,blueprint_json MEDIUMTEXT NOT NULL,content_hash CHAR(64) NOT NULL,
  created_by INT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_map_revision (org_id,layout_id,revision_number)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
 await db.execute(`CREATE TABLE IF NOT EXISTS warehouse_map_drafts (
  org_id VARCHAR(50) NOT NULL,layout_id INT NOT NULL,user_id INT NOT NULL,
  base_revision INT NOT NULL,blueprint_json MEDIUMTEXT NOT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (org_id,layout_id,user_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
};
