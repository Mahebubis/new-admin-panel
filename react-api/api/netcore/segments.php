<?php
/*
 * /api/netcore/segments.php
 *
 * Body actions (form-urlencoded or JSON):
 *   action=list            → list segments (id, name, counts, refreshed)
 *   action=get      &id    → fetch one segment + its config JSON
 *   action=save     [&id]  &name &contact_type &config(json) → create/update
 *   action=delete   &id
 *   action=duplicate&id
 *   action=refresh  &id    → recompute user_count
 *   action=count           &config(json) → preview count without saving
 *   action=download &id    → CSV of resulting users (email, fname, lname, phone, registered_at)
 */
header('Cache-Control: no-cache, no-store, must-revalidate');
ini_set('display_errors', 0);
ob_start();

chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();

global $conn;
if (!$conn) { header('Content-Type: application/json'); echo json_encode(['status'=>'error','message'=>'DB connection missing']); exit; }

/* helpers */
function jin($k, $d = null) { $v = $_REQUEST[$k] ?? null; return $v === null ? $d : $v; }
function ok($a)   { header('Content-Type: application/json'); echo json_encode(['status'=>'success'] + $a); exit; }
function fail($m, $code = 400) { http_response_code($code); header('Content-Type: application/json'); echo json_encode(['status'=>'error','message'=>$m]); exit; }
function esc($s) { global $conn; return mysqli_real_escape_string($conn, $s); }

/* ════════════════════════════════════════ 
   Event-table mapping (mirrors behaviour.php)
   For each event we know:
     - source SQL fragment that yields user_id rows occurring in [start,end]
     - Optional WHERE on a payload (filters) — we map each (event,payloadKey) to a column
═══════════════════════════════════════ */
$EVENT_SOURCE = [
    /* event_key => [table, user_col, date_col, extraWhere] */
    'register'                 => ['users',                   'user_id', 'registered_at',  ''],
    'signin'                   => ['signin_log',              'user_id', 'created_at',     ''],
    'exam_success'             => ['cit_results',             'user_id', '`timestamp`',    ''],
    'course_purchase'          => ['payment_status',          'user_id', '`timestamp`',    "status='initiated'"],
    'payment_success'          => ['payment_status',          'user_id', '`timestamp`',    "status='success'"],
    'preferred_domain'         => ['user_slected_domain_new', 'user_id', 'created_at',     ''],
    'visited_iap'              => ['user_iap_visits',         'user_id', 'visited_at',     ''],
    'result_view'              => ['cit_results',             'user_id', '`timestamp`',    'user_id IN (SELECT user_id FROM users WHERE score_viewed=1)'],
    'placement_community_link' => ['assigned_links',          'user_id', 'assigned_at',    ''],
    'instantexam_reminder'     => ['set_reminder',            'user_id', 'created_at',     ''],
    'course_edit'              => ['internship_edit_logs',    'user_id', 'created_at',     ''],
];

/* (event, payloadKey) → fully-qualified column to filter on.
   Columns starting with `users.` trigger an automatic LEFT JOIN to users when the source table is different. */
$PAYLOAD_COLUMNS = [
    'register' => [
        'country' => 'users.country', 'mobile' => 'users.phone', 'last_name' => 'users.lname',
        'state' => 'users.state', 'first_name' => 'users.fname', 'email' => 'users.email',
        'instantexam' => 'users.instant_exam', 'instantresult' => 'users.instant_result',
        'is_from_refund' => 'users.is_from_refund',
        'method'        => "(CASE WHEN users.is_signup_by_google='yes' THEN 'Google' ELSE 'Manual' END)",
    ],
    'signin'           => [ 'email' => 'users.email' ],
    'exam_success'     => [ 'result_score' => 'cit_results.score', 'status' => "'Completed'" ],
    'course_purchase'  => [
        'amount'          => 'payment_status.amount',
        'internship_name' => 'payment_status.internship_name',
        'batch_date'      => 'payment_status.batch_date',
        'coupon_applied'  => "(CASE WHEN payment_status.coupon_code IS NOT NULL AND payment_status.coupon_code <> '' THEN 'yes' ELSE 'no' END)",
    ],
    'payment_success'  => [
        'paid_amount'            => 'payment_status.amount',
        'paid_internship_name'   => 'payment_status.internship_name',
        'paid_batch_date'        => 'payment_status.batch_date',
        'coupon_applied_success' => "(CASE WHEN payment_status.coupon_code IS NOT NULL AND payment_status.coupon_code <> '' THEN 'yes' ELSE 'no' END)",
        'order_id'               => 'payment_status.order_id',
    ],
    'preferred_domain' => [ 'preferred_domain' => 'user_slected_domain_new.domain_name' ],
    'visited_iap'      => [ 'visited' => "'yes'" ],
    'result_view'      => [ 'score' => 'cit_results.score' ],
    'instantexam_reminder' => [ 'time_slot' => 'set_reminder.time_slot' ],
    'course_edit' => [
        'edit_internship_name' => 'internship_edit_logs.new_internship_name',
        'edit_page_url'        => 'internship_edit_logs.page_url',
        'edit_batch_date'      => 'internship_edit_logs.new_batch',
        'edit_type'            => 'internship_edit_logs.action_type',
    ],
    'register_company' => [
        'company_logo'   => "(CASE WHEN hiring_employer.employer_logo IS NOT NULL AND hiring_employer.employer_logo <> '' THEN 'Has Logo' ELSE 'No Logo' END)",
        'company_mobile' => 'hiring_employer.employer_phone',
        'company_name'   => 'hiring_employer.employer_name',
        'company_email'  => 'hiring_employer.employer_email',
    ],
    'company_signin' => [
        'company_signin_status' => 'employer_login_logs.status',
        'company_signin_ip'     => 'employer_login_logs.ip_address',
    ],
    'company_vacancy_post' => [
        'vp_job_type'    => 'job_list.job_type',
        'vp_job_title'   => 'job_list.job_title',
        'vp_mode'        => 'job_list.job_mode',
        'vp_comp_type'   => 'job_list.compensation_type',
        'vp_comp_period' => 'job_list.compensation_period',
        'vp_method'      => 'job_list.job_nature',
        'vp_source'      => 'job_list.source',
    ],
];

/* day filter — { type:'any'|'between'|'in_past'|'exactly_before', from, to, n, unit } → [start,end] dates or null */
function resolveDay($day) {
    if (!$day || ($day['type'] ?? 'any') === 'any') return [null, null];
    $t = $day['type'];
    $today = date('Y-m-d');
    if ($t === 'between') return [$day['from'] ?? $today, $day['to'] ?? $today];
    if ($t === 'in_past') {
        $n = max(1, (int)($day['n'] ?? 7));
        $unit = $day['unit'] ?? 'days';
        $sec = ['hours'=>3600,'days'=>86400,'weeks'=>604800,'months'=>2592000][$unit] ?? 86400;
        return [date('Y-m-d', time() - $n * $sec), $today];
    }
    if ($t === 'exactly_before') {
        $n = max(1, (int)($day['n'] ?? 7));
        $d = date('Y-m-d', time() - $n * 86400);
        return [$d, $d];
    }
    return [null, null];
}

/* Build a SELECT user_id subquery from a single condition. Returns SQL string or null on bad input. */
function buildConditionSql($cond, $isExclude = false) {
    global $EVENT_SOURCE, $PAYLOAD_COLUMNS, $conn;

    $event = $cond['event'] ?? '';
    if (!isset($EVENT_SOURCE[$event])) return null;
    [$tbl, $userCol, $dateCol, $where] = $EVENT_SOURCE[$event];

    $op    = $cond['operator'] ?? '>=';
    $count = max(0, (int)($cond['count'] ?? 1));
    $opMap = ['>='=>'>=', '>'=>'>', '<='=>'<=', '<'=>'<', '='=>'='];
    if (!isset($opMap[$op])) $op = '>=';

    /* day window */
    [$ds, $de] = resolveDay($cond['day'] ?? null);
    $whereParts = [];
    if ($where !== '') $whereParts[] = $where;
    if ($ds && $de)    $whereParts[] = "$dateCol BETWEEN '" . esc($ds) . " 00:00:00' AND '" . esc($de) . " 23:59:59'";

    /* payload filter — single filter per condition (legacy `filters[]` still supported) */
    $allFilters = $cond['filter'] ? [$cond['filter']] : ($cond['filters'] ?? []);
    foreach ($allFilters as $f) {
        if (!$f) continue;
        $pkey = $f['payload'] ?? '';
        $pop  = $f['op']      ?? 'is';
        $pval = $f['value']   ?? '';
        $col  = $PAYLOAD_COLUMNS[$event][$pkey] ?? null;
        if (!$col) continue;
        $valE = esc($pval);
        switch ($pop) {
            case 'exists':         $whereParts[] = "$col IS NOT NULL AND $col <> ''"; break;
            case 'does not exist': $whereParts[] = "($col IS NULL OR $col = '')";     break;
            case 'is':             $whereParts[] = "$col = '$valE'";                  break;
            case 'is not':         $whereParts[] = "$col <> '$valE'";                 break;
            case 'contains':       $whereParts[] = "$col LIKE '%$valE%'";             break;
            case 'does not contain': $whereParts[] = "$col NOT LIKE '%$valE%'";       break;
        }
    }

    $whereSql = $whereParts ? 'WHERE ' . implode(' AND ', $whereParts) : '';

    /* If event source needs a JOIN to users for register-payload columns, join it */
    $needsUsersJoin = false;
    foreach (($cond['filters'] ?? []) as $f) {
        $col = $PAYLOAD_COLUMNS[$event][$f['payload'] ?? ''] ?? '';
        if (strpos($col, 'users.') === 0 && $tbl !== 'users') { $needsUsersJoin = true; break; }
    }
    if (!$needsUsersJoin && !empty($cond['filter']['payload'])) {
        $col = $PAYLOAD_COLUMNS[$event][$cond['filter']['payload']] ?? '';
        if (strpos($col, 'users.') === 0 && $tbl !== 'users') $needsUsersJoin = true;
    }
    $join = $needsUsersJoin ? "LEFT JOIN users ON users.user_id = $tbl.$userCol" : '';

    /* Group + count comparison */
    $sql = "SELECT $tbl.$userCol AS user_id FROM $tbl $join $whereSql GROUP BY $tbl.$userCol HAVING COUNT(*) $op $count";

    /* did_not_do → invert: users NOT IN (the above) */
    if (($cond['did'] ?? 'did') === 'did_not_do') {
        $sql = "SELECT u.user_id FROM users u WHERE u.user_id NOT IN ($sql)";
    }
    return $sql;
}

/* Combine sub-queries (each yielding user_ids) by walking left-to-right with AND/OR.
   AND → IN (next), OR → UNION. */
function combineByConnector($items) {
    if (!$items) return null;
    $current = $items[0]['sql'];
    for ($i = 1; $i < count($items); $i++) {
        $next = $items[$i]['sql'];
        if (($items[$i]['connector'] ?? 'AND') === 'OR') {
            $current = "($current) UNION ($next)";
        } else {
            $current = "SELECT user_id FROM ($current) AS a WHERE user_id IN ($next)";
        }
    }
    return $current;
}

function combineConditions($conds) {
    $items = [];
    foreach ($conds as $i => $c) {
        $s = buildConditionSql($c);
        if (!$s) continue;
        $items[] = ['connector' => $i === 0 ? null : ($c['condConnector'] ?? 'AND'), 'sql' => $s];
    }
    return combineByConnector($items);
}

function combineBlocks($blocks) {
    $items = [];
    foreach ($blocks as $i => $b) {
        $s = combineConditions($b['conditions'] ?? []);
        if (!$s) continue;
        $items[] = ['connector' => $i === 0 ? null : ($b['blockConnector'] ?? 'AND'), 'sql' => $s];
    }
    $merged = combineByConnector($items);
    return $merged ? "SELECT DISTINCT user_id FROM ($merged) AS final_set" : null;
}

/* Build full SQL: include MINUS exclude. Final result excludes users whose users.active = 0. */
function buildSegmentSql($config) {
    $inc = combineBlocks($config['include']['blocks'] ?? []);
    if (!$inc) return null;
    $exc = combineBlocks($config['exclude']['blocks'] ?? []);
    $base = $exc
        ? "SELECT user_id FROM ($inc) AS inc WHERE user_id NOT IN (SELECT user_id FROM ($exc) AS exc)"
        : $inc;

    /* drop inactive users from the final segment (active = 0 → excluded; NULL/missing → kept) */
    return "SELECT s.user_id
            FROM ($base) AS s
            INNER JOIN users u ON u.user_id = s.user_id
            WHERE COALESCE(u.active, 1) <> 0";
}

function countSegment($config) {
    global $conn;
    $sql = buildSegmentSql($config);
    if (!$sql) return 0;
    $r = mysqli_query($conn, "SELECT COUNT(*) AS c FROM ($sql) AS s");
    if (!$r) return 0;
    return (int)mysqli_fetch_assoc($r)['c'];
}

/* counts: total, with email, with phone */
function channelCounts($config) {
    global $conn;
    $sql = buildSegmentSql($config);
    if (!$sql) return ['total' => 0, 'email' => 0, 'phone' => 0];
    $q = "SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN u.email IS NOT NULL AND u.email <> '' THEN 1 ELSE 0 END) AS email_c,
            SUM(CASE WHEN u.phone IS NOT NULL AND u.phone <> '' THEN 1 ELSE 0 END) AS phone_c
          FROM ($sql) AS s INNER JOIN users u ON u.user_id = s.user_id";
    $r = mysqli_query($conn, $q);
    if (!$r) return ['total' => 0, 'email' => 0, 'phone' => 0];
    $row = mysqli_fetch_assoc($r);
    return [
        'total' => (int)$row['total'],
        'email' => (int)$row['email_c'],
        'phone' => (int)$row['phone_c'],
    ];
}

/* idempotent: add columns to netcore_segments if not present */
function ensureSchema() {
    global $conn;
    $r = mysqli_query($conn, "SHOW COLUMNS FROM netcore_segments LIKE 'email_count'");
    if (!$r || mysqli_num_rows($r) === 0) {
        mysqli_query($conn, "ALTER TABLE netcore_segments
                             ADD COLUMN email_count INT NOT NULL DEFAULT 0,
                             ADD COLUMN phone_count INT NOT NULL DEFAULT 0");
    }
}
ensureSchema();

/* ════════════════════════════════════════
   ROUTING
═══════════════════════════════════════ */
$action = jin('action', '');

if ($action === 'list') {
    $page    = max(1, (int)jin('page', 1));
    $perPage = max(1, min(100, (int)jin('per_page', 10)));
    $search  = trim((string)jin('search', ''));
    $sort    = jin('sort', '');     /* '' | 'created_at' | 'refreshed' */
    $order   = strtolower(jin('order', 'desc')) === 'asc' ? 'ASC' : 'DESC';
    $offset  = ($page - 1) * $perPage;

    $where = '';
    if ($search !== '') {
        $s = esc($search);
        $where = "WHERE name LIKE '%$s%'";
    }

    $orderBy = "ORDER BY id DESC";
    if ($sort === 'created_at') $orderBy = "ORDER BY created_at $order";
    if ($sort === 'refreshed')  $orderBy = "ORDER BY user_count_refreshed_at $order";

    $tr = mysqli_query($conn, "SELECT COUNT(*) AS c FROM netcore_segments $where");
    $total = $tr ? (int)mysqli_fetch_assoc($tr)['c'] : 0;

    $r = mysqli_query($conn, "SELECT id, name, contact_type, user_count, email_count, phone_count,
                                     user_count_refreshed_at, created_at, updated_at
                              FROM netcore_segments
                              $where
                              $orderBy LIMIT $perPage OFFSET $offset");
    $rows = [];
    while ($r && $row = mysqli_fetch_assoc($r)) $rows[] = $row;
    ok([
        'segments' => $rows,
        'total'    => $total,
        'page'     => $page,
        'per_page' => $perPage,
        'pages'    => $total > 0 ? (int)ceil($total / $perPage) : 1,
    ]);
}

if ($action === 'get') {
    $id = (int)jin('id', 0);
    $r = mysqli_query($conn, "SELECT * FROM netcore_segments WHERE id=$id LIMIT 1");
    $row = $r ? mysqli_fetch_assoc($r) : null;
    if (!$row) fail('Not found', 404);
    $row['config'] = json_decode($row['config'], true);
    ok(['segment' => $row]);
}

if ($action === 'count') {
    $config = json_decode(jin('config', ''), true);
    if (!is_array($config)) fail('Invalid config');
    $count = countSegment($config);
    ok(['count' => $count]);
}

if ($action === 'save') {
    $id          = (int)jin('id', 0);
    $name        = trim((string)jin('name', ''));
    $contactType = trim((string)jin('contact_type', 'all_identified'));
    $config      = jin('config', '');
    if ($name === '')       fail('Name required');
    $cfgArr = json_decode($config, true);
    if (!$cfgArr) fail('Invalid config JSON');

    $ch = channelCounts($cfgArr);
    $nameE = esc($name); $ctE = esc($contactType); $cfgE = esc($config);
    $now   = date('Y-m-d H:i:s');

    if ($id > 0) {
        mysqli_query($conn, "UPDATE netcore_segments
                             SET name='$nameE', contact_type='$ctE', config='$cfgE',
                                 user_count={$ch['total']}, email_count={$ch['email']}, phone_count={$ch['phone']},
                                 user_count_refreshed_at='$now'
                             WHERE id=$id");
    } else {
        mysqli_query($conn, "INSERT INTO netcore_segments (name, contact_type, config, user_count, email_count, phone_count, user_count_refreshed_at)
                             VALUES ('$nameE', '$ctE', '$cfgE', {$ch['total']}, {$ch['email']}, {$ch['phone']}, '$now')");
        $id = mysqli_insert_id($conn);
    }
    ok(['id' => $id, 'count' => $ch['total'], 'email_count' => $ch['email'], 'phone_count' => $ch['phone'], 'refreshed_at' => $now]);
}

if ($action === 'delete') {
    $id = (int)jin('id', 0);
    if (!$id) fail('id required');
    mysqli_query($conn, "DELETE FROM netcore_segments WHERE id=$id");
    ok([]);
}

if ($action === 'duplicate') {
    $id = (int)jin('id', 0);
    $r = mysqli_query($conn, "SELECT name, contact_type, config FROM netcore_segments WHERE id=$id LIMIT 1");
    $row = $r ? mysqli_fetch_assoc($r) : null;
    if (!$row) fail('Not found', 404);
    $name = esc($row['name'] . ' (Copy)');
    $ct   = esc($row['contact_type']);
    $cfg  = esc($row['config']);
    mysqli_query($conn, "INSERT INTO netcore_segments (name, contact_type, config) VALUES ('$name','$ct','$cfg')");
    ok(['id' => mysqli_insert_id($conn)]);
}

if ($action === 'refresh') {
    $id = (int)jin('id', 0);
    $r = mysqli_query($conn, "SELECT config FROM netcore_segments WHERE id=$id LIMIT 1");
    $row = $r ? mysqli_fetch_assoc($r) : null;
    if (!$row) fail('Not found', 404);
    $ch = channelCounts(json_decode($row['config'], true));
    $now = date('Y-m-d H:i:s');
    mysqli_query($conn, "UPDATE netcore_segments
                         SET user_count={$ch['total']}, email_count={$ch['email']}, phone_count={$ch['phone']},
                             user_count_refreshed_at='$now'
                         WHERE id=$id");
    ok(['count' => $ch['total'], 'email_count' => $ch['email'], 'phone_count' => $ch['phone'], 'refreshed_at' => $now]);
}

if ($action === 'users') {
    /* paginated users for a segment, optionally filtered to a channel (email/sms/whatsapp) */
    $id      = (int)jin('id', 0);
    $page    = max(1, (int)jin('page', 1));
    $perPage = max(1, min(200, (int)jin('per_page', 25)));
    $channel = jin('channel', '');   /* '', 'email', 'sms', 'whatsapp' */
    $search  = trim((string)jin('search', ''));
    $offset  = ($page - 1) * $perPage;

    $r = mysqli_query($conn, "SELECT name, config FROM netcore_segments WHERE id=$id LIMIT 1");
    $seg = $r ? mysqli_fetch_assoc($r) : null;
    if (!$seg) fail('Not found', 404);
    $sql = buildSegmentSql(json_decode($seg['config'], true));
    if (!$sql) ok(['total' => 0, 'page' => 1, 'pages' => 1, 'users' => [], 'name' => $seg['name']]);

    $whereExtra = '';
    if ($channel === 'email') {
        $whereExtra = "AND u.email IS NOT NULL AND u.email <> ''";
    } elseif ($channel === 'sms' || $channel === 'whatsapp') {
        $whereExtra = "AND u.phone IS NOT NULL AND u.phone <> ''";
    }
    if ($search !== '') {
        $s = esc($search);
        if (strpos($search, '@') !== false)        $whereExtra .= " AND u.email = '$s'";
        elseif (preg_match('/^\d+$/', $search))    $whereExtra .= strlen($search) >= 10 ? " AND u.phone = '$s'" : " AND u.user_id = '$s'";
        else                                       $whereExtra .= " AND (u.fname LIKE '$s%' OR u.lname LIKE '$s%')";
    }

    $base = "FROM ($sql) AS s INNER JOIN users u ON u.user_id = s.user_id WHERE 1=1 $whereExtra";

    $tr = mysqli_query($conn, "SELECT COUNT(*) AS c $base");
    $total = $tr ? (int)mysqli_fetch_assoc($tr)['c'] : 0;

    $listSql = "SELECT u.user_id, u.email, u.phone AS mobile, u.fname AS first_name, u.lname AS last_name,
                       u.state, u.country, u.registered_at AS register_date
                $base
                ORDER BY u.registered_at DESC
                LIMIT $perPage OFFSET $offset";
    $lr = mysqli_query($conn, $listSql);
    $users = [];
    while ($lr && $row = mysqli_fetch_assoc($lr)) {
        if (!empty($row['register_date'])) $row['register_date'] = substr($row['register_date'], 0, 10);
        $users[] = $row;
    }

    ok([
        'name'  => $seg['name'],
        'total' => $total,
        'page'  => $page,
        'per_page' => $perPage,
        'pages' => $total > 0 ? (int)ceil($total / $perPage) : 1,
        'users' => $users,
    ]);
}

if ($action === 'users_csv') {
    /* full CSV export of a segment's users (optionally per channel) */
    $id      = (int)jin('id', 0);
    $channel = jin('channel', '');
    $r = mysqli_query($conn, "SELECT name, config FROM netcore_segments WHERE id=$id LIMIT 1");
    $seg = $r ? mysqli_fetch_assoc($r) : null;
    if (!$seg) fail('Not found', 404);
    $sql = buildSegmentSql(json_decode($seg['config'], true));
    if (!$sql) fail('Empty segment');
    $whereExtra = '';
    if ($channel === 'email')                       $whereExtra = "AND u.email IS NOT NULL AND u.email <> ''";
    elseif ($channel === 'sms' || $channel === 'whatsapp') $whereExtra = "AND u.phone IS NOT NULL AND u.phone <> ''";

    $filename = preg_replace('/[^a-zA-Z0-9_]+/', '_', $seg['name']) . ($channel ? "_$channel" : '') . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"$filename\"");
    $out = fopen('php://output', 'w');
    fputcsv($out, ['user_id','email','mobile','first_name','last_name','state','country','register_date']);
    $q = "SELECT u.user_id, u.email, u.phone, u.fname, u.lname, u.state, u.country, u.registered_at
          FROM ($sql) AS s INNER JOIN users u ON u.user_id = s.user_id WHERE 1=1 $whereExtra";
    $res = mysqli_query($conn, $q);
    while ($res && $row = mysqli_fetch_assoc($res)) fputcsv($out, $row);
    fclose($out);
    exit;
}

if ($action === 'download') {
    $id = (int)jin('id', 0);
    $r = mysqli_query($conn, "SELECT name, config FROM netcore_segments WHERE id=$id LIMIT 1");
    $row = $r ? mysqli_fetch_assoc($r) : null;
    if (!$row) fail('Not found', 404);
    $sql = buildSegmentSql(json_decode($row['config'], true));
    if (!$sql) fail('Empty segment');

    /* stream as CSV */
    $filename = preg_replace('/[^a-zA-Z0-9_]+/', '_', $row['name']) . '.csv';
    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"$filename\"");
    $out = fopen('php://output', 'w');
    fputcsv($out, ['user_id', 'email', 'fname', 'lname', 'phone', 'registered_at']);

    $q = "SELECT u.user_id, u.email, u.fname, u.lname, u.phone, u.registered_at
          FROM users u INNER JOIN ($sql) AS s ON s.user_id = u.user_id";
    $res = mysqli_query($conn, $q);
    if ($res) while ($r = mysqli_fetch_assoc($res)) fputcsv($out, $r);
    fclose($out);
    exit;
}

fail('Invalid action');
?>
