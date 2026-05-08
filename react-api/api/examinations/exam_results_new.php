<?php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

// Same MySQL memory tuning as PHP
$conn->query("SET SESSION tmp_table_size = 1024 * 1024 * 256");
$conn->query("SET SESSION max_heap_table_size = 1024 * 1024 * 256");
$conn->query("SET SESSION sort_buffer_size = 1024 * 1024 * 64");
$conn->query("SET SESSION read_rnd_buffer_size = 1024 * 1024 * 64");

$action = $_POST['action'] ?? '';

/* ════════════════════════════════════════
   FETCH EXAM RESULTS
   Exact same query as PHP, including:
   - Default: loads last 7 days when no filters (matches JS $(document).ready defaults)
   - Search: name OR email LIKE
   - Date: DATE(cr.timestamp) BETWEEN start AND end
   - All same JOINs: cit_results, users, user_campaign, result, internship_payment,
     assigned_links, whatsapp_placement_club_link, user_slected_domain_new
════════════════════════════════════════ */
if ($action === 'fetch_exam_results') {
    $limit   = (int)($_POST['limit']  ?? 10);
    $offset  = (int)($_POST['offset'] ?? 0);
    $keyword    = trim($_POST['keyword']    ?? '');
    $start_date = trim($_POST['start_date'] ?? '');
    $end_date   = trim($_POST['end_date']   ?? '');

    $where = "WHERE cr.exam_id = 1";

    // Default — load last 7 days when no filters (same as PHP JS default)
    if ($keyword === '' && $start_date === '' && $end_date === '') {
        $today    = date('Y-m-d');
        $last7    = date('Y-m-d', strtotime('-7 days'));
        $where   .= " AND DATE(cr.timestamp) BETWEEN '$last7' AND '$today'";
    }

    if ($keyword !== '') {
        $safe = $conn->real_escape_string($keyword);
        $where .= " AND (u.name LIKE '%$safe%' OR u.email LIKE '%$safe%')";
    }

    if ($start_date && !$end_date) {
        $safe_start = $conn->real_escape_string($start_date);
        $today      = date('Y-m-d');
        $where     .= " AND DATE(cr.timestamp) BETWEEN '$safe_start' AND '$today'";
    } elseif ($start_date && $end_date) {
        $safe_start = $conn->real_escape_string($start_date);
        $safe_end   = $conn->real_escape_string($end_date);
        $where     .= " AND DATE(cr.timestamp) BETWEEN '$safe_start' AND '$safe_end'";
    }

    /* ── exact same query as PHP (final version, no commented blocks) ── */
    $query = "
        SELECT
            u.user_id, u.name, u.email, u.phone,
            uc.medium, uc.ad, uc.adset, uc.campaign,
            u.instant_exam, u.registered_at,
            cr.correct_answers AS rightans,
            cr.wrong_answers   AS wrongans,
            (cr.correct_answers * 3) AS total,

            CASE
                WHEN cr.time_taken > 1800 THEN ROUND(cr.time_taken / 60000, 1)
                ELSE ROUND(cr.time_taken / 60, 1)
            END AS time_taken_not_readable,

            CASE
                WHEN cr.time_taken > 1800 THEN CONCAT(ROUND(cr.time_taken / 60000, 1), ' minutes')
                WHEN cr.time_taken < 1    THEN CONCAT(ROUND(cr.time_taken, 2), ' second')
                WHEN cr.time_taken < 60   THEN CONCAT(ROUND(cr.time_taken, 1), ' seconds')
                WHEN cr.time_taken < 3600 THEN CONCAT(ROUND(cr.time_taken / 60, 1), ' minutes')
                WHEN cr.time_taken < 86400 THEN CONCAT(ROUND(cr.time_taken / 3600, 2), ' hours')
                ELSE CONCAT(ROUND(cr.time_taken / 86400, 2), ' days')
            END AS time_taken_readable,

            CASE
                WHEN cr.time_taken < 60    THEN CONCAT(cr.time_taken, ' seconds')
                WHEN cr.time_taken < 3600  THEN CONCAT(ROUND(cr.time_taken / 60, 1), ' minutes')
                WHEN cr.time_taken < 86400 THEN CONCAT(ROUND(cr.time_taken / 3600, 2), ' hours')
                ELSE CONCAT(ROUND(cr.time_taken / 86400, 2), ' days')
            END AS time_taken,

            cr.timestamp AS exam_taken_date,
            cr.cit_version,
            r.rank,

            CASE
                WHEN TIMESTAMPDIFF(DAY, u.registered_at, cr.timestamp) > 30 THEN
                    CONCAT(FLOOR(TIMESTAMPDIFF(DAY, u.registered_at, cr.timestamp) / 30), ' month',
                           IF(FLOOR(TIMESTAMPDIFF(DAY, u.registered_at, cr.timestamp) / 30) > 1, 's ', ' '),
                           MOD(TIMESTAMPDIFF(DAY, u.registered_at, cr.timestamp), 30), ' day',
                           IF(MOD(TIMESTAMPDIFF(DAY, u.registered_at, cr.timestamp), 30) != 1, 's', ''))
                ELSE TRIM(CONCAT(
                    IF(TIMESTAMPDIFF(DAY,    u.registered_at, cr.timestamp) > 0,
                       CONCAT(TIMESTAMPDIFF(DAY, u.registered_at, cr.timestamp), ' days '), ''),
                    IF(MOD(TIMESTAMPDIFF(HOUR,   u.registered_at, cr.timestamp), 24) > 0,
                       CONCAT(MOD(TIMESTAMPDIFF(HOUR, u.registered_at, cr.timestamp), 24), ' hours '), ''),
                    IF(MOD(TIMESTAMPDIFF(MINUTE, u.registered_at, cr.timestamp), 60) > 0,
                       CONCAT(MOD(TIMESTAMPDIFF(MINUTE, u.registered_at, cr.timestamp), 60), ' minutes'), '')
                ))
            END AS time_difference,

            wpl.community_name AS assigned_name,
            wpl.community_link AS assigned_link,
            COALESCE(ip.internship_list, 'No') AS internship_purchased,
            GROUP_CONCAT(DISTINCT dm.domain_name    SEPARATOR ', ') AS domain,
            GROUP_CONCAT(DISTINCT dm.subdomain_name SEPARATOR ', ') AS subdomain

        FROM cit_results cr
        INNER JOIN users u       ON u.user_id   = cr.user_id
        LEFT  JOIN user_campaign uc ON uc.user_id = u.user_id
        LEFT  JOIN result r      ON r.user_id   = u.user_id
        LEFT  JOIN (
            SELECT user_id, GROUP_CONCAT(internship SEPARATOR ', ') AS internship_list
            FROM internship_payment GROUP BY user_id
        ) ip ON r.user_id = ip.user_id
        LEFT  JOIN assigned_links al               ON al.user_id  = u.user_id
        LEFT  JOIN whatsapp_placement_club_link wpl ON wpl.id = al.assigned_id
        LEFT  JOIN user_slected_domain_new dm      ON dm.user_id  = u.user_id
        $where
        GROUP BY u.user_id, cr.timestamp, cr.correct_answers, cr.wrong_answers,
                 cr.time_taken, cr.cit_version, r.rank,
                 wpl.community_name, wpl.community_link, ip.internship_list
        ORDER BY cr.timestamp DESC
        LIMIT $limit OFFSET $offset
    ";

    $result = $conn->query($query);
    $rows   = [];
    if ($result) while ($r = $result->fetch_assoc()) $rows[] = $r;

    // Count query
    $count_res = $conn->query("SELECT COUNT(*) AS total FROM cit_results cr
        INNER JOIN users u ON u.user_id = cr.user_id $where");
    $total = $count_res ? (int)$count_res->fetch_assoc()['total'] : 0;

    echo json_encode(['status'=>'success','data'=>$rows,'total'=>$total]);
    exit;
}

/* ════════════════════════════════════════
   EDIT RESULT
   Exact same as PHP edit_student_exam_result_new:
   UPDATE cit_results + UPDATE result
════════════════════════════════════════ */
if ($action === 'edit_student_exam_result_new') {
    $user_id  = mysqli_real_escape_string($conn, $_POST['user_id']  ?? '');
    $rightans = mysqli_real_escape_string($conn, $_POST['rightans'] ?? '');
    $wrongans = mysqli_real_escape_string($conn, $_POST['wrongans'] ?? '');
    $total    = mysqli_real_escape_string($conn, $_POST['total']    ?? '');
    $rank     = mysqli_real_escape_string($conn, $_POST['rank']     ?? '');
    $exam_id  = 1;

    $conn->query("UPDATE cit_results
                  SET correct_answers='$rightans', wrong_answers='$wrongans'
                  WHERE user_id='$user_id' AND exam_id='$exam_id'");

    $conn->query("UPDATE result
                  SET rightans='$rightans', wrongans='$wrongans', total='$total', rank='$rank'
                  WHERE user_id='$user_id'");

    echo json_encode(['status'=>'success','message'=>'Result updated successfully']);
    exit;
}

/* ════════════════════════════════════════
   DELETE RESULT
   Exact same as PHP delete_student_exam_result_new:
   DELETE from 4 tables in order
════════════════════════════════════════ */
if ($action === 'delete_student_exam_result_new') {
    $user_id  = mysqli_real_escape_string($conn, $_POST['user_id']  ?? '');
    $rightans = mysqli_real_escape_string($conn, $_POST['rightans'] ?? '');
    $exam_id  = 1;

    $queries = [
        "DELETE FROM cit_exam_login WHERE user_id='$user_id' AND exam_id='$exam_id'",
        "DELETE FROM cit_exam_data  WHERE user_id='$user_id' AND exam_id='$exam_id'",
        "DELETE FROM cit_results    WHERE user_id='$user_id' AND correct_answers='$rightans' AND exam_id='$exam_id'",
        "DELETE FROM result         WHERE user_id='$user_id' AND rightans='$rightans'",
    ];
    foreach ($queries as $q) $conn->query($q);

    echo json_encode(['status'=>'success','message'=>'Result deleted successfully']);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>