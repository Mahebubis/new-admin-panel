<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
session_start(); // needed for $_SESSION['bulk_pending']
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

/* ── log helper ── */
function logErr($context, $msg) {
    $logFile = '/home/istudio/logs/allocate-internships.log';
    $trace   = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 1);
    $line    = $trace[0]['line'] ?? '?';
    file_put_contents(
        $logFile,
        '[' . date('Y-m-d H:i:s') . '] [' . $context . '] line ' . $line . ': ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
}

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        ob_clean();
        header('Content-Type: application/json');
        $msg = 'PHP Fatal: ' . $error['message'] . ' in ' . $error['file'] . ' line ' . $error['line'];
        file_put_contents('/home/istudio/logs/allocate-internships.log',
            '[' . date('Y-m-d H:i:s') . '] [FATAL] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
        echo json_encode(['success' => false, 'message' => $msg]);
    }
});

global $conn;
if (!$conn) {
    logErr('INIT', 'DB connection failed');
    echo json_encode(['success' => false, 'message' => 'DB failed']);
    exit;
}

$action = $_POST['action'] ?? '';

/* ════════════════════════════════════════
   UPLOAD BULK DATA FILTERED
   Exact same logic as upload_bulk_data_filtered in functions.php:
   1. parse_bulk_file() — reads CSV, filters by amount/status/notes
   2. splits rows into matched (user already has internship_payment)
      and non_matched
   3. stores non_matched in $_SESSION['bulk_pending']
   4. returns both arrays + counts
════════════════════════════════════════ */
if ($action === 'upload_bulk_data_filtered') {

    if (!isset($_FILES['file'])) {
        logErr('upload_bulk_data_filtered', 'No file uploaded');
        echo json_encode(['success' => false, 'message' => 'No file uploaded']);
        exit;
    }

    $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
    if ($ext !== 'csv') {
        logErr('upload_bulk_data_filtered', 'Invalid file: ' . $_FILES['file']['name']);
        echo json_encode(['success' => false, 'message' => 'Please upload a CSV file only']);
        exit;
    }

    $payment_type = $_POST['payment_type'] ?? 'razorpay';

    /* ── parse_bulk_file() logic — exact copy from functions.php ── */
    $rows = [];

    $handle = fopen($_FILES['file']['tmp_name'], 'r');
    if (!$handle) {
        logErr('upload_bulk_data_filtered', 'Cannot open file');
        echo json_encode(['success' => false, 'message' => 'Cannot open uploaded file']);
        exit;
    }

    // Skip header row
    fgetcsv($handle);

    while (($data = fgetcsv($handle)) !== false) {

        // Amount — column B (index 1)
        $amountRaw   = $data[1] ?? '';
        $amountClean = preg_replace('/[^0-9.]/', '', $amountRaw);
        if ($amountClean === '') continue;
        $amount = (int) round((float)$amountClean);

        // Allow only these amounts (same as parse_bulk_file)
        if (!in_array($amount, [472, 490, 590])) continue;

        // Status — column D (index 3)
        $status = strtolower(trim($data[3] ?? ''));
        if ($status !== 'captured') continue;

        // Notes JSON — column U (index 20)
        $notesRaw = $data[20] ?? '';
        $notes    = json_decode($notesRaw, true);
        if (!is_array($notes)) continue;

        $user_id    = (int)($notes['user_id']        ?? 0);
        $internship = trim($notes['internship_name'] ?? '');
        $batch      = trim($notes['batch_date']      ?? '');

        if ($user_id === 0 || $internship === '') continue;

        $rows[] = [
            'user_id'    => $user_id,
            'email'      => trim($data[18] ?? ''),
            'payment_id' => trim($data[4]  ?? ''),
            'order_id'   => trim($data[4]  ?? ''),
            'internship' => $internship,
            'batch'      => $batch,
            'paid_at'    => date('Y-m-d H:i:s'),
            'amount'     => $amount,
        ];
    }
    fclose($handle);

    logErr('upload_bulk_data_filtered', 'Parsed ' . count($rows) . ' valid rows from CSV');

    /* ── split matched / non_matched ── */
    $matched     = [];
    $non_matched = [];

    foreach ($rows as $row) {
        $uid = (int)$row['user_id'];
        if ($uid === 0) continue;

        $check = mysqli_query($conn, "SELECT id FROM internship_payment WHERE user_id = $uid LIMIT 1");
        if (!$check) {
            logErr('upload_bulk_data_filtered', 'check query failed uid=' . $uid . ': ' . mysqli_error($conn));
            continue;
        }

        if (mysqli_num_rows($check) > 0) {
            $matched[] = $row;
        } else {
            $non_matched[] = $row;
        }
    }

    // Store ONLY non_matched in session for allocation step
    $_SESSION['bulk_pending'] = $non_matched;

    logErr('upload_bulk_data_filtered', 'matched=' . count($matched) . ' non_matched=' . count($non_matched));

    echo json_encode([
        'success'     => true,
        'matched'     => $matched,
        'non_matched' => $non_matched,
        'matched_cnt' => count($matched),
        'pending_cnt' => count($non_matched),
    ]);
    exit;
}

/* ════════════════════════════════════════
   ALLOCATE BULK INTERNSHIPS
   Exact same logic as allocate_bulk_internships in functions.php:
   1. reads $_SESSION['bulk_pending']
   2. for each row: checks duplicate, INSERTs internship_payment,
      then INSERTs payment_status if not exists
   3. clears session
   4. returns inserted + skipped counts
════════════════════════════════════════ */
if ($action === 'allocate_bulk_internships') {

    if (!isset($_SESSION['bulk_pending']) || empty($_SESSION['bulk_pending'])) {
        logErr('allocate_bulk_internships', 'No pending records in session');
        echo json_encode(['success' => false, 'message' => 'No pending records found. Please upload the file again.']);
        exit;
    }

    $rows     = $_SESSION['bulk_pending'];
    $inserted = 0;
    $skipped  = 0;

    foreach ($rows as $row) {

        $user_id    = (int)$row['user_id'];
        $payment_id = mysqli_real_escape_string($conn, $row['payment_id']);

        if ($user_id === 0 || empty($payment_id)) {
            logErr('allocate_bulk_internships', "Skipping — empty user_id or payment_id");
            $skipped++;
            continue;
        }

        /* ── 1. CHECK duplicate in internship_payment ── */
        $chk = mysqli_query($conn,
            "SELECT id FROM internship_payment
             WHERE user_id = $user_id OR payment_id = '$payment_id'
             LIMIT 1"
        );
        if (!$chk) {
            logErr('allocate_bulk_internships', 'Dup check failed uid=' . $user_id . ': ' . mysqli_error($conn));
            $skipped++;
            continue;
        }
        if (mysqli_num_rows($chk) > 0) {
            logErr('allocate_bulk_internships', "Duplicate — uid=$user_id pid=$payment_id");
            $skipped++;
            continue;
        }

        /* ── 2. INSERT internship_payment ── */
        $internship = mysqli_real_escape_string($conn, $row['internship']);
        $batch      = mysqli_real_escape_string($conn, $row['batch']);
        $paid_at    = mysqli_real_escape_string($conn, $row['paid_at']);

        $insert1 = mysqli_query($conn, "
            INSERT INTO internship_payment
            (user_id, internship, batch, payment_id, paid_at, batch_freeze, total_duration, internship_level)
            VALUES ($user_id, '$internship', '$batch', '$payment_id', '$paid_at', 0, 35, 'Silver')
        ");

        if (!$insert1) {
            logErr('allocate_bulk_internships', 'INSERT internship_payment failed uid=' . $user_id . ': ' . mysqli_error($conn));
            $skipped++;
            continue;
        }

        /* ── 3. CHECK payment_status ── */
        $chk2 = mysqli_query($conn,
            "SELECT id FROM payment_status WHERE payment_id = '$payment_id' LIMIT 1"
        );

        /* ── 4. INSERT payment_status if not exists ── */
        if ($chk2 && mysqli_num_rows($chk2) === 0) {
            $order_id    = mysqli_real_escape_string($conn, $row['order_id']    ?? $row['payment_id']);
            $amount      = (float)($row['amount'] ?? 0);

            $ins2 = mysqli_query($conn, "
                INSERT INTO payment_status
                (user_id, order_id, payment_id, amount, internship_name, batch_date, status, timestamp)
                VALUES ($user_id, '$order_id', '$payment_id', $amount, '$internship', '$batch', 'success', '$paid_at')
            ");

            if (!$ins2) {
                logErr('allocate_bulk_internships', 'INSERT payment_status failed uid=' . $user_id . ': ' . mysqli_error($conn));
                // non-fatal — internship_payment already inserted, keep going
            }
        }

        $inserted++;
    }

    // Clear session so it cannot re-run accidentally
    unset($_SESSION['bulk_pending']);

    logErr('allocate_bulk_internships', "Done — inserted=$inserted skipped=$skipped");

    echo json_encode([
        'success'  => true,
        'inserted' => $inserted,
        'skipped'  => $skipped,
    ]);
    exit;
}

/* ── fallback ── */
logErr('fallback', "Unknown action='$action'");
echo json_encode(['success' => false, 'message' => 'Invalid action: ' . $action]);
exit;
?>