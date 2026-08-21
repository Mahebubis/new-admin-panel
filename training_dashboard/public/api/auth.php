<?php
/**
 * auth.php — every way into the learning portal.
 * ---------------------------------------------------------------------------
 *   ?action=session   GET   who am I? (called on every app boot)
 *   ?action=login     POST  {email, password}       — the `users` table
 *   ?action=google    POST  {credential}            — Google Identity JWT
 *   ?action=handoff   POST  {id, sig}               — the dashboard's Skill Lab
 *   ?action=logout    POST
 *
 * Three kinds of learner can sign in:
 *
 *   1. A dashboard user — a row in `users`. Same email + same bcrypt password
 *      as dashboard.internshipstudio.com, because it is literally the same row.
 *
 *   2. A Google sign-in — the email must already exist in `users`. We never
 *      auto-create here; enrolment happens in the admin panel.
 *
 *   3. A ₹99-store outsider — someone who bought from the store but never
 *      registered on the dashboard. They have NO `users` row, so they sign in
 *      with their store email plus one shared password set in the admin panel
 *      (LMS → Settings). Guarded both ways: the email must be absent from
 *      `users` AND present on a successful `ninety_nine_store_orders` row.
 *      Signing them in registers the `users` row on the spot, so from the
 *      second login onwards they are an ordinary case-1 learner.
 *
 * Every attempt, successful or not, lands in lms_learner_logins.
 */

require_once __DIR__ . '/_bootstrap.php';

$action = $_GET['action'] ?? '';
$in     = learn_input();

/* ── the session payload every screen needs ─────────────────────────────── */
function learn_profile($conn, $uid) {
    $res = $conn->query("SELECT user_id, name, fname, lname, email, phone, photo
                         FROM users WHERE user_id = " . (int)$uid . " LIMIT 1");
    $u = $res ? $res->fetch_assoc() : null;
    if (!$u) return null;

    $name = trim((string)$u['name']);
    if ($name === '') $name = trim($u['fname'] . ' ' . $u['lname']);
    if ($name === '') $name = strstr((string)$u['email'], '@', true) ?: 'Learner';

    return [
        'user_id' => (int)$u['user_id'],
        'name'    => $name,
        'email'   => (string)$u['email'],
        'phone'   => (string)$u['phone'],
        'photo'   => (string)$u['photo'],
        'initial' => strtoupper(mb_substr($name, 0, 1)),
    ];
}

/** Signs the learner in and (re)starts their session. */
function learn_start_session($conn, $uid, $method, $handoffId = 0) {
    session_regenerate_id(true);           // no fixation across a login boundary
    $_SESSION['learn_user_id']    = (int)$uid;
    $_SESSION['learn_login_at']   = time();
    $_SESSION['learn_method']     = $method;
    $_SESSION['learn_handoff_id'] = (int)$handoffId;
    return learn_profile($conn, $uid);
}

/* ─────────────────────────────── session ──────────────────────────────── */
if ($action === 'session') {
    $uid = learn_user();
    if (!$uid) learn_ok(['authenticated' => false]);

    $me = learn_profile($conn, $uid);
    if (!$me) {                            // user row deleted mid-session
        session_destroy();
        learn_ok(['authenticated' => false]);
    }

    /* A handoff session is only good for the calendar day it was minted on —
       the cookie on the client says the same thing, but the server is the one
       that decides, so a stale cookie can't outlive its row. */
    $hid = (int)($_SESSION['learn_handoff_id'] ?? 0);
    if ($hid) {
        $r  = $conn->query("SELECT created_at FROM lms_portal_handoffs WHERE id = $hid LIMIT 1");
        $ro = $r ? $r->fetch_assoc() : null;
        $sameDay = $ro && substr((string)$ro['created_at'], 0, 10) === date('Y-m-d');
        if (!$sameDay) {
            session_destroy();
            learn_ok(['authenticated' => false, 'expired' => true],
                     'Your learning-portal pass was from an earlier day — please sign in again.');
        }
    }

    learn_ok([
        'authenticated' => true,
        'user'          => $me,
        'method'        => $_SESSION['learn_method'] ?? 'password',
        'handoff_id'    => $hid,
    ]);
}

/* ──────────────────────────── email + password ────────────────────────── */
if ($action === 'login') {
    $email = strtolower(trim((string)($in['email'] ?? '')));
    $pass  = (string)($in['password'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) learn_error('Enter a valid email address');
    if ($pass === '') learn_error('Enter your password');

    $ee  = learn_esc($conn, $email);
    $res = $conn->query("SELECT user_id, password, active FROM users WHERE email = '$ee' LIMIT 1");
    $u   = $res ? $res->fetch_assoc() : null;

    if ($u) {
        if ((int)$u['active'] !== 1) {
            learn_log_login($conn, $u['user_id'], $email, 'password', 'failed', 'account inactive');
            learn_error('This account is inactive. Please contact support.', 403);
        }
        /* Same bcrypt hashes the dashboard writes, so one password works on both. */
        if (!password_verify($pass, (string)$u['password'])) {
            learn_log_login($conn, $u['user_id'], $email, 'password', 'failed', 'wrong password');
            learn_error('That email and password do not match', 401);
        }
        $me = learn_start_session($conn, $u['user_id'], 'password');
        learn_log_login($conn, $u['user_id'], $email, 'password');
        learn_ok(['user' => $me], 'Welcome back');
    }

    /* No `users` row — the ₹99-store outsider path. */
    $order = learn_store_buyer($conn, $email);
    if (!$order) {
        learn_log_login($conn, 0, $email, 'password', 'failed', 'no account');
        learn_error('We could not find that email. Use the email you bought your course with.', 401);
    }
    if (!learn_store_password_ok($conn, $pass)) {
        learn_log_login($conn, 0, $email, 'store', 'failed', 'wrong store password');
        learn_error('That password is not correct for a store purchase.', 401);
    }

    $reg = learn_register_learner($conn, $email, trim($order['first_name'] . ' ' . $order['last_name']), $order['phone_number']);
    if (!$reg['ok']) {
        learn_log_login($conn, 0, $email, 'store', 'failed', $reg['message']);
        learn_error('We could not set up your account: ' . $reg['message'], 500);
    }
    learn_sync_store_enrollments($conn, $reg['user_id'], $email);

    $me = learn_start_session($conn, $reg['user_id'], 'store');
    learn_log_login($conn, $reg['user_id'], $email, 'store');
    learn_ok(['user' => $me], 'Welcome to iStudio');
}

/* ─────────────────────────────── Google ───────────────────────────────── */
if ($action === 'google') {
    $credential = (string)($in['credential'] ?? '');
    if ($credential === '') learn_error('Google sign-in did not return a credential');

    $payload = learn_verify_google($credential);
    if (!$payload) {
        learn_log_login($conn, 0, '', 'google', 'failed', 'token verification failed');
        learn_error('We could not verify that Google account. Please try again.', 401);
    }

    $email = strtolower((string)($payload['email'] ?? ''));
    if ($email === '') learn_error('That Google account has no email address', 401);

    $ee  = learn_esc($conn, $email);
    $res = $conn->query("SELECT user_id, active FROM users WHERE email = '$ee' LIMIT 1");
    $u   = $res ? $res->fetch_assoc() : null;

    if (!$u) {
        /* Fall back to the store: a Google-only buyer still gets in, and gets
           a `users` row created for them, exactly like the password path. */
        $order = learn_store_buyer($conn, $email);
        if (!$order) {
            learn_log_login($conn, 0, $email, 'google', 'failed', 'no account');
            learn_error('No course is linked to that Google account yet.', 403);
        }
        $reg = learn_register_learner($conn, $email, (string)($payload['name'] ?? ''), $order['phone_number']);
        if (!$reg['ok']) learn_error('We could not set up your account: ' . $reg['message'], 500);
        learn_sync_store_enrollments($conn, $reg['user_id'], $email);
        $u = ['user_id' => $reg['user_id'], 'active' => 1];
    }

    if ((int)$u['active'] !== 1) {
        learn_log_login($conn, $u['user_id'], $email, 'google', 'failed', 'account inactive');
        learn_error('This account is inactive. Please contact support.', 403);
    }

    $me = learn_start_session($conn, $u['user_id'], 'google');
    learn_log_login($conn, $u['user_id'], $email, 'google');
    learn_ok(['user' => $me], 'Signed in with Google');
}

/* ───────────────── handoff from the dashboard's Skill Lab ─────────────── */
if ($action === 'handoff') {
    $id  = (int)($in['id'] ?? $_GET['id'] ?? 0);
    $sig = (string)($in['sig'] ?? $_GET['sig'] ?? '');

    if (!$id) learn_error('Missing handoff id');
    if (!learn_sign_ok($id, $sig)) {
        learn_log_login($conn, 0, '', 'handoff', 'failed', 'bad signature', $id);
        learn_error('That learning-portal link is not valid.', 401);
    }

    $r = $conn->query("SELECT h.id, h.user_id, h.email, h.created_at, u.active
                       FROM lms_portal_handoffs h
                       LEFT JOIN users u ON u.user_id = h.user_id
                       WHERE h.id = $id LIMIT 1");
    $h = $r ? $r->fetch_assoc() : null;
    if (!$h) learn_error('That learning-portal link has expired.', 401);

    /* The rule you asked for: a pass is good for the calendar day it was made
       on and no longer. The client keeps the same id in a cookie that dies at
       midnight, but this check is the one that actually matters. */
    if (substr((string)$h['created_at'], 0, 10) !== date('Y-m-d')) {
        learn_log_login($conn, $h['user_id'], $h['email'], 'handoff', 'failed', 'link is from an earlier day', $id);
        learn_error('That learning-portal pass was issued on an earlier day. Open it again from your dashboard.', 401);
    }
    if ((int)$h['active'] !== 1) {
        learn_log_login($conn, $h['user_id'], $h['email'], 'handoff', 'failed', 'account inactive', $id);
        learn_error('This account is inactive. Please contact support.', 403);
    }

    $conn->query("UPDATE lms_portal_handoffs SET consumed_at = NOW() WHERE id = $id AND consumed_at IS NULL");
    learn_sync_store_enrollments($conn, (int)$h['user_id'], (string)$h['email']);

    $me = learn_start_session($conn, (int)$h['user_id'], 'handoff', $id);
    learn_log_login($conn, (int)$h['user_id'], (string)$h['email'], 'handoff', 'success', '', $id);
    learn_ok(['user' => $me, 'handoff_id' => $id], 'Signed in from your dashboard');
}

/* ─────────────────────────────── logout ───────────────────────────────── */
if ($action === 'logout') {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    @session_destroy();
    learn_ok(['authenticated' => false], 'Signed out');
}

learn_error('Unknown auth action: ' . $action, 404);


/* ═══════════════════════════════ helpers ══════════════════════════════════ */

/**
 * The ₹99 store's own record of a buyer. The table is a guest-checkout log —
 * no user_id — so email is the only join key we have.
 * Returns the most recent successful order row, or null.
 */
function learn_store_buyer($conn, $email) {
    $ee  = learn_esc($conn, strtolower($email));
    $res = $conn->query("SELECT id, first_name, last_name, email, phone_number, courses, course_slug, course_name, created_at
                         FROM ninety_nine_store_orders
                         WHERE LOWER(email) = '$ee' AND status = 'success'
                         ORDER BY created_at DESC LIMIT 1");
    return $res ? $res->fetch_assoc() : null;
}

/**
 * The one shared password every store-only buyer signs in with. Stored as a
 * bcrypt hash in lms_settings (`store_login_password_hash`) and set from the
 * admin panel — LMS → Settings. Absent = the whole path is closed, which is
 * the safe default rather than a hardcoded fallback.
 */
function learn_store_password_ok($conn, $pass) {
    $res  = $conn->query("SELECT setting_value FROM lms_settings WHERE setting_key = 'store_login_password_hash' LIMIT 1");
    $hash = $res ? (string)($res->fetch_assoc()['setting_value'] ?? '') : '';
    if ($hash === '') return false;
    return password_verify($pass, $hash);
}

/**
 * Registers a `users` row for a store buyer. Mirrors lms_register_user() in
 * react-api/api/lms/lms_api.php (role 4 = learner) so a learner created here
 * is indistinguishable from one the admin panel imported.
 */
function learn_register_learner($conn, $email, $name, $phone = '') {
    $name  = trim($name) ?: (strstr($email, '@', true) ?: 'Learner');
    $parts = preg_split('/\s+/', $name, 2);
    $fname = $parts[0] ?? $name;
    $lname = $parts[1] ?? '';
    $phone = preg_replace('/[^0-9+]/', '', (string)$phone);

    /* A random password nobody is told: the store password is what they type,
       and this row's own password only starts mattering if they later use
       "forgot password" on the dashboard. */
    $password = bin2hex(random_bytes(8));
    $hash     = password_hash($password, PASSWORD_BCRYPT);

    $base = preg_replace('/[^a-z0-9]/', '', strtolower($fname)) ?: 'learner';
    $username = $base;
    for ($i = 1; $i <= 50; $i++) {
        $ue = learn_esc($conn, $username);
        $r  = $conn->query("SELECT user_id FROM users WHERE username = '$ue' LIMIT 1");
        if (!$r || !$r->num_rows) break;
        $username = $base . $i;
    }

    $stmt = $conn->prepare("INSERT INTO users
        (username, fname, lname, name, email, password, phone, role, active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 4, 1)");
    if (!$stmt) return ['ok' => false, 'message' => 'Prepare failed'];
    $stmt->bind_param('sssssss', $username, $fname, $lname, $name, $email, $hash, $phone);
    if (!$stmt->execute()) {
        $err = $stmt->error; $stmt->close();
        learn_log('REGISTER', $err);
        return ['ok' => false, 'message' => 'Could not create the account'];
    }
    $uid = $stmt->insert_id;
    $stmt->close();

    @$conn->query("INSERT IGNORE INTO additional_details (user_id) VALUES ($uid)");
    @$conn->query("INSERT IGNORE INTO user_steps (user_id) VALUES ($uid)");

    return ['ok' => true, 'user_id' => (int)$uid, 'message' => ''];
}

/**
 * Turns ₹99-store purchases into LMS enrolments.
 *
 * The store records what was bought by slug; the LMS records what can be
 * played. Only slugs that match an lms_courses row become enrolments — an
 * unmapped slug is simply skipped (the Skill Lab card then shows it as
 * "content coming soon"). Safe to call on every sign-in: the enrolment table
 * has a UNIQUE (course_id, user_id), so repeats are no-ops.
 */
function learn_sync_store_enrollments($conn, $userId, $email) {
    $userId = (int)$userId;
    if (!$userId || $email === '') return 0;

    $ee  = learn_esc($conn, strtolower($email));
    $res = $conn->query("SELECT courses, course_slug FROM ninety_nine_store_orders
                         WHERE LOWER(email) = '$ee' AND status = 'success'");
    if (!$res) return 0;

    $slugs = [];
    while ($o = $res->fetch_assoc()) {
        /* `courses` is a JSON array of {name, slug, price}; course_slug holds
           the first one and is the only field older rows have. */
        $list = json_decode((string)$o['courses'], true);
        if (is_array($list)) {
            foreach ($list as $c) {
                $s = is_array($c) ? ($c['slug'] ?? '') : '';
                if ($s) $slugs[strtolower(trim($s))] = true;
            }
        }
        if (!empty($o['course_slug'])) $slugs[strtolower(trim($o['course_slug']))] = true;
    }
    if (!$slugs) return 0;

    $inList = implode(',', array_map(fn($s) => "'" . learn_esc($conn, $s) . "'", array_keys($slugs)));
    $cRes = $conn->query("SELECT id, validity_days FROM lms_courses
                          WHERE LOWER(slug) IN ($inList) AND status = 'published'");
    $made = 0;
    while ($cRes && ($c = $cRes->fetch_assoc())) {
        $cid    = (int)$c['id'];
        $days   = max(1, (int)($c['validity_days'] ?: 365));
        $expiry = date('Y-m-d', strtotime("+$days days"));
        $ok = $conn->query("INSERT IGNORE INTO lms_enrollments
            (course_id, user_id, access_type, amount, source, expiry_date, status)
            VALUES ($cid, $userId, 'paid', 99, 'store', '$expiry', 'active')");
        if ($ok && $conn->affected_rows > 0) $made++;
    }
    return $made;
}

/**
 * Verifies a Google Identity Services credential (a JWT) against Google's own
 * tokeninfo endpoint. Simpler and more robust than shipping a JWKS verifier,
 * and this runs once per sign-in so the extra round trip is not a concern.
 * Returns the decoded payload, or null if anything about it is wrong.
 */
function learn_verify_google($credential) {
    $clientId = '';
    if (is_file(__DIR__ . '/config/google.php')) $clientId = (string)(require __DIR__ . '/config/google.php');

    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential);
    $ch  = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($code !== 200 || !$body) { learn_log('GOOGLE', "tokeninfo HTTP $code"); return null; }
    $p = json_decode($body, true);
    if (!is_array($p) || empty($p['email'])) return null;

    if (($p['email_verified'] ?? 'false') !== 'true' && ($p['email_verified'] ?? false) !== true) return null;
    if ($clientId !== '' && ($p['aud'] ?? '') !== $clientId) { learn_log('GOOGLE', 'aud mismatch'); return null; }
    if ((int)($p['exp'] ?? 0) < time()) return null;

    return $p;
}
