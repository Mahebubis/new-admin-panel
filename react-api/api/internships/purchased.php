<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('purchased_internships', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();

$where = "WHERE 1=1";
$params = []; $types = '';
if ($search) { $like = "%$search%"; $where .= " AND (u.name LIKE ? OR u.email LIKE ? OR ip.internship LIKE ?)"; $params = [$like,$like,$like]; $types = 'sss'; }

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM internship_payment ip JOIN users u ON u.user_id = ip.user_id $where");
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$total = $stmt->get_result()->fetch_assoc()['c'];

$sql = "
    SELECT ip.id AS purchase_id, u.user_id, u.name AS student, u.email,
           ip.internship, COALESCE(ps.amount,'0') AS amount, 'active' AS status,
           DATE(ip.paid_at) AS enrolled_at
    FROM internship_payment ip
    JOIN users u ON u.user_id = ip.user_id
    LEFT JOIN payment_status ps ON ps.user_id=ip.user_id AND ps.internship_name=ip.internship AND ps.status='captured'
    $where ORDER BY ip.paid_at DESC LIMIT ? OFFSET ?
";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($types . 'ii', ...$allParams);
$stmt->execute();
$purchases = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

api_success(['purchases' => $purchases, 'total' => (int)$total, 'page' => $page]);
