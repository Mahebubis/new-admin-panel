<?php
/*
 * /api/students/simplified-data.php   (OPTIMIZED)
 *
 *   GET action=fetch_data    → paginated 23-column rows  (target < 1s)
 *   GET action=download_csv  → streaming CSV, JOIN-based (target < 30s for 3M rows)
 *
 *   Key changes vs the previous file:
 *     1.  COUNT(*) on the unfiltered set is cached for 5 min.
 *         (The full users table has 3M+ rows; counting them per page-load
 *          was the single biggest cost.)
 *     2.  EXISTS(...) replaces SELECT COUNT(...) > 0  (stops at first match).
 *     3.  CSV uses JOIN-based aggregation rather than 7 correlated subqueries
 *         per row — drops export from "minutes" to "seconds per million rows".
 *     4.  Paginated query keeps the original sub-query shape because, after
 *         LIMIT 20, those sub-queries fire only ~140 times and are < 100ms total
 *         once the indexes from indexes.sql are in place.
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

$jwt = require_jwt();
require_permission('download_student_data', $jwt);

$action     = $_GET['action']     ?? 'fetch_data';
$keyword    = trim($_GET['keyword']    ?? '');
$start_date = trim($_GET['start_date'] ?? '');
$end_date   = trim($_GET['end_date']   ?? '');

/* ── WHERE builder ─────────────────────────────────────────── */
$where      = "WHERE u.active = 1 AND u.role = 4";
$hasFilters = false;

if ($keyword !== '') {
    $safe   = $conn->real_escape_string($keyword);
    $where .= " AND u.email LIKE '%$safe%'";
    $hasFilters = true;
}
if ($start_date) {
    if (!$end_date) $end_date = date('Y-m-d');
    $sd = $conn->real_escape_string($start_date);
    $ed = $conn->real_escape_string($end_date);
    /* range-form so idx_users_active_role_reg is used (no DATE() wrap) */
    $where .= " AND u.registered_at >= '$sd 00:00:00'"
            . " AND u.registered_at <  DATE_ADD('$ed', INTERVAL 1 DAY)";
    $hasFilters = true;
}

/* ── batch CASE (used by both paginated + CSV) ─────────────── */
$batchCase = "
    CASE
        WHEN u.registered_at >= '2023-07-12 00:00:00'
         AND u.registered_at <  '2023-07-13 00:00:00' THEN 'Imported'
        WHEN u.registered_at >= '2023-07-22 00:00:00'
         AND u.registered_at <  '2023-07-23 00:00:00' THEN 'Imported'
        WHEN EXISTS(SELECT 1 FROM result r WHERE r.user_id = u.user_id) THEN
            (SELECT CONCAT('CIT ', ebt.cit_no)
             FROM result rt
             JOIN exam_batches ebt ON rt.phase = ebt.batch_id
             WHERE rt.user_id = u.user_id LIMIT 1)
        WHEN ad.current_exam_date <> '' THEN
            (SELECT ebr.exam_name
             FROM exam_batch_for_reports ebr
             WHERE ad.current_exam_date BETWEEN ebr.from_date AND ebr.to_date LIMIT 1)
        ELSE '-'
    END AS batch
";

/* ════════════════════════════════════════════════════════════
   CSV DOWNLOAD  (JOIN-based, single pass, streamed)
═══════════════════════════════════════════════════════════ */
if ($action === 'download_csv') {
    set_time_limit(0);
    ini_set('memory_limit', '512M');

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="simplified_data_' . date('Y-m-d') . '.csv"');
    while (ob_get_level()) ob_end_clean();
    echo "\xEF\xBB\xBF"; // UTF-8 BOM for Excel

    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'User ID','Fname','Lname','Name','Email','Phone',
        'State','Gender','Has Given Exam','Internship Count',
        'WA Community Added','Batch','Country',
        'Medium','Campaign','Adset','Ad',
        'Push Notification','Exam Qualified',
        'Survey Answer','Old Login Date','Registered At','Current Exam Date'
    ]);

    /*
     * CSV-only query: derived tables are materialised once, then hash-joined.
     * Each "subquery" no longer fires per row.
     */
    $csvSql = "
        SELECT
            u.user_id, u.fname, u.lname, u.name, u.email, u.phone,
            COALESCE(u.state,'')  AS state,
            COALESCE(u.gender,'') AS gender,

            CASE WHEN rs.cnt > 0 THEN 'Yes' ELSE 'No' END AS has_given_exam,
            COALESCE(ip.cnt, 0)                             AS internship_count,
            us.cit_whatsapp_community                       AS wa_community_added,

            CASE
                WHEN u.registered_at >= '2023-07-12 00:00:00'
                 AND u.registered_at <  '2023-07-13 00:00:00' THEN 'Imported'
                WHEN u.registered_at >= '2023-07-22 00:00:00'
                 AND u.registered_at <  '2023-07-23 00:00:00' THEN 'Imported'
                WHEN rs.cnt > 0 THEN CONCAT('CIT ', eb.cit_no)
                WHEN ad.current_exam_date <> '' THEN
                    (SELECT ebr.exam_name FROM exam_batch_for_reports ebr
                     WHERE ad.current_exam_date BETWEEN ebr.from_date AND ebr.to_date LIMIT 1)
                ELSE '-'
            END AS batch,

            COALESCE(u.country,'')    AS country,
            COALESCE(ucm.medium,'')   AS medium,
            COALESCE(ucm.campaign,'') AS campaign,
            COALESCE(ucm.adset,'')    AS adset,
            COALESCE(ucm.ad,'')       AS ad,

            CASE
                WHEN upn.endpoint = 'denied'    THEN 'Denied'
                WHEN upn.endpoint IS NOT NULL   THEN 'Allowed'
                ELSE 'Unavailable'
            END AS push_notification,

            CASE WHEN rs.cnt > 0 THEN 'Yes' ELSE 'No' END AS exam_qualified,

            COALESCE(usa.answer,'') AS survey_answer,
            ad.old_login_date,
            u.registered_at,
            ad.current_exam_date

        FROM users u
        INNER JOIN additional_details ad     ON ad.user_id = u.user_id
        LEFT JOIN  user_survey_answers usa   ON usa.user_id = u.user_id
        LEFT JOIN  user_campaign ucm         ON ucm.user_id = u.user_id
        LEFT JOIN  user_steps us             ON us.user_id  = u.user_id

        /* result aggregated: one row per user with a count + first phase */
        LEFT JOIN (
            SELECT r.user_id, COUNT(*) AS cnt, MIN(r.phase) AS phase
            FROM result r
            GROUP BY r.user_id
        ) rs ON rs.user_id = u.user_id
        LEFT JOIN exam_batches eb ON eb.batch_id = rs.phase

        /* internship_payment count */
        LEFT JOIN (
            SELECT user_id, COUNT(*) AS cnt
            FROM internship_payment
            GROUP BY user_id
        ) ip ON ip.user_id = u.user_id

        /* latest push_notification per user (id DESC LIMIT 1) */
        LEFT JOIN (
            SELECT p1.user_id, p1.endpoint
            FROM user_push_notification p1
            INNER JOIN (
                SELECT user_id, MAX(id) AS max_id
                FROM user_push_notification
                GROUP BY user_id
            ) p2 ON p2.user_id = p1.user_id AND p2.max_id = p1.id
        ) upn ON upn.user_id = u.user_id

        $where
        ORDER BY u.registered_at DESC
    ";

    $conn->real_query($csvSql);
    $res = $conn->use_result();   // streams rows, no RAM build-up
    while ($row = $res->fetch_assoc()) {
        fputcsv($fp, [
            $row['user_id'],
            $row['fname'],
            $row['lname'],
            $row['name'],
            $row['email'],
            "\t" . $row['phone'],
            $row['state'],
            $row['gender'],
            $row['has_given_exam'],
            $row['internship_count'],
            $row['wa_community_added']  ?? '',
            $row['batch'],
            $row['country'],
            $row['medium'],
            $row['campaign'],
            $row['adset'],
            $row['ad'],
            $row['push_notification']   ?? 'Unavailable',
            $row['exam_qualified'],
            $row['survey_answer'],
            $row['old_login_date']      ?? '',
            $row['registered_at'],
            $row['current_exam_date']   ?? '',
        ]);
    }
    $res->close();
    fclose($fp);
    exit();
}

/* ════════════════════════════════════════════════════════════
   FETCH DATA  (paginated JSON, 20 rows)
═══════════════════════════════════════════════════════════ */
$cols = "
    u.user_id, u.fname, u.lname, u.name, u.email, u.phone,
    COALESCE(u.state,'')  AS state,
    COALESCE(u.gender,'') AS gender,

    /* EXISTS short-circuits at first match — much faster than COUNT */
    IF(EXISTS(SELECT 1 FROM result r WHERE r.user_id = u.user_id),'Yes','No') AS has_given_exam,

    (SELECT COUNT(*) FROM internship_payment ip WHERE ip.user_id = u.user_id) AS internship_count,

    (SELECT us.cit_whatsapp_community FROM user_steps us WHERE us.user_id = u.user_id LIMIT 1) AS wa_community_added,

    $batchCase,

    COALESCE(u.country,'')    AS country,
    COALESCE(ucm.medium,'')   AS medium,
    COALESCE(ucm.campaign,'') AS campaign,
    COALESCE(ucm.adset,'')    AS adset,
    COALESCE(ucm.ad,'')       AS ad,

    (SELECT CASE
         WHEN upn.endpoint='denied'    THEN 'Denied'
         WHEN upn.endpoint IS NOT NULL THEN 'Allowed'
         ELSE 'Unavailable' END
     FROM user_push_notification upn
     WHERE upn.user_id = u.user_id ORDER BY upn.id DESC LIMIT 1) AS push_notification,

    /* identical to has_given_exam — kept as separate alias for the UI contract */
    IF(EXISTS(SELECT 1 FROM result r WHERE r.user_id = u.user_id),'Yes','No') AS exam_qualified,

    COALESCE(usa.answer,'') AS survey_answer,
    ad.old_login_date,
    u.registered_at,
    ad.current_exam_date
";

$joins = "
    FROM users u
    INNER JOIN additional_details ad   ON ad.user_id  = u.user_id
    LEFT JOIN  user_survey_answers usa ON usa.user_id = u.user_id
    LEFT JOIN  user_campaign ucm       ON ucm.user_id = u.user_id
";

$page    = max(1, (int)($_GET['page']     ?? 1));
$perPage = max(1, min(100, (int)($_GET['per_page'] ?? 20)));
$offset  = ($page - 1) * $perPage;

/* ── COUNT ──
 *  No-filter case  → cached for 5 minutes (it changes slowly).
 *  Filtered case   → re-run, but the smaller filtered set counts fast.
 */
if (!$hasFilters) {
    $cacheFile = sys_get_temp_dir() . '/sd_total_active_role4.cache';
    $cacheTtl  = 300;
    if (is_file($cacheFile) && (time() - filemtime($cacheFile)) < $cacheTtl) {
        $total = (int) file_get_contents($cacheFile);
    } else {
        $cntRes = $conn->query(
            "SELECT COUNT(*) AS c
             FROM users u
             INNER JOIN additional_details ad ON ad.user_id = u.user_id
             WHERE u.active = 1 AND u.role = 4"
        );
        $total = $cntRes ? (int)$cntRes->fetch_assoc()['c'] : 0;
        @file_put_contents($cacheFile, $total);
    }
} else {
    $cntRes = $conn->query("SELECT COUNT(*) AS c $joins $where");
    $total  = $cntRes ? (int)$cntRes->fetch_assoc()['c'] : 0;
}

/* ── rows ── */
$rows = [];
$res  = $conn->query("SELECT $cols $joins $where ORDER BY u.registered_at DESC LIMIT $perPage OFFSET $offset");
if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;

api_success(['students' => $rows, 'total' => $total, 'page' => $page]);
?>