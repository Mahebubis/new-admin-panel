<?php
/*
 * /api/college-details.php
 *
 * POST action=get_stats            → total, in_college, with_college_name, with_tpo
 * POST action=fetch_data           → paginated list with filters
 *      params: page, limit, search, is_in_college, current_year
 *
 * Table: user_college_details (ucd)  JOIN  users (u)
 *   ucd: id, user_id, is_in_college, college_name, current_year,
 *        tpo_name, tpo_email, tpo_phone,
 *        hod_name, hod_email, hod_phone,
 *        created_at, updated_at
 *   u:   username, email, name, phone
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ══════════════════════════════════════
   GET STATS
══════════════════════════════════════ */
if ($action === 'get_stats') {
    $sql = "
        SELECT
            COUNT(*)                                         AS total,
            SUM(ucd.is_in_college = 1)                      AS in_college,
            SUM(ucd.college_name IS NOT NULL
                AND ucd.college_name != '')                  AS with_college_name,
            SUM(ucd.tpo_name IS NOT NULL
                AND ucd.tpo_name != '')                      AS with_tpo
        FROM user_college_details ucd
        LEFT JOIN users u ON u.user_id = ucd.user_id
    ";
    $res = $conn->query($sql);
    if (!$res) { echo json_encode(['success'=>false,'message'=>$conn->error]); exit; }
    $row = $res->fetch_assoc();
    echo json_encode([
        'success'           => true,
        'total'             => (int)$row['total'],
        'in_college'        => (int)$row['in_college'],
        'with_college_name' => (int)$row['with_college_name'],
        'with_tpo'          => (int)$row['with_tpo'],
    ]);
    exit;
}

/* ══════════════════════════════════════
   FETCH DATA (paginated + filtered)
   Mirrors helper.php fetch_user_college_details exactly.
══════════════════════════════════════ */
if ($action === 'fetch_data') {
    $page   = max(1, (int)($_POST['page']  ?? 1));
    $limit  = min(200, max(1, (int)($_POST['limit'] ?? 25)));
    $offset = ($page - 1) * $limit;

    $search     = $conn->real_escape_string(trim($_POST['search']       ?? ''));
    $is_in_coll = ($_POST['is_in_college'] ?? '') !== '' ? (int)$_POST['is_in_college'] : null;
    $curr_year  = $conn->real_escape_string(trim($_POST['current_year'] ?? ''));

    /* ── WHERE builder ── */
    $where = "WHERE 1=1";
    if ($search !== '') {
        $where .= "
            AND (
                u.username       LIKE '%{$search}%' OR
                u.email          LIKE '%{$search}%' OR
                u.name           LIKE '%{$search}%' OR
                ucd.college_name LIKE '%{$search}%' OR
                ucd.tpo_name     LIKE '%{$search}%' OR
                ucd.hod_name     LIKE '%{$search}%'
            )";
    }
    if ($is_in_coll !== null) $where .= " AND ucd.is_in_college = {$is_in_coll}";
    if ($curr_year  !== '')   $where .= " AND ucd.current_year = '{$curr_year}'";

    /* ── Total count ── */
    $cnt = $conn->query("
        SELECT COUNT(*) AS total
        FROM user_college_details ucd
        LEFT JOIN users u ON u.user_id = ucd.user_id
        {$where}
    ");
    if (!$cnt) { echo json_encode(['success'=>false,'message'=>$conn->error]); exit; }
    $total = (int)$cnt->fetch_assoc()['total'];

    /* ── Data ── */
    $data_res = $conn->query("
        SELECT
            ucd.id, ucd.user_id, ucd.is_in_college,
            ucd.college_name, ucd.current_year,
            ucd.tpo_name, ucd.tpo_email, ucd.tpo_phone,
            ucd.hod_name, ucd.hod_email, ucd.hod_phone,
            ucd.created_at, ucd.updated_at,
            u.username, u.email, u.name, u.phone
        FROM user_college_details ucd
        LEFT JOIN users u ON u.user_id = ucd.user_id
        {$where}
        ORDER BY ucd.id DESC
        LIMIT {$limit} OFFSET {$offset}
    ");

    $rows = [];
    if ($data_res) while ($row = $data_res->fetch_assoc()) $rows[] = $row;

    echo json_encode([
        'success'     => true,
        'data'        => $rows,
        'total'       => $total,
        'page'        => $page,
        'limit'       => $limit,
        'total_pages' => (int)ceil($total / $limit),
    ]);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>