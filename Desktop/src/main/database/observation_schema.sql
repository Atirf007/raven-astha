-- Append-only qualified records. Apply with migration account; runtime SELECT/INSERT only.
CREATE TABLE IF NOT EXISTS asset_observations (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 org_id VARCHAR(50) NOT NULL, asset_id INT NOT NULL,
 request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 content_hash CHAR(64) CHARACTER SET ascii NOT NULL,
 kind ENUM('operation','failure') NOT NULL,
 started_at DATETIME(3) NOT NULL, ended_at DATETIME(3) NOT NULL,
 repair_started_at DATETIME(3) NULL, repair_ended_at DATETIME(3) NULL,
 source VARCHAR(120) NOT NULL, notes VARCHAR(500) NOT NULL,
 recorded_by INT NOT NULL, created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY observation_request (org_id,asset_id,request_key),
 INDEX observation_period (org_id,asset_id,started_at,ended_at),
 CHECK (ended_at>started_at),
 CHECK ((kind='operation' AND repair_started_at IS NULL AND repair_ended_at IS NULL)
 OR (kind='failure' AND repair_started_at IS NOT NULL AND repair_ended_at IS NOT NULL AND repair_started_at>=started_at AND repair_ended_at>repair_started_at AND repair_ended_at<=ended_at))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
