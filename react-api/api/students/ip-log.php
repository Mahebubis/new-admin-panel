<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cache.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('GET');
$jwt = require_jwt();
require_permission('students_with_ip', $jwt);

[$page, $per_page, $offset] = get_pagination();
$type = $_GET['type'] ?? '';
$ip = trim($_GET['ip'] ?? '');
$uid = trim($_GET['uid'] ?? '');

$where = "WHERE 1=1";
$params = [];
$bind_types = '';

if ($ip) {
    // Full IP (x.x.x.x) → exact match; partial → prefix match (uses index)
    $dot_count = substr_count($ip, '.');
    if ($dot_count >= 3) {
        $where .= " AND ip.ip_address = ?";
        $params[] = $ip;
    } else {
        $where .= " AND ip.ip_address LIKE ?";
        $params[] = "$ip%";
    }
    $bind_types .= 's';
} elseif ($uid) {
    $where .= " AND ip.user_id = ?";
    $params[] = (int)$uid;
    $bind_types .= 'i';
}

if ($type) {
    $where .= " AND ip.type = ?";
    $params[] = $type;
    $bind_types .= 's';
}

$has_filter = $ip || $uid;

// Get total count — optimized per filter type to avoid unnecessary JOINs
$total = 0;

if (!$has_filter && !$type) {
    // Default: use information_schema for instant count (cached 5 min)
    $cached = cache_get('ip_log_total_count');
    if ($cached !== null) {
        $total = $cached;
    } else {
        $r = $conn->query("SELECT TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'istudio_cit' AND TABLE_NAME = 'user_ip'");
        if ($r) $total = (int)$r->fetch_assoc()['TABLE_ROWS'];
        cache_set('ip_log_total_count', $total, 300);
    }
} elseif (!$has_filter && $type) {
    // Type-only: no JOIN needed
    $cached = cache_get('ip_log_type_count_' . $type);
    if ($cached !== null) {
        $total = $cached;
    } else {
        $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM user_ip WHERE type = ?");
        $stmt->bind_param('s', $type);
        $stmt->execute();
        $total = (int)$stmt->get_result()->fetch_assoc()['c'];
        $stmt->close();
        cache_set('ip_log_type_count_' . $type, $total, 120);
    }
} elseif ($uid) {
    // User ID: fast indexed count
    if ($type) {
        $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM user_ip WHERE user_id = ? AND type = ?");
        $target = (int)$uid;
        $stmt->bind_param('is', $target, $type);
    } else {
        $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM user_ip WHERE user_id = ?");
        $target = (int)$uid;
        $stmt->bind_param('i', $target);
    }
    $stmt->execute();
    $total = (int)$stmt->get_result()->fetch_assoc()['c'];
    $stmt->close();
} elseif ($ip) {
    // IP filter count — no JOIN, uses ip_address index for prefix match
    $dot_count = substr_count($ip, '.');
    if ($dot_count >= 3) {
        if ($type) {
            $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM user_ip WHERE ip_address = ? AND type = ?");
            $stmt->bind_param('ss', $ip, $type);
        } else {
            $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM user_ip WHERE ip_address = ?");
            $stmt->bind_param('s', $ip);
        }
    } else {
        $ip_prefix = "$ip%";
        if ($type) {
            $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM user_ip WHERE ip_address LIKE ? AND type = ?");
            $stmt->bind_param('ss', $ip_prefix, $type);
        } else {
            $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM user_ip WHERE ip_address LIKE ?");
            $stmt->bind_param('s', $ip_prefix);
        }
    }
    $stmt->execute();
    $total = (int)$stmt->get_result()->fetch_assoc()['c'];
    $stmt->close();
}

// Data query
$sql = "SELECT ip.user_id, u.name, u.email, ip.ip_address,
               COALESCE(ip.type,'') AS type, COALESCE(ip.domain,'') AS domain,
               ip.accessed_at
        FROM user_ip ip
        JOIN users u ON u.user_id = ip.user_id
        $where ORDER BY ip.accessed_at DESC LIMIT ? OFFSET ?";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($bind_types . 'ii', ...$allParams);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

api_success(['rows' => $rows, 'total' => $total, 'page' => $page]);
