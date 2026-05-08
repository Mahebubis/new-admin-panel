<?php
/*
 * /api/delete-incomplete-exam.php
 *
 * POST action=get_users    → list incomplete exam users + count
 * POST action=delete_users → execute DELETE and return affected rows
 *
 * Logic: cit_exam_login rows where end_exam IS NOT NULL
 *        but NO matching row in cit_exam_data AND cit_results
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

$WHERE = "WHERE cl.end_exam IS NOT NULL
            AND ced.id IS NULL
            AND cr.result_id IS NULL";
$JOINS = "FROM cit_exam_login cl
          JOIN  users u         ON cl.user_id = u.user_id
          LEFT JOIN cit_exam_data ced ON cl.user_id = ced.user_id AND cl.exam_id = ced.exam_id
          LEFT JOIN cit_results  cr  ON cl.user_id = cr.user_id  AND cl.exam_id = cr.exam_id";

/* ══════════════════════════════════════
   GET USERS  — fetch list + count
══════════════════════════════════════ */
if ($action === 'get_users') {
    // list
    $listRes = $conn->query("SELECT u.name, u.email $JOINS $WHERE");
    $users   = [];
    if ($listRes) while ($r = $listRes->fetch_assoc()) $users[] = $r;

    // count (separate query for clarity, same as PHP page)
    $cntSql = "SELECT COUNT(*) AS count
               FROM cit_exam_login cl
               LEFT JOIN cit_exam_data ced ON cl.user_id = ced.user_id AND cl.exam_id = ced.exam_id
               LEFT JOIN cit_results  cr  ON cl.user_id = cr.user_id  AND cl.exam_id = cr.exam_id
               $WHERE";
    $cntRes = $conn->query($cntSql);
    $count  = $cntRes ? (int)$cntRes->fetch_assoc()['count'] : count($users);

    echo json_encode(['success'=>true,'users'=>$users,'count'=>$count]);
    exit;
}

/* ══════════════════════════════════════
   DELETE USERS  — mirrors PHP $delete_sql
══════════════════════════════════════ */
if ($action === 'delete_users') {
    $deleteSql = "DELETE cl
                  FROM cit_exam_login cl
                  LEFT JOIN cit_exam_data ced ON cl.user_id = ced.user_id AND cl.exam_id = ced.exam_id
                  LEFT JOIN cit_results  cr  ON cl.user_id = cr.user_id  AND cl.exam_id = cr.exam_id
                  WHERE cl.end_exam IS NOT NULL
                    AND ced.id IS NULL
                    AND cr.result_id IS NULL";
    $ok = $conn->query($deleteSql);
    if ($ok) {
        $rows = $conn->affected_rows;
        echo json_encode(['success'=>true,'affected_rows'=>$rows,
            'message'=>"Successfully deleted $rows record(s) from cit_exam_login table."]);
    } else {
        echo json_encode(['success'=>false,'message'=>'Error: '.$conn->error]);
    }
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>