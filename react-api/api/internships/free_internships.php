<?php
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ── GET stats ── */
if ($_SERVER['REQUEST_METHOD'] === 'GET' || $action === 'get_stats') {
    echo json_encode([
        'status'   => 'success',
        'total'    => (int)view_free_internship_status('total'),
        'pending'  => (int)view_free_internship_status('pending'),
        'accepted' => (int)view_free_internship_status('accepted'),
        'rejected' => (int)view_free_internship_status('rejected'),
    ]);
    exit;
}

/* ── FETCH APPLICANTS ── */
if ($action === 'fetch_free_internship_applicants') {
    $limit   = (int)($_POST['limit']  ?? 10);
    $offset  = (int)($_POST['offset'] ?? 0);
    $status  = !empty($_POST['status'])  ? $_POST['status']  : null;
    $keyword = !empty($_POST['keyword']) ? $_POST['keyword'] : null;

    $data = fetch_free_internship_applicants($limit, $offset, $status, $keyword);
    if ($data === false) $data = [];

    $count_sql  = "SELECT COUNT(*) AS cnt FROM free_student_internships fsi
                   INNER JOIN users u ON fsi.user_id = u.user_id
                   INNER JOIN result r ON fsi.user_id = r.user_id";
    $conditions = [];
    if ($status)  $conditions[] = "fsi.status = '" . mysqli_real_escape_string($conn, $status) . "'";
    if ($keyword) $conditions[] = "u.email LIKE '%" . mysqli_real_escape_string($conn, $keyword) . "%'";
    if ($conditions) $count_sql .= " WHERE " . implode(' AND ', $conditions);
    $cRes  = mysqli_query($conn, $count_sql);
    $count = $cRes ? (int)mysqli_fetch_assoc($cRes)['cnt'] : 0;

    echo json_encode(['status'=>'success','data'=>$data,'count'=>$count]);
    exit;
}

/* ── ACCEPT ── */
if ($action === 'accept_free_internship_application') {
    $id      = (int)($_POST['id']      ?? 0);
    $user_id = (int)($_POST['user_id'] ?? 0);
    if (!$id || !$user_id) { echo json_encode(['status'=>'error','message'=>'id and user_id required']); exit; }

    if (mysqli_query($conn, "UPDATE free_student_internships SET status = 'accepted' WHERE id = $id")) {
        $res = mysqli_query($conn, "SELECT * FROM free_student_internships WHERE id = $id");
        $row = $res ? mysqli_fetch_assoc($res) : null;

        if ($row) {
            $payment_id = "free_{$row['id']}_{$row['user_id']}";
            $stmt = mysqli_prepare($conn, "INSERT INTO internship_payment (user_id, internship, batch, payment_id) VALUES (?, ?, ?, ?)");
            mysqli_stmt_bind_param($stmt, "ssss", $user_id, $row['internship_name'], $row['batch'], $payment_id);
            mysqli_stmt_execute($stmt);

            // Inline email lookup — get_user_by_id() is inside a class so can't be called here
            $uRes = mysqli_query($conn, "SELECT name, email FROM users WHERE user_id = $user_id LIMIT 1");
            $user = $uRes ? mysqli_fetch_assoc($uRes) : null;
            if ($user) {
                $to      = $user['email'];
                $subject = 'Successful Registration for ' . $row['internship_name'];
                $message = 'Dear ' . $user['name'] . ',<br><br>Congratulations! You have successfully enrolled.<br><br><b>Internship:</b> ' . $row['internship_name'] . '<br><b>Batch:</b> ' . $row['batch'] . '<br><br>Best Regards,<br>Team Internship Studio';
                try { sendEmail($to, $subject, $message); } catch (Throwable $e) {}
            }

            try { update_student_step($user_id, 'cit_internship_selection', 1); } catch (Throwable $e) {}
        }

        echo json_encode(['status'=>'success','message'=>'Internship added successfully']);
    } else {
        echo json_encode(['status'=>'failed','message'=>'Failed to add internship']);
    }
    exit;
}

/* ── REJECT ── */
if ($action === 'reject_free_internship_application') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) { echo json_encode(['status'=>'error','message'=>'id required']); exit; }
    echo json_encode(mysqli_query($conn, "UPDATE free_student_internships SET status = 'rejected' WHERE id = $id") ? ['status'=>'success','message'=>'Internship rejected successfully'] : ['status'=>'failed','message'=>'Failed to reject internship']);
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;