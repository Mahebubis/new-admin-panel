-- deploy/monitoring-report-table.sql
--
-- The monitoring history table. Run this ONCE, inside the `istudio_monitor`
-- database — not inside istudio_cit.
--
-- Why a separate database: the monitoring user needs INSERT and DELETE to
-- maintain this table. Granting that on istudio_cit would let it write into
-- the tables holding real student data. Keeping the history in its own
-- database means the monitoring user's only writes against istudio_cit remain
-- the DELETE/UPDATE on its own test account.
--
-- Roughly 600 rows/day at the default schedules. The monitor prunes anything
-- older than DB_REPORT_RETENTION_DAYS (90) automatically, so it settles at
-- ~55,000 rows / a few MB.

CREATE TABLE IF NOT EXISTS `monitoring_runs` (
  `id`           BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,

  -- Groups every check that ran together, so you can show one "run" as a unit.
  `run_id`       VARCHAR(40)      NOT NULL,

  `check_id`     VARCHAR(64)      NOT NULL COMMENT 'registration, exam-submission, ...',
  `check_name`   VARCHAR(160)     NOT NULL COMMENT 'Human readable name',
  `check_group`  VARCHAR(32)      NOT NULL COMMENT 'light | journey',

  -- skip = a dependency failed, so this check could not be evaluated. It is
  -- neither a pass nor a failure and must not be counted as either.
  `status`       ENUM('pass','fail','skip') NOT NULL,

  `started_at`   DATETIME         NOT NULL COMMENT 'UTC',
  `duration_ms`  INT UNSIGNED     NOT NULL DEFAULT 0,
  `attempts`     TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Includes retries',

  `failed_step`  VARCHAR(160)              DEFAULT NULL COMMENT 'Which student action broke',
  `error`        TEXT                      DEFAULT NULL,

  -- Every step with its timing, so the panel can render a full trace.
  `steps_json`   JSON                      DEFAULT NULL,
  `context_json` JSON                      DEFAULT NULL COMMENT 'user id, gateway, order id, ...',

  `alerted`      TINYINT(1)       NOT NULL DEFAULT 0 COMMENT 'Did this result send an email',
  `host`         VARCHAR(64)               DEFAULT NULL,
  `created_at`   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_check_started` (`check_id`, `started_at`),
  KEY `idx_started`       (`started_at`),
  KEY `idx_status`        (`status`, `started_at`),
  KEY `idx_run`           (`run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- ═══════════════════════════════════════════════════════════════════════════
-- Queries for the admin panel
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Current status of every check (the "is everything OK right now" panel).
--    Takes the newest non-skipped row per check.
--
-- SELECT r.check_id, r.check_name, r.status, r.started_at,
--        r.duration_ms, r.failed_step, r.error
-- FROM   monitoring_runs r
-- JOIN  (SELECT check_id, MAX(started_at) AS latest
--        FROM   monitoring_runs
--        WHERE  status <> 'skip'
--        GROUP  BY check_id) m
--   ON   r.check_id = m.check_id AND r.started_at = m.latest
-- ORDER  BY FIELD(r.status,'fail','pass'), r.check_name;


-- 2. Uptime percentage per check over the last 7 days.
--
-- SELECT check_id, check_name,
--        COUNT(*)                                             AS runs,
--        SUM(status = 'pass')                                 AS passed,
--        ROUND(100 * SUM(status = 'pass') / COUNT(*), 2)      AS uptime_pct,
--        ROUND(AVG(duration_ms))                              AS avg_ms
-- FROM   monitoring_runs
-- WHERE  started_at >= NOW() - INTERVAL 7 DAY
--   AND  status <> 'skip'
-- GROUP  BY check_id, check_name
-- ORDER  BY uptime_pct ASC;


-- 3. Recent failures, newest first — the incident feed.
--
-- SELECT started_at, check_name, failed_step, error, attempts, alerted
-- FROM   monitoring_runs
-- WHERE  status = 'fail'
-- ORDER  BY started_at DESC
-- LIMIT  50;


-- 4. Outage windows: consecutive failures grouped into incidents.
--
-- SELECT check_id, check_name,
--        MIN(started_at)                                        AS down_from,
--        MAX(started_at)                                        AS down_until,
--        TIMESTAMPDIFF(MINUTE, MIN(started_at), MAX(started_at)) AS minutes,
--        COUNT(*)                                               AS failed_runs
-- FROM   monitoring_runs
-- WHERE  status = 'fail'
--   AND  started_at >= NOW() - INTERVAL 30 DAY
-- GROUP  BY check_id, check_name, DATE(started_at)
-- ORDER  BY down_from DESC;


-- 5. Full trace of one run, for a detail page.
--
-- SELECT check_name, status, duration_ms, failed_step, error, steps_json
-- FROM   monitoring_runs
-- WHERE  run_id = '20260825T053151-085603'
-- ORDER  BY started_at;


-- 6. Daily trend, for a chart.
--
-- SELECT DATE(started_at) AS day,
--        SUM(status = 'pass') AS passed,
--        SUM(status = 'fail') AS failed
-- FROM   monitoring_runs
-- WHERE  started_at >= NOW() - INTERVAL 30 DAY
--   AND  status <> 'skip'
-- GROUP  BY day
-- ORDER  BY day;


-- NOTE ON TIME ZONES
-- started_at is stored in UTC. Your app runs on Asia/Kolkata, so convert when
-- displaying:  CONVERT_TZ(started_at, '+00:00', '+05:30')
