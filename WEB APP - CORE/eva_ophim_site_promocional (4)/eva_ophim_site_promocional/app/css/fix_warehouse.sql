-- ============================================================
-- EVAH OPHIM — Fix Warehouse (canvas preto + tabela missing)
-- ============================================================
USE evah_ophim_db;

-- ── 1. Colunas faltando em warehouse_layout ──────────────────
-- O warehouse.js usa: org_id e blueprint_data
CALL safe_add_column('warehouse_layout', 'org_id',         'VARCHAR(50) NULL');
CALL safe_add_column('warehouse_layout', 'blueprint_data', 'LONGTEXT NULL COMMENT "Blueprint JSON do Editor CAD"');

-- Vincular os layouts existentes à org padrão
UPDATE warehouse_layout SET org_id = 'org_1' WHERE org_id IS NULL;

-- ── 2. Criar tabela `warehouses` (usada por /api/warehouse/tabs) ──
CREATE TABLE IF NOT EXISTS warehouses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  org_id      VARCHAR(50) NOT NULL,
  name        VARCHAR(200) NOT NULL,
  tab_number  INT NOT NULL DEFAULT 1,
  is_shared   TINYINT(1) NOT NULL DEFAULT 0,
  description TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_org (org_id),
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Inserir o armazém padrão para a org_1
INSERT IGNORE INTO warehouses (org_id, name, tab_number) VALUES ('org_1', 'Armazém Principal', 1);

-- ── VERIFICAÇÃO ──────────────────────────────────────────────
SELECT 'warehouse_layout' AS tabela, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'evah_ophim_db'
  AND TABLE_NAME = 'warehouse_layout'
  AND COLUMN_NAME IN ('org_id','blueprint_data');

SHOW TABLES LIKE 'warehouses';

-- ============================================================
-- ✅ Canvas do Editor CAD deve funcionar agora.
-- ============================================================
