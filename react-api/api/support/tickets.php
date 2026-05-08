<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('support_tickets', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();
$status = $_GET['status'] ?? '';

$where = "WHERE 1=1";
$params = []; $types = '';
if ($search) { $like = "%$search%"; $where .= " AND (t.subject LIKE ? OR u.name LIKE ? OR u.email LIKE ?)"; $params = [$like,$like,$like]; $types = 'sss'; }
if ($status) { $where .= " AND t.status = ?"; $params[] = $status; $types .= 's'; }

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM support_tickets t JOIN users u ON u.user_id = t.user_id $where");
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$total = $stmt->get_result()->fetch_assoc()['c'];

$sql = "
    SELECT t.ticket_id, t.subject, t.status, 'medium' AS priority,
           u.name AS student_name, u.email,
           COALESCE(sa.agent_name,'Unassigned') AS agent,
           DATE(t.created_at) AS created_at
    FROM support_tickets t
    JOIN users u ON u.user_id = t.user_id
    LEFT JOIN support_agent sa ON sa.agent_id = t.agent_id
    $where ORDER BY t.created_at DESC LIMIT ? OFFSET ?
";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($types . 'ii', ...$allParams);
$stmt->execute();
$tickets = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// Get messages for each ticket
foreach ($tickets as &$ticket) {
    $tid = $ticket['ticket_id'];
    $msgRes = $conn->query("SELECT 'student' AS `from`, message AS text, TIME_FORMAT(created_at,'%H:%i') AS time FROM support_messages WHERE ticket_id = $tid ORDER BY created_at ASC LIMIT 20");
    $ticket['messages'] = $msgRes ? $msgRes->fetch_all(MYSQLI_ASSOC) : [];
}

api_success(['tickets' => $tickets, 'total' => (int)$total, 'page' => $page]);
