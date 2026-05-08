<?php
header('Content-Type: application/json');
ini_set('display_errors', 1);
error_reporting(E_ALL);

chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
global $conn;

if (!$conn) {
    echo json_encode(["status" => "error", "message" => "DB connection missing"]);
    exit;
}

$action = $_POST['action'] ?? '';
$filter = $_POST['filter'] ?? 'today';
$event  = $_POST['event']  ?? 'register';
$today  = date('Y-m-d');

$eventMap = [
    "register"                 => ["table" => "users",                    "column" => "registered_at"],
    "signin"                   => ["table" => "signin_log",               "column" => "created_at"],
    "exam_success"             => ["table" => "cit_results",              "column" => "timestamp"],
    "course_purchase"          => ["table" => "payment_status",           "column" => "timestamp"],
    "payment_success"          => ["table" => "payment_status",           "column" => "timestamp"],
    "preferred_domain"         => ["table" => "user_slected_domain_new",  "column" => "created_at"],
    "visited_iap"              => ["table" => "user_iap_visits",          "column" => "visited_at"],
    "result_view"              => ["table" => "cit_results",              "column" => "timestamp"],
    "placement_community_link" => ["table" => "assigned_links",           "column" => "assigned_at"],
    "instantexam_reminder"     => ["table" => "set_reminder",             "column" => "created_at"],
    "course_edit"              => ["table" => "internship_edit_logs",     "column" => "created_at"],
    "register_company"         => ["table" => "hiring_employer",          "column" => "registered_at"],
    "company_signin"           => ["table" => "employer_login_logs",      "column" => "login_time"],
    "company_vacancy_post"     => ["table" => "job_list",                 "column" => "created_at"],
];

/* ─── conversion vs other events split ───────────────────────
   Conversion = always shown as fixed cards.
   Other      = chosen via the "Other events" picker (one at a time).
─────────────────────────────────────────────────────────── */
$conversionEvents = ['register','signin','exam_success','course_purchase','payment_success'];
$otherEvents      = ['preferred_domain','result_view','visited_iap','placement_community_link','instantexam_reminder','course_edit','register_company','company_signin','company_vacancy_post'];

/* ─── placement community link source: union of regular + refund tables ─── */
function pclUnion($start, $end) {
    return "(SELECT user_id, assigned_id, assigned_at, 'non_refund' AS source
             FROM assigned_links WHERE assigned_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
             UNION ALL
             SELECT user_id, assigned_id, assigned_at, 'refund' AS source
             FROM assigned_links_for_refund WHERE assigned_at BETWEEN '$start 00:00:00' AND '$end 23:59:59') AS pcl";
}

/* ─── shared date-range resolver ───────────────────────────
   Returns [$start, $end] as plain Y-m-d dates.
   All WHERE clauses use:  col BETWEEN '$start 00:00:00' AND '$end 23:59:59'
   so MySQL uses column indexes instead of scanning every row.
─────────────────────────────────────────────────────────── */
function resolveRange($filter, $today) {
    if ($filter === 'today')     { return [$today, $today]; }
    if ($filter === 'yesterday') { $y = date('Y-m-d', strtotime('-1 day')); return [$y, $y]; }
    if ($filter === '7days')     { return [date('Y-m-d', strtotime('-6 days')), $today]; }
    if ($filter === '30days')    { return [date('Y-m-d', strtotime('-29 days')), $today]; }
    if (!empty($_POST['from']) && !empty($_POST['to'])) { return [$_POST['from'], $_POST['to']]; }
    return [$today, $today];
}

/* ─── convenience: full datetime range string for BETWEEN ── */
function dtRange($start, $end) {
    return ["$start 00:00:00", "$end 23:59:59"];
}

/* ─── getHourly (generic, for old fetch_behavior_data helper) ─── */
function getHourly($c, $t, $col, $offset) {
    $target = date('Y-m-d', strtotime("-$offset day"));
    $data   = array_fill(0, 24, 0);
    $r      = mysqli_query($c, "SELECT HOUR(`$col`) hr, COUNT(*) c FROM `$t` WHERE `$col` BETWEEN '$target 00:00:00' AND '$target 23:59:59' GROUP BY hr");
    while ($row = mysqli_fetch_assoc($r)) {
        $data[(int)$row['hr']] = (int)$row['c'];
    }
    return $data;
}

/* ─── getBehaviorHourly (dedup-aware, for overview chart) ─── */
function getBehaviorHourly($conn, $event, $offset = 0) {
    global $eventMap;
    $target = date('Y-m-d', strtotime("-$offset day"));
    $data   = array_fill(0, 24, 0);

    if ($event === 'course_purchase') {
        $sql = "SELECT HOUR(first_time) AS hr, COUNT(*) AS c
                FROM (
                    SELECT user_id, internship_name, MIN(`timestamp`) AS first_time
                    FROM payment_status
                    WHERE `timestamp` BETWEEN '$target 00:00:00' AND '$target 23:59:59' AND status='initiated'
                    GROUP BY user_id, internship_name
                ) AS t GROUP BY hr";
    } elseif ($event === 'payment_success') {
        $sql = "SELECT HOUR(first_time) AS hr, COUNT(*) AS c
                FROM (
                    SELECT user_id, internship_name, MIN(`timestamp`) AS first_time
                    FROM payment_status
                    WHERE `timestamp` BETWEEN '$target 00:00:00' AND '$target 23:59:59' AND status='success'
                    GROUP BY user_id, internship_name
                ) AS t GROUP BY hr";
    } elseif ($event === 'result_view') {
        $sql = "SELECT HOUR(cr.`timestamp`) AS hr, COUNT(*) AS c
                FROM cit_results cr
                INNER JOIN users u ON u.user_id = cr.user_id AND u.score_viewed = 1
                WHERE cr.`timestamp` BETWEEN '$target 00:00:00' AND '$target 23:59:59'
                GROUP BY hr";
    } elseif ($event === 'placement_community_link') {
        $sql = "SELECT HOUR(assigned_at) AS hr, COUNT(*) AS c FROM " . pclUnion($target, $target) . "
                GROUP BY hr";
    } else {
        $tbl = $eventMap[$event]['table']  ?? 'users';
        $col = $eventMap[$event]['column'] ?? 'registered_at';
        $sql = "SELECT HOUR(`$col`) AS hr, COUNT(*) AS c
                FROM `$tbl`
                WHERE `$col` BETWEEN '$target 00:00:00' AND '$target 23:59:59'
                GROUP BY hr";
    }

    $res = mysqli_query($conn, $sql);
    if ($res) {
        while ($row = mysqli_fetch_assoc($res)) {
            $data[(int)$row['hr']] = (int)$row['c'];
        }
    }
    return $data;
}


/* ════════════════════════════════════════
   ACTION: fetch_counts_only
════════════════════════════════════════ */
if ($action === 'fetch_counts_only') {

    [$start, $end] = resolveRange($filter, $today);
    $counts = [];

    foreach ($eventMap as $k => $v) {
        if ($k === 'course_purchase') {
            $sql = "SELECT COUNT(*) AS c FROM (
                        SELECT user_id, internship_name
                        FROM payment_status
                        WHERE `timestamp` BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='initiated'
                        GROUP BY user_id, internship_name
                    ) AS t";
        } elseif ($k === 'payment_success') {
            $sql = "SELECT COUNT(*) AS c FROM (
                        SELECT user_id, internship_name
                        FROM payment_status
                        WHERE `timestamp` BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='success'
                        GROUP BY user_id, internship_name
                    ) AS t";
        } elseif ($k === 'signin') {
            $sql = "SELECT COUNT(*) AS c FROM signin_log
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'preferred_domain') {
            $sql = "SELECT COUNT(DISTINCT user_id) AS c FROM user_slected_domain_new
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'visited_iap') {
            $sql = "SELECT COUNT(DISTINCT user_id) AS c FROM user_iap_visits
                    WHERE visited_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'result_view') {
            $sql = "SELECT COUNT(DISTINCT cr.user_id) AS c FROM cit_results cr
                    INNER JOIN users u ON u.user_id = cr.user_id AND u.score_viewed = 1
                    WHERE cr.`timestamp` BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'placement_community_link') {
            $sql = "SELECT COUNT(*) AS c FROM " . pclUnion($start, $end);
        } elseif ($k === 'instantexam_reminder') {
            $sql = "SELECT COUNT(*) AS c FROM set_reminder
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'course_edit') {
            $sql = "SELECT COUNT(*) AS c FROM internship_edit_logs
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'register_company') {
            $sql = "SELECT COUNT(*) AS c FROM hiring_employer
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'company_signin') {
            $sql = "SELECT COUNT(*) AS c FROM employer_login_logs
                    WHERE login_time BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'company_vacancy_post') {
            $sql = "SELECT COUNT(*) AS c FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } else {
            $sql = "SELECT COUNT(DISTINCT user_id) AS c FROM {$v['table']}
                    WHERE {$v['column']} BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        }
        $res        = mysqli_query($conn, $sql);
        $counts[$k] = (int)mysqli_fetch_assoc($res)['c'];
    }

    echo json_encode(["status" => "success", "counts" => $counts]);
    exit;
}


/* ════════════════════════════════════════
   ACTION: fetch_behavior_data  (overview chart)
════════════════════════════════════════ */
if ($action === 'fetch_behavior_data') {

    [$start, $end] = resolveRange($filter, $today);
    $customFilter  = (!empty($_POST['from']) && !empty($_POST['to'])) ? 'custom' : $filter;

    $tbl = $eventMap[$event]['table'];
    $col = $eventMap[$event]['column'];

    /* refresh counts */
    $counts = [];
    foreach ($eventMap as $k => $v) {
        if ($k === 'course_purchase') {
            $sql = "SELECT COUNT(*) AS c FROM (SELECT user_id, internship_name FROM payment_status
                    WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='initiated'
                    GROUP BY user_id, internship_name) AS t";
        } elseif ($k === 'payment_success') {
            $sql = "SELECT COUNT(*) AS c FROM (SELECT user_id, internship_name FROM payment_status
                    WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='success'
                    GROUP BY user_id, internship_name) AS t";
        } elseif ($k === 'result_view') {
            $sql = "SELECT COUNT(*) AS c FROM cit_results cr
                    INNER JOIN users u ON u.user_id = cr.user_id AND u.score_viewed = 1
                    WHERE cr.`timestamp` BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        } elseif ($k === 'placement_community_link') {
            $sql = "SELECT COUNT(*) AS c FROM " . pclUnion($start, $end);
        } else {
            $sql = "SELECT COUNT(*) AS c FROM {$v['table']} WHERE {$v['column']} BETWEEN '$start 00:00:00' AND '$end 23:59:59'";
        }
        $res        = mysqli_query($conn, $sql);
        $counts[$k] = (int)mysqli_fetch_assoc($res)['c'];
    }

    $labels   = [];
    $datasets = [];

    /* ── granularity: 'hour' | 'day' | 'week' | 'month'
       Auto-default: hour for today/yesterday, otherwise day. */
    $granularity = $_POST['granularity'] ?? '';
    if (!in_array($granularity, ['hour','day','week','month'])) {
        $granularity = in_array($filter, ['today','yesterday']) ? 'hour' : 'day';
    }

    /* event-aware count over an arbitrary [s,e] window */
    $rangeCount = function($s, $e) use ($event, $tbl, $col, $conn) {
        if ($event === 'course_purchase') {
            $sql = "SELECT COUNT(*) AS c FROM (SELECT user_id, internship_name FROM payment_status
                    WHERE `timestamp` BETWEEN '$s 00:00:00' AND '$e 23:59:59' AND status='initiated' GROUP BY user_id, internship_name) AS t";
        } elseif ($event === 'payment_success') {
            $sql = "SELECT COUNT(*) AS c FROM (SELECT user_id, internship_name FROM payment_status
                    WHERE `timestamp` BETWEEN '$s 00:00:00' AND '$e 23:59:59' AND status='success' GROUP BY user_id, internship_name) AS t";
        } elseif ($event === 'result_view') {
            $sql = "SELECT COUNT(*) AS c FROM cit_results cr
                    INNER JOIN users u ON u.user_id = cr.user_id AND u.score_viewed = 1
                    WHERE cr.`timestamp` BETWEEN '$s 00:00:00' AND '$e 23:59:59'";
        } elseif ($event === 'placement_community_link') {
            $sql = "SELECT COUNT(*) AS c FROM " . pclUnion($s, $e);
        } else {
            $sql = "SELECT COUNT(*) AS c FROM $tbl WHERE $col BETWEEN '$s 00:00:00' AND '$e 23:59:59'";
        }
        $res = mysqli_query($conn, $sql);
        return (int)mysqli_fetch_assoc($res)['c'];
    };

    if ($granularity === 'hour') {
        /* today/yesterday hourly view (3-line comparison: today / prev day / last week) */
        if (in_array($filter, ['today', 'yesterday'])) {
            $offset    = ($filter === 'today') ? 0 : 1;
            $labels    = array_map(fn($i) => sprintf("%02d:00", $i), range(0, 23));
            $datasets  = [
                ["label" => ucfirst($filter), "data" => getBehaviorHourly($conn, $event, $offset)],
                ["label" => "Previous Day",   "data" => getBehaviorHourly($conn, $event, $offset + 1)],
                ["label" => "Last Week",      "data" => getBehaviorHourly($conn, $event, $offset + 7)],
            ];
        } else {
            /* hourly across multi-day range (24 buckets summing across all days in range) */
            $labels = array_map(fn($i) => sprintf("%02d:00", $i), range(0, 23));
            $data   = array_fill(0, 24, 0);
            $hourlySql = "SELECT HOUR($col) hr, COUNT(*) c FROM $tbl
                          WHERE $col BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                          GROUP BY hr";
            if ($event === 'result_view') {
                $hourlySql = "SELECT HOUR(cr.`timestamp`) hr, COUNT(*) c FROM cit_results cr
                              INNER JOIN users u ON u.user_id=cr.user_id AND u.score_viewed=1
                              WHERE cr.`timestamp` BETWEEN '$start 00:00:00' AND '$end 23:59:59' GROUP BY hr";
            }
            $r = mysqli_query($conn, $hourlySql);
            if ($r) while ($row = mysqli_fetch_assoc($r)) $data[(int)$row['hr']] = (int)$row['c'];
            $datasets = [["label" => ucfirst(str_replace('_',' ',$event)), "data" => $data]];
        }
    } elseif ($granularity === 'day') {
        $startDate = new DateTime($start);
        $endDate   = new DateTime($end);
        $period    = new DatePeriod($startDate, new DateInterval('P1D'), (clone $endDate)->modify('+1 day'));

        $duration  = (int)((strtotime($end) - strtotime($start)) / 86400) + 1;
        $prevEnd   = date('Y-m-d', strtotime("$start -1 day"));
        $prevStart = date('Y-m-d', strtotime("$prevEnd -" . ($duration - 1) . " days"));

        $dataPoints = []; $prevPoints = []; $i = 0;
        foreach ($period as $date) {
            $d = $date->format('Y-m-d');
            $labels[] = date('M d', strtotime($d));
            $dataPoints[] = $rangeCount($d, $d);
            $pd = date('Y-m-d', strtotime("$prevStart +$i days"));
            $prevPoints[] = $rangeCount($pd, $pd);
            $i++;
        }
        $rangeLabel = ($filter === '7days') ? 'Last 7 Days' : (($filter === '30days') ? 'Last 30 Days' : 'Selected Range');
        if (in_array($filter, ['today','yesterday'])) $rangeLabel = ucfirst($filter);
        $datasets = [
            [ "label" => $rangeLabel, "data" => $dataPoints ],
            [ "label" => "Previous Period ($prevStart → $prevEnd)", "data" => $prevPoints ],
        ];
    } elseif ($granularity === 'week') {
        /* week buckets: walk Monday-to-Sunday weeks covering the range */
        $cur = new DateTime($start);
        $cur->modify('Monday this week');
        $endDate = new DateTime($end);
        $weeks = [];
        while ($cur <= $endDate) {
            $ws = $cur->format('Y-m-d');
            $we = (clone $cur)->modify('+6 days')->format('Y-m-d');
            $weeks[] = [$ws, $we];
            $cur->modify('+1 week');
        }
        $dataPoints = [];
        foreach ($weeks as [$ws, $we]) {
            $labels[] = date('M d', strtotime($ws));
            $dataPoints[] = $rangeCount($ws, $we);
        }
        $datasets = [[ "label" => "Selected Range (weekly)", "data" => $dataPoints ]];
    } elseif ($granularity === 'month') {
        /* month buckets */
        $cur = new DateTime(date('Y-m-01', strtotime($start)));
        $endDate = new DateTime($end);
        $months = [];
        while ($cur <= $endDate) {
            $ms = $cur->format('Y-m-01');
            $me = (clone $cur)->modify('last day of this month')->format('Y-m-d');
            $months[] = [$ms, $me, $cur->format('M Y')];
            $cur->modify('first day of next month');
        }
        $dataPoints = [];
        foreach ($months as [$ms, $me, $lbl]) {
            $labels[] = $lbl;
            $dataPoints[] = $rangeCount($ms, $me);
        }
        $datasets = [[ "label" => "Selected Range (monthly)", "data" => $dataPoints ]];
    }

    echo json_encode(["status" => "success", "counts" => $counts, "labels" => $labels, "datasets" => $datasets]);
    exit;
}


/* ════════════════════════════════════════
   ACTION: recent_users
════════════════════════════════════════ */
if ($action === 'recent_users') {

    $userMap = [
        "register"         => ["table" => "users",                   "column" => "registered_at",  "has_email" => true],
        "signin"           => ["table" => "signin_log",              "column" => "created_at",      "has_email" => false],
        "exam_success"     => ["table" => "cit_results",             "column" => "timestamp",       "has_email" => false],
        "course_purchase"  => ["table" => "payment_status",          "column" => "timestamp",       "has_email" => false],
        "payment_success"  => ["table" => "internship_payment",      "column" => "paid_at",         "has_email" => false],
        "preferred_domain" => ["table" => "user_slected_domain_new", "column" => "created_at",      "has_email" => false],
        "visited_iap"      => ["table" => "user_iap_visits",         "column" => "visited_at",      "has_email" => false],
        "result_view"      => ["table" => "cit_results",             "column" => "timestamp",       "has_email" => false],
        "placement_community_link" => ["table" => "assigned_links",  "column" => "assigned_at",     "has_email" => false],
        "instantexam_reminder"     => ["table" => "set_reminder",    "column" => "created_at",      "has_email" => false],
        "course_edit"              => ["table" => "internship_edit_logs", "column" => "created_at", "has_email" => false],
        "register_company"         => ["table" => "hiring_employer",      "column" => "registered_at", "has_email" => false],
        "company_signin"           => ["table" => "employer_login_logs",  "column" => "login_time",    "has_email" => false],
        "company_vacancy_post"     => ["table" => "job_list",             "column" => "created_at",    "has_email" => false],
    ];

    [$start, $end] = resolveRange($filter, $today);

    $tbl      = $userMap[$event]['table'];
    $col      = $userMap[$event]['column'];
    $hasEmail = $userMap[$event]['has_email'];

    if ($hasEmail) {
        $query = "SELECT email, $col AS created_at FROM $tbl
                  WHERE $col BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                  ORDER BY $col DESC LIMIT 10";
    } elseif ($event === 'result_view') {
        $query = "SELECT u.email, a.$col AS created_at
                  FROM $tbl a JOIN users u ON a.user_id = u.user_id AND u.score_viewed = 1
                  WHERE a.$col BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                  ORDER BY a.$col DESC LIMIT 10";
    } elseif ($event === 'placement_community_link') {
        $query = "SELECT u.email, pcl.assigned_at AS created_at
                  FROM " . pclUnion($start, $end) . "
                  JOIN users u ON u.user_id = pcl.user_id
                  ORDER BY pcl.assigned_at DESC LIMIT 10";
    } elseif ($event === 'register_company') {
        $query = "SELECT employer_email AS email, registered_at AS created_at
                  FROM hiring_employer
                  WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                  ORDER BY registered_at DESC LIMIT 10";
    } elseif ($event === 'company_signin') {
        $query = "SELECT he.employer_email AS email, ell.login_time AS created_at
                  FROM employer_login_logs ell
                  JOIN hiring_employer he ON he.employer_id = ell.employer_id
                  WHERE ell.login_time BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                  ORDER BY ell.login_time DESC LIMIT 10";
    } elseif ($event === 'company_vacancy_post') {
        $query = "SELECT he.employer_email AS email, jl.created_at AS created_at
                  FROM job_list jl
                  JOIN hiring_employer he ON he.employer_id = jl.employer_id
                  WHERE jl.created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                  ORDER BY jl.created_at DESC LIMIT 10";
    } else {
        $query = "SELECT u.email, a.$col AS created_at
                  FROM $tbl a JOIN users u ON a.user_id = u.user_id
                  WHERE a.$col BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                  ORDER BY a.$col DESC LIMIT 10";
    }

    $res   = mysqli_query($conn, $query);
    $users = [];
    while ($r = mysqli_fetch_assoc($res)) {
        $r['email'] = $r['email'] ?: 'N/A';
        $users[]    = $r;
    }

    echo json_encode(["status" => "success", "users" => $users]);
    exit;
}


/* ════════════════════════════════════════
   ACTION: fetch_event_hourly_data
════════════════════════════════════════ */
if ($action === 'fetch_event_hourly_data') {

    $from   = $_POST['from'] ?? '';
    $to     = $_POST['to']   ?? '';
    $labels = [];
    $counts = [];
    $xTitle = '';
    $yTitle = 'Event Count';

    if (in_array($filter, ['today', 'yesterday'])) {
        $target = ($filter === 'today') ? $today : date('Y-m-d', strtotime('-1 day'));
        $labels = array_map(fn($i) => sprintf("%02d:00", $i), range(0, 23));
        $counts = array_fill(0, 24, 0);

        if (in_array($event, ['payment_success', 'course_purchase'])) {
            $status = ($event === 'payment_success') ? 'success' : 'initiated';
            $sql    = "SELECT HOUR(first_time) AS hr, COUNT(*) AS c
                       FROM (
                           SELECT user_id, internship_name, MIN(timestamp) AS first_time
                           FROM payment_status
                           WHERE `timestamp` BETWEEN '$target 00:00:00' AND '$target 23:59:59' AND status='$status'
                           GROUP BY user_id, internship_name
                       ) AS t GROUP BY hr ORDER BY hr";
        } elseif ($event === 'result_view') {
            $sql = "SELECT HOUR(cr.`timestamp`) AS hr, COUNT(*) AS c
                    FROM cit_results cr
                    INNER JOIN users u ON u.user_id = cr.user_id AND u.score_viewed = 1
                    WHERE cr.`timestamp` BETWEEN '$target 00:00:00' AND '$target 23:59:59'
                    GROUP BY hr ORDER BY hr";
        } elseif ($event === 'placement_community_link') {
            $sql = "SELECT HOUR(assigned_at) AS hr, COUNT(*) AS c
                    FROM " . pclUnion($target, $target) . "
                    GROUP BY hr ORDER BY hr";
        } else {
            $tbl = $eventMap[$event]['table'];
            $col = $eventMap[$event]['column'];
            $sql = "SELECT HOUR(`$col`) AS hr, COUNT(*) AS c
                    FROM `$tbl` WHERE `$col` BETWEEN '$target 00:00:00' AND '$target 23:59:59' GROUP BY hr ORDER BY hr";
        }

        $res = mysqli_query($conn, $sql);
        while ($row = mysqli_fetch_assoc($res)) {
            $counts[(int)$row['hr']] = (int)$row['c'];
        }
        $xTitle = 'Time (Hourly)';

    } else {
        if ($filter === '7days')      { $start = date('Y-m-d', strtotime('-6 days'));  $end = $today; }
        elseif ($filter === '30days') { $start = date('Y-m-d', strtotime('-29 days')); $end = $today; }
        elseif (!empty($from) && !empty($to)) { $start = $from; $end = $to; }
        else { $start = $end = $today; }

        $startDate = new DateTime($start);
        $endDate   = new DateTime($end);
        $period    = new DatePeriod($startDate, new DateInterval('P1D'), $endDate->modify('+1 day'));

        foreach ($period as $d) {
            $labels[] = $d->format('M d');
        }

        foreach ($labels as $idx => $lbl) {
            $date = date('Y-m-d', strtotime($lbl));

            if (in_array($event, ['payment_success', 'course_purchase'])) {
                $status = ($event === 'payment_success') ? 'success' : 'initiated';
                $sql    = "SELECT COUNT(*) AS c FROM (
                               SELECT user_id, internship_name FROM payment_status
                               WHERE `timestamp` BETWEEN '$date 00:00:00' AND '$date 23:59:59' AND status='$status'
                               GROUP BY user_id, internship_name
                           ) AS t";
            } elseif ($event === 'result_view') {
                $sql = "SELECT COUNT(*) AS c FROM cit_results cr
                        INNER JOIN users u ON u.user_id = cr.user_id AND u.score_viewed = 1
                        WHERE cr.`timestamp` BETWEEN '$date 00:00:00' AND '$date 23:59:59'";
            } elseif ($event === 'placement_community_link') {
                $sql = "SELECT COUNT(*) AS c FROM " . pclUnion($date, $date);
            } else {
                $tbl = $eventMap[$event]['table'];
                $col = $eventMap[$event]['column'];
                $sql = "SELECT COUNT(*) AS c FROM $tbl WHERE $col BETWEEN '$date 00:00:00' AND '$date 23:59:59'";
            }

            $res          = mysqli_query($conn, $sql);
            $counts[$idx] = ($res && $row = mysqli_fetch_assoc($res)) ? (int)$row['c'] : 0;
        }
        $xTitle = 'Date';
    }

    echo json_encode([
        'status' => 'success',
        'labels' => array_values($labels),
        'counts' => array_values($counts),
        'xTitle' => $xTitle,
        'yTitle' => $yTitle,
        'total'  => array_sum($counts),
    ]);
    exit;
}


/* ════════════════════════════════════════
   ACTION: fetch_payload_data
════════════════════════════════════════ */
if ($action === 'fetch_payload_data') {

    $parameter = $_POST['parameter'] ?? '';
    $from      = $_POST['from']      ?? '';
    $to        = $_POST['to']        ?? '';

    [$start, $end] = resolveRange($filter, $today);

    $labels = [];
    $counts = [];

    switch ($parameter) {

        /* ── register params ── */
        case 'instantexam':
            $sql = "SELECT instant_exam AS label, COUNT(*) AS cnt FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY instant_exam";
            break;

        case 'express':
            $sql = "SELECT CASE WHEN organic_user=1 THEN 'Yes' ELSE 'No' END AS label, COUNT(*) AS cnt
                    FROM users WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59' GROUP BY organic_user";
            break;

        case 'referral':
            $sql = "SELECT CASE WHEN is_from_referral=1 THEN 'Yes' ELSE 'No' END AS label, COUNT(*) AS cnt
                    FROM users WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59' GROUP BY is_from_referral";
            break;

        case 'first_name':
            $sql = "SELECT fname AS label, COUNT(*) AS cnt FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND fname IS NOT NULL
                    GROUP BY fname ORDER BY cnt DESC LIMIT 25";
            break;

        case 'last_name':
            $sql = "SELECT lname AS label, COUNT(*) AS cnt FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND lname IS NOT NULL
                    GROUP BY lname ORDER BY cnt DESC LIMIT 25";
            break;

        case 'mobile':
            $sql = "SELECT phone AS label, COUNT(*) AS cnt FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND phone IS NOT NULL
                    GROUP BY phone ORDER BY cnt DESC LIMIT 25";
            break;

        case 'state':
            $sql = "SELECT state AS label, COUNT(*) AS cnt FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND state IS NOT NULL
                    GROUP BY state ORDER BY cnt DESC LIMIT 25";
            break;

        case 'country':
            $sql = "SELECT country AS label, COUNT(*) AS cnt FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND country IS NOT NULL
                    GROUP BY country ORDER BY cnt DESC LIMIT 25";
            break;

        case 'email':
            $sql = "SELECT email AS label, COUNT(*) AS cnt FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND email IS NOT NULL
                    GROUP BY email ORDER BY cnt DESC LIMIT 25";
            break;

        case 'method':
            /* Google signup vs Manual */
            $sql = "SELECT CASE WHEN is_signup_by_google='yes' THEN 'Google' ELSE 'Manual' END AS label, COUNT(*) AS cnt
                    FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY is_signup_by_google";
            break;

        case 'source':
            /* UTM source from user_campaign joined on user_id */
            $sql = "SELECT COALESCE(NULLIF(uc.source,''),'Direct') AS label, COUNT(DISTINCT u.user_id) AS cnt
                    FROM users u
                    LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY uc.source ORDER BY cnt DESC LIMIT 25";
            break;

        case 'instantresult':
            $sql = "SELECT COALESCE(NULLIF(instant_result,''),'Unknown') AS label, COUNT(*) AS cnt
                    FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY instant_result ORDER BY cnt DESC";
            break;

        case 'setreminder':
            /* Yes = user has at least one row in set_reminder; No = otherwise */
            $sql = "SELECT CASE WHEN sr.user_id IS NOT NULL THEN 'Yes' ELSE 'No' END AS label, COUNT(*) AS cnt
                    FROM users u
                    LEFT JOIN (SELECT DISTINCT user_id FROM set_reminder) sr ON sr.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY label";
            break;

        case 'campaign':
            $sql = "SELECT COALESCE(NULLIF(uc.campaign,''),'Direct') AS label, COUNT(DISTINCT u.user_id) AS cnt
                    FROM users u
                    LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY uc.campaign ORDER BY cnt DESC LIMIT 25";
            break;

        case 'adset':
            $sql = "SELECT COALESCE(NULLIF(uc.adset,''),'Direct') AS label, COUNT(DISTINCT u.user_id) AS cnt
                    FROM users u
                    LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY uc.adset ORDER BY cnt DESC LIMIT 25";
            break;

        case 'ad':
            $sql = "SELECT COALESCE(NULLIF(uc.ad,''),'Direct') AS label, COUNT(DISTINCT u.user_id) AS cnt
                    FROM users u
                    LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY uc.ad ORDER BY cnt DESC LIMIT 25";
            break;

        case 'medium':
            $sql = "SELECT COALESCE(NULLIF(uc.medium,''),'Direct') AS label, COUNT(DISTINCT u.user_id) AS cnt
                    FROM users u
                    LEFT JOIN user_campaign uc ON uc.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY uc.medium ORDER BY cnt DESC LIMIT 25";
            break;

        case 'is_from_refund':
            $sql = "SELECT CASE WHEN is_from_refund='yes' THEN 'Yes' ELSE 'No' END AS label, COUNT(*) AS cnt
                    FROM users
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY is_from_refund";
            break;

        case 'full_url':
            /* registration URL — joined from store_full_url on user_id */
            $sql = "SELECT COALESCE(NULLIF(sfu.full_url,''),'Unknown') AS label, COUNT(DISTINCT u.user_id) AS cnt
                    FROM users u
                    LEFT JOIN store_full_url sfu ON sfu.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY sfu.full_url ORDER BY cnt DESC LIMIT 25";
            break;

        case 'register_type':
            $sql = "SELECT COALESCE(NULLIF(sfu.register_type,''),'Unknown') AS label, COUNT(DISTINCT u.user_id) AS cnt
                    FROM users u
                    LEFT JOIN store_full_url sfu ON sfu.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY sfu.register_type ORDER BY cnt DESC";
            break;

        case 'device':
            $sql = "SELECT COALESCE(NULLIF(sfu.device,''),'Unknown') AS label, COUNT(DISTINCT u.user_id) AS cnt
                    FROM users u
                    LEFT JOIN store_full_url sfu ON sfu.user_id = u.user_id
                    WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY sfu.device ORDER BY cnt DESC";
            break;

        /* ── exam_success params ── */
        case 'result_score':
            $totalRes   = mysqli_query($conn, "SELECT COUNT(user_id) AS total FROM cit_results WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59'");
            $totalCount = (int)mysqli_fetch_assoc($totalRes)['total'];
            $sql        = "SELECT score AS label, COUNT(user_id) AS cnt FROM cit_results
                           WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                           GROUP BY score ORDER BY label ASC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>$totalCount]);
            exit;

        case 'status':
            $totalRes  = mysqli_query($conn, "SELECT COUNT(user_id) AS total FROM cit_results WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59'");
            $completed = (int)mysqli_fetch_assoc($totalRes)['total'];
            echo json_encode(["status"=>"success","labels"=>['Completed'],"counts"=>[$completed],"total"=>$completed]);
            exit;

        /* ── course_purchase params ── */
        case 'amount':
            $sql = "SELECT amount AS label, COUNT(*) AS cnt FROM (
                        SELECT user_id, internship_name, MAX(amount) AS amount FROM payment_status
                        WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='initiated'
                        GROUP BY user_id, internship_name
                    ) AS t GROUP BY amount ORDER BY amount ASC";
            break;

        case 'internship_name':
            $sql = "SELECT COALESCE(NULLIF(internship_name,''),'Unknown Internship') AS label, COUNT(*) AS cnt
                    FROM (SELECT user_id, internship_name FROM payment_status
                          WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='initiated'
                          GROUP BY user_id, internship_name) AS t
                    GROUP BY label ORDER BY cnt DESC";
            break;

        case 'batch_date':
            $sql = "SELECT COALESCE(batch_date,'Not Assigned') AS label, COUNT(*) AS cnt
                    FROM (SELECT user_id, internship_name, MAX(batch_date) AS batch_date FROM payment_status
                          WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='initiated'
                          GROUP BY user_id, internship_name) AS t
                    GROUP BY label ORDER BY label ASC";
            break;

        case 'coupon_applied':
            $sql = "SELECT COALESCE(coupon_code,'No Coupon') AS label, COUNT(*) AS cnt
                    FROM (SELECT user_id, internship_name, MAX(coupon_code) AS coupon_code FROM payment_status
                          WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='initiated'
                          GROUP BY user_id, internship_name) AS t
                    GROUP BY coupon_code ORDER BY cnt DESC";
            break;

        case 'initiated_at':
            if (in_array($filter, ['today','yesterday'])) {
                $target = ($filter==='today') ? date('Y-m-d') : date('Y-m-d', strtotime('-1 day'));
                for ($h=0; $h<24; $h++) {
                    $next     = $h+1;
                    $lbl      = sprintf("%02d–%02d O'clock", $h, $next);
                    $q        = "SELECT COUNT(*) AS cnt FROM (
                                     SELECT user_id, internship_name FROM payment_status
                                     WHERE `timestamp` BETWEEN '$target 00:00:00' AND '$target 23:59:59' AND HOUR(timestamp)=$h AND status='initiated'
                                     GROUP BY user_id, internship_name) AS t";
                    $r        = mysqli_query($conn, $q);
                    $labels[] = $lbl;
                    $counts[] = (int)mysqli_fetch_assoc($r)['cnt'];
                }
                echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
                exit;
            }
            // multi-day fallback
            $startDate = ($filter==='7days') ? date('Y-m-d',strtotime('-6 days')) : (($filter==='30days') ? date('Y-m-d',strtotime('-29 days')) : (!empty($from)?$from:$start));
            $endDate   = (!empty($to)) ? $to : $today;
            $sql       = "SELECT DATE(first_time) AS label, COUNT(*) AS cnt
                          FROM (SELECT user_id, internship_name, MIN(timestamp) AS first_time FROM payment_status
                                WHERE timestamp BETWEEN '$startDate 00:00:00' AND '$endDate 23:59:59' AND status='initiated'
                                GROUP BY user_id, internship_name) AS t
                          GROUP BY DATE(first_time) ORDER BY label ASC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = date('M d',strtotime($row['label'])); $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── payment_success params ── */
        case 'paid_amount':
            $sql = "SELECT amount AS label, COUNT(*) AS cnt FROM (
                        SELECT user_id, internship_name, MAX(amount) AS amount FROM payment_status
                        WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='success'
                        GROUP BY user_id, internship_name
                    ) AS t GROUP BY amount ORDER BY amount ASC";
            break;

        case 'paid_internship_name':
            $sql = "SELECT COALESCE(NULLIF(internship_name,''),'Unknown Internship') AS label, COUNT(*) AS cnt
                    FROM (SELECT user_id, internship_name FROM payment_status
                          WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='success'
                          GROUP BY user_id, internship_name) AS t
                    GROUP BY label ORDER BY cnt DESC";
            break;

        case 'paid_batch_date':
            $sql = "SELECT COALESCE(batch_date,'Not Assigned') AS label, COUNT(*) AS cnt
                    FROM (SELECT user_id, internship_name, MAX(batch_date) AS batch_date FROM payment_status
                          WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='success'
                          GROUP BY user_id, internship_name) AS t
                    GROUP BY label ORDER BY label ASC";
            break;

        case 'coupon_applied_success':
            $sql = "SELECT COALESCE(coupon_code,'No Coupon') AS label, COUNT(*) AS cnt
                    FROM (SELECT user_id, internship_name, MAX(coupon_code) AS coupon_code FROM payment_status
                          WHERE timestamp BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND status='success'
                          GROUP BY user_id, internship_name) AS t
                    GROUP BY coupon_code ORDER BY cnt DESC";
            break;

        case 'order_id':
            $sql = "SELECT ps.order_id AS label, COUNT(DISTINCT ps.user_id) AS cnt
                    FROM payment_status ps
                    WHERE ps.status='success'
                      AND ps.user_id IN (
                          SELECT DISTINCT ip.user_id FROM internship_payment ip
                          WHERE ip.paid_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      )
                    GROUP BY ps.order_id ORDER BY MAX(ps.timestamp) DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label']?:'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'paid_at':
            if (in_array($filter, ['today','yesterday'])) {
                $target = ($filter==='today') ? date('Y-m-d') : date('Y-m-d', strtotime('-1 day'));
                for ($h=0; $h<24; $h++) {
                    $next     = $h+1;
                    $lbl      = sprintf("%02d–%02d O'clock", $h, $next);
                    $q        = "SELECT COUNT(*) AS cnt FROM (
                                     SELECT user_id, internship_name FROM payment_status
                                     WHERE `timestamp` BETWEEN '$target 00:00:00' AND '$target 23:59:59' AND HOUR(timestamp)=$h AND status='success'
                                     GROUP BY user_id, internship_name) AS t";
                    $r        = mysqli_query($conn, $q);
                    $labels[] = $lbl;
                    $counts[] = (int)mysqli_fetch_assoc($r)['cnt'];
                }
                echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
                exit;
            }
            $startDate = (!empty($from)) ? $from : $start;
            $endDate   = (!empty($to))   ? $to   : $end;
            $sql       = "SELECT DATE(first_time) AS label, COUNT(*) AS cnt
                          FROM (SELECT user_id, internship_name, MIN(timestamp) AS first_time FROM payment_status
                                WHERE timestamp BETWEEN '$startDate 00:00:00' AND '$endDate 23:59:59' AND status='success'
                                GROUP BY user_id, internship_name) AS t
                          GROUP BY DATE(first_time) ORDER BY label ASC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = date('M d',strtotime($row['label'])); $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── preferred_domain param ── */
        case 'preferred_domain':
            if (in_array($filter, ['7days','30days']) || (!empty($from) && !empty($to))) {
                $startDate = new DateTime($start);
                $endDate   = new DateTime($end);
                $period    = new DatePeriod($startDate, new DateInterval('P1D'), $endDate->modify('+1 day'));
                foreach ($period as $dateObj) {
                    $d        = $dateObj->format('Y-m-d');
                    $r        = mysqli_query($conn, "SELECT COUNT(DISTINCT user_id) AS c FROM user_slected_domain_new WHERE `created_at` BETWEEN '$d 00:00:00' AND '$d 23:59:59'");
                    $labels[] = date('M d', strtotime($d));
                    $counts[] = (int)mysqli_fetch_assoc($r)['c'];
                }
                echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
                exit;
            }
            $totalRes   = mysqli_query($conn, "SELECT COUNT(DISTINCT user_id) AS total FROM user_slected_domain_new WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'");
            $total      = (int)mysqli_fetch_assoc($totalRes)['total'];
            $sql        = "SELECT COALESCE(NULLIF(domain_name,''),'Not Selected') AS label,
                                  COUNT(DISTINCT user_id) AS cnt
                           FROM user_slected_domain_new
                           WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                           GROUP BY domain_name ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label']; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>$total]);
            exit;

        /* ── visited_iap params ── */
        case 'visited':
            $yesRes = mysqli_query($conn, "SELECT COUNT(DISTINCT user_id) AS c FROM user_iap_visits
                                           WHERE visited_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'");
            $yes    = (int)mysqli_fetch_assoc($yesRes)['c'];

            /* "no" = registered users in the same range who did NOT visit IAP */
            $noRes  = mysqli_query($conn, "SELECT COUNT(*) AS c FROM users u
                                           WHERE u.registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                                             AND NOT EXISTS (
                                                 SELECT 1 FROM user_iap_visits v
                                                 WHERE v.user_id = u.user_id
                                                   AND v.visited_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                                             )");
            $no     = (int)mysqli_fetch_assoc($noRes)['c'];

            echo json_encode(["status"=>"success","labels"=>['yes','no'],"counts"=>[$yes,$no],"total"=>$yes+$no]);
            exit;

        case 'visited_time':
            if (in_array($filter, ['today','yesterday'])) {
                $target = ($filter==='today') ? date('Y-m-d') : date('Y-m-d', strtotime('-1 day'));
                $labels = array_map(fn($i) => sprintf("%02d:00", $i), range(0, 23));
                $counts = array_fill(0, 24, 0);
                $r      = mysqli_query($conn, "SELECT HOUR(visited_at) AS hr, COUNT(*) AS c FROM user_iap_visits
                                               WHERE visited_at BETWEEN '$target 00:00:00' AND '$target 23:59:59'
                                               GROUP BY hr ORDER BY hr");
                while ($row = mysqli_fetch_assoc($r)) { $counts[(int)$row['hr']] = (int)$row['c']; }
                echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
                exit;
            }
            $labels    = [];
            $counts    = [];
            $startDate = new DateTime($start);
            $endDate   = new DateTime($end);
            $period    = new DatePeriod($startDate, new DateInterval('P1D'), $endDate->modify('+1 day'));
            $byDate    = [];
            $r         = mysqli_query($conn, "SELECT DATE(visited_at) AS d, COUNT(*) AS c FROM user_iap_visits
                                              WHERE visited_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                                              GROUP BY DATE(visited_at)");
            while ($row = mysqli_fetch_assoc($r)) { $byDate[$row['d']] = (int)$row['c']; }
            foreach ($period as $dateObj) {
                $d        = $dateObj->format('Y-m-d');
                $labels[] = date('M d', strtotime($d));
                $counts[] = $byDate[$d] ?? 0;
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── placement_community_link params ── */
        case 'refund_non_refund':
            $nrRes = mysqli_query($conn, "SELECT COUNT(*) AS c FROM assigned_links
                                          WHERE assigned_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'");
            $nr    = (int)mysqli_fetch_assoc($nrRes)['c'];
            $rRes  = mysqli_query($conn, "SELECT COUNT(*) AS c FROM assigned_links_for_refund
                                          WHERE assigned_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'");
            $r     = (int)mysqli_fetch_assoc($rRes)['c'];
            echo json_encode(["status"=>"success","labels"=>['Non Refund','Refund'],"counts"=>[$nr,$r],"total"=>$nr+$r]);
            exit;

        case 'assigned_links':
            /* combine link → count from both regular and refund tables */
            $sql = "SELECT label, SUM(cnt) AS cnt FROM (
                        SELECT COALESCE(NULLIF(wp.community_link,''),'Unknown') AS label, COUNT(*) AS cnt
                        FROM assigned_links al
                        LEFT JOIN whatsapp_placement_club_link wp ON wp.id = al.assigned_id
                        WHERE al.assigned_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                        GROUP BY wp.community_link
                        UNION ALL
                        SELECT COALESCE(NULLIF(wpr.community_link,''),'Unknown') AS label, COUNT(*) AS cnt
                        FROM assigned_links_for_refund alr
                        LEFT JOIN whatsapp_placement_club_link_for_refund wpr ON wpr.id = alr.assigned_id
                        WHERE alr.assigned_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                        GROUP BY wpr.community_link
                    ) AS combined
                    GROUP BY label ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── instantexam_reminder params ── */
        case 'date_time':
            /* group by reminder date in the selected created_at range */
            $sql = "SELECT DATE(`date`) AS label, COUNT(*) AS cnt FROM set_reminder
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY DATE(`date`) ORDER BY label ASC LIMIT 60";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ? date('M d', strtotime($row['label'])) : 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'time_slot':
            $sql = "SELECT COALESCE(NULLIF(time_slot,''),'Unknown') AS label, COUNT(*) AS cnt
                    FROM set_reminder
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY time_slot ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── course_edit params ── */
        case 'edit_internship_name':
            $sql = "SELECT COALESCE(NULLIF(new_internship_name,''),'Unknown') AS label, COUNT(*) AS cnt
                    FROM internship_edit_logs
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY new_internship_name ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'edit_page_url':
            $sql = "SELECT COALESCE(NULLIF(page_url,''),'Unknown') AS label, COUNT(*) AS cnt
                    FROM internship_edit_logs
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY page_url ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'edit_batch_date':
            $sql = "SELECT COALESCE(NULLIF(new_batch,''),'Not Assigned') AS label, COUNT(*) AS cnt
                    FROM internship_edit_logs
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY new_batch ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'edit_type':
            /* action_type: typically UPDATE / EXTEND */
            $sql = "SELECT COALESCE(NULLIF(action_type,''),'Unknown') AS label, COUNT(*) AS cnt
                    FROM internship_edit_logs
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY action_type ORDER BY cnt DESC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── register_company params ── */
        case 'company_logo':
            /* yes/no breakdown of companies that uploaded a logo */
            $sql = "SELECT CASE WHEN employer_logo IS NOT NULL AND employer_logo != ''
                                THEN 'Has Logo' ELSE 'No Logo' END AS label,
                           COUNT(*) AS cnt
                    FROM hiring_employer
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY label";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'company_mobile':
            $sql = "SELECT employer_phone AS label, COUNT(*) AS cnt FROM hiring_employer
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND employer_phone IS NOT NULL AND employer_phone != ''
                    GROUP BY employer_phone ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'company_name':
            $sql = "SELECT employer_name AS label, COUNT(*) AS cnt FROM hiring_employer
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND employer_name IS NOT NULL AND employer_name != ''
                    GROUP BY employer_name ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'company_email':
            $sql = "SELECT employer_email AS label, COUNT(*) AS cnt FROM hiring_employer
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND employer_email IS NOT NULL AND employer_email != ''
                    GROUP BY employer_email ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── company_signin params ── */
        case 'company_signin_email':
            /* email comes from hiring_employer joined via employer_id */
            $sql = "SELECT he.employer_email AS label, COUNT(*) AS cnt
                    FROM employer_login_logs ell
                    JOIN hiring_employer he ON he.employer_id = ell.employer_id
                    WHERE ell.login_time BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND he.employer_email IS NOT NULL AND he.employer_email != ''
                    GROUP BY he.employer_email ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'company_signin_status':
            /* success / fail breakdown */
            $sql = "SELECT COALESCE(NULLIF(status,''),'Unknown') AS label, COUNT(*) AS cnt
                    FROM employer_login_logs
                    WHERE login_time BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY status ORDER BY cnt DESC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'company_signin_ip':
            $sql = "SELECT COALESCE(NULLIF(ip_address,''),'Unknown') AS label, COUNT(*) AS cnt
                    FROM employer_login_logs
                    WHERE login_time BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY ip_address ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'company_signin_user_agent':
            /* trim user_agent to a friendly bucket: browser/OS-ish prefix (first 60 chars) */
            $sql = "SELECT COALESCE(NULLIF(SUBSTRING(user_agent,1,60),''),'Unknown') AS label, COUNT(*) AS cnt
                    FROM employer_login_logs
                    WHERE login_time BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY label ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── company_vacancy_post params ── */
        case 'vp_email':
            /* email comes from hiring_employer joined via employer_id */
            $sql = "SELECT he.employer_email AS label, COUNT(*) AS cnt
                    FROM job_list jl
                    JOIN hiring_employer he ON he.employer_id = jl.employer_id
                    WHERE jl.created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND he.employer_email IS NOT NULL AND he.employer_email != ''
                    GROUP BY he.employer_email ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_job_type':
            $sql = "SELECT COALESCE(NULLIF(job_type,''),'Unknown') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY job_type ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_job_title':
            $sql = "SELECT COALESCE(NULLIF(job_title,''),'Unknown') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY job_title ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_mode':
            /* wfo / wfh / hybrid */
            $sql = "SELECT COALESCE(NULLIF(job_mode,''),'Unknown') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY job_mode ORDER BY cnt DESC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_openings':
            $sql = "SELECT openings AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND openings IS NOT NULL
                    GROUP BY openings ORDER BY label ASC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] !== null ? (string)$row['label'] : 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_start_date':
            $sql = "SELECT DATE(start_date) AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND start_date IS NOT NULL
                    GROUP BY DATE(start_date) ORDER BY label ASC LIMIT 60";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ? date('M d, Y', strtotime($row['label'])) : 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_duration':
            $sql = "SELECT COALESCE(NULLIF(CAST(job_duration AS CHAR),''),'Not Set') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY job_duration ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_salary':
            /* bucketed compensation_amount ranges for a friendly distribution */
            $sql = "SELECT label, COUNT(*) AS cnt FROM (
                        SELECT CASE
                            WHEN compensation_amount IS NULL OR compensation_amount = 0 THEN 'Unpaid / Not Set'
                            WHEN compensation_amount < 5000 THEN '< 5k'
                            WHEN compensation_amount < 10000 THEN '5k – 10k'
                            WHEN compensation_amount < 25000 THEN '10k – 25k'
                            WHEN compensation_amount < 50000 THEN '25k – 50k'
                            WHEN compensation_amount < 100000 THEN '50k – 1L'
                            ELSE '1L+'
                        END AS label
                        FROM job_list
                        WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    ) AS t GROUP BY label ORDER BY cnt DESC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_comp_amount':
            $sql = "SELECT compensation_amount AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND compensation_amount IS NOT NULL
                    GROUP BY compensation_amount ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] !== null ? (string)$row['label'] : 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_comp_min':
            $sql = "SELECT compensation_min_amount AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND compensation_min_amount IS NOT NULL
                    GROUP BY compensation_min_amount ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] !== null ? (string)$row['label'] : 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_comp_max':
            $sql = "SELECT compensation_max_amount AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                      AND compensation_max_amount IS NOT NULL
                    GROUP BY compensation_max_amount ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] !== null ? (string)$row['label'] : 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_comp_type':
            /* Fixed / Range / etc. */
            $sql = "SELECT COALESCE(NULLIF(compensation_type,''),'Unknown') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY compensation_type ORDER BY cnt DESC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_comp_period':
            /* month / year / hour / etc. */
            $sql = "SELECT COALESCE(NULLIF(compensation_period,''),'Unknown') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY compensation_period ORDER BY cnt DESC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_experience':
            $sql = "SELECT COALESCE(NULLIF(min_experience,''),'Not Set') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY min_experience ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_method':
            /* job_nature: full-time / part-time / etc. */
            $sql = "SELECT COALESCE(NULLIF(job_nature,''),'Unknown') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY job_nature ORDER BY cnt DESC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        case 'vp_source':
            $sql = "SELECT COALESCE(NULLIF(source,''),'Direct') AS label, COUNT(*) AS cnt FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY source ORDER BY cnt DESC LIMIT 25";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) { $labels[] = $row['label'] ?: 'Unknown'; $counts[] = (int)$row['cnt']; }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        /* ── result_view params ── */
        case 'score':
            $sql = "SELECT cr.score AS label, COUNT(cr.user_id) AS cnt FROM cit_results cr
                    INNER JOIN users u ON u.user_id = cr.user_id AND u.score_viewed = 1
                    WHERE cr.`timestamp` BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY cr.score ORDER BY label ASC";
            $res = mysqli_query($conn, $sql);
            while ($row = mysqli_fetch_assoc($res)) {
                $labels[] = $row['label'] ?: 'Unknown';
                $counts[] = (int)$row['cnt'];
            }
            echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts,"total"=>array_sum($counts)]);
            exit;

        default:
            echo json_encode(["status"=>"error","message"=>"Invalid parameter"]);
            exit;
    }

    /* run generic SQL and cap at 20 rows */
    $res = mysqli_query($conn, $sql);
    while ($row = mysqli_fetch_assoc($res)) {
        $labels[] = $row['label'] ?: 'Unknown';
        $counts[] = (int)$row['cnt'];
    }
    if (count($labels) > 20) { $labels = array_slice($labels, 0, 20); $counts = array_slice($counts, 0, 20); }

    echo json_encode(["status"=>"success","labels"=>$labels,"counts"=>$counts]);
    exit;
}


/* ════════════════════════════════════════
   ACTION: fetch_user_event_frequency
════════════════════════════════════════ */
if ($action === 'fetch_user_event_frequency') {

    $from = $_POST['from'] ?? '';
    $to   = $_POST['to']   ?? '';

    $localEventMap = [
        "register"         => ["table"=>"users",                   "column"=>"registered_at", "where"=>"1=1"],
        "signin"           => ["table"=>"signin_log",              "column"=>"created_at",     "where"=>"1=1"],
        "exam_success"     => ["table"=>"cit_results",             "column"=>"timestamp",      "where"=>"1=1"],
        "course_purchase"  => ["table"=>"payment_status",          "column"=>"timestamp",      "where"=>"status='initiated'"],
        "payment_success"  => ["table"=>"payment_status",          "column"=>"timestamp",      "where"=>"status='success'"],
        "preferred_domain" => ["table"=>"user_slected_domain_new", "column"=>"created_at",     "where"=>"1=1"],
        "visited_iap"      => ["table"=>"user_iap_visits",         "column"=>"visited_at",     "where"=>"1=1"],
        "result_view"      => ["table"=>"cit_results",             "column"=>"timestamp",      "where"=>"user_id IN (SELECT user_id FROM users WHERE score_viewed=1)"],
        "instantexam_reminder" => ["table"=>"set_reminder",        "column"=>"created_at",     "where"=>"1=1"],
        "course_edit"          => ["table"=>"internship_edit_logs","column"=>"created_at",     "where"=>"1=1"],
    ];

    [$start, $end] = resolveRange($filter, $today);

    if ($event === 'placement_community_link') {
        $sql = "SELECT event_count AS label, COUNT(*) AS cnt
                FROM (
                    SELECT user_id, COUNT(*) AS event_count
                    FROM " . pclUnion($start, $end) . "
                    GROUP BY user_id
                ) AS user_event_counts
                GROUP BY event_count
                ORDER BY event_count ASC";
    } elseif ($event === 'register_company') {
        /* hiring_employer is keyed by employer_id (no user_id column) */
        $sql = "SELECT event_count AS label, COUNT(*) AS cnt
                FROM (
                    SELECT employer_id, COUNT(*) AS event_count
                    FROM hiring_employer
                    WHERE registered_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY employer_id
                ) AS company_event_counts
                GROUP BY event_count
                ORDER BY event_count ASC";
    } elseif ($event === 'company_signin') {
        /* employer_login_logs is keyed by employer_id */
        $sql = "SELECT event_count AS label, COUNT(*) AS cnt
                FROM (
                    SELECT employer_id, COUNT(*) AS event_count
                    FROM employer_login_logs
                    WHERE login_time BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY employer_id
                ) AS company_signin_counts
                GROUP BY event_count
                ORDER BY event_count ASC";
    } elseif ($event === 'company_vacancy_post') {
        /* job_list is keyed by employer_id (jobs posted per company) */
        $sql = "SELECT event_count AS label, COUNT(*) AS cnt
                FROM (
                    SELECT employer_id, COUNT(*) AS event_count
                    FROM job_list
                    WHERE created_at BETWEEN '$start 00:00:00' AND '$end 23:59:59'
                    GROUP BY employer_id
                ) AS vacancy_post_counts
                GROUP BY event_count
                ORDER BY event_count ASC";
    } else {
        $tbl   = $localEventMap[$event]['table'];
        $col   = $localEventMap[$event]['column'];
        $where = $localEventMap[$event]['where'];

        $sql = "SELECT event_count AS label, COUNT(*) AS cnt
                FROM (
                    SELECT user_id, COUNT(*) AS event_count
                    FROM $tbl
                    WHERE $col BETWEEN '$start 00:00:00' AND '$end 23:59:59' AND $where
                    GROUP BY user_id
                ) AS user_event_counts
                GROUP BY event_count
                ORDER BY event_count ASC";
    }

    $res    = mysqli_query($conn, $sql);
    $labels = [];
    $counts = [];
    while ($row = mysqli_fetch_assoc($res)) {
        $labels[] = $row['label'];
        $counts[] = (int)$row['cnt'];
    }

    echo json_encode([
        "status" => "success",
        "labels" => $labels,
        "counts" => $counts,
        "xTitle" => "Number of Times Event Performed",
        "yTitle" => "Number of Users",
    ]);
    exit;
}


/* ── fallback ── */
echo json_encode(["status" => "error", "message" => "Invalid action"]);
exit;
?>