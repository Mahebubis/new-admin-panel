<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('internship_list', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();

$where = "WHERE 1=1";
$params = []; $types = '';
if ($search) { $like = "%$search%"; $where .= " AND il.internship_name LIKE ?"; $params = [$like]; $types = 's'; }

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM internship_list il $where");
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$total = $stmt->get_result()->fetch_assoc()['c'];

$sql = "
    SELECT il.id AS internship_id, il.internship_name AS title, '' AS domain, '' AS duration,
           COALESCE(il.price,0) AS price, COALESCE(il.has_gold,0) AS is_iit,
           CASE WHEN il.show_internship=1 THEN 'active' ELSE 'inactive' END AS status,
           COALESCE(il.priority,0) AS priority,
           (SELECT COUNT(*) FROM internship_payment ip WHERE ip.internship = il.internship_name) AS enrolled
    FROM internship_list il $where ORDER BY il.priority ASC LIMIT ? OFFSET ?
";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($types . 'ii', ...$allParams);
$stmt->execute();
$internships = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

api_success(['internships' => $internships, 'total' => (int)$total, 'page' => $page]);
