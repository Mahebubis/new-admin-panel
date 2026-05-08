<?php
/**
 * /api/reports/profile_completion_report.php
 *
 * Required by reports.php for ?type=user_profile_completion
 *
 * Filter modes:
 *   ?versions=1,2,3   -> OLD: filter by exam_batch_for_reports / current_exam_date
 *   ?cit_ids=1,2,3    -> NEW: filter by users.cit_id
 *
 * Uses $conn from reports.php (already authenticated and connected).
 */

if (!isset($conn) || !$conn) {
    http_response_code(500);
    echo "DB connection unavailable";
    return;
}

ini_set('max_execution_time', 0);
ini_set('memory_limit', '2048M');

date_default_timezone_set('Asia/Kolkata');
$fileDate = (new DateTime())->format('d-m-Y h-i A');

/* ─── Decide filter mode ─── */
$mode = '';
$filter_sql = '';
if (!empty($_GET['cit_ids'])) {
    $mode = 'new';
    $arr = array_filter(array_map('intval', explode(',', $_GET['cit_ids'])));
    if (!empty($arr)) {
        $filter_sql = " AND u.cit_id IS NOT NULL AND u.cit_id IN (" . implode(',', $arr) . ") ";
    } else {
        $filter_sql = " AND u.cit_id IS NOT NULL ";
    }
} elseif (!empty($_GET['versions'])) {
    $mode = 'old';
    $vs = array_filter(explode(',', $_GET['versions']), 'is_numeric');
    if (!empty($vs)) {
        $versions_in = implode(',', array_map(function ($v) { return "'CIT $v'"; }, $vs));
        $filter_sql = "
            AND u.user_id IN (
                SELECT ad.user_id FROM additional_details ad
                JOIN exam_batch_for_reports ebr
                  ON DATE(ebr.from_date) <= DATE(ad.current_exam_date)
                 AND DATE(ebr.to_date)   >= DATE(ad.current_exam_date)
                WHERE ebr.exam_name IN ($versions_in)
            ) ";
    }
}

/* ─── CSV headers ─── */
@ob_end_clean();
header('Content-Type: text/csv; charset=utf-8');
$fname = $mode === 'new' ? "profile_completion_report_new_$fileDate.csv"
       : ($mode === 'old' ? "profile_completion_report_$fileDate.csv"
                          : "profile_completion_report_all_$fileDate.csv");
header('Content-Disposition: attachment; filename="' . $fname . '"');

$fp = fopen('php://output', 'w');
fputcsv($fp, [
    'user_id','fname','lname','email','phone','registered_at',
    'Photo','Resume','Profile Summary','Resume Headline','Key Skills',
    'Employment History','Education','Projects','Online Profiles',
    'Career Profile','Personal Details','Address',
    'Languages','Certifications','Extracurricular Activities',
    'Profile Completion %',
]);

$chunk_size = 5000;
$offset = 0;

while (true) {
    /* ─── Fetch a chunk of users ─── */
    $sql_users = "
        SELECT u.user_id, u.fname, u.lname, u.email, u.phone,
               u.photo, u.resume, u.dob, u.registered_at
        FROM users u
        WHERE u.active = 1 AND u.role = 4
        $filter_sql
        ORDER BY u.user_id
        LIMIT $offset, $chunk_size
    ";
    $res_users = $conn->query($sql_users);
    if (!$res_users || $res_users->num_rows === 0) break;

    $users = [];
    $user_ids = [];
    while ($row = $res_users->fetch_assoc()) {
        $users[$row['user_id']] = $row;
        $user_ids[] = (int)$row['user_id'];
    }
    if (empty($user_ids)) break;
    $user_ids_str = implode(',', $user_ids);

    /* ─── Bulk-load every related table once per chunk ─── */
    $additional = [];
    $rs = $conn->query("SELECT user_id, about_me, tagline FROM additional_details
                        WHERE user_id IN ($user_ids_str)");
    while ($rs && $r = $rs->fetch_assoc()) $additional[$r['user_id']] = $r;

    $addresses = [];
    $rs = @$conn->query("SELECT user_id, city, state, country, pincode FROM user_address
                         WHERE user_id IN ($user_ids_str)");
    while ($rs && $r = $rs->fetch_assoc()) $addresses[$r['user_id']] = $r;

    $skills = [];
    $rs = @$conn->query("SELECT user_id, skills FROM user_skills WHERE user_id IN ($user_ids_str)");
    while ($rs && $r = $rs->fetch_assoc()) $skills[$r['user_id']] = $r;

    $work_count = [];
    $rs = @$conn->query("SELECT user_id, COUNT(*) AS c FROM user_work
                         WHERE user_id IN ($user_ids_str) GROUP BY user_id");
    while ($rs && $r = $rs->fetch_assoc()) $work_count[$r['user_id']] = (int)$r['c'];

    $edu_count = [];
    $rs = @$conn->query("SELECT user_id, COUNT(*) AS c FROM user_education
                         WHERE user_id IN ($user_ids_str) GROUP BY user_id");
    while ($rs && $r = $rs->fetch_assoc()) $edu_count[$r['user_id']] = (int)$r['c'];

    $proj_count = [];
    $rs = @$conn->query("SELECT user_id, COUNT(*) AS c FROM user_projects
                         WHERE user_id IN ($user_ids_str) GROUP BY user_id");
    while ($rs && $r = $rs->fetch_assoc()) $proj_count[$r['user_id']] = (int)$r['c'];

    $social_exist = [];
    $rs = @$conn->query("SELECT DISTINCT user_id FROM user_social
                         WHERE user_id IN ($user_ids_str)");
    while ($rs && $r = $rs->fetch_assoc()) $social_exist[$r['user_id']] = true;

    $career = [];
    $rs = @$conn->query("SELECT user_id, current_industry FROM user_career_profile
                         WHERE user_id IN ($user_ids_str)");
    while ($rs && $r = $rs->fetch_assoc()) $career[$r['user_id']] = $r;

    $personal = [];
    $rs = @$conn->query("SELECT user_id, marital_status FROM user_personal_details
                         WHERE user_id IN ($user_ids_str)");
    while ($rs && $r = $rs->fetch_assoc()) $personal[$r['user_id']] = $r;

    $lang_count = [];
    $rs = @$conn->query("SELECT user_id, COUNT(*) AS c FROM user_languages
                         WHERE user_id IN ($user_ids_str) GROUP BY user_id");
    while ($rs && $r = $rs->fetch_assoc()) $lang_count[$r['user_id']] = (int)$r['c'];

    $cert_count = [];
    $rs = @$conn->query("SELECT user_id, COUNT(*) AS c FROM user_certifications
                         WHERE user_id IN ($user_ids_str) GROUP BY user_id");
    while ($rs && $r = $rs->fetch_assoc()) $cert_count[$r['user_id']] = (int)$r['c'];

    $extra_count = [];
    $rs = @$conn->query("SELECT user_id, COUNT(*) AS c FROM user_extracurriculars
                         WHERE user_id IN ($user_ids_str) GROUP BY user_id");
    while ($rs && $r = $rs->fetch_assoc()) $extra_count[$r['user_id']] = (int)$r['c'];

    /* ─── Build CSV row per user ─── */
    foreach ($users as $uid => $u) {
        $photo = (!empty($u['photo']) && $u['photo'] !== "https://hire.internshipstudio.com/assets/img/avatars/avatar_placeholder.png") ? 'Yes' : 'No';
        $resume = !empty($u['resume']) ? 'Yes' : 'No';

        $prof_sum = isset($additional[$uid]) && !empty($additional[$uid]['about_me']) ? 'Yes' : 'No';
        $res_head = isset($additional[$uid]) && !empty($additional[$uid]['tagline']) ? 'Yes' : 'No';

        $key_sk      = (isset($skills[$uid]) && !empty($skills[$uid]['skills'])) ? 'Yes' : 'No';
        $emp_hist    = (!empty($work_count[$uid]))  ? 'Yes' : 'No';
        $edu         = (!empty($edu_count[$uid]))   ? 'Yes' : 'No';
        $proj        = (!empty($proj_count[$uid]))  ? 'Yes' : 'No';
        $online_prof = isset($social_exist[$uid])   ? 'Yes' : 'No';
        $car_prof    = (isset($career[$uid]) && !empty($career[$uid]['current_industry'])) ? 'Yes' : 'No';
        $pers_det    = (isset($personal[$uid]) && !empty($personal[$uid]['marital_status'])) ? 'Yes' : 'No';

        $addr = 'No';
        if (isset($addresses[$uid])) {
            $a = $addresses[$uid];
            if (!empty($a['city']) || !empty($a['state']) || !empty($a['country']) || !empty($a['pincode'])) {
                $addr = 'Yes';
            }
        }

        $lang  = !empty($lang_count[$uid])  ? 'Yes' : 'No';
        $cert  = !empty($cert_count[$uid])  ? 'Yes' : 'No';
        $extra = !empty($extra_count[$uid]) ? 'Yes' : 'No';

        $sections = [$photo, $resume, $prof_sum, $res_head, $key_sk, $emp_hist, $edu,
                     $proj, $online_prof, $car_prof, $pers_det, $addr, $lang, $cert, $extra];
        $completed = count(array_filter($sections, fn($x) => $x === 'Yes'));
        $pct = round(($completed / 15) * 100, 2);

        fputcsv($fp, [
            $uid, $u['fname'], $u['lname'], $u['email'], $u['phone'], $u['registered_at'],
            $photo, $resume, $prof_sum, $res_head, $key_sk,
            $emp_hist, $edu, $proj, $online_prof,
            $car_prof, $pers_det, $addr,
            $lang, $cert, $extra,
            $pct,
        ]);
    }

    if (ob_get_length()) { @ob_flush(); flush(); }
    $offset += $chunk_size;
}

fclose($fp);