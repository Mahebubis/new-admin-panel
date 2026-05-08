<?php
/**
 * /api/reports/reports.php
 *
 * Single-file backend for the React Reports page. Handles:
 *   ?action=meta               -> JSON metadata for the page
 *   ?action=student_reminder   -> CSV download
 *   ?type=...                  -> CSV downloads (mirrors legacy download_data.php)
 *
 * Auth: JWT via Authorization header OR ?token=... (browsers can't send headers
 * on <a href> downloads, so the token is appended to the URL by the React code).
 */

ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log');
error_reporting(E_ALL);
set_time_limit(0);
ini_set('memory_limit', '2048M');

/* ─── Streaming setup — kill every layer of buffering so CSV rows reach
   the browser as soon as they're written, instead of after the whole
   query finishes (which is what was making "Loading..." sit there). */
@ini_set('zlib.output_compression', '0');
@ini_set('implicit_flush', '1');
@ini_set('output_buffering', 'off');
if (function_exists('apache_setenv')) { @apache_setenv('no-gzip', '1'); }
while (ob_get_level() > 0) { @ob_end_clean(); }
header('X-Accel-Buffering: no'); // disable nginx proxy buffering
ob_implicit_flush(true);

/* Helper: flush after every CSV row so the download is incremental. */
function rep_flush_row() {
    if (function_exists('ob_get_length') && ob_get_length() !== false) {
        @ob_flush();
    }
    @flush();
}

/* ─── Same config + middleware that every other working API in this folder uses */
require_once __DIR__ . '/../../config/database.php';   // provides $conn, $conn2, $conn3
require_once __DIR__ . '/../../middleware/auth.php';   // require_jwt(), require_permission(), api_error()

/* ─── Optional: separate connection for "istudio_data" (autofill leads).
   If that DB doesn't exist on this server, $data_conn falls back to $conn. */
$data_conn = @new mysqli(DB_HOST, DB_USER, DB_PASS, 'istudio_data');
if ($data_conn->connect_error) {
    $data_conn = $conn; // graceful fallback so the file never explodes
}
@$data_conn->set_charset('utf8mb4');

/* ─── Auth ─── */
require_method('GET');
$jwt = require_jwt();
require_permission('reports', $jwt);

/* ─── Common timestamp + batch-window cache (same as legacy) ─── */
date_default_timezone_set('Asia/Kolkata');
$result = (new DateTime())->format('d-m-Y h-i A');

$batches = [];
$br_rs = mysqli_query($conn, "SELECT * FROM exam_batch_for_reports");
while ($br_rs && $row = mysqli_fetch_assoc($br_rs)) {
    $batches[$row['exam_name']] = [
        'from_date' => $row['from_date'],
        'to_date'   => $row['to_date'],
    ];
}

/* ─── Inline helpers (replacements for the legacy helper.php functions) ─── */
function rep_fetch_internship_map($conn) {
    $map = [];
    $rs = mysqli_query($conn, "SELECT internship_name, learnyst_name FROM internship_list");
    while ($rs && $row = mysqli_fetch_assoc($rs)) {
        $map[$row['internship_name']] = $row['learnyst_name'];
    }
    return $map;
}

function rep_fetch_exam_dates($conn) {
    $batches = [];
    $rs = mysqli_query($conn, "SELECT DISTINCT date FROM exam_dates");
    while ($rs && $r = mysqli_fetch_assoc($rs)) {
        $batches[] = ['date' => $r['date'], 'refund' => 'no'];
    }
    $rs = mysqli_query($conn, "SELECT DISTINCT batch FROM internship_payment WHERE refund='yes'");
    while ($rs && $r = mysqli_fetch_assoc($rs)) {
        if (!empty($r['batch'])) $batches[] = ['date' => $r['batch'], 'refund' => 'yes'];
    }
    usort($batches, function ($a, $b) {
        $parse = function ($d) {
            $d = preg_replace('/(\d+)(st|nd|rd|th)/i', '$1', $d);
            if (!preg_match('/(\d{1,2})\s+([A-Za-z]+),?\s*(\d{4})/', $d, $m)) return 0;
            return mktime(0, 0, 0, (int)date('n', strtotime($m[2])), (int)$m[1], (int)$m[3]);
        };
        return $parse($b['date']) <=> $parse($a['date']);
    });
    return $batches;
}

$internships = rep_fetch_internship_map($conn);
$versions    = isset($_GET['versions']) ? explode(',', $_GET['versions']) : [];

/* ============================================================
   ROUTE 1 — META (JSON for the React page)
============================================================ */
if (($_GET['action'] ?? '') === 'meta') {
    // override the application/json header set by cors.php (it's already JSON, but be explicit)
    header('Content-Type: application/json; charset=UTF-8');

    $cit_new = [];
    $r = mysqli_query($conn, "SELECT id, cit_name FROM cit_version ORDER BY id ASC");
    while ($r && $row = mysqli_fetch_assoc($r)) {
        $cit_new[] = ['id' => (int)$row['id'], 'cit_name' => $row['cit_name']];
    }

    $cit_count = 0;
    $cnt = mysqli_query($conn, "SELECT COUNT(exam_name) AS c FROM exam_batch_for_reports");
    if ($cnt) $cit_count = (int)(mysqli_fetch_assoc($cnt)['c'] ?? 0);

    $batch_dates = rep_fetch_exam_dates($conn);

    echo json_encode([
        'status'      => 'success',
        'cit_new'     => $cit_new,
        'cit_count'   => $cit_count,
        'batch_dates' => $batch_dates,
    ]);
    exit;
}

/* ============================================================
   ROUTE 2 — STUDENT REMINDER (verbatim port of student_reminder.php)
============================================================ */
if (($_GET['action'] ?? '') === 'student_reminder') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="student_reminder.csv"');

    $output = fopen('php://output', 'w');
    fputcsv($output, ['user_id', 'fname', 'lname', 'email', 'remind_later']);

    $rs = $conn->query("SELECT user_id, fname, lname, email, remind_later
                        FROM users WHERE remind_later IS NOT NULL");
    if ($rs) {
        while ($row = $rs->fetch_assoc()) {
            fputcsv($output, [
                $row['user_id'],
                $row['fname'],
                $row['lname'],
                $row['email'],
                ($row['remind_later'] == 1) ? 'Yes' : 'No',
            ]);
        }
    }
    fclose($output);
    exit;
}

/* ============================================================
   ROUTE 3 — CSV DOWNLOADS by ?type=...
============================================================ */
header('Content-Type: text/csv; charset=UTF-8');

$type = $_GET['type'] ?? '';

/* ============================================================
   complete_data — full CSV with batch CASE statement.

   Performance fixes vs original:
   - Pre-filters users in SQL by CIT date window (when ?versions= is given)
     so we never run correlated subqueries against the entire users table.
   - Uses real_query() + use_result() so each row streams from MySQL to
     PHP to the browser instead of being buffered server-side.
   - flush()es after every fputcsv() so the download starts immediately.
============================================================ */
if ($type === 'complete_data') {
    /* ─── SQL pre-filter from ?versions=... (registration window OR
       current_exam_date in the matching batch's date range). ─── */
    $version_filter_sql = '';
    if (!empty($_GET['versions'])) {
        $vs = array_filter(array_map('intval', explode(',', $_GET['versions'])));
        $or_clauses = [];
        foreach ($vs as $v) {
            $name = "CIT $v";
            if (isset($batches[$name])) {
                $f = mysqli_real_escape_string($conn, $batches[$name]['from_date']);
                $t = mysqli_real_escape_string($conn, $batches[$name]['to_date']);
                $or_clauses[] = "(u.registered_at BETWEEN '$f' AND '$t' OR (ad.current_exam_date BETWEEN '$f' AND '$t'))";
            }
        }
        if (!empty($or_clauses)) {
            $version_filter_sql = " AND (" . implode(' OR ', $or_clauses) . ") ";
        }
    }

    if (isset($_GET['version'])) {
        header('Content-Disposition: attachment; filename="IStudio ' . $_GET['version'] . ' - ' . $result . '.csv"');
    } else {
        header('Content-Disposition: attachment; filename="IStudio Complete - ' . $result . '.csv"');
    }
    echo "\xEF\xBB\xBF"; // UTF-8 BOM so Excel reads non-ASCII correctly
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','name','email','phone','whatsapp','city','state','pincode','gender',
        'college_name','program','year','branch','other_branch','student/ca','ca_reg_at',
        'payment_status','applyforexam','active','registered_at','registered_from',
        'has_given_exam','internship_count','wa_community_added','batch','country',
        'medium','campaign','adset','ad','push_notification','exam_qualified',
        'survey_answer','old_login_date','exam_date_selected','fname','lname',
    ]);
    rep_flush_row(); // push header out immediately so the browser stops "Loading..."

    $caseStatement  = "CASE WHEN DATE(u.registered_at) IN('2023-07-12','2023-07-22') THEN 'Imported' ";
    $caseStatement .= "WHEN (SELECT COUNT(r.user_id) FROM result r WHERE r.user_id = u.user_id) > 0 THEN (
        SELECT CONCAT('CIT ', ebt.cit_no) FROM result rt
        INNER JOIN exam_batches ebt ON rt.phase = ebt.batch_id
        WHERE rt.user_id = u.user_id LIMIT 1) ";
    $caseStatement .= "WHEN ad.current_exam_date IS NOT NULL AND ad.current_exam_date <> '' THEN (
        SELECT ebr.exam_name FROM exam_batch_for_reports ebr
        WHERE ad.current_exam_date BETWEEN ebr.from_date AND ebr.to_date LIMIT 1) ";
    $caseStatement .= "WHEN eb.batch_id IS NOT NULL AND eb.batch_id <> '' THEN (
        SELECT CONCAT('CIT ', eb.cit_no) FROM exam_batches eb
        WHERE eb.batch_date = ad.current_exam_date LIMIT 1) ";
    foreach ($batches as $bn => $d) {
        $caseStatement .= "WHEN u.registered_at BETWEEN '" . $d['from_date'] . "' AND '" . $d['to_date'] . "' THEN '" . $bn . "' ";
    }
    $caseStatement .= "ELSE '-' END AS batch";

    $sql = "SELECT u.*,
        (SELECT COUNT(ip.user_id) FROM internship_payment ip WHERE ip.user_id = u.user_id) AS internship_count,
        (SELECT CASE WHEN COUNT(r.user_id) > 0 THEN 'Yes' ELSE 'No' END FROM result r WHERE r.user_id = u.user_id) AS has_given_exam,
        (SELECT us.cit_whatsapp_community FROM user_steps us WHERE us.user_id = u.user_id) AS wa_community_added,
        $caseStatement,
        ucm.medium, ucm.campaign, ucm.adset, ucm.ad,
        COALESCE((SELECT CASE
            WHEN upn.endpoint = 'denied' THEN 'Denied'
            WHEN upn.endpoint IS NOT NULL THEN 'Allowed'
            ELSE 'Unavailable' END
            FROM user_push_notification upn
            WHERE upn.user_id = u.user_id ORDER BY upn.id DESC LIMIT 1), 'Unavailable') AS push_notification,
        (SELECT CASE WHEN COUNT(r.user_id) > 0 THEN 'Yes' ELSE 'No' END FROM result r WHERE r.user_id = u.user_id) AS exam_qualified,
        usa.answer AS survey_answer,
        ad.old_login_date, ad.current_exam_date
        FROM users u
        INNER JOIN additional_details ad ON u.user_id = ad.user_id
        LEFT JOIN user_survey_answers usa ON u.user_id = usa.user_id
        LEFT JOIN user_campaign ucm ON u.user_id = ucm.user_id
        LEFT JOIN exam_batches eb ON eb.batch_date = ad.current_exam_date
        WHERE u.active = 1 AND u.role = 4 $version_filter_sql";

    /* ─── Stream rows: real_query + use_result avoids loading the whole
       result set into PHP memory and lets us flush each row out. ─── */
    if (!$conn->real_query($sql)) {
        fputcsv($fp, ['ERROR', $conn->error]);
        fclose($fp);
        exit;
    }
    $res = $conn->use_result();
    while ($rows = $res->fetch_assoc()) {
        // Belt-and-suspenders: keep the PHP version filter as a safety net
        if (isset($_GET['version']) && $rows['batch'] != $_GET['version']) continue;
        if (!empty($versions)) {
            $batchNumber = preg_replace('/[^0-9]/', '', $rows['batch']);
            if (!in_array($batchNumber, $versions)) continue;
        }
        fputcsv($fp, [
            $rows['user_id'], ucwords($rows['name']), $rows['email'], $rows['phone'], $rows['whatsapp'],
            $rows['city'], $rows['state'], $rows['pincode'], $rows['gender'],
            $rows['college_name'], $rows['program'], $rows['year'], $rows['branch'], $rows['other_branch'],
            $rows['role'] == 2 ? 'CA' : ($rows['role'] == 4 ? 'Student' : ''),
            $rows['ca_reg_at'], $rows['payment_status'], $rows['applyforexam'], $rows['active'],
            $rows['registered_at'], $rows['registered_from'],
            $rows['has_given_exam'], $rows['internship_count'], $rows['wa_community_added'],
            $rows['batch'], $rows['country'],
            $rows['medium'], $rows['campaign'], $rows['adset'], $rows['ad'],
            $rows['push_notification'], $rows['exam_qualified'], $rows['survey_answer'],
            $rows['old_login_date'], $rows['current_exam_date'],
            ucwords($rows['fname']), ucwords($rows['lname']),
        ]);
        rep_flush_row();
    }
    $res->free();
    fclose($fp);
    exit;
}

/* ============================================================
   simplified_complete_data — CIT-id-driven date window with EXCEPT/UNION
============================================================ */
if ($type === 'simplified_complete_data') {
    if (empty($_GET['versions'])) { http_response_code(400); echo "CIT id is required"; exit; }
    $vs = explode(',', $_GET['versions']);
    $cit_id = intval($vs[0]);

    $date_rs = mysqli_query($conn, "
        SELECT DATE_ADD(from_date, INTERVAL 1 DAY) AS start_date, to_date AS end_date
        FROM exam_batch_for_reports
        WHERE exam_name = CONCAT('CIT ', $cit_id) LIMIT 1");
    $date_row = $date_rs ? mysqli_fetch_assoc($date_rs) : null;
    if (!$date_row) { http_response_code(400); echo "Invalid CIT ID"; exit; }
    $start_date = $date_row['start_date'];
    $end_date   = $date_row['end_date'];

    header('Content-Type: text/csv; charset=UTF-8');
    header("Content-Disposition: attachment; filename=\"Simplified_IStudio_CIT_{$cit_id}.csv\"");
    echo "\xEF\xBB\xBF";
    $fp = fopen('php://output', 'w');

    fputcsv($fp, [
        'user_id','fname','lname','name','email','phone','state','gender',
        'has_given_exam','internship_count','wa_community_added','batch',
        'country','medium','campaign','adset','ad',
        'push_notification','exam_qualified','survey_answer',
        'old_login_date','fb_lead','registered_at','current_exam_date',
        'domain_name','subdomain_name',
    ]);

    $caseStatement  = "CASE ";
    $caseStatement .= "WHEN DATE(u.registered_at) IN('2023-07-12','2023-07-22') THEN 'Imported' ";
    $caseStatement .= "WHEN (SELECT COUNT(r.user_id) FROM result r WHERE r.user_id=u.user_id)>0 THEN (
        SELECT CONCAT('CIT ', ebt.cit_no) FROM result rt
        JOIN exam_batches ebt ON rt.phase=ebt.batch_id
        WHERE rt.user_id=u.user_id LIMIT 1) ";
    $caseStatement .= "WHEN ad.current_exam_date IS NOT NULL AND ad.current_exam_date<>'' THEN (
        SELECT ebr.exam_name FROM exam_batch_for_reports ebr
        WHERE ad.current_exam_date BETWEEN ebr.from_date AND ebr.to_date LIMIT 1) ";
    $caseStatement .= "ELSE '-' END AS batch";

    $sql = "
        SELECT u.user_id, u.fname, u.lname, u.name, u.email, u.phone, u.state,
            u.gender, u.country, u.fb_lead, u.registered_at,
            ad.old_login_date, ad.current_exam_date,
            (SELECT CASE WHEN COUNT(r.user_id)>0 THEN 'Yes' ELSE 'No' END FROM result r WHERE r.user_id=u.user_id) AS has_given_exam,
            (SELECT COUNT(ip.user_id) FROM internship_payment ip WHERE ip.user_id=u.user_id) AS internship_count,
            (SELECT us.cit_whatsapp_community FROM user_steps us WHERE us.user_id=u.user_id) AS wa_community_added,
            {$caseStatement},
            ucm.medium, ucm.campaign, ucm.adset, ucm.ad,
            COALESCE((SELECT CASE
                WHEN upn.endpoint='denied' THEN 'Denied'
                WHEN upn.endpoint IS NOT NULL THEN 'Allowed'
                ELSE 'Unavailable' END
                FROM user_push_notification upn
                WHERE upn.user_id=u.user_id ORDER BY upn.id DESC LIMIT 1), 'Unavailable') AS push_notification,
            (SELECT CASE WHEN COUNT(r.user_id)>0 THEN 'Yes' ELSE 'No' END FROM result r WHERE r.user_id=u.user_id) AS exam_qualified,
            usa.answer AS survey_answer,
            usd.domain_name, usd.subdomain_name
        FROM users u
        INNER JOIN additional_details ad ON u.user_id=ad.user_id
        LEFT  JOIN user_survey_answers usa ON u.user_id=usa.user_id
        LEFT  JOIN user_campaign ucm ON u.user_id=ucm.user_id
        LEFT  JOIN user_slected_domain_new usd ON u.user_id = usd.user_id
        WHERE u.active = 1 AND u.role = 4
          AND u.user_id IN (
              (SELECT u1.user_id FROM users u1
               WHERE u1.registered_at BETWEEN '$start_date' AND CONCAT('$end_date',' 23:59:59'))
              EXCEPT
              (SELECT DISTINCT u2.user_id FROM users u2
               JOIN cit_results cr2 ON u2.user_id = cr2.user_id
               WHERE u2.registered_at BETWEEN '$start_date' AND CONCAT('$end_date',' 23:59:59')
                 AND cr2.`timestamp` > CONCAT('$end_date',' 23:59:59'))
              UNION
              (SELECT DISTINCT u3.user_id FROM users u3
               JOIN cit_results cr3 ON u3.user_id = cr3.user_id
               WHERE u3.registered_at < '$start_date'
                 AND cr3.`timestamp` BETWEEN '$start_date' AND CONCAT('$end_date',' 23:59:59'))
          )";

    $conn->real_query($sql);
    $res = $conn->use_result();
    while ($row = $res->fetch_assoc()) {
        fputcsv($fp, [
            $row['user_id'],
            ucwords($row['fname']), ucwords($row['lname']), ucwords($row['name']),
            $row['email'], $row['phone'], $row['state'], $row['gender'],
            $row['has_given_exam'], $row['internship_count'], $row['wa_community_added'],
            $row['batch'], $row['country'],
            $row['medium'], $row['campaign'], $row['adset'], $row['ad'],
            $row['push_notification'], $row['exam_qualified'], $row['survey_answer'],
            $row['old_login_date'], $row['fb_lead'], $row['registered_at'],
            $row['current_exam_date'],
            $row['domain_name'], $row['subdomain_name'],
        ]);
        rep_flush_row();
    }
    fclose($fp);
    exit;
}

/* ============================================================
   complete_data_new — by users.cit_id (new CIT version table)
============================================================ */
if ($type === 'complete_data_new') {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="IStudio Complete (New) - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','name','email','phone','whatsapp','city','state','pincode','gender',
        'college_name','program','year','branch','other_branch','student_or_ca','ca_reg_at',
        'payment_status','applyforexam','active','registered_at','registered_from',
        'has_given_exam','internship_count','wa_community_added','batch','country',
        'medium','campaign','adset','ad','push_notification','exam_qualified','survey_answer',
        'old_login_date','current_exam_date','fname','lname',
    ]);

    $cit_ids = isset($_GET['cit_ids']) ? array_map('intval', explode(',', $_GET['cit_ids'])) : [];
    $cit_ids_sql = !empty($cit_ids)
        ? " AND u.cit_id IS NOT NULL AND u.cit_id IN (" . implode(',', $cit_ids) . ") "
        : " AND u.cit_id IS NOT NULL ";

    $sql = "SELECT u.*, u.instant_result,
        (SELECT COUNT(ip.user_id) FROM internship_payment ip WHERE ip.user_id = u.user_id) AS internship_count,
        (SELECT CASE WHEN COUNT(r.user_id)>0 THEN 'Yes' ELSE 'No' END FROM result r WHERE r.user_id = u.user_id) AS has_given_exam,
        (SELECT us.cit_whatsapp_community FROM user_steps us WHERE us.user_id = u.user_id) AS wa_community_added,
        '' AS batch,
        ucm.medium, ucm.campaign, ucm.adset, ucm.ad,
        COALESCE((SELECT CASE
            WHEN upn.endpoint='denied' THEN 'Denied'
            WHEN upn.endpoint IS NOT NULL THEN 'Allowed'
            ELSE 'Unavailable' END
            FROM user_push_notification upn
            WHERE upn.user_id = u.user_id ORDER BY upn.id DESC LIMIT 1), 'Unavailable') AS push_notification,
        (SELECT CASE WHEN COUNT(r.user_id)>0 THEN 'Yes' ELSE 'No' END FROM result r WHERE r.user_id = u.user_id) AS exam_qualified,
        usa.answer AS survey_answer,
        ad.old_login_date, ad.current_exam_date
        FROM users u
        INNER JOIN additional_details ad ON u.user_id = ad.user_id
        LEFT  JOIN user_survey_answers usa ON u.user_id = usa.user_id
        LEFT  JOIN user_campaign ucm ON u.user_id = ucm.user_id
        WHERE u.active = 1 AND u.role = 4 $cit_ids_sql";

    $rs = mysqli_query($conn, $sql);
    rep_flush_row(); // make sure header bytes go out before the slow loop
    while ($rs && $row = $rs->fetch_assoc()) {
        fputcsv($fp, [
            $row['user_id'], ucwords($row['name']), $row['email'], $row['phone'], $row['whatsapp'],
            $row['city'], $row['state'], $row['pincode'], $row['gender'],
            $row['college_name'], $row['program'], $row['year'], $row['branch'], $row['other_branch'],
            ($row['role'] == 2 ? 'CA' : ($row['role'] == 4 ? 'Student' : '')),
            $row['ca_reg_at'], $row['payment_status'], $row['applyforexam'], $row['active'],
            $row['registered_at'], $row['registered_from'],
            $row['has_given_exam'], $row['internship_count'], $row['wa_community_added'],
            $row['batch'], $row['country'],
            $row['medium'], $row['campaign'], $row['adset'], $row['ad'],
            $row['push_notification'], $row['exam_qualified'],
            $row['survey_answer'], $row['old_login_date'], $row['current_exam_date'],
            ucwords($row['fname']), ucwords($row['lname']),
        ]);
        rep_flush_row();
    }
    fclose($fp);
    exit;
}

/* ============================================================
   simplified_complete_data_new — by users.cit_id
============================================================ */
if ($type === 'simplified_complete_data_new') {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="Simplified IStudio Complete (New) - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','fname','lname','name','email','phone','state','gender',
        'has_given_exam','internship_count','wa_community_added','batch',
        'country','medium','campaign','adset','ad',
        'push_notification','exam_qualified','instant_result','survey_answer',
        'old_login_date','fb_lead','registered_at','current_exam_date',
    ]);

    $cit_ids = isset($_GET['cit_ids']) ? array_map('intval', explode(',', $_GET['cit_ids'])) : [];
    $cit_ids_sql = !empty($cit_ids)
        ? " AND u.cit_id IS NOT NULL AND u.cit_id IN (" . implode(',', $cit_ids) . ") "
        : " AND u.cit_id IS NOT NULL ";

    $sql = "SELECT u.*, u.instant_result,
        (SELECT COUNT(ip.user_id) FROM internship_payment ip WHERE ip.user_id = u.user_id) AS internship_count,
        (SELECT CASE WHEN COUNT(r.user_id)>0 THEN 'Yes' ELSE 'No' END FROM result r WHERE r.user_id = u.user_id) AS has_given_exam,
        (SELECT us.cit_whatsapp_community FROM user_steps us WHERE us.user_id = u.user_id) AS wa_community_added,
        '' AS batch,
        ucm.medium, ucm.campaign, ucm.adset, ucm.ad,
        COALESCE((SELECT CASE
            WHEN upn.endpoint='denied' THEN 'Denied'
            WHEN upn.endpoint IS NOT NULL THEN 'Allowed'
            ELSE 'Unavailable' END
            FROM user_push_notification upn
            WHERE upn.user_id = u.user_id ORDER BY upn.id DESC LIMIT 1), 'Unavailable') AS push_notification,
        (SELECT CASE WHEN COUNT(r.user_id)>0 THEN 'Yes' ELSE 'No' END FROM result r WHERE r.user_id = u.user_id) AS exam_qualified,
        usa.answer AS survey_answer,
        ad.old_login_date, ad.current_exam_date
        FROM users u
        INNER JOIN additional_details ad ON u.user_id = ad.user_id
        LEFT  JOIN user_survey_answers usa ON u.user_id = usa.user_id
        LEFT  JOIN user_campaign ucm ON u.user_id = ucm.user_id
        WHERE u.active = 1 AND u.role = 4 $cit_ids_sql";

    $rs = mysqli_query($conn, $sql);
    rep_flush_row();
    while ($rs && $row = $rs->fetch_assoc()) {
        fputcsv($fp, [
            $row['user_id'], ucwords($row['fname']), ucwords($row['lname']),
            ucwords($row['name']), $row['email'], $row['phone'], $row['state'], $row['gender'],
            $row['has_given_exam'], $row['internship_count'], $row['wa_community_added'],
            $row['batch'], $row['country'],
            $row['medium'], $row['campaign'], $row['adset'], $row['ad'],
            $row['push_notification'], $row['exam_qualified'], $row['instant_result'],
            $row['survey_answer'], $row['old_login_date'], $row['fb_lead'],
            $row['registered_at'], $row['current_exam_date'],
        ]);
        rep_flush_row();
    }
    fclose($fp);
    exit;
}

/* ============================================================
   all_students  (+ optional ?status=paid|unpaid)
============================================================ */
if ($type === 'all_students') {
    header('Content-Disposition: attachment; filename="IStudio Student - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','name','email','phone','whatsapp','city','state','pincode','gender',
        'college_name','program','year','branch','other_branch','used_ref_id','payment_id',
        'payment_status','payment_amount','applyforexam','active','registered_at','registered_from',
    ]);

    $sql = "SELECT * FROM users INNER JOIN additional_details
            ON users.user_id = additional_details.user_id
            WHERE users.role = 4 AND users.active = 1";
    if (isset($_GET['status'])) {
        $applyforexam = ($_GET['status'] === 'paid') ? 1 : 0;
        $statusSafe = mysqli_real_escape_string($conn, $_GET['status']);
        $sql .= " AND additional_details.payment_status = '$statusSafe' OR users.applyforexam = $applyforexam";
    }
    $rs = mysqli_query($conn, $sql);
    while ($rows = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [
            $rows['user_id'], ucwords($rows['name']), $rows['email'], $rows['phone'], $rows['whatsapp'],
            $rows['city'], $rows['state'], $rows['pincode'], $rows['gender'],
            $rows['college_name'], $rows['program'], $rows['year'], $rows['branch'], $rows['other_branch'],
            $rows['used_ref_id'], $rows['payment_id'], $rows['payment_status'], $rows['payment_amount'],
            $rows['applyforexam'], $rows['active'], $rows['registered_at'], $rows['registered_from'],
        ]);
    }
    // Append dropoff temp_data rows (legacy behavior)
    $rs2 = mysqli_query($conn, "SELECT t.phone, t.timestamp FROM temp_data t
                                WHERE t.phone NOT IN (SELECT phone FROM users) AND t.role = 4");
    while ($rs2 && $rows = mysqli_fetch_assoc($rs2)) {
        fputcsv($fp, ['-','-','-', $rows['phone'], '-','-','-','-','-','-','-','-','-','-',
                      '-','-','-','-','-','-', $rows['timestamp'], '-']);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   dropoff_mobile
============================================================ */
if ($type === 'dropoff_mobile') {
    header('Content-Disposition: attachment; filename="Dropoff Mobile Number - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, ['phone', 'timestamp']);
    $rs = mysqli_query($conn, "SELECT t.phone, t.timestamp FROM temp_data t
                               WHERE t.phone NOT IN (SELECT phone FROM users) AND t.role = 4");
    while ($rs && $row = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [$row['phone'], $row['timestamp']]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   deactivated_students
============================================================ */
if ($type === 'deactivated_students') {
    header('Content-Disposition: attachment; filename="IStudio Deactivated Students - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','name','email','phone','whatsapp','city','state','pincode','gender',
        'college_name','program','year','branch','other_branch','applyforexam','active','registered_at',
    ]);
    $rs = mysqli_query($conn, "SELECT * FROM users INNER JOIN additional_details
                                ON users.user_id = additional_details.user_id
                                WHERE users.role = 4 AND users.active = 0");
    while ($rs && $rows = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [
            $rows['user_id'], ucwords($rows['name']), $rows['email'], $rows['phone'], $rows['whatsapp'],
            $rows['city'], $rows['state'], $rows['pincode'], $rows['gender'],
            $rows['college_name'], $rows['program'], $rows['year'], $rows['branch'], $rows['other_branch'],
            $rows['applyforexam'], $rows['active'], $rows['registered_at'],
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   student_applications — basic export of internship applications
============================================================ */
if ($type === 'student_applications') {
    header('Content-Disposition: attachment; filename="Student Applications - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'application_id','user_id','name','email','phone','internship','batch',
        'payment_id','paid_at','status','applied_at',
    ]);
    // Best-effort export. Adjust the SELECT if you have a dedicated student_applications table.
    $rs = @mysqli_query($conn, "
        SELECT ip.id AS application_id, u.user_id, u.name, u.email, u.phone,
               ip.internship, ip.batch, ip.payment_id, ip.paid_at,
               COALESCE(ip.refund, '-') AS status, ip.paid_at AS applied_at
        FROM internship_payment ip
        INNER JOIN users u ON u.user_id = ip.user_id
        WHERE u.active = 1
        ORDER BY ip.paid_at DESC");
    while ($rs && $r = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [
            $r['application_id'], $r['user_id'], ucwords($r['name']), $r['email'], $r['phone'],
            $r['internship'], $r['batch'], $r['payment_id'], $r['paid_at'],
            $r['status'], $r['applied_at'],
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   student_internship_sheet
============================================================ */
if ($type === 'student_internship_sheet') {
    header('Content-Disposition: attachment; filename="IStudio Student Internships - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','name','phone','email','internship','batch','payment_id','paid_at',
        'plan','amount','upgraded_payment_id','gold_community_link',
    ]);
    $sql = "SELECT u.user_id, u.name, u.phone, u.email,
                   e.internship, e.batch, e.payment_id, e.paid_at, e.internship_level,
                   ps.amount, e.upgraded_payment_id,
                   (SELECT il.gold_community_link FROM internship_list il
                    WHERE il.internship_name = e.internship LIMIT 1) AS gold_community_link
            FROM internship_payment e
            INNER JOIN users u ON u.user_id = e.user_id
            LEFT JOIN payment_status ps
                ON e.payment_id COLLATE utf8mb4_unicode_ci = ps.payment_id COLLATE utf8mb4_unicode_ci
            WHERE u.active = 1";
    $rs = mysqli_query($conn, $sql);
    while ($rs && $rows = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [
            $rows['user_id'], ucwords($rows['name']), $rows['phone'], $rows['email'],
            $rows['internship'], $rows['batch'], $rows['payment_id'], $rows['paid_at'],
            $rows['internship_level'], $rows['amount'], $rows['upgraded_payment_id'],
            $rows['gold_community_link'],
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   learnyst_internship_sheet — by ?batch + ?refund
============================================================ */
if ($type === 'learnyst_internship_sheet') {
    $batch  = mysqli_real_escape_string($conn, $_GET['batch'] ?? '');
    $refund = mysqli_real_escape_string($conn, $_GET['refund'] ?? 'no');
    header('Content-Disposition: attachment; filename="IStudio Learnyst Sheet - ' . $batch . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'SerialNo','LearnerName','LearnerEmail','Password','Mobile','CourseName',
        'Validity','AmountPaid','DripStartDate','AccessType','PricingName','MakeAsAffiliate','AffiliateCode',
    ]);
    $sql = "SELECT u.name, u.phone, u.email, e.internship, e.batch, e.payment_id,
                   e.paid_at, e.internship_level
            FROM users u
            INNER JOIN internship_payment e ON u.user_id = e.user_id
            WHERE e.batch = '$batch' AND e.refund = '$refund' AND u.active = 1";
    $courseNameOverrides = [
        'ui/ux design'              => 'UI UX',
        'pharmaceutical'            => 'Pharmacy',
        'artificial intelligence'   => 'Artificial Intelligence (New)',
        'autocad'                   => 'AutoCAD Essentials',
        'cpp and data structures'   => 'C++ & Data Structure',
    ];
    $rs = mysqli_query($conn, $sql);
    while ($rs && $row = mysqli_fetch_assoc($rs)) {
        $courseName = trim(preg_replace('/\s*internship\s*$/i', '', $row['internship']));
        $key = strtolower($courseName);
        if (isset($courseNameOverrides[$key])) {
            $courseName = $courseNameOverrides[$key];
        }
        fputcsv($fp, [
            '', ucwords($row['name']), $row['email'], 'Istudio@123', $row['phone'],
            $courseName, '',
            $row['internship_level'] === 'Gold' ? '1980' : '880',
            '', 'paid', '', '', '',
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   user_exam_credentials
============================================================ */
if ($type === 'user_exam_credentials') {
    header('Content-Disposition: attachment; filename="IStudio Student Exam Credentials - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, ['user_id','name','phone','email','password']);
    $rs = mysqli_query($conn, "SELECT u.user_id, u.name, u.phone, u.email, e.password
                                FROM users u
                                INNER JOIN exam_credentials e ON u.user_id = e.user_id
                                WHERE u.active = 1");
    while ($rs && $rows = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [$rows['user_id'], ucwords($rows['name']), $rows['phone'], $rows['email'], $rows['password']]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   gst_data
============================================================ */
if ($type === 'gst_data') {
    header('Content-Disposition: attachment; filename="GST Data Sheet - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','name','email','phone','state','country','payment_id','internship_name','batch','paid_at',
    ]);
    $rs = mysqli_query($conn, "SELECT u.user_id, u.name, u.email, u.phone, u.state, u.country,
                                       ip.payment_id, ip.internship, ip.batch, ip.paid_at
                                FROM users u
                                INNER JOIN internship_payment ip ON u.user_id = ip.user_id
                                WHERE u.active = 1");
    while ($rs && $rows = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [
            $rows['user_id'], ucwords($rows['name']), $rows['email'], $rows['phone'],
            $rows['state'], $rows['country'], $rows['payment_id'],
            $rows['internship'], $rows['batch'], $rows['paid_at'],
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   user_exam_result — joins istudio_cit.result + istudio_exam.result
============================================================ */
if ($type === 'user_exam_result') {
    header('Content-Disposition: attachment; filename="IStudio Student Exam Result - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','name','phone','email','rightans','wrongans','total','rank','percentile','exam_date',
    ]);
    $sql = "SELECT u.user_id, u.name, u.email, u.phone,
                   COALESCE(rc.rightans, re.rightans) AS rightans,
                   COALESCE(rc.wrongans, re.wrongans) AS wrongans,
                   re.skipq, re.exam_taken_date, rc.total, rc.rank, rc.percentile
            FROM istudio_cit.users u
            LEFT JOIN istudio_cit.result  rc ON u.user_id = rc.user_id
            LEFT JOIN istudio_exam.result re ON u.user_id = re.user_id
            WHERE re.exam_taken_date IS NOT NULL
            ORDER BY re.exam_taken_date DESC";
    $rs = mysqli_query($conn, $sql);
    while ($rs && $rows = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [
            $rows['user_id'], ucwords($rows['name']), $rows['phone'], $rows['email'],
            $rows['rightans'], $rows['wrongans'], $rows['total'],
            $rows['rank'], $rows['percentile'], $rows['exam_taken_date'],
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   user_purchased_internships — uses $conn2 (istudio_exam) for exam date
============================================================ */
if ($type === 'user_purchased_internships') {
    header('Content-Disposition: attachment; filename="IStudio Student Purchased Internships - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'user_id','name','email','phone','purchased_internships','registered_at','exam_taken_date',
    ]);
    $rs = mysqli_query($conn, "SELECT u.user_id, u.name, u.email, u.phone,
                                       COUNT(ip.id) AS purchased_internships, u.registered_at
                                FROM users u
                                INNER JOIN internship_payment ip ON u.user_id = ip.user_id
                                WHERE u.active = 1
                                GROUP BY u.user_id, u.name, u.email, u.phone, u.registered_at");
    while ($rs && $rows = mysqli_fetch_assoc($rs)) {
        $exam_date = 'null';
        if ($conn2) {
            $stmt = mysqli_prepare($conn2, "SELECT exam_taken_date FROM result WHERE user_id = ?");
            if ($stmt) {
                mysqli_stmt_bind_param($stmt, 'i', $rows['user_id']);
                mysqli_stmt_execute($stmt);
                $r = mysqli_stmt_get_result($stmt);
                $erow = $r ? mysqli_fetch_assoc($r) : null;
                if (!empty($erow['exam_taken_date'])) $exam_date = $erow['exam_taken_date'];
                mysqli_stmt_close($stmt);
            }
        }
        fputcsv($fp, [
            $rows['user_id'], ucwords($rows['name']), $rows['email'], $rows['phone'],
            $rows['purchased_internships'], $rows['registered_at'], $exam_date,
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   user_ip_data
============================================================ */
if ($type === 'user_ip_data') {
    header('Content-Disposition: attachment; filename="IStudio User IP - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, ['user_id','name','email','phone','ip_address','domain','accessed_at']);
    $rs = mysqli_query($conn, "SELECT u.user_id, u.name, u.phone, u.email,
                                       ui.ip_address, ui.domain, ui.accessed_at
                                FROM users u
                                INNER JOIN user_ip ui ON u.user_id = ui.user_id
                                WHERE u.active = 1");
    while ($rs && $rows = mysqli_fetch_assoc($rs)) {
        $accessed_at = $rows['accessed_at'] ? date('jS F, Y', strtotime($rows['accessed_at'])) : '';
        fputcsv($fp, [
            $rows['user_id'], ucwords($rows['name']), $rows['email'], $rows['phone'],
            $rows['ip_address'], $rows['domain'], $accessed_at,
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   autofill_reg_data — uses $data_conn (istudio_data DB if available)
============================================================ */
if ($type === 'autofill_reg_data') {
    header('Content-Disposition: attachment; filename="Autofill Registration Data - ' . $result . '.csv"');
    $fp = fopen('php://output', 'w');
    fputcsv($fp, [
        'id','email','phone','state','email_sent','is_user_registered','timestamp','email_scheduled_at',
    ]);
    $rs = @mysqli_query($data_conn, "SELECT * FROM temp_user_leads");
    while ($rs && $rows = mysqli_fetch_assoc($rs)) {
        fputcsv($fp, [
            $rows['id'], $rows['email'], $rows['phone'], $rows['state'],
            $rows['email_sent'], $rows['user_registered'] ?? ($rows['is_user_registered'] ?? ''),
            $rows['timestamp'], $rows['email_scheduled_at'],
        ]);
    }
    fclose($fp);
    exit;
}

/* ============================================================
   user_profile_completion — chunked, supports BOTH old (?versions=)
   and new (?cit_ids=) filters. Heavy lifting in sibling file.
============================================================ */
if ($type === 'user_profile_completion') {
    require __DIR__ . '/profile_completion_report.php';
    exit;
}

/* ─── Unknown type ─── */
http_response_code(400);
header('Content-Type: application/json; charset=UTF-8');
echo json_encode(['success' => false, 'message' => 'Unknown report type or action: ' . $type]);
exit;