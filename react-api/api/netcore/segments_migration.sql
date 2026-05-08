-- Run once on the istudio_cit database to create the segments storage table.
-- mysql -u <user> -p istudio_cit < segments_migration.sql

CREATE TABLE IF NOT EXISTS netcore_segments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    contact_type            VARCHAR(64)  NOT NULL DEFAULT 'all_identified',
    config                  LONGTEXT     NOT NULL,                          -- JSON of include/exclude blocks
    user_count              INT          NOT NULL DEFAULT 0,
    user_count_refreshed_at DATETIME     NULL,
    created_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_created_at (created_at),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
