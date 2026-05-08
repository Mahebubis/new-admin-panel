<?php
/*
 * /api/netcore/user_timeline.php
 *
 * GET / POST actions:
 *   action=timeline     → all events the given user has triggered, newest first
 *     params: user_id (int, required)  OR  email (string)
 *   action=event_detail → full row for one event occurrence
 *     params: event (string), user_id (int), ts (datetime "Y-m-d H:i:s")
 *
 * Designed to be fast:
 *   - One UNION ALL query that pulls the timestamp + event name from every relevant table
 *   - Indexed lookups by user_id everywhere
 */
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');
ini_set('display_errors', 0);
ob_start();

chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB connection missing']); exit; }

$action = $_REQUEST['action'] ?? 'timeline';

/* ── resolve user_id (allow email lookup as a convenience) ── */
function resolveUserId($conn) {
    $uid = (int)($_REQUEST['user_id'] ?? 0);
    if ($uid > 0) return $uid;

    $email = trim($_REQUEST['email'] ?? '');
    if ($email === '') return 0;
    $email = mysqli_real_escape_string($conn, $email);
    $r = mysqli_query($conn, "SELECT user_id FROM users WHERE email='$email' LIMIT 1");
    if ($r && $row = mysqli_fetch_assoc($r)) return (int)$row['user_id'];
    return 0;
}

/* ════════════════════════════════════════
   ACTION: timeline
   Identifies each occurrence by (event, user_id, ts) — no per-table id needed.
════════════════════════════════════════ */
if ($action === 'timeline') {
    $userId = resolveUserId($conn);
    if (!$userId) { echo json_encode(['status'=>'error','message'=>'Missing or invalid user_id/email']); exit; }

    $sql = "
      SELECT 'register'                 AS event, registered_at AS ts FROM users                       WHERE user_id=$userId
      UNION ALL
      SELECT 'signin'                   AS event, created_at    AS ts FROM signin_log                  WHERE user_id=$userId
      UNION ALL
      SELECT 'exam_success'             AS event, `timestamp`   AS ts FROM cit_results                 WHERE user_id=$userId
      UNION ALL
      SELECT 'course_purchase'          AS event, `timestamp`   AS ts FROM payment_status              WHERE user_id=$userId AND status='initiated'
      UNION ALL
      SELECT 'payment_success'          AS event, `timestamp`   AS ts FROM payment_status              WHERE user_id=$userId AND status='success'
      UNION ALL
      SELECT 'preferred_domain'         AS event, created_at    AS ts FROM user_slected_domain_new     WHERE user_id=$userId
      UNION ALL
      SELECT 'visited_iap'              AS event, visited_at    AS ts FROM user_iap_visits             WHERE user_id=$userId
      UNION ALL
      SELECT 'placement_community_link' AS event, assigned_at   AS ts FROM assigned_links              WHERE user_id=$userId
      UNION ALL
      SELECT 'placement_community_link' AS event, assigned_at   AS ts FROM assigned_links_for_refund   WHERE user_id=$userId
      UNION ALL
      SELECT 'instantexam_reminder'     AS event, created_at    AS ts FROM set_reminder                WHERE user_id=$userId
      UNION ALL
      SELECT 'course_edit'              AS event, created_at    AS ts FROM internship_edit_logs        WHERE user_id=$userId
      ORDER BY ts DESC
      LIMIT 500
    ";

    $res    = mysqli_query($conn, $sql);
    $events = [];
    if ($res) while ($row = mysqli_fetch_assoc($res)) {
        $events[] = [
            'event'     => $row['event'],
            'user_id'   => $userId,
            'timestamp' => $row['ts'],
        ];
    }
    /* SQL already returns DESC (most recent first) — keep it that way so the newest event is at the TOP. */

    /* basic profile snippet for the page header (incl. photo) */
    $r = mysqli_query($conn, "SELECT user_id, email, fname, lname, phone, photo, registered_at
                              FROM users WHERE user_id=$userId LIMIT 1");
    $profile = $r ? mysqli_fetch_assoc($r) : null;

    /* drop placeholder avatars so the UI can show initials instead */
    if ($profile && !empty($profile['photo'])) {
        $placeholder = 'https://hire.internshipstudio.com/assets/img/avatars/avatar_placeholder.png';
        if ($profile['photo'] === $placeholder) $profile['photo'] = null;
    }

    /* device used to register (mobile / desktop) — from store_full_url, most recent row */
    $device = null;
    $r = mysqli_query($conn, "SELECT device FROM store_full_url WHERE user_id=$userId ORDER BY created_at DESC LIMIT 1");
    if ($r && $row = mysqli_fetch_assoc($r)) $device = $row['device'];

    echo json_encode([
        'status'  => 'success',
        'profile' => $profile,
        'device'  => $device,
        'events'  => $events,
    ]);
    exit;
}

/* ════════════════════════════════════════
   ACTION: event_detail
   Looks up the row by (user_id, exact timestamp) on the right source table.
════════════════════════════════════════ */
if ($action === 'event_detail') {
    $event = $_REQUEST['event']   ?? '';
    $uid   = (int)($_REQUEST['user_id'] ?? 0);
    $ts    = mysqli_real_escape_string($conn, $_REQUEST['ts'] ?? '');
    if ($event === '' || !$uid || $ts === '') { echo json_encode(['status'=>'error','message'=>'Missing event/user_id/ts']); exit; }

    /* table + datetime column for each event */
    $eventTable = [
        'register'                 => ['tables' => [['users',                   'registered_at']]],
        'signin'                   => ['tables' => [['signin_log',              'created_at']]],
        'exam_success'             => ['tables' => [['cit_results',             '`timestamp`']]],
        'course_purchase'          => ['tables' => [['payment_status',          '`timestamp`']], 'extra' => "AND status='initiated'"],
        'payment_success'          => ['tables' => [['payment_status',          '`timestamp`']], 'extra' => "AND status='success'"],
        'preferred_domain'         => ['tables' => [['user_slected_domain_new', 'created_at']]],
        'visited_iap'              => ['tables' => [['user_iap_visits',         'visited_at']]],
        'instantexam_reminder'     => ['tables' => [['set_reminder',            'created_at']]],
        'course_edit'              => ['tables' => [['internship_edit_logs',    'created_at']]],
        /* placement_community_link spans two tables — try both */
        'placement_community_link' => ['tables' => [
            ['assigned_links',            'assigned_at'],
            ['assigned_links_for_refund', 'assigned_at'],
        ]],
    ];

    if (!isset($eventTable[$event])) { echo json_encode(['status'=>'error','message'=>'Unknown event']); exit; }
    $extra = $eventTable[$event]['extra'] ?? '';

    foreach ($eventTable[$event]['tables'] as [$tbl, $col]) {
        $q = "SELECT * FROM $tbl WHERE user_id=$uid AND $col='$ts' $extra LIMIT 1";
        $r = mysqli_query($conn, $q);
        if ($r && $row = mysqli_fetch_assoc($r)) {
            /* drop heavy/sensitive columns */
            foreach (['password','token','employer_password','employer_password_plain','user_agent'] as $strip) {
                if (array_key_exists($strip, $row)) unset($row[$strip]);
            }
            echo json_encode(['status'=>'success','event'=>$event,'table'=>$tbl,'data'=>$row]);
            exit;
        }
    }

    echo json_encode(['status'=>'error','message'=>'Row not found']);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>
