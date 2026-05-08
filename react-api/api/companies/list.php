<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('all_companies', $jwt);

[$page, $per_page, $offset] = get_pagination();
$search = get_search();

$where = "WHERE 1=1";
$params = []; $types = '';
if ($search) { $like = "%$search%"; $where .= " AND (e.employer_name LIKE ? OR e.employer_location LIKE ?)"; $params = [$like,$like]; $types = 'ss'; }

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM hiring_employer e $where");
if ($params) $stmt->bind_param($types, ...$params);
$stmt->execute();
$total = $stmt->get_result()->fetch_assoc()['c'];

$sql = "
    SELECT e.employer_id AS company_id, e.employer_name AS name,
           COALESCE(e.industry,'') AS sector, COALESCE(e.employer_location,'') AS city,
           COALESCE(e.employer_website,'') AS website, COALESCE(e.status,'active') AS status,
           DATE(e.registered_at) AS joined_at,
           COALESCE(e.current_openings,0) AS openings, COALESCE(e.candidates_hired,0) AS total_hired
    FROM hiring_employer e $where ORDER BY e.registered_at DESC LIMIT ? OFFSET ?
";
$stmt = $conn->prepare($sql);
$allParams = array_merge($params, [$per_page, $offset]);
$stmt->bind_param($types . 'ii', ...$allParams);
$stmt->execute();
$companies = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

api_success(['companies' => $companies, 'total' => (int)$total, 'page' => $page]);
