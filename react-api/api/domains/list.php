<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('manage_domains', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();

$where = "WHERE 1=1";
$params = []; $types = '';

if ($search) { $like = "%$search%"; $where .= " AND (domain_name LIKE ? OR category LIKE ?)"; $params = [$like,$like]; $types = 'ss'; }

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM domains $where");
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$total = $stmt->get_result()->fetch_assoc()['c'];

$sql = "SELECT id, domain_name, COALESCE(category,'') AS category, COALESCE(status,'active') AS status, DATE(created_at) AS created_at FROM domains $where ORDER BY id DESC LIMIT ? OFFSET ?";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($types . 'ii', ...$allParams);
$stmt->execute();
$domains = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

api_success(['domains' => $domains, 'total' => (int)$total, 'page' => $page]);
