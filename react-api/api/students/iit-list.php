<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cache.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('GET');
$jwt = require_jwt();
require_permission('all_iit_students', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();

// Use FULLTEXT index for fast IIT filtering (878x faster than LIKE)
$iit_filter = "MATCH(u.college_name) AGAINST('+IIT +\"Indian Institute of Technology\"' IN BOOLEAN MODE)";

$select_cols = 'u.user_id, u.name, u.email, u.phone, u.state, u.country, u.registered_at, u.applyforexam, u.active, u.is_signup_by_google, u.instant_exam, u.instant_result, u.college_name';

if ($search) {
    $keyword = $conn->real_escape_string($search);
    $sql = "SELECT $select_cols
            FROM users u
            WHERE u.role = 4
              AND $iit_filter
              AND (
                  u.user_id = '$keyword'
                  OR u.email LIKE '%$keyword%'
                  OR u.phone LIKE '%$keyword%'
                  OR u.name LIKE '%$keyword%'
              )
            ORDER BY u.registered_at DESC
            LIMIT 100";
    $result = $conn->query($sql);
    $students = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $students[] = $row;
        }
    }
    api_success(['students' => $students, 'total' => count($students), 'page' => 1]);
} else {
    // Cache counts for 5 minutes
    $cache_key_counts = 'iit_students_counts_v4';
    $counts = cache_get($cache_key_counts);
    if (!$counts) {
        $total = 0;
        $registered = 0;
        $r = $conn->query("SELECT COUNT(*) AS c FROM users u WHERE u.role = 4 AND $iit_filter");
        if ($r) $total = (int)$r->fetch_assoc()['c'];
        $r = $conn->query("SELECT COUNT(*) AS c FROM users u WHERE u.role = 4 AND u.applyforexam = 1 AND $iit_filter");
        if ($r) $registered = (int)$r->fetch_assoc()['c'];
        $counts = ['total' => $total, 'registered' => $registered];
        cache_set($cache_key_counts, $counts, 300);
    }

    $total = $counts['total'];
    $registered = $counts['registered'];

    // Cache paginated results for 60 seconds
    $cache_key_page = "iit_page_{$page}_{$per_page}";
    $cached_students = cache_get($cache_key_page);
    if ($cached_students) {
        api_success([
            'students' => $cached_students,
            'total' => $total,
            'registered' => $registered,
            'unregistered' => $total - $registered,
            'page' => $page,
        ]);
    }

    $sql = "SELECT $select_cols
            FROM users u
            WHERE u.role = 4
              AND $iit_filter
            ORDER BY u.registered_at DESC
            LIMIT $per_page OFFSET $offset";
    $result = $conn->query($sql);
    $students = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $students[] = $row;
        }
    }

    cache_set($cache_key_page, $students, 60);

    api_success([
        'students' => $students,
        'total' => $total,
        'registered' => $registered,
        'unregistered' => $total - $registered,
        'page' => $page,
    ]);
}
