const { pool } = require('./connection');

async function runEamMigration() {
  const connection = await pool.getConnection();
  try {
    const observationsSql=require('fs').readFileSync(require('path').join(__dirname,'observation_schema.sql'),'utf8');
    await connection.query(observationsSql);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        org_id VARCHAR(50) NOT NULL,
        asset_code VARCHAR(40) NOT NULL,
        name VARCHAR(200) NOT NULL,
        asset_type VARCHAR(80) NOT NULL DEFAULT 'equipment',
        status ENUM('active','inactive','maintenance','retired') NOT NULL DEFAULT 'active',
        location VARCHAR(120),
        manufacturer VARCHAR(120),
        model VARCHAR(120),
        serial_number VARCHAR(120),
        criticality ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
        metadata JSON,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_assets_org_code (org_id, asset_code),
        INDEX idx_assets_org_status (org_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'assets', 'parent_asset_id', 'INT NULL');
    await safeAddColumn(connection, 'assets', 'functional_location', 'VARCHAR(120) NULL');
    await safeAddColumn(connection, 'assets', 'functional_location_id', 'INT NULL');
    await safeAddColumn(connection, 'assets', 'hourly_downtime_cost', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safeAddColumn(connection, 'assets', 'replacement_value', 'DECIMAL(14,2) NULL');
    await safeAddColumn(connection, 'assets', 'description', 'TEXT NULL');
    await safeAddColumn(connection, 'assets', 'reference_designation', 'VARCHAR(120) NULL');
    await safeAddColumn(connection, 'assets', 'asset_family', 'VARCHAR(120) NULL');
    await safeAddColumn(connection, 'assets', 'purchase_date', 'DATE NULL');
    await safeAddColumn(connection, 'assets', 'purchase_value', 'DECIMAL(14,2) NULL');
    await safeAddColumn(connection, 'assets', 'warranty_start', 'DATE NULL');
    await safeAddColumn(connection, 'assets', 'warranty_end', 'DATE NULL');
    await safeAddColumn(connection, 'assets', 'commissioned_at', 'DATETIME NULL');
    await safeAddColumn(connection, 'assets', 'decommissioned_at', 'DATETIME NULL');
    await safeAddColumn(connection, 'assets', 'equipment_model_id', 'INT NULL');
    await safeAddColumn(connection, 'materials', 'material_type', "VARCHAR(30) NULL");
    await safeAddColumn(connection, 'materials', 'origin_country', 'VARCHAR(100) NULL');
    await safeAddColumn(connection, 'materials', 'ved_class', "ENUM('vital','essential','desirable') NULL");
    await safeAddColumn(connection, 'materials', 'abc_class', "ENUM('A','B','C') NULL");
    await safeAddColumn(connection, 'materials', 'xyz_class', "ENUM('X','Y','Z') NULL");
    await safeAddColumn(connection, 'materials', 'safety_stock', 'DECIMAL(12,3) NULL');
    await safeAddColumn(connection, 'materials', 'reorder_point', 'DECIMAL(12,3) NULL');
    await safeAddColumn(connection, 'materials', 'lead_time_days', 'INT NULL');
    await safeAddColumn(connection, 'materials', 'sourcing_strategy', "ENUM('single_source','common_source') NULL");
    await safeAddColumn(connection, 'suppliers', 'org_id', 'VARCHAR(50) NULL');
    await connection.query(`CREATE TABLE IF NOT EXISTS functional_locations (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL,
      location_code VARCHAR(60) NOT NULL, name VARCHAR(200) NOT NULL,
      parent_location_id INT NULL, cost_center VARCHAR(80) NULL, work_center VARCHAR(80) NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_functional_location_code (org_id, location_code), INDEX idx_functional_location_parent (org_id, parent_location_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS equipment_models (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,manufacturer VARCHAR(120) NULL,model_code VARCHAR(120) NOT NULL,name VARCHAR(200) NOT NULL,description TEXT NULL,revision VARCHAR(40) NULL,status ENUM('draft','approved','active','obsolete') NOT NULL DEFAULT 'draft',created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uk_equipment_model (org_id,model_code),INDEX idx_equipment_model_org (org_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS equipment_modules (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,equipment_id INT NOT NULL,parent_module_id INT NULL,reference_designation VARCHAR(120) NULL,code VARCHAR(80) NOT NULL,name VARCHAR(200) NOT NULL,description TEXT NULL,module_type VARCHAR(80) NULL,position_order INT NOT NULL DEFAULT 0,status ENUM('active','inactive','retired') NOT NULL DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uk_module_code (equipment_id,code),INDEX idx_module_parent (org_id,equipment_id,parent_module_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS component_positions (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,equipment_id INT NOT NULL,module_id INT NULL,parent_component_id INT NULL,reference_designation VARCHAR(120) NULL,position_number VARCHAR(80) NOT NULL,name VARCHAR(200) NOT NULL,description TEXT NULL,component_type VARCHAR(80) NULL,expected_item_id INT NULL,quantity_required DECIMAL(12,3) NOT NULL DEFAULT 1,is_replaceable TINYINT(1) NOT NULL DEFAULT 1,is_critical TINYINT(1) NOT NULL DEFAULT 0,is_spare_relevant TINYINT(1) NOT NULL DEFAULT 1,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uk_component_position (equipment_id,position_number),INDEX idx_component_module (org_id,module_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS component_instances (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,component_position_id INT NOT NULL,inventory_item_id INT NULL,serial_number VARCHAR(120) NULL,batch_number VARCHAR(120) NULL,manufacturer VARCHAR(120) NULL,manufacturer_part_number VARCHAR(120) NULL,installed_at DATETIME NULL,removed_at DATETIME NULL,status ENUM('installed','removed','failed','repair','warehouse','scrapped','unknown') NOT NULL DEFAULT 'installed',operating_hours_at_install DECIMAL(14,2) NULL,current_operating_hours DECIMAL(14,2) NULL,source_work_order_id INT NULL,warranty_start DATE NULL,warranty_end DATE NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_instance_position (org_id,component_position_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS component_installation_history (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,component_position_id INT NOT NULL,old_instance_id INT NULL,new_instance_id INT NULL,installed_at DATETIME NULL,removed_at DATETIME NULL,work_order_id INT NULL,technician_id INT NULL,reason VARCHAR(300) NULL,notes TEXT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_install_history (org_id,component_position_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS equipment_revisions (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,equipment_id INT NOT NULL,revision_code VARCHAR(40) NOT NULL,status ENUM('draft','under_review','approved','active','superseded','obsolete') NOT NULL DEFAULT 'draft',effective_from DATE NULL,effective_to DATE NULL,change_order VARCHAR(120) NULL,notes TEXT NULL,approved_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_equipment_revision (equipment_id,revision_code),INDEX idx_equipment_revision (org_id,equipment_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS equipment_visuals (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,equipment_id INT NOT NULL,module_id INT NULL,type ENUM('photo','normal_view','exploded_view','technical_illustration','cutaway','section_view','3d_model','ar_reference') NOT NULL,orientation ENUM('front','rear','left','right','top','bottom','isometric','custom') NOT NULL DEFAULT 'custom',title VARCHAR(200) NOT NULL,description TEXT NULL,revision VARCHAR(40) NULL,status ENUM('draft','approved','active','obsolete') NOT NULL DEFAULT 'draft',attachment_id INT NULL,is_primary TINYINT(1) NOT NULL DEFAULT 0,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_equipment_visual (org_id,equipment_id,type)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS equipment_assembly_parts (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, equipment_id INT NOT NULL,
      visual_id INT NOT NULL, module_id INT NULL, component_position_id INT NULL,
      tx DECIMAL(12,4) NOT NULL DEFAULT 0, ty DECIMAL(12,4) NOT NULL DEFAULT 0, tz DECIMAL(12,4) NOT NULL DEFAULT 0,
      rx DECIMAL(12,4) NOT NULL DEFAULT 0, ry DECIMAL(12,4) NOT NULL DEFAULT 0, rz DECIMAL(12,4) NOT NULL DEFAULT 0,
      scale_factor DECIMAL(10,4) NOT NULL DEFAULT 1,
      explode_dx DECIMAL(12,4) NOT NULL DEFAULT 0, explode_dy DECIMAL(12,4) NOT NULL DEFAULT 0, explode_dz DECIMAL(12,4) NOT NULL DEFAULT 0,
      anchor_x DECIMAL(12,4) NULL, anchor_y DECIMAL(12,4) NULL, anchor_z DECIMAL(12,4) NULL,
      updated_by INT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_equipment_assembly_visual (org_id,equipment_id,visual_id),
      INDEX idx_equipment_assembly (org_id,equipment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'equipment_assembly_parts', 'anchor_x', 'DECIMAL(12,4) NULL');
    await safeAddColumn(connection, 'equipment_assembly_parts', 'anchor_y', 'DECIMAL(12,4) NULL');
    await safeAddColumn(connection, 'equipment_assembly_parts', 'anchor_z', 'DECIMAL(12,4) NULL');
    await connection.query(`CREATE TABLE IF NOT EXISTS equipment_assembly_external_parts (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, equipment_id INT NOT NULL,
      source_type ENUM('child_visual','material_file') NOT NULL, source_id INT NOT NULL,
      module_id INT NULL, component_position_id INT NULL,
      tx DECIMAL(12,4) NOT NULL DEFAULT 0, ty DECIMAL(12,4) NOT NULL DEFAULT 0, tz DECIMAL(12,4) NOT NULL DEFAULT 0,
      rx DECIMAL(12,4) NOT NULL DEFAULT 0, ry DECIMAL(12,4) NOT NULL DEFAULT 0, rz DECIMAL(12,4) NOT NULL DEFAULT 0,
      scale_factor DECIMAL(10,4) NOT NULL DEFAULT 1,
      explode_dx DECIMAL(12,4) NOT NULL DEFAULT 0, explode_dy DECIMAL(12,4) NOT NULL DEFAULT 0, explode_dz DECIMAL(12,4) NOT NULL DEFAULT 0,
      anchor_x DECIMAL(12,4) NULL, anchor_y DECIMAL(12,4) NULL, anchor_z DECIMAL(12,4) NULL,
      updated_by INT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_equipment_external_source (org_id,equipment_id,source_type,source_id),
      INDEX idx_equipment_external (org_id,equipment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS equipment_hotspots (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,equipment_id INT NOT NULL,visual_id INT NOT NULL,module_id INT NULL,component_position_id INT NULL,component_instance_id INT NULL,inventory_item_id INT NULL,hotspot_type ENUM('point','callout','area','polygon','line','label','mesh','spatial') NOT NULL DEFAULT 'point',label VARCHAR(200) NULL,callout_number VARCHAR(80) NULL,x_normalized DECIMAL(10,7) NULL,y_normalized DECIMAL(10,7) NULL,polygon_data JSON NULL,style_metadata JSON NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_hotspot_visual (org_id,visual_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS technical_documents (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,equipment_id INT NOT NULL,owner_type ENUM('equipment','module','component_position','component_instance','functional_location') NOT NULL DEFAULT 'equipment',owner_id INT NOT NULL,document_number VARCHAR(120) NOT NULL,title VARCHAR(200) NOT NULL,document_type ENUM('manual','datasheet','electrical','mechanical','hydraulic','pneumatic','pid','layout','certificate','inspection','other') NOT NULL DEFAULT 'other',description TEXT NULL,status ENUM('draft','under_review','approved','active','superseded','obsolete') NOT NULL DEFAULT 'draft',current_revision_id INT NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uk_technical_document (org_id,document_number),INDEX idx_technical_document_owner (org_id,equipment_id,owner_type,owner_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS technical_document_revisions (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,document_id INT NOT NULL,revision_code VARCHAR(40) NOT NULL,filename VARCHAR(200) NOT NULL,mime_type VARCHAR(120) NOT NULL,file_data MEDIUMTEXT NULL,file_url VARCHAR(2048) NULL,file_size_kb INT NULL,effective_from DATE NULL,effective_to DATE NULL,change_description TEXT NULL,status ENUM('draft','under_review','approved','active','superseded','obsolete') NOT NULL DEFAULT 'draft',created_by INT NULL,approved_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_technical_document_revision (document_id,revision_code),INDEX idx_technical_document_revision (org_id,document_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'component_positions', 'installed_instance_id', 'INT NULL');
    await safeAddColumn(connection, 'component_instances', 'manufacturer_serial', 'VARCHAR(120) NULL');
    await safeAddColumn(connection, 'component_instances', 'operating_cycles_at_install', 'DECIMAL(14,2) NULL');
    await safeAddColumn(connection, 'component_instances', 'current_cycles', 'DECIMAL(14,2) NULL');
    await safeAddColumn(connection, 'equipment_visuals', 'filename', 'VARCHAR(200) NULL');
    await safeAddColumn(connection, 'equipment_visuals', 'mime_type', 'VARCHAR(120) NULL');
    await safeAddColumn(connection, 'equipment_visuals', 'file_data', 'MEDIUMTEXT NULL');
    await safeAddColumn(connection, 'equipment_visuals', 'file_url', 'VARCHAR(2048) NULL');
    await safeAddColumn(connection, 'equipment_visuals', 'file_size_kb', 'INT NULL');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS maintenance_work_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        org_id VARCHAR(50) NOT NULL,
        asset_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        type ENUM('preventive','corrective','inspection') NOT NULL DEFAULT 'corrective',
        priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
        status ENUM('open','in_progress','blocked','completed','cancelled') NOT NULL DEFAULT 'open',
        due_at DATETIME NULL,
        completed_at DATETIME NULL,
        assigned_to INT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_wo_org_status (org_id, status),
        INDEX idx_wo_asset (asset_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS asset_spares (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, asset_id INT NOT NULL,
      material_id INT NOT NULL, quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
      UNIQUE KEY uk_asset_spare (asset_id, material_id), INDEX idx_spares_org (org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'asset_spares', 'minimum_quantity', 'DECIMAL(12,3) NULL');
    await safeAddColumn(connection, 'asset_spares', 'maximum_quantity', 'DECIMAL(12,3) NULL');
    await safeAddColumn(connection, 'asset_spares', 'functional_location_id', 'INT NULL');
    await connection.query(`CREATE TABLE IF NOT EXISTS asset_spare_audit (
      id BIGINT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL,
      asset_id INT NOT NULL, material_id INT NOT NULL, action VARCHAR(60) NOT NULL,
      detail VARCHAR(500) NULL, actor_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_asset_spare_audit (org_id,asset_id,material_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS work_order_materials (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, work_order_id INT NOT NULL,
      material_id INT NOT NULL, quantity DECIMAL(12,3) NOT NULL, issued_at TIMESTAMP NULL,
      issued_by INT NULL, INDEX idx_wom_org (org_id), UNIQUE KEY uk_wom_item (work_order_id, material_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'work_order_materials', 'unit_cost', 'DECIMAL(12,2) NOT NULL DEFAULT 0');
    await safeAddColumn(connection, 'work_order_materials', 'material_cost', 'DECIMAL(14,2) NOT NULL DEFAULT 0');
    await safeAddColumn(connection, 'work_order_materials', 'returned_quantity', 'DECIMAL(12,3) NOT NULL DEFAULT 0');
    await connection.query(`CREATE TABLE IF NOT EXISTS preventive_plans (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, asset_id INT NOT NULL,
      title VARCHAR(200) NOT NULL, interval_days INT NOT NULL, next_due_at DATE NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1, created_by INT NULL,
      INDEX idx_pp_org_due (org_id, active, next_due_at), UNIQUE KEY uk_pp_asset_title (asset_id, title)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS preventive_plan_runs (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, plan_id INT NOT NULL,
      due_date DATE NOT NULL, work_order_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_preventive_run (plan_id, due_date), INDEX idx_pp_runs_org (org_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS preventive_plan_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,plan_id INT NOT NULL,
      title VARCHAR(300) NOT NULL,position_order INT NOT NULL DEFAULT 0,
      INDEX idx_preventive_plan_tasks (org_id,plan_id,position_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS inventory_reservations (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, work_order_id INT NOT NULL,
      material_id INT NOT NULL, quantity DECIMAL(12,3) NOT NULL, status ENUM('active','issued','cancelled') NOT NULL DEFAULT 'active',
      created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_reservation_work_material (work_order_id, material_id), INDEX idx_reservation_available (org_id, material_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS purchase_requisitions (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, work_order_id INT NULL, material_id INT NOT NULL,
      requested_quantity DECIMAL(12,3) NOT NULL, status ENUM('draft','requested','approved','cancelled','fulfilled') NOT NULL DEFAULT 'draft',
      reason VARCHAR(200) NOT NULL, created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_requisition_work_material (work_order_id, material_id), INDEX idx_requisition_org_status (org_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'purchase_requisitions', 'approved_by', 'INT NULL');
    await safeAddColumn(connection, 'purchase_requisitions', 'approved_at', 'DATETIME NULL');
    await safeAddColumn(connection, 'purchase_requisitions', 'cancel_reason', 'VARCHAR(300) NULL');
    await connection.query(`CREATE TABLE IF NOT EXISTS purchase_requisition_audit (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, requisition_id INT NOT NULL,
      action VARCHAR(50) NOT NULL, detail VARCHAR(300) NULL, actor_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_requisition_audit (org_id,requisition_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS maintenance_purchase_orders (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, po_number VARCHAR(40) NULL,
      requisition_id INT NOT NULL, supplier_id INT NOT NULL, material_id INT NOT NULL, quantity DECIMAL(12,3) NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL, currency VARCHAR(5) NOT NULL DEFAULT 'BRL', expected_at DATE NULL,
      status ENUM('draft','sent','confirmed','received','cancelled') NOT NULL DEFAULT 'draft', created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_maintenance_po_requisition (org_id,requisition_id), UNIQUE KEY uk_maintenance_po_number (org_id,po_number),
      INDEX idx_maintenance_po_status (org_id,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'maintenance_purchase_orders', 'received_quantity', 'DECIMAL(12,3) NOT NULL DEFAULT 0');
    await safeAddColumn(connection, 'maintenance_purchase_orders', 'received_at', 'DATETIME NULL');
    await safeAddColumn(connection, 'maintenance_purchase_orders', 'rfq_bid_id', 'INT NULL');
    const [purchaseStatusColumns] = await connection.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='maintenance_purchase_orders' AND COLUMN_NAME='status'");
    if (!purchaseStatusColumns[0]?.COLUMN_TYPE.includes("'partial'")) await connection.query("ALTER TABLE maintenance_purchase_orders MODIFY COLUMN status ENUM('draft','sent','confirmed','partial','received','cancelled') NOT NULL DEFAULT 'draft'");
    await connection.query(`CREATE TABLE IF NOT EXISTS downtime_records (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, work_order_id INT NOT NULL,
      asset_id INT NOT NULL, started_at DATETIME NOT NULL, ended_at DATETIME NOT NULL,
      downtime_hours DECIMAL(12,3) NOT NULL, hourly_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
      production_loss_cost DECIMAL(14,2) NOT NULL DEFAULT 0, failure_symptom VARCHAR(200) NULL,
      failure_mechanism VARCHAR(200) NULL, causing_material_id INT NULL, remarks TEXT NULL,
      created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_downtime_asset (org_id, asset_id, started_at), INDEX idx_downtime_work_order (work_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS failure_classifications (
      id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,code VARCHAR(50) NOT NULL,
      name VARCHAR(200) NOT NULL,category ENUM('symptom','mechanism','cause') NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_failure_classification (org_id,category,code),INDEX idx_failure_classification (org_id,category,is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'downtime_records', 'failure_classification_id', 'INT NULL');
    await connection.query(`CREATE TABLE IF NOT EXISTS work_order_labor (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, work_order_id INT NOT NULL,
      user_id INT NULL, hours DECIMAL(12,3) NOT NULL, hourly_rate DECIMAL(12,2) NOT NULL,
      labor_cost DECIMAL(14,2) NOT NULL, remarks VARCHAR(500) NULL, created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_labor_work_order (org_id, work_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'maintenance_work_orders', 'work_order_number', 'VARCHAR(40) NULL');
    await safeAddColumn(connection, 'maintenance_work_orders', 'financial_closed_at', 'DATETIME NULL');
    await safeAddColumn(connection, 'maintenance_work_orders', 'released_at', 'DATETIME NULL');
    await safeAddColumn(connection, 'maintenance_work_orders', 'released_by', 'INT NULL');
    await connection.query(`CREATE TABLE IF NOT EXISTS work_order_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, work_order_id INT NOT NULL,
      title VARCHAR(300) NOT NULL, is_completed TINYINT(1) NOT NULL DEFAULT 0, completed_at DATETIME NULL,
      completed_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_tasks_work_order (org_id,work_order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS work_order_audit (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, work_order_id INT NOT NULL,
      action VARCHAR(80) NOT NULL, detail VARCHAR(500) NULL, actor_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_work_order (org_id,work_order_id,created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS work_order_material_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,work_order_id INT NOT NULL,material_id INT NOT NULL,
      requested_quantity DECIMAL(12,3) NOT NULL,issued_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
      status ENUM('draft','approved','rejected','fulfilled') NOT NULL DEFAULT 'draft',
      requested_by INT NULL,approved_by INT NULL,approved_at DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_work_order_material_request (org_id,work_order_id,material_id),INDEX idx_wom_request (org_id,work_order_id,status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS material_sources (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, material_id INT NOT NULL, supplier_id INT NOT NULL,
      supplier_sku VARCHAR(100) NULL, unit_price DECIMAL(12,2) NOT NULL, currency VARCHAR(5) NOT NULL DEFAULT 'BRL',
      lead_time_days INT NULL, is_approved TINYINT(1) NOT NULL DEFAULT 1, created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_material_supplier (org_id, material_id, supplier_id), INDEX idx_source_material (org_id, material_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS supplier_price_history (
      id INT AUTO_INCREMENT PRIMARY KEY, org_id VARCHAR(50) NOT NULL, material_source_id INT NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL, currency VARCHAR(5) NOT NULL DEFAULT 'BRL', effective_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INT NULL, INDEX idx_price_history_source (material_source_id, effective_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'assets', 'spatial_x', 'DECIMAL(14,4) NULL');
    await safeAddColumn(connection, 'assets', 'spatial_y', 'DECIMAL(14,4) NULL');
    await safeAddColumn(connection, 'assets', 'spatial_z', 'DECIMAL(14,4) NULL');
    await safeAddColumn(connection, 'assets', 'spatial_rotation', 'DECIMAL(10,4) NULL');
    await safeAddColumn(connection, 'assets', 'spatial_level', 'VARCHAR(80) NULL');
    await safeAddColumn(connection, 'preventive_plans', 'interval_hours', 'DECIMAL(14,2) NULL');
    await safeAddColumn(connection, 'preventive_plans', 'interval_cycles', 'DECIMAL(14,2) NULL');
    await safeAddColumn(connection, 'preventive_plans', 'next_due_hours', 'DECIMAL(14,2) NULL');
    await safeAddColumn(connection, 'preventive_plans', 'next_due_cycles', 'DECIMAL(14,2) NULL');
    await safeAddColumn(connection, 'assets', 'operating_hours', 'DECIMAL(14,2) NOT NULL DEFAULT 0');
    await safeAddColumn(connection, 'assets', 'operating_cycles', 'DECIMAL(14,2) NOT NULL DEFAULT 0');
    await connection.query(`CREATE TABLE IF NOT EXISTS asset_counter_readings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,asset_id INT NOT NULL,
      operating_hours DECIMAL(14,2) NOT NULL,operating_cycles DECIMAL(14,2) NOT NULL,
      recorded_by INT NULL,recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_asset_counter_readings (org_id,asset_id,recorded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS equipment_scenes (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,equipment_id INT NOT NULL,title VARCHAR(200) NOT NULL,scene_data JSON NOT NULL,status ENUM('draft','under_review','approved','active','obsolete') NOT NULL DEFAULT 'draft',created_by INT NULL,approved_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_scene_equipment (org_id,equipment_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS supplier_qualifications (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,supplier_id INT NOT NULL,category VARCHAR(100) NOT NULL,status ENUM('pending','qualified','suspended','expired') NOT NULL DEFAULT 'pending',score DECIMAL(5,2) NULL,expires_at DATE NULL,evidence_note VARCHAR(500) NULL,approved_by INT NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uk_supplier_qualification (org_id,supplier_id,category),INDEX idx_supplier_qualification (org_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS request_for_quotes (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,rfq_number VARCHAR(40) NOT NULL,title VARCHAR(200) NOT NULL,status ENUM('draft','published','closed','awarded','cancelled') NOT NULL DEFAULT 'draft',closes_at DATETIME NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_rfq_number (org_id,rfq_number),INDEX idx_rfq_status (org_id,status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS rfq_lines (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,rfq_id INT NOT NULL,material_id INT NOT NULL,quantity DECIMAL(12,3) NOT NULL,required_at DATE NULL,UNIQUE KEY uk_rfq_line (rfq_id,material_id),INDEX idx_rfq_line (org_id,rfq_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS rfq_bids (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,rfq_line_id INT NOT NULL,supplier_id INT NOT NULL,unit_price DECIMAL(12,2) NOT NULL,currency VARCHAR(5) NOT NULL DEFAULT 'BRL',lead_time_days INT NULL,status ENUM('submitted','selected','rejected') NOT NULL DEFAULT 'submitted',created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_rfq_bid (rfq_line_id,supplier_id),INDEX idx_rfq_bid (org_id,rfq_line_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS material_source_quotas (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,material_id INT NOT NULL,supplier_id INT NOT NULL,quota_percent DECIMAL(5,2) NOT NULL,updated_by INT NULL,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uk_source_quota (org_id,material_id,supplier_id),INDEX idx_source_quota_material (org_id,material_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS procurement_audit (id BIGINT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,entity_type VARCHAR(40) NOT NULL,entity_id INT NOT NULL,action VARCHAR(60) NOT NULL,detail VARCHAR(500) NULL,actor_id INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_procurement_audit (org_id,entity_type,entity_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS material_unit_conversions (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,material_id INT NOT NULL,from_unit VARCHAR(20) NOT NULL,to_unit VARCHAR(20) NOT NULL,factor DECIMAL(18,8) NOT NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_material_unit_conversion (org_id,material_id,from_unit,to_unit)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'materials', 'purchase_unit', 'VARCHAR(20) NULL');
    await connection.query(`CREATE TABLE IF NOT EXISTS material_demand_forecasts (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,material_id INT NOT NULL,forecast_date DATE NOT NULL,quantity DECIMAL(12,3) NOT NULL,source ENUM('manual','mrp','preventive','work_order') NOT NULL DEFAULT 'manual',created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_material_forecast (org_id,material_id,forecast_date,source),INDEX idx_forecast_date (org_id,forecast_date)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS condition_readings (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,asset_id INT NOT NULL,metric_code VARCHAR(80) NOT NULL,value DECIMAL(18,6) NOT NULL,unit VARCHAR(30) NULL,recorded_at DATETIME NOT NULL,source ENUM('manual','iot','inspection') NOT NULL DEFAULT 'manual',created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_condition_reading (org_id,asset_id,metric_code,recorded_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS condition_rules (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,asset_id INT NOT NULL,metric_code VARCHAR(80) NOT NULL,unit VARCHAR(30) NULL,minimum_value DECIMAL(18,6) NULL,maximum_value DECIMAL(18,6) NULL,severity ENUM('warning','critical') NOT NULL DEFAULT 'warning',is_active TINYINT(1) NOT NULL DEFAULT 1,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,INDEX idx_condition_rule_asset (org_id,asset_id,metric_code,is_active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await connection.query(`CREATE TABLE IF NOT EXISTS condition_alerts (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,asset_id INT NOT NULL,rule_id INT NOT NULL,reading_id INT NOT NULL,status ENUM('open','acknowledged','closed') NOT NULL DEFAULT 'open',severity ENUM('warning','critical') NOT NULL,acknowledged_by INT NULL,acknowledged_at DATETIME NULL,closed_by INT NULL,closed_at DATETIME NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_condition_rule_reading (org_id,rule_id,reading_id),INDEX idx_condition_alert_asset (org_id,asset_id,status,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await safeAddColumn(connection, 'condition_alerts', 'work_order_id', 'INT NULL');
    await safeAddColumn(connection, 'work_order_material_requests', 'approved_quantity', 'DECIMAL(12,3) NULL');
    const [authorizationStatus] = await connection.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='work_order_material_requests' AND COLUMN_NAME='status'");
    if (!authorizationStatus[0]?.COLUMN_TYPE.includes("'revoked'")) await connection.query("ALTER TABLE work_order_material_requests MODIFY COLUMN status ENUM('draft','approved','rejected','fulfilled','revoked') NOT NULL DEFAULT 'draft'");
    await safeAddColumn(connection, 'maintenance_purchase_orders', 'purchase_unit', 'VARCHAR(20) NULL');
    await safeAddColumn(connection, 'maintenance_purchase_orders', 'purchase_factor', 'DECIMAL(18,6) NOT NULL DEFAULT 1');
    await safeAddColumn(connection, 'maintenance_purchase_orders', 'purchase_quantity', 'DECIMAL(12,3) NULL');
    await safeAddColumn(connection, 'maintenance_purchase_orders', 'purchase_unit_price', 'DECIMAL(18,6) NULL');
    const [purchasePriceType]=await connection.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='maintenance_purchase_orders' AND COLUMN_NAME='unit_price'");
    if(purchasePriceType[0]?.COLUMN_TYPE!=='decimal(18,6)')await connection.query('ALTER TABLE maintenance_purchase_orders MODIFY COLUMN unit_price DECIMAL(18,6) NOT NULL');
    await safeAddColumn(connection, 'material_demand_forecasts', 'priority', "ENUM('urgent','high','medium','low') NOT NULL DEFAULT 'medium'");
    await safeAddColumn(connection, 'preventive_plans', 'priority', "ENUM('urgent','high','medium','low') NOT NULL DEFAULT 'medium'");
    await safeAddColumn(connection, 'preventive_plans', 'calendar_json', 'TEXT NULL');
    await connection.query("CREATE TABLE IF NOT EXISTS maintenance_plan_templates (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,name VARCHAR(120) NOT NULL,definition JSON NOT NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_plan_template(org_id,name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await connection.query("CREATE TABLE IF NOT EXISTS equipment_snapshots (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,equipment_id INT NOT NULL,label VARCHAR(120) NOT NULL,kind ENUM('as_designed','as_built') NOT NULL,status ENUM('draft','approved','rejected') NOT NULL DEFAULT 'draft',snapshot_data JSON NOT NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,reviewed_by INT NULL,reviewed_at DATETIME NULL,review_note VARCHAR(300) NULL,INDEX idx_equipment_snapshot(org_id,equipment_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await connection.query("CREATE TABLE IF NOT EXISTS supplier_qualification_evidence (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,qualification_id INT NOT NULL,filename VARCHAR(200) NOT NULL,mime_type VARCHAR(100) NOT NULL,file_data LONGTEXT NULL,file_url VARCHAR(2048) NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,INDEX idx_qualification_evidence(org_id,qualification_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    const [lifecycle] = await connection.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='maintenance_work_orders' AND COLUMN_NAME='status'");
    if(!lifecycle[0]?.COLUMN_TYPE.includes("'waiting_materials'"))await connection.query("ALTER TABLE maintenance_work_orders MODIFY COLUMN status ENUM('open','in_progress','blocked','waiting_materials','paused','completed','cancelled') NOT NULL DEFAULT 'open'");
    for(const table of ['materials','movements']){const [type]=await connection.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='quantity'",[table]);if(type[0]&&!type[0].COLUMN_TYPE.startsWith('decimal'))await connection.query(`ALTER TABLE ${table} MODIFY COLUMN quantity DECIMAL(15,3) NOT NULL DEFAULT 0`);}
    await connection.query("CREATE TABLE IF NOT EXISTS maintenance_iot_devices (id INT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,asset_id INT NOT NULL,name VARCHAR(120) NOT NULL,key_hash CHAR(64) NOT NULL,expires_at DATETIME NOT NULL,revoked_at DATETIME NULL,last_seen_at DATETIME NULL,created_by INT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_device_key(key_hash),INDEX idx_iot_asset(org_id,asset_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await connection.query("CREATE TABLE IF NOT EXISTS maintenance_iot_events (id BIGINT AUTO_INCREMENT PRIMARY KEY,org_id VARCHAR(50) NOT NULL,device_id INT NOT NULL,event_id VARCHAR(80) NOT NULL,reading_id INT NOT NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uk_device_event(device_id,event_id),INDEX idx_iot_event_org(org_id,device_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
  } finally { connection.release(); }
}

async function safeAddColumn(connection, table, column, definition) {
  const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
  if (!columns.length) await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
}

if (require.main === module) runEamMigration().then(() => process.exit(0)).catch(() => process.exit(1));
module.exports = { runEamMigration };
