<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('check_payments', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();

$where = "WHERE 1=1";
$params = []; $types = '';
if ($search) { $like = "%$search%"; $where .= " AND (u.name LIKE ? OR u.email LIKE ? OR ps.payment_id LIKE ?)"; $params = [$like,$like,$like]; $types = 'sss'; }

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM payment_status ps JOIN users u ON u.user_id = ps.user_id $where");
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$total = $stmt->get_result()->fetch_assoc()['c'];

$sql = "
    SELECT ps.id AS payment_id, u.name AS student_name, u.email, u.user_id,
           COALESCE(ps.internship_name,'') AS internship,
           CAST(ps.amount AS DECIMAL(10,2)) AS amount, 'Payment Gateway' AS gateway,
           ps.status, COALESCE(ps.payment_id,'') AS gateway_txn, DATE(ps.timestamp) AS paid_at
    FROM payment_status ps JOIN users u ON u.user_id = ps.user_id
    $where ORDER BY ps.id DESC LIMIT ? OFFSET ?
";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($types . 'ii', ...$allParams);
$stmt->execute();
$payments = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

api_success(['payments' => $payments, 'total' => (int)$total, 'page' => $page]);
