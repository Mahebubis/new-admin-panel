<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cache.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('GET');
$jwt = require_jwt();
require_permission('all_students', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();

// Only select columns that the frontend actually uses (all from users table)
$select_cols = 'u.user_id, u.name, u.email, u.phone, u.state, u.country, u.registered_at, u.applyforexam, u.active, u.is_signup_by_google, u.instant_exam, u.instant_result';

// if ($search) {
//     $keyword = $conn->real_escape_string($search);
//     $sql = "SELECT $select_cols
//             FROM users u
//             WHERE u.role = 4
//             AND (
//                 u.user_id = '$keyword'
//                 OR u.email LIKE '%$keyword%'
//                 OR u.phone LIKE '%$keyword%'
//                 OR u.name LIKE '%$keyword%'
//             )
//             ORDER BY u.registered_at DESC
//             LIMIT 100";
//     $result = $conn->query($sql);
//     $students = [];
//     if ($result) {
//         while ($row = $result->fetch_assoc()) {
//             $students[] = $row;
//         }
//     }
//     api_success(['students' => $students, 'total' => count($students), 'page' => 1]);
// }
if ($search) {
    $keyword = $conn->real_escape_string(trim($search));
    $students = [];

    // --- Exact user_id match (PK, instant) ---
    if (is_numeric($keyword)) {
        $sql = "SELECT $select_cols FROM users u
                WHERE u.user_id = '$keyword' LIMIT 1";
        $result = $conn->query($sql);
        if ($result) while ($row = $result->fetch_assoc()) $students[] = $row;
    }

    // --- Exact phone match ---
    if (empty($students)) {
        $sql = "SELECT $select_cols FROM users u
                WHERE u.phone = '$keyword'
                ORDER BY u.registered_at DESC LIMIT 50";
        $result = $conn->query($sql);
        if ($result) while ($row = $result->fetch_assoc()) $students[] = $row;
    }

    // --- Exact email match ---
    if (empty($students)) {
        $sql = "SELECT $select_cols FROM users u
                WHERE u.email = '$keyword'
                ORDER BY u.registered_at DESC LIMIT 50";
        $result = $conn->query($sql);
        if ($result) while ($row = $result->fetch_assoc()) $students[] = $row;
    }

    // --- Name LIKE search (only fallback) ---
    if (empty($students)) {
        $sql = "SELECT $select_cols FROM users u
                WHERE u.name LIKE '$keyword%'
                ORDER BY u.registered_at DESC LIMIT 100";
        $result = $conn->query($sql);
        if ($result) while ($row = $result->fetch_assoc()) $students[] = $row;
    }

    api_success(['students' => $students, 'total' => count($students), 'page' => 1]);
}
else {
    // Use cached counts (refresh every 2 minutes)
    $cache_key_counts = 'students_counts_v2';
    $counts = cache_get($cache_key_counts);
    if (!$counts) {
        $total = 0;
        $registered = 0;
        $r = $conn->query("SELECT COUNT(*) AS c FROM users WHERE role = 4");
        if ($r) $total = (int)$r->fetch_assoc()['c'];
        $r = $conn->query("SELECT COUNT(*) AS c FROM users WHERE role = 4 AND applyforexam = 1");
        if ($r) $registered = (int)$r->fetch_assoc()['c'];
        $counts = ['total' => $total, 'registered' => $registered];
        cache_set($cache_key_counts, $counts, 120);
    }

    $total = $counts['total'];
    $registered = $counts['registered'];

    // Paginated data query - only needed columns, no JOIN needed
    // $sql = "SELECT $select_cols
    //         FROM users u
    //         WHERE u.role = 4
    //         ORDER BY u.registered_at DESC
    //         LIMIT $per_page OFFSET $offset";
    // $result = $conn->query($sql);
    // $students = [];
    // if ($result) {
    //     while ($row = $result->fetch_assoc()) {
    //         $students[] = $row;
    //     }
    // }

    // api_success([
    //     'students' => $students,
    //     'total' => $total,
    //     'registered' => $registered,
    //     'unregistered' => $total - $registered,
    //     'page' => $page
    // ]);
    // Cache per page, 60 second TTL
$cache_key_data = "students_page_{$page}_limit_{$per_page}";
$students = cache_get($cache_key_data);

if (!$students) {
    $sql = "SELECT $select_cols
            FROM users u
            WHERE u.role = 4
            ORDER BY u.registered_at DESC
            LIMIT $per_page OFFSET $offset";
    $result = $conn->query($sql);
    $students = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $students[] = $row;
        }
    }
    cache_set($cache_key_data, $students, 60);
}

api_success([
    'students'    => $students,
    'total'       => $total,
    'registered'  => $registered,
    'unregistered'=> $total - $registered,
    'page'        => $page
]);
}
