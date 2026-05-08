<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('exam_result', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();
$batch = $_GET['batch'] ?? '';
$passed = $_GET['passed'] ?? '';

$where = "WHERE 1=1";
$params = []; $types = '';
if ($search) { $like = "%$search%"; $where .= " AND (u.name LIKE ? OR u.email LIKE ?)"; $params = [$like,$like]; $types = 'ss'; }
if ($batch) { $where .= " AND cr.cit_version LIKE ?"; $params[] = "%$batch%"; $types .= 's'; }
if ($passed === '1') $where .= " AND COALESCE(cr.score,0) >= 60";
elseif ($passed === '0') $where .= " AND COALESCE(cr.score,0) < 60";

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM cit_results cr JOIN users u ON u.user_id = cr.user_id $where");
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$total = $stmt->get_result()->fetch_assoc()['c'];

$stats = $conn->query("SELECT AVG(score) AS avg_score, COUNT(*) AS total, SUM(CASE WHEN score>=60 THEN 1 ELSE 0 END) AS passed_count FROM cit_results")->fetch_assoc();

$sql = "
    SELECT cr.result_id, cr.user_id, u.name, u.email,
           COALESCE(cr.cit_version,'') AS batch, COALESCE(cr.score,0) AS score,
           COALESCE(cr.time_taken,0) AS time_taken,
           CASE WHEN COALESCE(cr.score,0) >= 60 THEN 1 ELSE 0 END AS passed,
           DATE(cr.timestamp) AS exam_date,
           RANK() OVER (PARTITION BY cr.cit_version ORDER BY cr.score DESC) AS `rank`
    FROM cit_results cr JOIN users u ON u.user_id = cr.user_id
    $where ORDER BY cr.score DESC LIMIT ? OFFSET ?
";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($types . 'ii', ...$allParams);
$stmt->execute();
$results = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

api_success(['results' => $results, 'total' => (int)$total, 'stats' => $stats, 'page' => $page]);
