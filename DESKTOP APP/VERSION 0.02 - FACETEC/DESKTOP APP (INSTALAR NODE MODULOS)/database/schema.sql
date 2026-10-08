-- ============================================================
-- EVAH OPHIM — Banco de Dados MySQL (Produção v2.0)
-- Schema completo: gestão de materiais, estoque, mapa,
-- planos, assinaturas, notificações e auditoria
-- ============================================================

CREATE DATABASE IF NOT EXISTS evah_ophim
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE evah_ophim;

-- ══════════════════════════════════════
-- MÓDULO 1: IDENTIDADE & ACESSO
-- ══════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizations (
  id          VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  plan        VARCHAR(50) DEFAULT 'Enterprise',
  logo        LONGTEXT,
  policies    JSON,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  surname       VARCHAR(100),
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  company       VARCHAR(200),
  phone         VARCHAR(30),
  role          ENUM('superadmin','admin','manager','operator','viewer') NOT NULL DEFAULT 'viewer',
  avatar_url    LONGTEXT,
  org_id        VARCHAR(50) DEFAULT 'org_1',
  sector        VARCHAR(100) DEFAULT 'Logística',
  provider      ENUM('local','google','microsoft','webauthn') DEFAULT 'local',
  provider_id   VARCHAR(255),
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP NULL,
  failed_logins INT NOT NULL DEFAULT 0,
  locked_until  TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_provider (provider),
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sessions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  token       VARCHAR(500) NOT NULL,
  provider    VARCHAR(20) DEFAULT 'local',
  ip_address  VARCHAR(45),
  user_agent  TEXT,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token(255)),
  INDEX idx_user (user_id),
  INDEX idx_expires (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE webauthn_credentials (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  credential_id   TEXT NOT NULL,
  public_key      TEXT NOT NULL,
  sign_count      INT DEFAULT 0,
  device_name     VARCHAR(100),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE password_resets (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  token       VARCHAR(255) NOT NULL UNIQUE,
  used        TINYINT(1) NOT NULL DEFAULT 0,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 2: PLANOS & ASSINATURAS
-- ══════════════════════════════════════

CREATE TABLE plans (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  slug            VARCHAR(30) NOT NULL UNIQUE,
  name            VARCHAR(100) NOT NULL,
  price_monthly   DECIMAL(10,2) DEFAULT 0.00,
  price_annual    DECIMAL(10,2) DEFAULT 0.00,
  max_users       INT DEFAULT 1,
  max_materials   INT DEFAULT 100,
  features        JSON COMMENT '["dashboard","mapa_2d","api"]',
  sla_uptime      DECIMAL(4,2) DEFAULT 0.00,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE subscriptions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  plan_id         INT NOT NULL,
  billing_cycle   ENUM('monthly','annual') DEFAULT 'monthly',
  status          ENUM('active','past_due','cancelled','trial','expired') DEFAULT 'trial',
  trial_ends_at   TIMESTAMP NULL,
  current_period_start TIMESTAMP NULL,
  current_period_end   TIMESTAMP NULL,
  cancelled_at    TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB;

CREATE TABLE invoices (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  subscription_id INT NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(5) DEFAULT 'BRL',
  status          ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  paid_at         TIMESTAMP NULL,
  due_date        DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 3: MATERIAIS & ESTOQUE
-- ══════════════════════════════════════

CREATE TABLE categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  color       VARCHAR(7) DEFAULT '#6C63FF',
  parent_id   INT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE materials (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20) NOT NULL UNIQUE COMMENT 'Ex: MERB-00000001',
  description     VARCHAR(300) NOT NULL,
  brand           VARCHAR(100),
  model           VARCHAR(100),
  category_id     INT NULL,
  sector          VARCHAR(100) COMMENT 'Ex: Assembly, Paint, Body',
  location        VARCHAR(50) COMMENT 'Ex: A1-N2-P3',
  quantity        INT NOT NULL DEFAULT 0,
  min_qty         INT NOT NULL DEFAULT 0,
  max_qty         INT NOT NULL DEFAULT 0,
  unit_price      DECIMAL(12,2) DEFAULT 0.00,
  currency        VARCHAR(5) DEFAULT 'BRL',
  unit            VARCHAR(20) DEFAULT 'UN' COMMENT 'UN, KG, L, M, CX',
  barcode         VARCHAR(50),
  image_url       VARCHAR(500),
  image_data      LONGTEXT COMMENT 'Base64 para uso offline',
  manual_url      VARCHAR(500),
  manual_data     LONGTEXT COMMENT 'PDF em Base64',
  manual_filename VARCHAR(200),
  interchangeable TINYINT(1) NOT NULL DEFAULT 0,
  interchange_with TEXT COMMENT 'Códigos substitutos separados por vírgula',
  notes           TEXT,
  machinery       VARCHAR(200),
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_by      INT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_code (code),
  INDEX idx_sector (sector),
  INDEX idx_brand (brand),
  INDEX idx_barcode (barcode),
  INDEX idx_category (category_id),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE movements (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  material_id     INT NOT NULL,
  type            ENUM('entrada','saida') NOT NULL,
  quantity        INT NOT NULL,
  nf_number       VARCHAR(50),
  responsible     VARCHAR(100),
  reason          VARCHAR(300),
  notes           TEXT,
  created_by      INT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_material (material_id),
  INDEX idx_type (type),
  INDEX idx_date (created_at),
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 4: COMPONENTES PERSONALIZADOS
-- ══════════════════════════════════════

CREATE TABLE components (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  created_by  INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE component_materials (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  component_id  INT NOT NULL,
  material_id   INT NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  UNIQUE KEY uk_comp_mat (component_id, material_id)
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 5: ARMAZÉM (LAYOUT & MAPA 2D)
-- ══════════════════════════════════════

CREATE TABLE warehouse_layout (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) DEFAULT 'Armazém Principal',
  room_w    INT NOT NULL DEFAULT 720,
  room_h    INT NOT NULL DEFAULT 480,
  door_x    INT DEFAULT 620,
  door_y    INT DEFAULT 480,
  door_w    INT DEFAULT 100,
  aisles    JSON,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE shelves (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  layout_id   INT NOT NULL,
  shelf_code  VARCHAR(5) NOT NULL,
  pos_x       INT NOT NULL DEFAULT 0,
  pos_y       INT NOT NULL DEFAULT 0,
  width       INT NOT NULL DEFAULT 120,
  height      INT NOT NULL DEFAULT 80,
  levels      INT NOT NULL DEFAULT 4,
  positions   INT NOT NULL DEFAULT 5,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (layout_id) REFERENCES warehouse_layout(id) ON DELETE CASCADE,
  UNIQUE KEY uk_layout_shelf (layout_id, shelf_code)
) ENGINE=InnoDB;

CREATE TABLE shelf_assignments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  shelf_id    INT NOT NULL,
  level       INT NOT NULL,
  position    INT NOT NULL,
  material_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shelf_id) REFERENCES shelves(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  UNIQUE KEY uk_shelf_slot (shelf_id, level, position)
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 6: FORNECEDORES & COMPRAS
-- ══════════════════════════════════════

CREATE TABLE suppliers (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  cnpj          VARCHAR(18) UNIQUE,
  contact_name  VARCHAR(100),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(30),
  address       TEXT,
  notes         TEXT,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cnpj (cnpj)
) ENGINE=InnoDB;

CREATE TABLE purchase_orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  po_number     VARCHAR(30) NOT NULL UNIQUE,
  supplier_id   INT NOT NULL,
  status        ENUM('draft','sent','confirmed','partial','received','cancelled') DEFAULT 'draft',
  total_amount  DECIMAL(12,2) DEFAULT 0.00,
  currency      VARCHAR(5) DEFAULT 'BRL',
  expected_at   DATE,
  received_at   TIMESTAMP NULL,
  notes         TEXT,
  created_by    INT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE purchase_order_items (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  po_id           INT NOT NULL,
  material_id     INT NOT NULL,
  quantity        INT NOT NULL,
  unit_price      DECIMAL(12,2) NOT NULL,
  received_qty    INT DEFAULT 0,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id)
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 7: NOTIFICAÇÕES & ALERTAS
-- ══════════════════════════════════════

CREATE TABLE notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  type        ENUM('info','warning','error','success') DEFAULT 'info',
  title       VARCHAR(200) NOT NULL,
  message     TEXT,
  link        VARCHAR(500),
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_read (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE stock_alerts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  material_id   INT NOT NULL,
  alert_type    ENUM('below_min','above_max','zero_stock','expiring') NOT NULL,
  status        ENUM('active','acknowledged','resolved') DEFAULT 'active',
  resolved_at   TIMESTAMP NULL,
  resolved_by   INT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 8: MENSAGENS & CONTATO
-- ══════════════════════════════════════

CREATE TABLE contact_messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  subject     VARCHAR(200) DEFAULT 'Geral',
  message     TEXT NOT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  replied_at  TIMESTAMP NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_date (created_at)
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 9: AUDITORIA & COMPLIANCE
-- ══════════════════════════════════════

CREATE TABLE audit_log (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT,
  action      VARCHAR(50) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT',
  entity_type VARCHAR(50),
  entity_id   INT,
  old_values  JSON,
  new_values  JSON,
  ip_address  VARCHAR(45),
  user_agent  VARCHAR(500),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_action (user_id, action),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_date (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- MÓDULO 10: CONFIGURAÇÕES DO SISTEMA
-- ══════════════════════════════════════

CREATE TABLE system_settings (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_val TEXT,
  description VARCHAR(300),
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ══════════════════════════════════════
-- VIEWS ÚTEIS
-- ══════════════════════════════════════

CREATE OR REPLACE VIEW vw_low_stock AS
SELECT m.id, m.code, m.description, m.quantity, m.min_qty, m.sector, m.location,
       (m.min_qty - m.quantity) AS deficit
FROM materials m
WHERE m.quantity < m.min_qty AND m.is_active = 1
ORDER BY deficit DESC;

CREATE OR REPLACE VIEW vw_stock_value AS
SELECT m.sector,
       COUNT(*) AS total_items,
       SUM(m.quantity) AS total_qty,
       SUM(m.quantity * m.unit_price) AS total_value
FROM materials m
WHERE m.is_active = 1
GROUP BY m.sector;

CREATE OR REPLACE VIEW vw_recent_movements AS
SELECT mv.id, mv.type, mv.quantity, mv.nf_number, mv.reason, mv.created_at,
       m.code AS material_code, m.description AS material_desc,
       u.name AS user_name
FROM movements mv
JOIN materials m ON mv.material_id = m.id
LEFT JOIN users u ON mv.created_by = u.id
ORDER BY mv.created_at DESC
LIMIT 100;

-- ══════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════

DELIMITER //

-- Auto-create stock alert when quantity drops below min
CREATE TRIGGER trg_stock_alert_after_movement
AFTER INSERT ON movements
FOR EACH ROW
BEGIN
  DECLARE cur_qty INT;
  DECLARE cur_min INT;
  SELECT quantity, min_qty INTO cur_qty, cur_min FROM materials WHERE id = NEW.material_id;
  IF cur_qty < cur_min AND cur_qty >= 0 THEN
    INSERT IGNORE INTO stock_alerts (material_id, alert_type)
    SELECT NEW.material_id, 'below_min'
    FROM DUAL
    WHERE NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE material_id = NEW.material_id AND alert_type = 'below_min' AND status = 'active'
    );
  END IF;
  IF cur_qty = 0 THEN
    INSERT IGNORE INTO stock_alerts (material_id, alert_type)
    SELECT NEW.material_id, 'zero_stock'
    FROM DUAL
    WHERE NOT EXISTS (
      SELECT 1 FROM stock_alerts
      WHERE material_id = NEW.material_id AND alert_type = 'zero_stock' AND status = 'active'
    );
  END IF;
END//

DELIMITER ;

-- ══════════════════════════════════════
-- DADOS INICIAIS (seed)
-- ══════════════════════════════════════

-- Planos
INSERT INTO plans (slug, name, price_monthly, price_annual, max_users, max_materials, features, sla_uptime) VALUES
('starter', 'Starter', 0.00, 0.00, 1, 100, '["dashboard_basico","suporte_email"]', 0.00),
('pro', 'Pro', 19.90, 99.90, 5, -1, '["dashboard_completo","azure","mapa_2d","suporte_prioritario","api"]', 99.50),
('personalizado', 'Personalizado', 0.00, 0.00, -1, -1, '["tudo_pro","api_dedicada","sla_custom","suporte_247","componentes_custom"]', 99.99);

-- Organizações padrão
INSERT INTO organizations (id, name, plan, logo, policies) VALUES
('org_1', 'Evah Ophim Corp', 'Enterprise', NULL, '{"requireMfa": false, "sessionTimeout": 480, "ipWhitelist": ""}');

-- Admin padrão (senha: admin123 → hash bcrypt)
INSERT INTO users (name, surname, email, password_hash, role, email_verified) VALUES
('Admin', 'Sistema', 'admin@evah.com', '$2b$10$placeholder_hash_replace_in_production', 'superadmin', 1);

-- Assinatura do admin
INSERT INTO subscriptions (user_id, plan_id, billing_cycle, status) VALUES
(1, 3, 'annual', 'active');

-- Categorias
INSERT INTO categories (name, slug, description, color) VALUES
('Elétricos', 'eletricos', 'Motores, CLPs, sensores e componentes elétricos', '#6C63FF'),
('Mecânicos', 'mecanicos', 'Rolamentos, válvulas e peças mecânicas', '#00D4FF'),
('Pneumáticos', 'pneumaticos', 'Válvulas, cilindros e acessórios pneumáticos', '#FF6B6B'),
('Pintura', 'pintura', 'Bicos, bombas e insumos de pintura', '#00FF88'),
('Infraestrutura', 'infraestrutura', 'Cabos, conectores e materiais gerais', '#FFB830');

-- Layout padrão do armazém
INSERT INTO warehouse_layout (name, room_w, room_h, door_x, door_y, door_w, aisles) VALUES
('Armazém Principal', 720, 480, 620, 480, 100, '[{"label":"RUA 1","x":220,"y":310},{"label":"RUA 2","x":500,"y":310}]');

-- Prateleiras padrão
INSERT INTO shelves (layout_id, shelf_code, pos_x, pos_y, width, height, levels, positions) VALUES
(1, 'A', 160, 380, 200, 80, 4, 5),
(1, 'B', 60, 120, 80, 220, 4, 5),
(1, 'C', 280, 80, 140, 70, 4, 5),
(1, 'D', 300, 200, 100, 100, 3, 4),
(1, 'E', 600, 80, 120, 120, 4, 5),
(1, 'F', 600, 260, 120, 120, 4, 6);

-- Fornecedores
INSERT INTO suppliers (name, cnpj, contact_name, contact_email) VALUES
('WEG S.A.', '84.429.695/0001-11', 'Vendas WEG', 'vendas@weg.net'),
('Siemens Brasil', '44.013.159/0001-07', 'Depto Comercial', 'comercial@siemens.com.br'),
('SKF do Brasil', '60.389.824/0001-80', 'Peças Industriais', 'pecas@skf.com.br');

-- Materiais de exemplo
INSERT INTO materials (code, description, brand, model, category_id, sector, location, quantity, min_qty, max_qty, unit_price, interchangeable) VALUES
('MERB-00000001', 'Motor Elétrico Trifásico', 'WEG', 'W22 5CV', 1, 'Assembly', 'A1-N2-P3', 5, 2, 20, 1250.00, 0),
('MERB-00000002', 'CLP CPU 1214C DC/DC/DC', 'Siemens', 'S7-1200', 1, 'Assembly', 'E1-N1-P1', 3, 1, 10, 3500.00, 1),
('MERB-00000003', 'Bico Pulverizador de Tinta', 'Graco', 'RAC X', 4, 'Paint', 'P3-N4-P2', 15, 20, 50, 850.00, 1),
('MERB-00000004', 'Sensor Indutivo M12', 'Pepperl+Fuchs', 'NBN8-18GM50', 1, 'Body', 'C4-N1-P2', 42, 10, 100, 125.00, 1),
('MERB-00000005', 'Rolamento Autocompensador', 'SKF', '22210 E', 2, 'Assembly', 'B2-N2-P1', 12, 5, 30, 450.00, 1),
('MERB-00000006', 'Servo Motor AC', 'Yaskawa', 'SGM7J', 1, 'Body', 'A5-N3-P1', 2, 3, 10, 6800.00, 0),
('MERB-00000007', 'Bomba Centrífuga Inox', 'Dancor', 'CBI-16', 4, 'Paint', 'D1-N1-P1', 1, 2, 5, 4200.00, 0),
('MERB-00000008', 'Cabo de Cobre 10mm²', 'Prysmian', 'Superastic', 5, 'General', 'F1-N2-P3', 250, 100, 1000, 12.50, 0),
('MERB-00000009', 'Válvula Solenoide', 'Parker', 'D1VW', 3, 'Assembly', 'C2-N3-P1', 8, 5, 25, 780.00, 0),
('MERB-00000010', 'Válvula Proporcional', 'Bosch Rexroth', '4WREE', 3, 'General', 'G2-N1-P1', 0, 2, 8, 5600.00, 0),
('MERB-00000151', 'IHM KTP700 SIEMENS', 'Siemens', 'KTP700', 1, 'Assembly', 'E1-N2-P1', 0, 1, 3, 8500.00, 0),
('MERB-00000012', 'Relé Térmico S-T', 'Schneider', 'LRD08', 1, 'General', 'F2-N1-P4', 18, 10, 50, 95.00, 0);

-- Configurações do sistema
INSERT INTO system_settings (setting_key, setting_val, description) VALUES
('company_name', 'Kazinho Systems', 'Nome da empresa'),
('system_version', '2.0.0', 'Versão do sistema'),
('default_currency', 'BRL', 'Moeda padrão'),
('material_code_prefix', 'MERB', 'Prefixo do código de material'),
('material_code_length', '8', 'Tamanho do número sequencial'),
('session_timeout_minutes', '480', 'Timeout de sessão em minutos'),
('max_failed_logins', '5', 'Tentativas de login antes de bloquear'),
('lockout_duration_minutes', '30', 'Duração do bloqueio em minutos'),
('backup_retention_days', '30', 'Retenção de backups em dias'),
('audit_log_retention_days', '365', 'Retenção de logs de auditoria');

-- Notificação de boas-vindas
INSERT INTO notifications (user_id, type, title, message) VALUES
(1, 'success', 'Bem-vindo ao EVAH OPHIM!', 'Seu sistema está configurado e pronto para uso. Comece cadastrando seus materiais.');
