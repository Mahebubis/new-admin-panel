-- deploy/cleanup-synthetic-users.sql
--
-- Ongoing cleanup is handled by the monitor itself: every journey run deletes
-- the fixed test account before re-registering it (src/db.js). You do not need
-- a scheduled job for that.
--
-- This file covers two things the monitor does not:
--
--   PART A — accounts left over from the initial build and testing, which used
--            a generated-email scheme before switching to the fixed account.
--   PART B — a grant script for the tightly scoped MySQL user the monitor
--            should connect as.
--
-- ⚠ Confirm the table and column names against your schema first. They are
--   written from the code in exam-backend and user_dashboard, not from a dump.
--   Take a backup before the first run, and never run a DELETE without running
--   the SELECT above it.


-- ═══════════════════════════════════════════════════════════════════════════
-- PART A — remove leftover test accounts
-- ═══════════════════════════════════════════════════════════════════════════

-- A.1  What is there? Review this before deleting anything.
SELECT id, email, fname, lname, phone, registered_at
FROM   users
WHERE  email LIKE 'monitor\_%@internshipstudio.com'
   OR  email = 'monitor.test@internshipstudio.com'
ORDER  BY id DESC;

-- A.2  Collect the ids once so every delete below targets the same set.
DROP TEMPORARY TABLE IF EXISTS monitor_users;
CREATE TEMPORARY TABLE monitor_users AS
SELECT id
FROM   users
WHERE  email LIKE 'monitor\_%@internshipstudio.com';   -- generated-email era only

SELECT COUNT(*) AS accounts_to_remove FROM monitor_users;

-- A.3  Exam artefacts. Preview first:
--   SELECT * FROM cit_results    WHERE user_id IN (SELECT id FROM monitor_users);
--   SELECT * FROM cit_exam_login WHERE user_id IN (SELECT id FROM monitor_users);
DELETE FROM cit_results    WHERE user_id IN (SELECT id FROM monitor_users);
DELETE FROM cit_exam_login WHERE user_id IN (SELECT id FROM monitor_users);

-- A.4  Payment artefacts. These are unpaid orders — the checkout check never
--      completes a payment. Verify before deleting:
--   SELECT order_id, order_status, amount, created_at
--   FROM   payments WHERE user_id IN (SELECT id FROM monitor_users);
DELETE FROM payments WHERE user_id IN (SELECT id FROM monitor_users);

-- A.5  The accounts themselves.
DELETE FROM users WHERE id IN (SELECT id FROM monitor_users);

DROP TEMPORARY TABLE IF EXISTS monitor_users;

-- A.6  Alternative to deleting: flag and exclude. Safer if your schema has
--      foreign keys or audit triggers that make deletes risky. The `users`
--      table already has an `is_test_account` column, and the monitor sets it
--      to 1 automatically on each run.
--
--   UPDATE users SET is_test_account = 1
--   WHERE  email LIKE 'monitor\_%@internshipstudio.com'
--      OR  email = 'monitor.test@internshipstudio.com';
--
--   Then filter `WHERE is_test_account = 0` in reporting queries.


-- ═══════════════════════════════════════════════════════════════════════════
-- PART B — the monitoring database user
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The monitor needs to delete the test account before re-registering it. Give
-- it its own credentials rather than reusing the application's, scoped to the
-- four tables it touches. Replace <monitor-server-ip> and <strong-password>.

-- CREATE USER 'monitoring'@'<monitor-server-ip>' IDENTIFIED BY '<strong-password>';
--
-- -- SELECT to find the account, DELETE to remove it, UPDATE for is_test_account.
-- GRANT SELECT, DELETE, UPDATE ON istudio_cit.users          TO 'monitoring'@'<monitor-server-ip>';
-- GRANT SELECT, DELETE         ON istudio_cit.cit_results    TO 'monitoring'@'<monitor-server-ip>';
-- GRANT SELECT, DELETE         ON istudio_cit.cit_exam_login TO 'monitoring'@'<monitor-server-ip>';
-- GRANT SELECT, DELETE         ON istudio_cit.payments       TO 'monitoring'@'<monitor-server-ip>';
--
-- FLUSH PRIVILEGES;
--
-- The monitor also reads information_schema to check that a table and column
-- exist before touching them; that needs no extra grant.
--
-- Remember to open 3306 to the monitoring server's IP in the database security
-- group — it runs on a different machine from the app servers.
