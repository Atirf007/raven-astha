-- Additive schema, MySQL 8. Apply with a migration account after backup.
-- Runtime account needs SELECT/INSERT on studies/snapshots, SELECT/INSERT/UPDATE
-- on jobs. Do not grant UPDATE or DELETE on immutable snapshots.
CREATE TABLE IF NOT EXISTS analytics_studies (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 org_id VARCHAR(50) COLLATE utf8mb4_bin NOT NULL,
 name VARCHAR(120) NOT NULL, question VARCHAR(1000) NOT NULL,
 created_by INT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY study_tenant (id,org_id), INDEX studies_owner (org_id,created_by,created_at),
 INDEX studies_tenant_history (org_id,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS analytics_snapshots (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 study_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 org_id VARCHAR(50) COLLATE utf8mb4_bin NOT NULL, version INT UNSIGNED NOT NULL,
 dataset JSON NOT NULL, content_hash CHAR(64) CHARACTER SET ascii NOT NULL,
 row_count INT UNSIGNED NOT NULL, created_by INT NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY snapshot_tenant (id,org_id), UNIQUE KEY study_version (study_id,version),
 FOREIGN KEY (study_id,org_id) REFERENCES analytics_studies(id,org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS analytics_jobs (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 org_id VARCHAR(50) COLLATE utf8mb4_bin NOT NULL,
 study_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 snapshot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash CHAR(64) CHARACTER SET ascii NOT NULL, method VARCHAR(50) NOT NULL,
 parameters JSON NOT NULL, created_by INT NOT NULL,
 status ENUM('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
 attempts INT UNSIGNED NOT NULL DEFAULT 0, lease_token CHAR(36) CHARACTER SET ascii NULL,
 lease_expires_at DATETIME(3) NULL, result JSON NULL, error_code VARCHAR(60) NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), completed_at DATETIME(3) NULL,
 UNIQUE KEY job_tenant (id,org_id), UNIQUE KEY request_identity (org_id,created_by,request_key), INDEX jobs_queue (status,lease_expires_at,created_at),
 INDEX jobs_study_history (study_id,org_id,created_at,id),
 FOREIGN KEY (study_id,org_id) REFERENCES analytics_studies(id,org_id),
 FOREIGN KEY (snapshot_id,org_id) REFERENCES analytics_snapshots(id,org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Immutable idempotency receipt for analytical publication from operational data.
CREATE TABLE IF NOT EXISTS analytics_source_publications (
 org_id VARCHAR(50) COLLATE utf8mb4_bin NOT NULL, created_by INT NOT NULL,
 request_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 request_hash CHAR(64) CHARACTER SET ascii NOT NULL,
 study_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 snapshot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (org_id,created_by,request_key),
 FOREIGN KEY (study_id,org_id) REFERENCES analytics_studies(id,org_id),
 FOREIGN KEY (snapshot_id,org_id) REFERENCES analytics_snapshots(id,org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Quarantine is private and expires after 24 hours. Raw content is never served as a web file.
CREATE TABLE IF NOT EXISTS analytics_imports (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 study_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 org_id VARCHAR(50) COLLATE utf8mb4_bin NOT NULL, created_by INT NOT NULL,
 format ENUM('csv','json') NOT NULL, origin VARCHAR(200) NOT NULL,
 raw_sha256 CHAR(64) CHARACTER SET ascii NOT NULL, raw_data MEDIUMBLOB NULL,
 status ENUM('quarantined','ready','failed','published','expired') NOT NULL DEFAULT 'quarantined',
 table_data JSON NULL, parser_engine JSON NULL, mapped_data JSON NULL,
 mapped_hash CHAR(64) CHARACTER SET ascii NULL,
 snapshot_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), expires_at DATETIME(3) NOT NULL,
 INDEX imports_retention (org_id,expires_at), INDEX imports_expiry (expires_at), INDEX imports_admission (org_id,created_at),
 FOREIGN KEY (study_id,org_id) REFERENCES analytics_studies(id,org_id),
 FOREIGN KEY (snapshot_id,org_id) REFERENCES analytics_snapshots(id,org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

-- Append-only documentary reviews; SELECT/INSERT only for the runtime account.
-- Private mutable drafts are separate from immutable published snapshots.
CREATE TABLE IF NOT EXISTS analytics_drafts (
 study_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 org_id VARCHAR(50) COLLATE utf8mb4_bin NOT NULL, created_by INT NOT NULL,
 draft JSON NULL, version INT UNSIGNED NOT NULL DEFAULT 1,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(study_id,created_by), INDEX drafts_owner(org_id,created_by),
 FOREIGN KEY(study_id,org_id) REFERENCES analytics_studies(id,org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS analytics_reviews (
 id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
 job_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 org_id VARCHAR(50) COLLATE utf8mb4_bin NOT NULL,
 reviewer_id INT NOT NULL, reviewer_name VARCHAR(150) NOT NULL,
 decision ENUM('accepted','rejected') NOT NULL, note VARCHAR(2000) NOT NULL,
 result_hash CHAR(64) CHARACTER SET ascii NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY review_identity (job_id,reviewer_id),
 FOREIGN KEY (job_id,org_id) REFERENCES analytics_jobs(id,org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
