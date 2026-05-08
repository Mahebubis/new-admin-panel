<?php
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_GET['action'] ?? $_POST['action'] ?? '';

/* ═══════════════════════════════════════════
   GET ALL EXAM DATES + CIT versions (page load)
   Returns: exam_dates, cit_versions (old), cit_versions_new, pivot data
═══════════════════════════════════════════ */
if ($action === 'get_page_data' || $_SERVER['REQUEST_METHOD'] === 'GET') {
    // exam_dates
    $dates = [];
    $res = mysqli_query($conn, "SELECT * FROM exam_dates");
    if ($res) while ($r = mysqli_fetch_assoc($res)) $dates[] = $r;

    // cit_version (new table)
    $citNew = [];
    $res2 = mysqli_query($conn, "SELECT id, cit_name FROM cit_version ORDER BY id DESC");
    if ($res2) while ($r = mysqli_fetch_assoc($res2)) $citNew[] = $r;

    // exam_batch_for_reports (old table)
    $citOld = [];
    $res3 = mysqli_query($conn, "SELECT * FROM exam_batch_for_reports ORDER BY id DESC");
    if ($res3) while ($r = mysqli_fetch_assoc($res3)) $citOld[] = $r;

    // special exam dates
    $special = [];
    $res4 = mysqli_query($conn, "SELECT * FROM special_exam_dates");
    if ($res4) while ($r = mysqli_fetch_assoc($res4)) $special[] = $r;

    // refund program range
    $refundRes = mysqli_query($conn, "SELECT settings_value FROM settings WHERE settings_key='show_refund_program_batch' LIMIT 1");
    $refundRange = $refundRes ? (mysqli_fetch_assoc($refundRes)['settings_value'] ?? '') : '';

    echo json_encode([
        'status'       => 'success',
        'dates'        => $dates,
        'cit_new'      => $citNew,
        'cit_old'      => $citOld,
        'special'      => $special,
        'refund_range' => $refundRange,
    ]);
    exit;
}

/* ═══════════ EXAM DATES ═══════════ */

/* add_exam_date — same as functions.php + exam_dates.php */
if ($action === 'add_exam_date') {
    $is_special = (int)($_POST['is_special'] ?? 0);
    $date = date('jS F, Y');
    $stmt = $conn->prepare("INSERT INTO exam_dates (date, status, total_seats, remaining_seats, show_date, is_special) VALUES (?, 'empty', 10, 10, 1, ?)");
    $stmt->bind_param("si", $date, $is_special);
    if ($stmt->execute()) {
        $newId = $conn->insert_id;
        $row = [
            'id'               => $newId,
            'date'             => $date,
            'status'           => 'empty',
            'total_seats'      => 10,
            'remaining_seats'  => 10,
            'show_date'        => 1,
            'is_special'       => $is_special
        ];
        echo json_encode(['status'=>'success','message'=>'Exam date added successfully','row'=>$row]);
    } else {
        echo json_encode(['status'=>'failed','message'=>'Failed to add exam date']);
    }
    exit;
}

/* fetch_exam_date_by_id */
if ($action === 'fetch_exam_date_by_id') {
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $conn->prepare("SELECT * FROM exam_dates WHERE id = ?");
    $stmt->bind_param("i", $id); $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_assoc());
    exit;
}

/* update_exam_date — same as functions.php (with is_special) */
if ($action === 'update_exam_date') {
    $id              = (int)$_POST['id'];
    $date            = $_POST['date'];
    $status          = $_POST['status'];
    $total_seats     = (int)$_POST['total_seats'];
    $remaining_seats = (int)$_POST['remaining_seats'];
    $is_special      = (int)($_POST['is_special'] ?? 0);
    $stmt = $conn->prepare("UPDATE exam_dates SET date=?, status=?, total_seats=?, remaining_seats=?, is_special=? WHERE id=?");
    $stmt->bind_param("ssiiii", $date, $status, $total_seats, $remaining_seats, $is_special, $id);
    echo json_encode($stmt->execute()
        ? ['status'=>'success','message'=>'Exam date updated successfully']
        : ['status'=>'failed','message'=>'Failed to update exam date']);
    exit;
}

/* disable_exam_date */
if ($action === 'disable_exam_date') {
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $conn->prepare("UPDATE exam_dates SET show_date=0 WHERE id=?");
    $stmt->bind_param("i", $id);
    echo json_encode($stmt->execute()
        ? ['status'=>'success','message'=>'Exam date disabled successfully']
        : ['status'=>'failed','message'=>'Failed to disable exam date']);
    exit;
}

/* delete_exam_date */
if ($action === 'delete_exam_date') {
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $conn->prepare("DELETE FROM exam_dates WHERE id=?");
    $stmt->bind_param("i", $id);
    echo json_encode($stmt->execute()
        ? ['status'=>'success','message'=>'Exam date deleted successfully']
        : ['status'=>'failed','message'=>'Failed to delete exam date']);
    exit;
}

/* ═══════════ SPECIAL / REFUND BATCH DATES ═══════════ */

/* add_special_exam_date */
if ($action === 'add_special_exam_date') {
    $date = date('jS F, Y');
    $stmt = $conn->prepare("INSERT INTO special_exam_dates (date, status, total_seats, remaining_seats, show_date) VALUES (?, 'empty', 10, 10, 1)");
    $stmt->bind_param("s", $date);
    if ($stmt->execute()) {
        $newId = $conn->insert_id;
        $row = [
            'id'               => $newId,
            'date'             => $date,
            'status'           => 'empty',
            'total_seats'      => 10,
            'remaining_seats'  => 10,
            'show_date'        => 1
        ];
        echo json_encode(['status'=>'success','message'=>'Special batch date added','row'=>$row]);
    } else {
        echo json_encode(['status'=>'failed','message'=>'Failed to add special batch']);
    }
    exit;
}

/* fetch_special_exam_date_by_id */
if ($action === 'fetch_special_exam_date_by_id') {
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $conn->prepare("SELECT * FROM special_exam_dates WHERE id=?");
    $stmt->bind_param("i", $id); $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_assoc());
    exit;
}

/* update_special_exam_date */
if ($action === 'update_special_exam_date') {
    $id              = (int)$_POST['id'];
    $date            = $_POST['date'];
    $status          = $_POST['status'];
    $total_seats     = (int)$_POST['total_seats'];
    $remaining_seats = (int)$_POST['remaining_seats'];
    $stmt = $conn->prepare("UPDATE special_exam_dates SET date=?, status=?, total_seats=?, remaining_seats=? WHERE id=?");
    $stmt->bind_param("ssiii", $date, $status, $total_seats, $remaining_seats, $id);
    echo json_encode($stmt->execute()
        ? ['status'=>'success','message'=>'Special batch updated']
        : ['status'=>'failed','message'=>'Update failed']);
    exit;
}

/* disable_special_exam_date */
if ($action === 'disable_special_exam_date') {
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $conn->prepare("UPDATE special_exam_dates SET show_date=0 WHERE id=?");
    $stmt->bind_param("i", $id);
    echo json_encode($stmt->execute()
        ? ['status'=>'success','message'=>'Special batch disabled']
        : ['status'=>'failed','message'=>'Disable failed']);
    exit;
}

/* ═══════════ REFUND PROGRAM RANGE ═══════════ */

/* update_refund_program_range */
if ($action === 'update_refund_program_range') {
    $range = ($_POST['from_date'] ?? '') . '|' . ($_POST['to_date'] ?? '');
    $stmt  = $conn->prepare("UPDATE settings SET settings_value=? WHERE settings_key='show_refund_program_batch'");
    $stmt->bind_param("s", $range);
    echo json_encode($stmt->execute()
        ? ['status'=>'success','message'=>'Refund program range updated']
        : ['status'=>'failed','message'=>'Update failed']);
    exit;
}

/* ═══════════ CIT DATES OVERVIEW ═══════════ */

/* update_cit_special_normal — same as functions.php handler */
if ($action === 'update_cit_special_normal') {
    $updates = json_decode($_POST['updates'] ?? '[]', true);
    $failed  = [];
    foreach ($updates as $u) {
        $id      = (int)$u['id'];
        $special = (int)$u['special'];
        $normal  = (int)$u['normal'];
        $res = mysqli_query($conn, "UPDATE exam_batch_for_reports SET special=$special, normal=$normal WHERE id=$id");
        if (!$res) $failed[] = $id;
    }
    echo json_encode(count($failed) === 0
        ? ['status'=>'success','message'=>'CIT changes updated successfully']
        : ['status'=>'error','message'=>'Failed to update IDs: ' . implode(',', $failed)]);
    exit;
}

/* fetch_new_cit_relationships — from exam_dates.php */
if ($action === 'fetch_new_cit_relationships') {
    $res  = mysqli_query($conn, "SELECT cit_version_id, exam_date_id, selected FROM cit_version_exam_date");
    $rows = [];
    if ($res) while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode($rows);
    exit;
}

/* save_new_cit_relationships — from exam_dates.php */
if ($action === 'save_new_cit_relationships') {
    $updates = json_decode($_POST['updates'] ?? '[]', true);
    foreach ($updates as $u) {
        $examDateId   = (int)$u['exam_date_id'];
        $citVersionId = (int)$u['cit_version_id'];
        $sel          = (int)$u['selected'];
        mysqli_query($conn, "INSERT INTO cit_version_exam_date (cit_version_id, exam_date_id, selected)
                             VALUES ($citVersionId, $examDateId, $sel)
                             ON DUPLICATE KEY UPDATE selected = VALUES(selected)");
    }
    echo json_encode(['status'=>'success','message'=>'New CIT selections saved successfully']);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>