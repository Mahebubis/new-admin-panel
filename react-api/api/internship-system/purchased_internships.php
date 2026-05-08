<?php
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   FETCH ALL INTERNSHIPS (paginated)
   Mirrors fetch_all_internships()
════════════════════════════════════════ */
if ($action === 'fetch_all') {
    $limit  = (int)($_POST['limit']  ?? 10);
    $offset = (int)($_POST['offset'] ?? 0);

    $countRes = mysqli_query($conn, "SELECT COUNT(*) as cnt FROM internship_payment");
    $total    = mysqli_fetch_assoc($countRes)['cnt'] ?? 0;

    $sql = "
        SELECT
            ip.id            AS internship_id,
            ip.user_id,
            ip.internship    AS internship_name,
            ip.batch,
            ip.payment_id,
            ip.paid_at,
            ip.total_duration,
            ip.internship_level,
            ip.batch_freeze,
            ip.upgraded_payment_id,
            u.name,
            u.email,
            u.phone,
            ps.amount        AS charge_amount,
            (SELECT COUNT(*) FROM project_submission prs
             WHERE prs.user_id = ip.user_id
               AND prs.internship_id = ip.id
               AND prs.status = 'approved') AS project_status
        FROM internship_payment ip
        INNER JOIN users u ON ip.user_id = u.user_id
        LEFT JOIN payment_status ps ON ps.payment_id = ip.payment_id
        ORDER BY ip.paid_at DESC
        LIMIT $limit OFFSET $offset
    ";

    $res  = mysqli_query($conn, $sql);
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;

    echo json_encode(['status'=>'success','data'=>$rows,'total'=>(int)$total]);
    exit;
}

/* ════════════════════════════════════════
   SEARCH BY KEYWORD
   Mirrors fetch_internship_by_keyword()
════════════════════════════════════════ */
if ($action === 'fetch_by_keyword') {
    $keyword = mysqli_real_escape_string($conn, $_POST['keyword'] ?? '');

    $sql = "
        SELECT
            ip.id            AS internship_id,
            ip.user_id,
            ip.internship    AS internship_name,
            ip.batch,
            ip.payment_id,
            ip.paid_at,
            ip.total_duration,
            ip.internship_level,
            ip.batch_freeze,
            ip.upgraded_payment_id,
            u.name,
            u.email,
            u.phone,
            ps.amount        AS charge_amount,
            (SELECT COUNT(*) FROM project_submission prs
             WHERE prs.user_id = ip.user_id
               AND prs.internship_id = ip.id
               AND prs.status = 'approved') AS project_status
        FROM internship_payment ip
        INNER JOIN users u ON ip.user_id = u.user_id
        LEFT JOIN payment_status ps ON ps.payment_id = ip.payment_id
        WHERE u.name LIKE '%$keyword%'
           OR u.email LIKE '%$keyword%'
           OR u.phone LIKE '%$keyword%'
           OR ip.payment_id LIKE '%$keyword%'
           OR ip.internship LIKE '%$keyword%'
        ORDER BY ip.paid_at DESC
        LIMIT 200
    ";

    $res  = mysqli_query($conn, $sql);
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;

    echo json_encode(['status'=>'success','data'=>$rows,'total'=>count($rows)]);
    exit;
}

/* ════════════════════════════════════════
   FETCH INTERNSHIP LIST (for dropdowns)
════════════════════════════════════════ */
if ($action === 'fetch_internship_list') {
    $res  = mysqli_query($conn, "SELECT id, internship_name FROM internship_list ORDER BY priority ASC");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode(['status'=>'success','data'=>$rows]);
    exit;
}

/* ════════════════════════════════════════
   FETCH EXAM DATES (for batch dropdown)
   Mirrors fetch_exam_dates()
════════════════════════════════════════ */
if ($action === 'fetch_exam_dates') {
    $sql = "
        SELECT
            ed.date,
            CASE
                WHEN COUNT(ip.id) = 0 THEN 'empty'
                WHEN COUNT(ip.id) >= ed.max_students THEN 'full'
                ELSE 'half'
            END AS status
        FROM exam_dates ed
        LEFT JOIN internship_payment ip ON ip.batch = ed.date
        GROUP BY ed.date, ed.max_students
        ORDER BY ed.date ASC
    ";
    $res  = mysqli_query($conn, $sql);
    $rows = [];
    if ($res) while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;

    // fallback if exam_dates table doesn't exist
    if (empty($rows)) {
        $res2 = mysqli_query($conn, "SELECT DISTINCT batch AS date FROM internship_payment ORDER BY batch ASC");
        while ($r = mysqli_fetch_assoc($res2)) $rows[] = ['date'=>$r['date'],'status'=>'half'];
    }
    echo json_encode(['status'=>'success','data'=>$rows]);
    exit;
}

/* ════════════════════════════════════════
   FETCH USER BY KEYWORD (for add modal)
   Mirrors fetch_user_by_keyword()
════════════════════════════════════════ */
if ($action === 'fetch_user_by_keyword') {
    $keyword = mysqli_real_escape_string($conn, $_POST['keyword'] ?? '');
    $sql = "SELECT user_id, name, email, phone FROM users
            WHERE name LIKE '%$keyword%' OR email LIKE '%$keyword%' OR phone LIKE '%$keyword%'
            LIMIT 20";
    $res  = mysqli_query($conn, $sql);
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode(['status'=>'success','data'=>$rows]);
    exit;
}

/* ════════════════════════════════════════
   DELETE INTERNSHIP
   Same logic as delete_internship in functions.php
════════════════════════════════════════ */
if ($action === 'delete_internship') {
    $payment_id = mysqli_real_escape_string($conn, $_POST['payment_id'] ?? '');

    if (mysqli_query($conn, "DELETE FROM internship_payment WHERE payment_id = '$payment_id'")) {
        echo json_encode(['status'=>'success','message'=>'Internship deleted successfully']);
    } else {
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   PROVIDE CERTIFICATE
   Same logic as provide_certificate in functions.php
════════════════════════════════════════ */
if ($action === 'provide_certificate') {
    $user_id        = (int)($_POST['user_id']        ?? 0);
    $internship_id  = (int)($_POST['internship_id']  ?? 0);

    $check = mysqli_query($conn, "SELECT user_id FROM project_submission
                                  WHERE user_id = $user_id AND internship_id = $internship_id");

    if (mysqli_num_rows($check) === 0) {
        $ins = mysqli_query($conn, "INSERT INTO project_submission (user_id, status, internship_id)
                                    VALUES ($user_id, 'approved', $internship_id)");
        if ($ins) {
            mysqli_query($conn, "UPDATE user_steps SET
                istudio_training_portal = 1,
                istudio_project_submission = 1
                WHERE user_id = $user_id");
            echo json_encode(['status'=>'success','message'=>'Certificate Issued']);
        } else {
            echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        }
    } else {
        echo json_encode(['status'=>'error','message'=>'Certificate already issued']);
    }
    exit;
}

/* ════════════════════════════════════════
   ADD INTERNSHIP
   Same logic as add_by_admin.php
════════════════════════════════════════ */
if ($action === 'add_internship') {
    $user_id          = (int)($_POST['user_id']          ?? 0);
    $internship       = mysqli_real_escape_string($conn, $_POST['internship']       ?? '');
    $batch            = mysqli_real_escape_string($conn, $_POST['batch']            ?? '');
    $payment_id       = mysqli_real_escape_string($conn, $_POST['payment_id']       ?? '');
    $total_duration   = (int)($_POST['total_duration']   ?? 35);
    $internship_level = mysqli_real_escape_string($conn, $_POST['internship_level'] ?? 'Silver');
    $paid_at          = date('Y-m-d H:i:s');

    if (!$user_id || !$internship || !$batch) {
        echo json_encode(['status'=>'error','message'=>'user_id, internship and batch are required']);
        exit;
    }

    // Check duplicate
    $chk = mysqli_query($conn, "SELECT id FROM internship_payment
                                 WHERE user_id = $user_id AND internship = '$internship' AND batch = '$batch'");
    if (mysqli_num_rows($chk) > 0) {
        echo json_encode(['status'=>'error','message'=>'This internship entry already exists for this student and batch']);
        exit;
    }

    $sql = "INSERT INTO internship_payment
            (user_id, internship, batch, payment_id, paid_at, batch_freeze, total_duration, internship_level)
            VALUES ($user_id, '$internship', '$batch', '$payment_id', '$paid_at', 0, $total_duration, '$internship_level')";

    if (mysqli_query($conn, $sql)) {
        echo json_encode(['status'=>'success','message'=>'Internship added successfully']);
    } else {
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   UPDATE INTERNSHIP
   Same logic as edit_by_admin.php
════════════════════════════════════════ */
if ($action === 'update_internship') {
    $orig_payment_id     = mysqli_real_escape_string($conn, $_POST['payment_id']           ?? '');
    $internship          = mysqli_real_escape_string($conn, $_POST['internship']            ?? '');
    $batch               = mysqli_real_escape_string($conn, $_POST['batch']                ?? '');
    $new_payment_id      = mysqli_real_escape_string($conn, $_POST['new_payment_id']        ?? '');
    $batch_freeze        = (int)($_POST['batch_freeze']        ?? 0);
    $total_duration      = (int)($_POST['total_duration']      ?? 35);
    $internship_level    = mysqli_real_escape_string($conn, $_POST['internship_level']     ?? 'Silver');
    $upgraded_payment_id = mysqli_real_escape_string($conn, $_POST['upgraded_payment_id']  ?? '');

    $sql = "UPDATE internship_payment SET
            internship          = '$internship',
            batch               = '$batch',
            payment_id          = '$new_payment_id',
            batch_freeze        = $batch_freeze,
            total_duration      = $total_duration,
            internship_level    = '$internship_level',
            upgraded_payment_id = '$upgraded_payment_id'
            WHERE payment_id = '$orig_payment_id'";

    if (mysqli_query($conn, $sql)) {
        echo json_encode(['status'=>'success','message'=>'Updated successfully']);
    } else {
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   BULK UPLOAD — parse CSV
   Same logic as upload_bulk_data in functions.php
════════════════════════════════════════ */
if ($action === 'upload_bulk_data') {
    $payment_type = $_POST['payment_type'] ?? 'razorpay';
    $response     = ['success' => false, 'message' => '', 'data' => []];

    if (!isset($_FILES['file'])) {
        $response['message'] = 'No file uploaded';
        echo json_encode($response); exit;
    }

    $originalName = $_FILES['file']['name'];
    $extension    = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if ($extension !== 'csv') {
        $response['message'] = 'Please upload a CSV file only';
        echo json_encode($response); exit;
    }

    // Fetch existing payment IDs to mark already processed rows
    $existingRes = mysqli_query($conn, "SELECT payment_id FROM internship_payment");
    $existingIds = [];
    while ($r = mysqli_fetch_assoc($existingRes)) $existingIds[] = $r['payment_id'];

    // Fetch users by email
    $usersRes = mysqli_query($conn, "SELECT user_id, email FROM users");
    $usersByEmail = [];
    while ($r = mysqli_fetch_assoc($usersRes)) $usersByEmail[$r['email']] = $r['user_id'];

    $file = $_FILES['file']['tmp_name'];
    $data = [];

    if (($handle = fopen($file, 'r')) !== false) {
        $header = fgetcsv($handle);
        if (!$header) { $response['message'] = 'Cannot read CSV'; echo json_encode($response); exit; }

        while (($row = fgetcsv($handle)) !== false) {
            if (count($header) !== count($row)) continue;
            $rowData = array_combine($header, $row);

            if ($payment_type === 'razorpay') {
                $amount         = (int)($rowData['amount'] ?? 0);
                $status         = $rowData['status'] ?? '';
                $amount_refunded = (int)($rowData['amount_refunded'] ?? 0);

                if ($status !== 'captured' || $amount_refunded > 0) continue;

                $pid   = $rowData['id'] ?? '';
                $email = $rowData['email'] ?? '';
                $desc  = $rowData['description'] ?? '';
                $paid_at = $rowData['created_at'] ?? '';

                if (in_array($pid, $existingIds)) continue;

                $uid = $usersByEmail[$email] ?? null;
                if (!$uid) continue;

                // Try to parse internship|batch from description
                $internship_info = $desc;
                $batch_info      = '';
                if (strpos($desc, '|') !== false) {
                    [$internship_info, $batch_info] = explode('|', $desc, 2);
                }

                $data[] = [
                    'user_id'    => $uid,
                    'email'      => $email,
                    'payment_id' => $pid,
                    'amount'     => $amount / 100, // razorpay stores in paise
                    'internship' => trim($internship_info) . '|' . trim($batch_info),
                    'paid_at'    => $paid_at,
                ];

            } elseif ($payment_type === 'phonepe') {
                $pid    = $rowData['order_id']          ?? '';
                $email  = $rowData['customer_id']       ?? '';
                $amount = $rowData['amount']             ?? 0;
                $status = $rowData['payment_status']    ?? '';
                $paid_at= $rowData['created_at']        ?? '';

                if (strtolower($status) !== 'success') continue;
                if (in_array($pid, $existingIds)) continue;

                $uid = $usersByEmail[$email] ?? null;
                if (!$uid) continue;

                $data[] = [
                    'user_id'    => $uid,
                    'email'      => $email,
                    'payment_id' => $pid,
                    'amount'     => $amount,
                    'internship' => '|',
                    'paid_at'    => $paid_at,
                ];

            } elseif ($payment_type === 'hdfc_smartgateway') {
                $pid    = $rowData['order_id']          ?? '';
                $email  = $rowData['customer_id']       ?? '';
                $amount = $rowData['amount']             ?? 0;
                $status = $rowData['payment_status']    ?? '';
                $desc   = $rowData['description']       ?? '';
                $paid_at= $rowData['created_at']        ?? '';

                if (strtolower($status) !== 'success') continue;
                if (in_array($pid, $existingIds)) continue;

                $uid = $usersByEmail[$email] ?? null;
                if (!$uid) continue;

                $data[] = [
                    'user_id'    => $uid,
                    'email'      => $email,
                    'payment_id' => $pid,
                    'amount'     => $amount,
                    'internship' => $desc . '|',
                    'paid_at'    => $paid_at,
                ];
            }
        }
        fclose($handle);
    }

    $response['success'] = true;
    $response['data']    = $data;
    echo json_encode($response);
    exit;
}

/* ── fallback ── */
echo json_encode(['status'=>'error','message'=>'Invalid action: '.$action]);
exit;
?>