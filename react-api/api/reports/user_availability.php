<?php
/*
 * /api/user-availability.php
 *
 * GET ?action=get_data
 *     &page=1 &per_page=60
 *     &job_type=internship|job
 *     &available_from=now|15days|1month|specific
 *     &location_type=remote|onsite
 *     &city=X
 *     &search=name|email|phone
 *
 * Tables:
 *   user_availability           (ua)
 *   users                       (u)
 *   user_availability_locations (ual)  → cities
 *   user_availability_location_types (ualt) → remote/onsite
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action = $_GET['action'] ?? $_POST['action'] ?? '';

if ($action !== 'get_data') {
    echo json_encode(['success'=>false,'message'=>'Invalid action']); exit;
}

/* ─── Sanitise filters ─── */
$job_type       = $conn->real_escape_string(trim($_GET['job_type']       ?? ''));
$available_from = $conn->real_escape_string(trim($_GET['available_from'] ?? ''));
$location_type  = $conn->real_escape_string(trim($_GET['location_type']  ?? ''));
$city           = $conn->real_escape_string(trim($_GET['city']           ?? ''));
$search         = $conn->real_escape_string(trim($_GET['search']         ?? ''));
$page           = max(1, (int)($_GET['page']     ?? 1));
$perPage        = max(1, min(120, (int)($_GET['per_page'] ?? 60)));
$offset         = ($page - 1) * $perPage;

/* ─── WHERE builder ─── */
$where = [];
if ($job_type)       $where[] = "ua.job_type = '$job_type'";
if ($available_from) $where[] = "ua.available_from = '$available_from'";
if ($city)           $where[] = "ual.city LIKE '%$city%'";
if ($location_type)  $where[] = "ualt.location_type = '$location_type'";
if ($search)         $where[] = "(u.name LIKE '%$search%' OR u.email LIKE '%$search%' OR u.phone LIKE '%$search%')";

$joinClause = "
    FROM user_availability ua
    LEFT JOIN users u ON u.user_id = ua.user_id
    LEFT JOIN user_availability_locations ual ON ual.availability_id = ua.id
    LEFT JOIN user_availability_location_types ualt ON ualt.availability_id = ua.id
";
$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

/* ─── Total count ─── */
$countSql = "SELECT COUNT(DISTINCT ua.id) AS total $joinClause $whereClause";
$countRes = $conn->query($countSql);
if (!$countRes) { echo json_encode(['success'=>false,'message'=>'Count error: '.$conn->error]); exit; }
$total = (int)$countRes->fetch_assoc()['total'];

/* ─── Paginated data ─── */
$dataSql = "
    SELECT
        ua.id,
        ua.user_id,
        ua.job_type,
        ua.available_from,
        ua.specific_date,
        ua.available_till,
        ua.willing_to_relocate,
        ua.stipend_amount,
        ua.expected_ctc,
        ua.created_at,
        u.name   AS user_name,
        u.email  AS user_email,
        u.phone  AS user_phone,
        u.username,
        GROUP_CONCAT(DISTINCT ual.city          ORDER BY ual.city ASC SEPARATOR ',') AS cities,
        GROUP_CONCAT(DISTINCT ualt.location_type                   SEPARATOR ',') AS location_types
    $joinClause
    $whereClause
    GROUP BY ua.id
    ORDER BY ua.created_at DESC
    LIMIT $perPage OFFSET $offset
";
$dataRes = $conn->query($dataSql);
if (!$dataRes) { echo json_encode(['success'=>false,'message'=>'Query error: '.$conn->error]); exit; }

$data = [];
while ($row = $dataRes->fetch_assoc()) {
    $row['cities_array']         = $row['cities']         ? array_filter(array_map('trim', explode(',', $row['cities'])))         : [];
    $row['location_types_array'] = $row['location_types'] ? array_filter(array_map('trim', explode(',', $row['location_types']))) : [];
    $row['willing_to_relocate']  = (bool)$row['willing_to_relocate'];
    $row['stipend_amount']       = $row['stipend_amount']  ? (float)$row['stipend_amount']  : null;
    $row['expected_ctc']         = $row['expected_ctc']    ? (float)$row['expected_ctc']    : null;
    $data[] = $row;
}

echo json_encode([
    'success'     => true,
    'data'        => $data,
    'total'       => $total,
    'page'        => $page,
    'per_page'    => $perPage,
    'total_pages' => (int)ceil($total / $perPage),
]);
exit;
?>