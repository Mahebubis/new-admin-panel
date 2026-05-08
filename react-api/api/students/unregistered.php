<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

require_method('GET');
$jwt = require_jwt();
require_permission('unregistered_students', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();

$where = "WHERE u.role = 4 AND (u.applyforexam = 0 OR u.applyforexam IS NULL)";
$params = [];
$types = '';

if ($search) {
    $like = "%$search%";
    $where .= " AND (u.name LIKE ? OR u.email LIKE ?)";
    $params = [$like, $like];
    $types = 'ss';
}

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM users u $where");
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$total = $stmt->get_result()->fetch_assoc()['c'];

$sql = "SELECT u.user_id, u.name, u.email, COALESCE(u.phone,'') AS phone, DATE(u.registered_at) AS registered_at FROM users u $where ORDER BY u.user_id DESC LIMIT ? OFFSET ?";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($types . 'ii', ...$allParams);
$stmt->execute();
$students = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

api_success(['students' => $students, 'total' => (int)$total, 'page' => $page]);
