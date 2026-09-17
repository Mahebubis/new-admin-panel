<?php
/* ════════════════════════════════════════════════════════════
   MONITORING API
   Endpoint: /admin/react-api/api/monitoring/monitoring.php

   Reads the synthetic monitoring history written by the monitoring
   server (13.207.16.208) every 5 / 15 minutes.

   Actions (GET):
     ?action=overview                 -> current state of every check + uptime
     ?action=runs                     -> paginated run history (filterable)
     ?action=run&run_id=<id>          -> every check in one run, with step traces
     ?action=incidents                -> outage windows (consecutive failures)
     ?action=trend&days=30            -> daily pass/fail counts for the chart
     ?action=export                   -> CSV of the current filter

   The history lives in a SEPARATE database (`monitor`) from the application
   data, so the monitoring server never needs INSERT rights on istudio_cit.
   That means this file reads cross-database — see MON_DB below.

   Timestamps are stored in UTC. Everything returned to the browser is
   converted to IST so the admin panel never has to think about it.
════════════════════════════════════════════════════════════ */
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

date_default_timezone_set('Asia/Kolkata');

$jwt = require_jwt();
require_permission('monitoring', $jwt);

/* The monitoring history database and table. Change here if they ever move.
   NOTE: the API's MySQL user needs SELECT on this database —
   cPanel > Manage My Databases > Add User To Database > istudio_admin -> monitor */
define('MON_DB',    'monitor');
define('MON_TABLE', 'monitoring_runs');
define('MON_FQ',    '`' . MON_DB . '`.`' . MON_TABLE . '`');

/* Every check the monitor runs, in the order a student experiences them.
   Used so the overview shows all six even before the first run of one. */
$MON_CHECKS = [
    'website-availability' => ['label' => 'Website availability',  'group' => 'light',
        'blurb' => 'Dashboard, login and registration pages load and the app boots'],
    'api-health'           => ['label' => 'API health',            'group' => 'light',
        'blurb' => 'Database, registration, exam, payment and webhook endpoints answer'],
    'registration'         => ['label' => 'Student registration',  'group' => 'journey',
        'blurb' => 'A student can create an account and land on the thank-you page'],
    'login-exam-start'     => ['label' => 'Login and exam start',  'group' => 'journey',
        'blurb' => 'Sign in, enter the exam portal and see the first question'],
    'exam-submission'      => ['label' => 'Exam submission',       'group' => 'journey',
        'blurb' => 'Answers save and the submitted result is stored'],
    'payment-checkout'     => ['label' => 'Payment checkout',      'group' => 'journey',
        'blurb' => 'An order is created and the gateway checkout renders'],
];

/* ── helpers ─────────────────────────────────────────────── */

/* UTC column -> IST string, done in SQL so PHP never has to guess. */
function mon_ist($col) {
    return "CONVERT_TZ($col,'+00:00','+05:30')";
}

function mon_json($raw) {
    if ($raw === null || $raw === '') return null;
    $d = json_decode($raw, true);
    return json_last_error() === JSON_ERROR_NONE ? $d : null;
}

/* Turn one database row into the shape the React component expects. */
function mon_row($r) {
    return [
        'id'          => (int)$r['id'],
        'run_id'      => $r['run_id'],
        'check_id'    => $r['check_id'],
        'check_name'  => $r['check_name'],
        'check_group' => $r['check_group'],
        'status'      => $r['status'],
        'started_at'  => $r['started_ist'],
        'duration_ms' => (int)$r['duration_ms'],
        'attempts'    => (int)$r['attempts'],
        'failed_step' => $r['failed_step'],
        'error'       => $r['error'],
        'alerted'     => (int)$r['alerted'] === 1,
        'host'        => $r['host'],
        'steps'       => mon_json($r['steps_json'] ?? null) ?: [],
        'context'     => mon_json($r['context_json'] ?? null) ?: (object)[],
    ];
}

/* Build the WHERE clause shared by ?action=runs and ?action=export.
   Returns [sql, types, params] for bind_param. */
function mon_filters() {
    $where  = ['1=1'];
    $types  = '';
    $params = [];

    $check = trim($_GET['check'] ?? '');
    if ($check !== '' && $check !== 'all') {
        $where[]  = 'check_id = ?';
        $types   .= 's';
        $params[] = $check;
    }

    $status = trim($_GET['status'] ?? 'all');
    if (in_array($status, ['pass', 'fail', 'skip'], true)) {
        $where[]  = 'status = ?';
        $types   .= 's';
        $params[] = $status;
    }

    /* Dates arrive as IST calendar days; the column is UTC. Comparing the
       converted value keeps "25 Aug" meaning 25 Aug in Mumbai. */
    $ist = mon_ist('started_at');

    $date = trim($_GET['date'] ?? '');
    if ($date !== '') {
        $where[]  = "DATE($ist) = ?";
        $types   .= 's';
        $params[] = $date;
    }

    $from = trim($_GET['date_from'] ?? '');
    if ($from !== '') {
        $where[]  = "DATE($ist) >= ?";
        $types   .= 's';
        $params[] = $from;
    }

    $to = trim($_GET['date_to'] ?? '');
    if ($to !== '') {
        $where[]  = "DATE($ist) <= ?";
        $types   .= 's';
        $params[] = $to;
    }

    $q = trim($_GET['q'] ?? '');
    if ($q !== '') {
        $where[]  = '(run_id = ? OR failed_step LIKE ? OR error LIKE ?)';
        $types   .= 'sss';
        $params[] = $q;
        $params[] = '%' . $q . '%';
        $params[] = '%' . $q . '%';
    }

    return [implode(' AND ', $where), $types, $params];
}

function mon_bind($stmt, $types, $params) {
    if ($types === '') return;
    $refs = [];
    foreach ($params as $k => $v) $refs[$k] = &$params[$k];
    array_unshift($refs, $types);
    call_user_func_array([$stmt, 'bind_param'], $refs);
}

/* ── guard: is the history database reachable at all? ─────── */
$probe = @$conn->query('SELECT 1 FROM ' . MON_FQ . ' LIMIT 1');
if ($probe === false) {
    api_error(
        'Cannot read the monitoring history. Give this API user SELECT on the `' . MON_DB . '` ' .
        'database (cPanel > Manage My Databases > Add User To Database). MySQL said: ' . $conn->error,
        500
    );
}

/* ════════ ROUTING ════════ */
$action = $_GET['action'] ?? 'overview';

/* ── current state of every check ───────────────────────── */
if ($action === 'overview') {

    /* Newest non-skipped row per check. Joining on MAX(id) rather than
       MAX(started_at) avoids ties when two runs share a timestamp. */
    $latest = [];
    $sql = 'SELECT r.id, r.run_id, r.check_id, r.check_name, r.check_group, r.status,
                   ' . mon_ist('r.started_at') . ' AS started_ist,
                   r.duration_ms, r.attempts, r.failed_step, r.error, r.alerted, r.host,
                   r.steps_json, r.context_json
            FROM ' . MON_FQ . ' r
            JOIN (SELECT check_id, MAX(id) AS mid
                  FROM ' . MON_FQ . '
                  WHERE status <> "skip"
                  GROUP BY check_id) m ON r.id = m.mid';
    if ($res = $conn->query($sql)) {
        while ($r = $res->fetch_assoc()) $latest[$r['check_id']] = mon_row($r);
    }

    /* Uptime over two windows, in one pass each. */
    $windows = ['24h' => 1, '7d' => 7, '30d' => 30];
    $uptime  = [];
    foreach ($windows as $key => $days) {
        $st = $conn->prepare(
            'SELECT check_id,
                    COUNT(*)                              AS runs,
                    SUM(status = "pass")                  AS passed,
                    SUM(status = "fail")                  AS failed,
                    ROUND(AVG(duration_ms))               AS avg_ms,
                    MAX(duration_ms)                      AS max_ms
             FROM ' . MON_FQ . '
             WHERE started_at >= (UTC_TIMESTAMP() - INTERVAL ? DAY) AND status <> "skip"
             GROUP BY check_id'
        );
        $st->bind_param('i', $days);
        $st->execute();
        $r = $st->get_result();
        while ($row = $r->fetch_assoc()) {
            $runs = (int)$row['runs'];
            $uptime[$key][$row['check_id']] = [
                'runs'   => $runs,
                'passed' => (int)$row['passed'],
                'failed' => (int)$row['failed'],
                'pct'    => $runs > 0 ? round((int)$row['passed'] / $runs * 100, 2) : null,
                'avg_ms' => (int)$row['avg_ms'],
                'max_ms' => (int)$row['max_ms'],
            ];
        }
        $st->close();
    }

    /* For anything currently failing: when did this streak start?
       = the earliest failure after the most recent pass. */
    $downSince = [];
    foreach ($latest as $cid => $row) {
        if ($row['status'] !== 'fail') continue;
        $st = $conn->prepare(
            'SELECT ' . mon_ist('MIN(started_at)') . ' AS since, COUNT(*) AS runs
             FROM ' . MON_FQ . '
             WHERE check_id = ? AND status = "fail"
               AND started_at > IFNULL(
                     (SELECT MAX(started_at) FROM ' . MON_FQ . '
                      WHERE check_id = ? AND status = "pass"), "1970-01-01")'
        );
        $st->bind_param('ss', $cid, $cid);
        $st->execute();
        $d = $st->get_result()->fetch_assoc();
        $st->close();
        $downSince[$cid] = ['since' => $d['since'] ?? null, 'failed_runs' => (int)($d['runs'] ?? 0)];
    }

    /* Assemble in a fixed order so the UI never reshuffles between polls. */
    global $MON_CHECKS;
    $checks = [];
    foreach ($MON_CHECKS as $cid => $meta) {
        $row = $latest[$cid] ?? null;
        $checks[] = [
            'check_id'    => $cid,
            'check_name'  => $row['check_name'] ?? $meta['label'],
            'check_group' => $meta['group'],
            'blurb'       => $meta['blurb'],
            'status'      => $row['status']      ?? 'unknown',
            'last_run'    => $row['started_at']  ?? null,
            'duration_ms' => $row['duration_ms'] ?? null,
            'failed_step' => $row['failed_step'] ?? null,
            'error'       => $row['error']       ?? null,
            'attempts'    => $row['attempts']    ?? null,
            'alerted'     => $row['alerted']     ?? false,
            'run_id'      => $row['run_id']      ?? null,
            'uptime_24h'  => $uptime['24h'][$cid] ?? null,
            'uptime_7d'   => $uptime['7d'][$cid]  ?? null,
            'uptime_30d'  => $uptime['30d'][$cid] ?? null,
            'down_since'  => $downSince[$cid]['since'] ?? null,
            'failed_runs' => $downSince[$cid]['failed_runs'] ?? 0,
        ];
    }

    /* Freshness: how long since the monitor last wrote anything. A monitor
       that has stopped reporting looks identical to one with nothing to
       report, so this is what makes the difference visible. */
    $meta = $conn->query(
        'SELECT ' . mon_ist('MAX(started_at)') . ' AS last_seen,
                TIMESTAMPDIFF(MINUTE, MAX(started_at), UTC_TIMESTAMP()) AS minutes_ago,
                COUNT(*) AS total_rows,
                MIN(' . mon_ist('started_at') . ') AS oldest
         FROM ' . MON_FQ
    )->fetch_assoc();

    $failing = 0;
    foreach ($checks as $c) if ($c['status'] === 'fail') $failing++;

    api_success([
        'checks'  => $checks,
        'summary' => [
            'total'       => count($checks),
            'failing'     => $failing,
            'healthy'     => $failing === 0,
            'last_seen'   => $meta['last_seen'] ?? null,
            'minutes_ago' => $meta['minutes_ago'] === null ? null : (int)$meta['minutes_ago'],
            /* The light group runs every 5 minutes; nothing for 20 means the
               monitoring server itself is in trouble. */
            'stale'       => $meta['minutes_ago'] !== null && (int)$meta['minutes_ago'] > 20,
            'total_rows'  => (int)($meta['total_rows'] ?? 0),
            'oldest'      => $meta['oldest'] ?? null,
        ],
    ]);
}

/* ── paginated run history ──────────────────────────────── */
if ($action === 'runs') {
    [$where, $types, $params] = mon_filters();

    $page     = max(1, (int)($_GET['page'] ?? 1));
    $perPage  = min(200, max(10, (int)($_GET['per_page'] ?? 50)));
    $offset   = ($page - 1) * $perPage;

    $cst = $conn->prepare('SELECT COUNT(*) AS n FROM ' . MON_FQ . ' WHERE ' . $where);
    mon_bind($cst, $types, $params);
    $cst->execute();
    $total = (int)$cst->get_result()->fetch_assoc()['n'];
    $cst->close();

    $st = $conn->prepare(
        'SELECT id, run_id, check_id, check_name, check_group, status,
                ' . mon_ist('started_at') . ' AS started_ist,
                duration_ms, attempts, failed_step, error, alerted, host,
                steps_json, context_json
         FROM ' . MON_FQ . '
         WHERE ' . $where . '
         ORDER BY id DESC
         LIMIT ? OFFSET ?'
    );
    mon_bind($st, $types . 'ii', array_merge($params, [$perPage, $offset]));
    $st->execute();
    $res = $st->get_result();

    $records = [];
    while ($r = $res->fetch_assoc()) $records[] = mon_row($r);
    $st->close();

    api_success([
        'records'     => $records,
        'total'       => $total,
        'page'        => $page,
        'per_page'    => $perPage,
        'total_pages' => max(1, (int)ceil($total / $perPage)),
    ]);
}

/* ── one run, every check in it, with step traces ───────── */
if ($action === 'run') {
    $runId = trim($_GET['run_id'] ?? '');
    if ($runId === '') api_error('run_id required', 400);

    $st = $conn->prepare(
        'SELECT id, run_id, check_id, check_name, check_group, status,
                ' . mon_ist('started_at') . ' AS started_ist,
                duration_ms, attempts, failed_step, error, alerted, host,
                steps_json, context_json
         FROM ' . MON_FQ . '
         WHERE run_id = ?
         ORDER BY id ASC'
    );
    $st->bind_param('s', $runId);
    $st->execute();
    $res = $st->get_result();

    $records = [];
    while ($r = $res->fetch_assoc()) $records[] = mon_row($r);
    $st->close();

    if (!$records) api_error('Run not found', 404);

    api_success(['run_id' => $runId, 'records' => $records]);
}

/* ── outage windows ─────────────────────────────────────── */
if ($action === 'incidents') {
    $days  = min(180, max(1, (int)($_GET['days'] ?? 30)));
    $limit = min(500, max(10, (int)($_GET['limit'] ?? 200)));

    /* Pull the failures, then group consecutive ones per check in PHP.
       Doing it here rather than in SQL keeps the query portable and the
       grouping rule ("a gap of one successful run ends the incident")
       explicit and easy to change. */
    $st = $conn->prepare(
        'SELECT check_id, check_name, status,
                ' . mon_ist('started_at') . ' AS started_ist,
                failed_step, error, alerted
         FROM ' . MON_FQ . '
         WHERE started_at >= (UTC_TIMESTAMP() - INTERVAL ? DAY) AND status <> "skip"
         ORDER BY check_id ASC, started_at ASC'
    );
    $st->bind_param('i', $days);
    $st->execute();
    $res = $st->get_result();

    $incidents = [];
    $open      = [];   // check_id => incident being built

    while ($r = $res->fetch_assoc()) {
        $cid = $r['check_id'];

        if ($r['status'] === 'fail') {
            if (!isset($open[$cid])) {
                $open[$cid] = [
                    'check_id'    => $cid,
                    'check_name'  => $r['check_name'],
                    'started_at'  => $r['started_ist'],
                    'ended_at'    => $r['started_ist'],
                    'failed_runs' => 0,
                    'failed_step' => $r['failed_step'],
                    'error'       => $r['error'],
                    'alerted'     => false,
                ];
            }
            $open[$cid]['ended_at']     = $r['started_ist'];
            $open[$cid]['failed_runs'] += 1;
            if ((int)$r['alerted'] === 1) $open[$cid]['alerted'] = true;
        } elseif (isset($open[$cid])) {
            /* First pass after a run of failures closes the incident, and the
               recovery time is this successful run. */
            $open[$cid]['recovered_at'] = $r['started_ist'];
            $incidents[] = $open[$cid];
            unset($open[$cid]);
        }
    }
    $st->close();

    /* Anything still failing is an open incident. */
    foreach ($open as $inc) {
        $inc['recovered_at'] = null;
        $incidents[] = $inc;
    }

    foreach ($incidents as &$inc) {
        $end = $inc['recovered_at'] ?: $inc['ended_at'];
        $inc['minutes'] = max(0, (int)round(
            (strtotime($end) - strtotime($inc['started_at'])) / 60
        ));
        $inc['ongoing'] = $inc['recovered_at'] === null;
    }
    unset($inc);

    usort($incidents, fn($a, $b) => strcmp($b['started_at'], $a['started_at']));

    api_success([
        'incidents' => array_slice($incidents, 0, $limit),
        'days'      => $days,
        'total'     => count($incidents),
    ]);
}

/* ── daily pass/fail counts for the chart ───────────────── */
if ($action === 'trend') {
    $days = min(90, max(7, (int)($_GET['days'] ?? 30)));

    $st = $conn->prepare(
        'SELECT DATE(' . mon_ist('started_at') . ') AS day,
                COUNT(*)             AS runs,
                SUM(status = "pass") AS passed,
                SUM(status = "fail") AS failed
         FROM ' . MON_FQ . '
         WHERE started_at >= (UTC_TIMESTAMP() - INTERVAL ? DAY) AND status <> "skip"
         GROUP BY day
         ORDER BY day ASC'
    );
    $st->bind_param('i', $days);
    $st->execute();
    $res = $st->get_result();

    $rows = [];
    while ($r = $res->fetch_assoc()) {
        $runs = (int)$r['runs'];
        $rows[] = [
            'day'    => $r['day'],
            'runs'   => $runs,
            'passed' => (int)$r['passed'],
            'failed' => (int)$r['failed'],
            'pct'    => $runs > 0 ? round((int)$r['passed'] / $runs * 100, 2) : null,
        ];
    }
    $st->close();

    api_success(['trend' => $rows, 'days' => $days]);
}

/* ── CSV export of the current filter ───────────────────── */
if ($action === 'export') {
    [$where, $types, $params] = mon_filters();
    $cap = 20000;

    $st = $conn->prepare(
        'SELECT ' . mon_ist('started_at') . ' AS started_ist,
                run_id, check_id, check_name, check_group, status,
                duration_ms, attempts, failed_step, error, alerted, host
         FROM ' . MON_FQ . '
         WHERE ' . $where . '
         ORDER BY id DESC
         LIMIT ?'
    );
    mon_bind($st, $types . 'i', array_merge($params, [$cap]));
    $st->execute();
    $res = $st->get_result();

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="monitoring_' . date('Y-m-d') . '.csv"');

    $out = fopen('php://output', 'w');
    /* BOM so Excel opens UTF-8 correctly. */
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Time (IST)', 'Run ID', 'Check', 'Name', 'Group', 'Status',
                   'Duration (ms)', 'Attempts', 'Failed step', 'Error', 'Alert sent', 'Host']);
    while ($r = $res->fetch_assoc()) {
        fputcsv($out, [
            $r['started_ist'], $r['run_id'], $r['check_id'], $r['check_name'],
            $r['check_group'], $r['status'], $r['duration_ms'], $r['attempts'],
            $r['failed_step'], $r['error'], ((int)$r['alerted'] === 1 ? 'yes' : 'no'), $r['host'],
        ]);
    }
    fclose($out);
    $st->close();
    exit;
}

api_error('Unknown action', 400);
