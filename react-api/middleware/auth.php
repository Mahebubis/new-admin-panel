<?php
/**
 * JWT Authentication Middleware
 * Custom HS256 JWT implementation (no external library needed)
 */

// function base64url_encode($data) {
//     return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
// }

// function base64url_decode($data) {
//     return base64_decode(strtr($data, '-_', '+/'));
// }

// function jwt_encode($payload) {
//     $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
//     $payload = json_encode($payload);

//     $base = base64url_encode($header) . '.' . base64url_encode($payload);
//     $signature = hash_hmac('sha256', $base, JWT_SECRET_KEY, true);

//     return $base . '.' . base64url_encode($signature);
// }

// function jwt_decode($token) {
//     $parts = explode('.', $token);
//     if (count($parts) !== 3) return null;

//     $base = $parts[0] . '.' . $parts[1];
//     $signature = base64url_decode($parts[2]);
//     $expected = hash_hmac('sha256', $base, JWT_SECRET_KEY, true);

//     if (!hash_equals($expected, $signature)) return null;

//     $payload = json_decode(base64url_decode($parts[1]), true);
//     if (!$payload) return null;

//     // Check expiration
//     if (isset($payload['exp']) && $payload['exp'] < time()) return null;

//     return $payload;
// }

// function get_bearer_token() {
//     $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
//     if (preg_match('/Bearer\s+(.+)$/i', $auth, $m)) {
//         return $m[1];
//     }
//     return $_GET['token'] ?? null;
// }

// function require_jwt() {
//     $token = get_bearer_token();
//     if (!$token) {
//         api_error('No authentication token provided', 401);
//     }

//     $payload = jwt_decode($token);
//     if (!$payload) {
//         api_error('Invalid or expired token', 401);
//     }

//     return $payload;
// }

// function get_admin_permissions($user_id, $conn) {
//     // Check if superadmin
//     $stmt = $conn->prepare("SELECT is_superadmin FROM admin_users WHERE user_id = ? AND is_active = 1");
//     $stmt->bind_param("i", $user_id);
//     $stmt->execute();
//     $result = $stmt->get_result()->fetch_assoc();

//     if ($result && $result['is_superadmin']) {
//         return ['__superadmin__'];
//     }

//     // Get individual permissions
//     $stmt = $conn->prepare("SELECT permission_key FROM admin_permissions WHERE user_id = ? AND granted = 1");
//     $stmt->bind_param("i", $user_id);
//     $stmt->execute();
//     $res = $stmt->get_result();

//     $perms = ['dashboard'];
//     while ($row = $res->fetch_assoc()) {
//         $perms[] = $row['permission_key'];
//     }

//     return array_unique($perms);
// }

// function has_permission($key, $jwt_data) {
//     $perms = $jwt_data['permissions'] ?? [];
//     if (in_array('__superadmin__', $perms)) return true;
//     if ($key === 'dashboard') return true;
//     return in_array($key, $perms);
// }

// function require_permission($key, $jwt_data) {
//     if (!has_permission($key, $jwt_data)) {
//         api_error('You do not have permission for this action', 403);
//     }
// }

// function is_superadmin($jwt_data) {
//     return in_array('__superadmin__', $jwt_data['permissions'] ?? []);
// }

// // Response helpers
// function api_success($data = [], $message = 'Success', $code = 200) {
//     http_response_code($code);
//     echo json_encode(['success' => true, 'message' => $message, 'data' => $data]);
//     exit();
// }

// function api_error($message = 'Error', $code = 400) {
//     http_response_code($code);
//     echo json_encode(['success' => false, 'message' => $message, 'data' => []]);
//     exit();
// }

// function get_json_input() {
//     $input = json_decode(file_get_contents('php://input'), true);
//     return $input ?: [];
// }

// function get_client_ip() {
//     return $_SERVER['HTTP_CF_CONNECTING_IP']
//         ?? $_SERVER['HTTP_X_FORWARDED_FOR']
//         ?? $_SERVER['HTTP_CLIENT_IP']
//         ?? $_SERVER['REMOTE_ADDR']
//         ?? '0.0.0.0';
// }

// function require_method($method) {
//     if ($_SERVER['REQUEST_METHOD'] !== strtoupper($method)) {
//         api_error('Method not allowed', 405);
//     }
// }

// // Pagination helper
// function get_pagination() {
//     $page = max(1, intval($_GET['page'] ?? 1));
//     $per_page = max(1, min(100, intval($_GET['per_page'] ?? $_GET['limit'] ?? 20)));
//     $offset = ($page - 1) * $per_page;
//     return [$page, $per_page, $offset];
// }

// function get_search() {
//     return trim($_GET['search'] ?? $_GET['keyword'] ?? '');
// }






/**
 * JWT Authentication Middleware
 * Custom HS256 JWT implementation (no external library needed)
 *
 * v2 changes:
 *  - require_jwt() now checks admin_users.is_active on every authenticated
 *    request. If a user exists in admin_users with is_active = 0, they are
 *    immediately logged out (HTTP 401). This works even if their JWT is
 *    still within its exp window.
 */

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwt_encode($payload) {
    $header  = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode($payload);

    $base      = base64url_encode($header) . '.' . base64url_encode($payload);
    $signature = hash_hmac('sha256', $base, JWT_SECRET_KEY, true);

    return $base . '.' . base64url_encode($signature);
}

function jwt_decode($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    $base      = $parts[0] . '.' . $parts[1];
    $signature = base64url_decode($parts[2]);
    $expected  = hash_hmac('sha256', $base, JWT_SECRET_KEY, true);

    if (!hash_equals($expected, $signature)) return null;

    $payload = json_decode(base64url_decode($parts[1]), true);
    if (!$payload) return null;

    // Check expiration
    if (isset($payload['exp']) && $payload['exp'] < time()) return null;

    return $payload;
}

/**
 * Returns true if this JWT was issued before the user's last password change.
 * Reads from admin_password_log. If no row exists, token is considered fresh.
 */
function is_token_password_stale($jwt_payload) {
    global $conn;
    if (!$conn) return false;

    $uid = (int)($jwt_payload['user_id'] ?? 0);
    $iat = (int)($jwt_payload['iat'] ?? 0);
    if ($uid <= 0 || $iat <= 0) return false;

    $stmt = $conn->prepare("SELECT password_changed_at FROM admin_password_log WHERE user_id = ? LIMIT 1");
    if (!$stmt) return false;
    $stmt->bind_param("i", $uid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) return false;
    $pwd_at = (int)$row['password_changed_at'];
    if ($pwd_at <= 0) return false;

    // Strict less-than so a token issued in the same second as the password change still works.
    return $iat < $pwd_at;
}

/**
 * Helper used by password-change endpoints to record the change time.
 * Upserts the row in admin_password_log.
 */
function bump_password_changed_at($user_id) {
    global $conn;
    if (!$conn) return false;
    $user_id = (int)$user_id;
    if ($user_id <= 0) return false;

    $now = time();
    $stmt = $conn->prepare("
        INSERT INTO admin_password_log (user_id, password_changed_at)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE password_changed_at = VALUES(password_changed_at)
    ");
    if (!$stmt) return false;
    $stmt->bind_param("ii", $user_id, $now);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}

function get_bearer_token() {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)$/i', $auth, $m)) {
        return $m[1];
    }
    return $_GET['token'] ?? null;
}

/**
 * Returns true if the user is deactivated (admin_users row exists with is_active = 0).
 * If no admin_users row exists at all, returns false (user is not marked deactivated,
 * though they may still have no admin permissions — that's handled elsewhere).
 */
function is_user_deactivated($user_id) {
    global $conn;
    if (!$conn) return false;

    $stmt = $conn->prepare("SELECT is_active FROM admin_users WHERE user_id = ? LIMIT 1");
    if (!$stmt) return false;
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$res) return false;            // no row → not deactivated (no admin record at all)
    return (int)$res['is_active'] === 0; // row exists and is_active = 0 → deactivated
}

function require_jwt() {
    $token = get_bearer_token();
    if (!$token) {
        api_error('No authentication token provided', 401);
    }

    $payload = jwt_decode($token);
    if (!$payload) {
        api_error('Invalid or expired token', 401);
    }

    // Enforce is_active = 0 → logout (even if JWT is still valid)
    $uid = (int)($payload['user_id'] ?? 0);
    if ($uid > 0 && is_user_deactivated($uid)) {
        api_error('Your account has been deactivated. Please contact a Super Admin.', 401);
    }

// Enforce password rotation: token issued before last password change is dead.
    if (is_token_password_stale($payload)) {
        api_error('Your password was changed. Please log in again.', 401);
    }
    return $payload;
}

function get_admin_permissions($user_id, $conn) {
    // If deactivated, no permissions at all
    if (is_user_deactivated($user_id)) {
        return [];
    }

    // Check if superadmin (and active)
    $stmt = $conn->prepare("SELECT is_superadmin FROM admin_users WHERE user_id = ? AND is_active = 1 LIMIT 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($result && (int)$result['is_superadmin'] === 1) {
        return ['__superadmin__'];
    }

    // Get individual permissions
    $stmt = $conn->prepare("SELECT permission_key FROM admin_permissions WHERE user_id = ? AND granted = 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $res = $stmt->get_result();

    $perms = ['dashboard'];
    while ($row = $res->fetch_assoc()) {
        $perms[] = $row['permission_key'];
    }
    $stmt->close();

    return array_values(array_unique($perms));
}

function has_permission($key, $jwt_data) {
    $perms = $jwt_data['permissions'] ?? [];
    if (in_array('__superadmin__', $perms, true)) return true;
    if ($key === 'dashboard') return true;
    return in_array($key, $perms, true);
}

function require_permission($key, $jwt_data) {
    if (!has_permission($key, $jwt_data)) {
        api_error('You do not have permission for this action', 403);
    }
}

function is_superadmin($jwt_data) {
    return in_array('__superadmin__', $jwt_data['permissions'] ?? [], true);
}

// Response helpers
function api_success($data = [], $message = 'Success', $code = 200) {
    http_response_code($code);
    echo json_encode(['success' => true, 'message' => $message, 'data' => $data]);
    exit();
}

function api_error($message = 'Error', $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message, 'data' => []]);
    exit();
}

function get_json_input() {
    $input = json_decode(file_get_contents('php://input'), true);
    return $input ?: [];
}

function get_client_ip() {
    return $_SERVER['HTTP_CF_CONNECTING_IP']
        ?? $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['HTTP_CLIENT_IP']
        ?? $_SERVER['REMOTE_ADDR']
        ?? '0.0.0.0';
}

function require_method($method) {
    if ($_SERVER['REQUEST_METHOD'] !== strtoupper($method)) {
        api_error('Method not allowed', 405);
    }
}

// Pagination helper
function get_pagination() {
    $page     = max(1, intval($_GET['page'] ?? 1));
    $per_page = max(1, min(100, intval($_GET['per_page'] ?? $_GET['limit'] ?? 20)));
    $offset   = ($page - 1) * $per_page;
    return [$page, $per_page, $offset];
}

function get_search() {
    return trim($_GET['search'] ?? $_GET['keyword'] ?? '');
}