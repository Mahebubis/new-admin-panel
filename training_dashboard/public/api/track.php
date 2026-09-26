<?php
/**
 * track.php — portal usage analytics: how often learners come back, how long
 * they stay, and which screens and courses that time went to.
 * ---------------------------------------------------------------------------
 *   ?action=flush   POST {
 *                     visit_key,
 *                     entry:    {path, referrer}          // first flush only
 *                     segments: [{path, title, course_id, lesson_id,
 *                                 seconds, views}, …]
 *                   }
 *
 * ONE endpoint, called about once a minute per tab. It used to be three
 * (visit / page / beat) firing four times a minute between them; the client now
 * buffers locally and hands over a batch, so ten lesson switches arrive as ten
 * segments in a single request. See src/lib/tracking.js for the other half.
 *
 * Notes
 *   • The client owns `visit_key` (a random 32-hex string in sessionStorage), so
 *     one browser tab is one visit and a reload does not inflate the count.
 *   • The client also stops counting two minutes after the last sign of life,
 *     so an abandoned tab cannot report an overnight study session. The clamp
 *     below is the server's own backstop against a bad or forged payload.
 *   • Requests may arrive via navigator.sendBeacon on pagehide, which posts
 *     text/plain — learn_input() reads php://input either way.
 *   • Everything is best effort: a tracking failure must never surface to the
 *     learner, so this answers success even when a write is a no-op.
 */

require_once __DIR__ . '/_bootstrap.php';

$uid    = learn_require_user();
$action = $_GET['action'] ?? '';
$in     = learn_input();

learn_insight_install($conn);

/* ── ?action=issue — a playback problem ─────────────────────────────────
   POST { course_id, lesson_id, type, detail, note, source, video_kind,
          video_url, player_state, page, device:{…} }
   From the player itself (a source that never loaded, an embed that never
   answered) or from the troubleshooter's Report button. One row each, with
   the browser details, so the admin can see where problems cluster. */
if ($action === 'issue') {
    $type = preg_replace('/[^a-z_]/', '', strtolower((string)($in['type'] ?? '')));
    if ($type === '') learn_error('type is required');
    $lid = max(0, (int)($in['lesson_id'] ?? 0));

    /* A player stuck in a loop is one problem, not fifty rows. A learner's
       own report always gets through. */
    try {
    if ($type !== 'learner_report') {
        $dup = $conn->query("SELECT id FROM lms_player_issues
                             WHERE user_id = " . (int)$uid . " AND lesson_id = $lid
                               AND issue_type = '" . learn_esc($conn, $type) . "'
                               AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE) LIMIT 1");
        if ($dup && $dup->num_rows) learn_ok(['logged' => false]);
    }

    $d   = learn_device(is_array($in['device'] ?? null) ? $in['device'] : null);
    $e   = fn($v, $len) => "'" . learn_esc($conn, substr((string)$v, 0, $len)) . "'";
    $src = in_array($in['source'] ?? '', ['auto', 'learner'], true) ? $in['source'] : 'auto';

    $ok = $conn->query("INSERT INTO lms_player_issues
        (user_id, course_id, lesson_id, issue_type, source, detail, note, video_kind, video_url,
         player_state, page, browser, browser_version, os, os_version, device_type, in_app,
         device_json, ip, user_agent)
        VALUES (" . (int)$uid . ", " . max(0, (int)($in['course_id'] ?? 0)) . ", $lid,
                " . $e($type, 40) . ", '$src', " . $e($in['detail'] ?? '', 400) . ", " . $e($in['note'] ?? '', 1000) . ",
                " . $e($in['video_kind'] ?? '', 16) . ", " . $e($in['video_url'] ?? '', 500) . ",
                " . $e($in['player_state'] ?? '', 60) . ", " . $e($in['page'] ?? '', 255) . ",
                " . $e($d['browser'], 40) . ", " . $e($d['browser_version'], 40) . ", " . $e($d['os'], 30) . ",
                " . $e($d['os_version'], 30) . ", " . $e($d['device_type'], 16) . ", " . $e($d['in_app'], 40) . ",
                " . $e($d['json'] ?? '', 4000) . ", " . $e(learn_ip(), 45) . ", " . $e(learn_ua(), 400) . ")");
    if (!$ok) learn_log('ISSUE', 'insert failed: ' . $conn->error);
    } catch (Throwable $t) {
        learn_log('ISSUE', $t->getMessage());
        $ok = false;
    }
    learn_ok(['logged' => (bool)$ok]);
}

if ($action !== 'flush') learn_error('Unknown track action: ' . $action, 404);

/* A visit key is client-generated, so it is validated hard before use. */
$key = strtolower(trim((string)($in['visit_key'] ?? '')));
if (!preg_match('/^[0-9a-f]{32}$/', $key)) learn_ok([]);

$segments = is_array($in['segments'] ?? null) ? $in['segments'] : [];
$entry    = is_array($in['entry'] ?? null) ? $in['entry'] : null;

$clean = fn($p) => substr(parse_url((string)$p, PHP_URL_PATH) ?: '/', 0, 255);

/* ── the visit row ─────────────────────────────────────────────────────── */
$ke = learn_esc($conn, $key);
$r  = $conn->query("SELECT id FROM lms_learner_visits WHERE visit_key = '$ke' LIMIT 1");
$visitId = $r && ($row = $r->fetch_assoc()) ? (int)$row['id'] : 0;

if (!$visitId) {
    $conn->query("INSERT INTO lms_learner_visits
        (user_id, visit_key, entry_path, referrer, ip, user_agent, last_seen_at)
        VALUES (" . (int)$uid . ", '$ke',
                '" . learn_esc($conn, $clean($entry['path'] ?? '/')) . "',
                '" . learn_esc($conn, substr((string)($entry['referrer'] ?? ''), 0, 500)) . "',
                '" . learn_esc($conn, learn_ip()) . "', '" . learn_esc($conn, learn_ua()) . "', NOW())");
    $visitId = (int)$conn->insert_id;

    /* Which browser, which version, which machine — for the admin's Devices
       & browsers report. A statement of its own, so a database still missing
       these columns keeps recording the visit itself. */
    if ($visitId) {
        $d = learn_device(is_array($entry['device'] ?? null) ? $entry['device'] : null);
        $e = fn($v, $len) => "'" . learn_esc($conn, substr((string)$v, 0, $len)) . "'";
        try { $conn->query("UPDATE lms_learner_visits SET
                browser = " . $e($d['browser'], 40) . ", browser_version = " . $e($d['browser_version'], 40) . ",
                os = " . $e($d['os'], 30) . ", os_version = " . $e($d['os_version'], 30) . ",
                device_type = " . $e($d['device_type'], 16) . ", in_app = " . $e($d['in_app'], 40) . ",
                screen = " . $e($d['screen'] ?? '', 20) . ", device_json = " . $e($d['json'] ?? '', 4000) . "
            WHERE id = $visitId"); } catch (Throwable $t) { learn_log('TRACK', 'device: ' . $t->getMessage()); }
    }

    if (!$visitId) {
        /* Two tabs racing on one key: re-read rather than insert a duplicate. */
        $r = $conn->query("SELECT id FROM lms_learner_visits WHERE visit_key = '$ke' LIMIT 1");
        $visitId = $r && ($row = $r->fetch_assoc()) ? (int)$row['id'] : 0;
    }
    if (!$visitId) learn_ok([]);
}

/* ── the segments ──────────────────────────────────────────────────────── */
$totalSeconds = 0;
$totalViews   = 0;
$applied      = 0;

/* A single flush covers at most a minute of use, so anything past a handful of
   screens is a malformed payload rather than real browsing. */
foreach (array_slice($segments, 0, 40) as $s) {
    if (!is_array($s)) continue;

    $path = $clean($s['path'] ?? '');
    if ($path === '') continue;

    /* Clamped: the client flushes every 60s, so 300s allows for a late flush
       and clock skew while still refusing a payload claiming hours. */
    $seconds = min(300, max(0, (int)($s['seconds'] ?? 0)));
    $views   = min(20,  max(0, (int)($s['views'] ?? 0)));
    if ($seconds === 0 && $views === 0) continue;

    $cid = max(0, (int)($s['course_id'] ?? 0));
    $lid = max(0, (int)($s['lesson_id'] ?? 0));

    $conn->query("INSERT INTO lms_learner_page_views
        (visit_id, user_id, path, title, course_id, lesson_id, seconds, last_seen_at)
        VALUES ($visitId, " . (int)$uid . ", '" . learn_esc($conn, $path) . "',
                '" . learn_esc($conn, substr((string)($s['title'] ?? ''), 0, 190)) . "',
                $cid, $lid, $seconds, NOW())
        ON DUPLICATE KEY UPDATE
            seconds      = seconds + VALUES(seconds),
            last_seen_at = NOW(),
            title        = IF(VALUES(title) <> '', VALUES(title), title),
            course_id    = IF(VALUES(course_id) > 0, VALUES(course_id), course_id)");

    $totalSeconds += $seconds;
    $totalViews   += $views;
    $applied++;
}

if ($totalSeconds > 0 || $totalViews > 0) {
    $conn->query("UPDATE lms_learner_visits
                  SET duration_secs = duration_secs + $totalSeconds,
                      page_views    = page_views + $totalViews,
                      last_seen_at  = NOW()
                  WHERE id = $visitId");
}

learn_ok(['visit_id' => $visitId, 'segments' => $applied, 'seconds' => $totalSeconds]);
