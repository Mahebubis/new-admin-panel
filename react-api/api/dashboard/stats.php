<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cache.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('GET');
$jwt = require_jwt();
require_permission('dashboard', $jwt);

// Check cache first (5 minute TTL - dashboard stats don't need real-time precision)
$cache_key = 'dashboard_stats_v2';
$cached = cache_get($cache_key);
if ($cached) { api_success($cached); }

// Use separate optimized COUNT queries with index hints
// This is faster than a single query with multiple CASE statements on 3M+ rows
$total = 0;
$registered = 0;
$online = 0;
$today_signups = 0;
$week_signups = 0;

// Total students (uses idx_users_role_reg index)
$r = $conn->query("SELECT COUNT(*) AS c FROM users WHERE role = 4");
if ($r) $total = (int)$r->fetch_assoc()['c'];

// Registered students (uses idx_users_role_apply index)
$r = $conn->query("SELECT COUNT(*) AS c FROM users WHERE role = 4 AND applyforexam = 1");
if ($r) $registered = (int)$r->fetch_assoc()['c'];

// Online users (uses idx_users_online index)
$r = $conn->query("SELECT COUNT(*) AS c FROM users WHERE online_status = 'online'");
if ($r) $online = (int)$r->fetch_assoc()['c'];

// Today signups (uses idx_users_role_reg index with range scan)
$r = $conn->query("SELECT COUNT(*) AS c FROM users WHERE role = 4 AND registered_at >= CURDATE()");
if ($r) $today_signups = (int)$r->fetch_assoc()['c'];

// Week signups (uses idx_users_role_reg index with range scan)
$r = $conn->query("SELECT COUNT(*) AS c FROM users WHERE role = 4 AND registered_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
if ($r) $week_signups = (int)$r->fetch_assoc()['c'];

// Revenue
$revenue = 0;
$r = $conn->query("SELECT COALESCE(SUM(CAST(amount AS DECIMAL(10,2))),0) AS t FROM payment_status WHERE status='captured'");
if ($r) $revenue = $r->fetch_assoc()['t'];

// Small table counts - these are fast
$pending_refunds = 0;
$r = $conn->query("SELECT COUNT(*) AS c FROM refunds WHERE status='pending'");
if ($r) $pending_refunds = (int)($r->fetch_assoc()['c'] ?? 0);

$open_tickets = 0;
$r = $conn->query("SELECT COUNT(*) AS c FROM support_tickets WHERE status='open'");
if ($r) $open_tickets = (int)($r->fetch_assoc()['c'] ?? 0);

$active_internships = 0;
$r = $conn->query("SELECT COUNT(*) AS c FROM internship_list WHERE show_internship=1");
if ($r) $active_internships = (int)($r->fetch_assoc()['c'] ?? 0);

$pct = $total > 0 ? round(($registered / $total) * 100, 1) : 0;

$result = [
    'total_students' => $total,
    'registered_students' => $registered,
    'unregistered' => $total - $registered,
    'online_users' => $online,
    'today_signups' => $today_signups,
    'week_signups' => $week_signups,
    'registration_pct' => $pct,
    'total_revenue' => '₹' . number_format($revenue, 0),
    'pending_refunds' => $pending_refunds,
    'open_tickets' => $open_tickets,
    'active_internships' => $active_internships,
];

// Cache for 5 minutes (300 seconds)
cache_set($cache_key, $result, 300);
api_success($result);
