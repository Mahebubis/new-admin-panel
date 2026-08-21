<?php
/**
 * _bootstrap.php — shared bootstrap for every training.internshipstudio.com
 * endpoint (the learner-facing "Skill Lab / learning portal").
 * ---------------------------------------------------------------------------
 * Responsibilities, in order:
 *   1. CORS for the origins that talk to us (the dashboard app and local dev)
 *   2. a session cookie scoped to this subdomain only
 *   3. $conn — the same `istudio_cit` database the admin LMS writes to
 *   4. learn_install() — creates the portal-only tables (SSO handoffs, login
 *      log, visit/page analytics). The lms_* content tables are owned by
 *      react-api/api/lms/lms_api.php and are NEVER created here.
 *   5. tiny JSON helpers with the same {status,data|message} contract the rest
 *      of the estate uses.
 *
 * Nothing here echoes on its own: endpoints call learn_ok() / learn_error().
 */

@ini_set('display_errors', '0');
error_reporting(E_ALL);

define('LEARN_LOG_FILE', __DIR__ . '/learn_errors.log');
@ini_set('log_errors', '1');
@ini_set('error_log', LEARN_LOG_FILE);

function learn_log($label, $msg) {
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $label . ': ' . $msg
          . '  {' . ($_SERVER['REQUEST_METHOD'] ?? 'CLI') . ' '
          . ($_SERVER['REQUEST_URI'] ?? '') . '}' . PHP_EOL;
    @file_put_contents(LEARN_LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

/* ── 1. CORS ───────────────────────────────────────────────────────────────
   The portal's own pages are same-origin, so this mainly matters for local
   Vite dev and for the dashboard app calling handoff_status.php. Credentials
   are allowed, which is why the origin is echoed back rather than wildcarded. */
$LEARN_ALLOWED_ORIGINS = [
    'https://training.internshipstudio.com',
    'https://dashboard.internshipstudio.com',
    'https://cit.internshipstudio.com',
];
$learnCrossSite = false;
if (isset($_SERVER['HTTP_ORIGIN'])) {
    $o = $_SERVER['HTTP_ORIGIN'];
    $devOrigin = preg_match('#^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$#', $o);
    if (in_array($o, $LEARN_ALLOWED_ORIGINS, true) || $devOrigin) {
        header("Access-Control-Allow-Origin: $o");
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');
        /* Same-origin production requests carry no Origin header at all, so this
           only ever flips for a genuinely cross-site caller we already trust. */
        $learnCrossSite = ($o !== 'https://training.internshipstudio.com');
    }
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

header('Content-Type: application/json');

/* ── 2. session ────────────────────────────────────────────────────────────
   Deliberately NOT shared with dashboard.internshipstudio.com: the portal has
   its own login and its own lifetime. The handoff link (see auth.php) is what
   bridges the two, not a shared cookie. */
if (session_status() !== PHP_SESSION_ACTIVE) {
    /* SameSite: Lax in production, where the app and this API share an origin
       and Lax is the stronger CSRF posture.

       A trusted cross-site caller — in practice `vite dev` on localhost —
       cannot use a Lax cookie at all: the browser withholds it on XHR, so
       login succeeds and every request after it arrives with no session. Those
       callers get None, which requires Secure. It is scoped tightly: the flag
       only flips for an Origin already on the allow-list above, so an attacker
       page (whose Origin is rejected) still faces a Lax cookie. */
    $secure = (($_SERVER['HTTPS'] ?? '') === 'on') || $learnCrossSite;
    session_name('istudio_learn');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => ($learnCrossSite && $secure) ? 'None' : 'Lax',
    ]);
    @session_start();
}

/* ── 3. database ───────────────────────────────────────────────────────────
   config/db.php FIRST, and the shared cPanel helper only as a fallback.

   The original order was the other way round, on the assumption that
   /home/istudio/public_html/cit/common/helper.php was a thin connector like
   react-api treats it. It is not: it is the CIT app's front controller. Merely
   including it runs its whole request router — which on this subdomain means

     • a Composer platform_check.php that trigger_error()s at E_USER_ERROR
       because the lock file wants PHP >= 8.2 and this vhost runs 8.1, and which
       sets a 500 on the way out;
     • dozens of `Undefined array key "action"` warnings from that router
       reading request keys we never sent;
     • unknown side effects on headers, the session and the response code.

   Suppressing all of that was possible but never going to be stable — the next
   PHP bump or helper edit breaks us again. A dedicated connection is four lines
   and answers to nobody, so that is what the portal uses. The helper stays as a
   fallback purely so a box without config/db.php still works. */
$conn = null;
if (is_file(__DIR__ . '/config/db.php')) {
    $cfg = require __DIR__ . '/config/db.php';
    $try = @new mysqli($cfg['host'], $cfg['user'], $cfg['pass'], $cfg['name'], $cfg['port'] ?? 3306);
    if ($try->connect_errno) learn_log('DB', 'config/db.php: ' . $try->connect_error);
    else $conn = $try;
}

$sharedHelper = '/home/istudio/public_html/cit/common/helper.php';
if (!$conn && is_file($sharedHelper)) {
    learn_log('DB', 'falling back to the shared helper — create config/db.php to avoid this');
    $prevCode = http_response_code();
    /* Swallow only the platform check; everything else keeps normal handling. */
    set_error_handler(function ($no, $str) {
        if (strpos($str, 'Composer detected issues in your platform') !== false) return true;
        /* The helper's router warnings are noise here and would otherwise bury
           our own entries in learn_errors.log. */
        if (strpos($str, 'Undefined array key') !== false) return true;
        return false;
    });
    ob_start();
    @chdir(dirname($sharedHelper));
    include_once $sharedHelper;
    ob_end_clean();
    restore_error_handler();
    // platform_check.php sets a 500 before it errors out; undo that.
    if (http_response_code() !== $prevCode) @http_response_code($prevCode ?: 200);
    if (function_exists('connect_db')) $conn = connect_db('istudio_cit');
}
if (!$conn) {
    learn_log('DB', 'no connection available');
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Database unavailable']);
    exit;
}
$conn->set_charset('utf8mb4');

/* ── 4. helpers ────────────────────────────────────────────────────────── */
function learn_ok($data = [], $message = '') {
    echo json_encode(['status' => 'success', 'data' => $data, 'message' => $message]);
    exit;
}
function learn_error($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['status' => 'error', 'message' => $message]);
    exit;
}
function learn_input() {
    $raw = file_get_contents('php://input');
    $j   = $raw ? json_decode($raw, true) : null;
    return is_array($j) ? $j : ($_POST ?: []);
}
function learn_esc($conn, $v) { return $conn->real_escape_string((string)$v); }
function learn_ip() {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
    return substr((string)$ip, 0, 45);
}
function learn_ua() { return substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 400); }

/** The secret both sides of the handoff sign with. See config/secret.php. */
function learn_secret() {
    static $s = null;
    if ($s === null) {
        $s = is_file(__DIR__ . '/config/secret.php') ? (string)(require __DIR__ . '/config/secret.php') : '';
        if ($s === '') learn_log('CONFIG', 'config/secret.php missing — handoff links will be rejected');
    }
    return $s;
}
/** HMAC over the handoff row id — stops anyone walking ?sso=1,2,3… into another account. */
function learn_sign($id) { return hash_hmac('sha256', 'handoff:' . (int)$id, learn_secret()); }
function learn_sign_ok($id, $sig) {
    $s = learn_secret();
    return $s !== '' && is_string($sig) && $sig !== '' && hash_equals(learn_sign($id), $sig);
}

/* ── 5. portal-only tables ─────────────────────────────────────────────────
   Idempotent and cheap enough to run per request (CREATE TABLE IF NOT EXISTS
   against an existing table is a metadata no-op) — same approach lms_api.php
   takes for the content tables. */
function learn_install($conn) {
    /* One row per "Go to learning portal" click in the dashboard's Skill Lab.
       Its id is the parameter handed to the portal and then parked in a cookie
       for the rest of the calendar day; created_at is what expires it. */
    $conn->query("CREATE TABLE IF NOT EXISTS lms_portal_handoffs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT          NOT NULL,
        email       VARCHAR(190)      DEFAULT NULL,
        source      VARCHAR(40)       DEFAULT 'skill_lab',
        course_id   INT               DEFAULT 0,
        ip          VARCHAR(45)       DEFAULT NULL,
        user_agent  VARCHAR(400)      DEFAULT NULL,
        consumed_at DATETIME          DEFAULT NULL,
        created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    /* Every way into the portal, logged: manual password, Google, the ₹99-store
       outsider password, and the dashboard handoff. Failures land here too. */
    $conn->query("CREATE TABLE IF NOT EXISTS lms_learner_logins (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT               DEFAULT 0,
        email      VARCHAR(190)      DEFAULT NULL,
        method     ENUM('password','google','store','handoff') DEFAULT 'password',
        outcome    ENUM('success','failed') DEFAULT 'success',
        reason     VARCHAR(190)      DEFAULT NULL,
        handoff_id INT               DEFAULT 0,
        ip         VARCHAR(45)       DEFAULT NULL,
        user_agent VARCHAR(400)      DEFAULT NULL,
        created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_created (user_id, created_at),
        INDEX idx_method (method, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    /* One visit = one browser tab session. last_seen_at is bumped by the
       heartbeat, so duration_secs survives a tab closing without a goodbye
       (beforeunload is not reliable on mobile). */
    $conn->query("CREATE TABLE IF NOT EXISTS lms_learner_visits (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT          NOT NULL,
        visit_key     CHAR(32)     NOT NULL,
        entry_path    VARCHAR(255)      DEFAULT NULL,
        referrer      VARCHAR(500)      DEFAULT NULL,
        ip            VARCHAR(45)       DEFAULT NULL,
        user_agent    VARCHAR(400)      DEFAULT NULL,
        page_views    INT               DEFAULT 0,
        duration_secs INT               DEFAULT 0,
        started_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        last_seen_at  DATETIME          DEFAULT NULL,
        UNIQUE KEY uniq_visit (visit_key),
        INDEX idx_user_started (user_id, started_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    /* Time on each screen, attributed to a course/lesson where there is one.
       Upserted on (visit, path, lesson) so a heartbeat is a single UPDATE. */
    $conn->query("CREATE TABLE IF NOT EXISTS lms_learner_page_views (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        visit_id     INT          NOT NULL,
        user_id      INT          NOT NULL,
        path         VARCHAR(255) NOT NULL,
        title        VARCHAR(190)      DEFAULT NULL,
        course_id    INT               DEFAULT 0,
        lesson_id    INT               DEFAULT 0,
        seconds      INT               DEFAULT 0,
        entered_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        last_seen_at DATETIME          DEFAULT NULL,
        UNIQUE KEY uniq_view (visit_id, path, lesson_id),
        INDEX idx_user_course (user_id, course_id),
        INDEX idx_lesson (lesson_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}
learn_install($conn);

/**
 * The watch-tracking columns on lms_progress, as a set of lowercase names.
 *
 * lms_progress belongs to react-api/api/lms/lms_api.php and this file does not
 * create it. The extra columns are a different matter: without them the portal
 * silently drops the playhead, the real duration and the time actually spent
 * watching, so it adds any that are missing rather than waiting for the admin
 * API to be deployed. Both sides use the same DDL, so whichever runs first
 * wins and the other's lms_add_column() becomes a no-op.
 *
 * The answer is cached in a marker file for an hour — this is read on every
 * position heartbeat, and SHOW COLUMNS on each of those is a waste.
 */
function learn_watch_columns($conn) {
    static $cols = null;
    if ($cols !== null) return $cols;

    $marker = sys_get_temp_dir() . '/istudio-lms-watch-columns.json';
    if (is_file($marker) && (time() - (int)@filemtime($marker)) < 3600) {
        $cached = json_decode((string)@file_get_contents($marker), true);
        if (is_array($cached) && $cached) { $cols = $cached; return $cols; }
    }

    $cols = [];
    $r = $conn->query('SHOW COLUMNS FROM lms_progress');
    while ($r && ($row = $r->fetch_assoc())) $cols[strtolower((string)$row['Field'])] = true;
    if (!$cols) return $cols;                    // table missing: nothing to do

    $want = [
        'last_position_secs' => '`last_position_secs` INT NOT NULL DEFAULT 0',
        'duration_secs'      => '`duration_secs` INT NOT NULL DEFAULT 0',
        'watch_time_secs'    => '`watch_time_secs` INT NOT NULL DEFAULT 0',
        'play_count'         => '`play_count` INT NOT NULL DEFAULT 0',
        'first_played_at'    => '`first_played_at` DATETIME NULL DEFAULT NULL',
        'last_played_at'     => '`last_played_at` DATETIME NULL DEFAULT NULL',
        'completed_at'       => '`completed_at` DATETIME NULL DEFAULT NULL',
    ];
    foreach ($want as $name => $ddl) {
        if (isset($cols[$name])) continue;
        if ($conn->query("ALTER TABLE lms_progress ADD COLUMN $ddl")) $cols[$name] = true;
        else learn_log('SCHEMA', "could not add lms_progress.$name: " . $conn->error);
    }

    @file_put_contents($marker, json_encode($cols));
    return $cols;
}

/* ── 6. the logged-in learner ──────────────────────────────────────────── */
function learn_user() { return (int)($_SESSION['learn_user_id'] ?? 0); }

/** Guard for endpoints that need a learner; never returns when signed out. */
function learn_require_user() {
    $uid = learn_user();
    if (!$uid) learn_error('Not signed in', 401);
    return $uid;
}

/** Writes one row into the login log. Never fatal — analytics must not block a login. */
function learn_log_login($conn, $userId, $email, $method, $outcome = 'success', $reason = '', $handoffId = 0) {
    @$conn->query("INSERT INTO lms_learner_logins
        (user_id, email, method, outcome, reason, handoff_id, ip, user_agent)
        VALUES (" . (int)$userId . ", '" . learn_esc($conn, $email) . "', '" . learn_esc($conn, $method) . "',
                '" . learn_esc($conn, $outcome) . "', '" . learn_esc($conn, $reason) . "', " . (int)$handoffId . ",
                '" . learn_esc($conn, learn_ip()) . "', '" . learn_esc($conn, learn_ua()) . "')");
}
