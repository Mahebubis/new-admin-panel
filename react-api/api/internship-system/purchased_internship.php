<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
// include '/home/istudio/public_html/cit/common/functions.php';
ob_clean();
header('Content-Type: application/json');

/* ── write to a guaranteed-writable log file ── */
function logErr($context, $msg) {
    $logFile = '/home/istudio/logs/purchased-internships.log';
    $trace   = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 1);
    $line    = $trace[0]['line'] ?? '?';
    $entry   = '[' . date('Y-m-d H:i:s') . '] [' . $context . '] line ' . $line . ': ' . $msg . PHP_EOL;
    file_put_contents($logFile, $entry, FILE_APPEND | LOCK_EX);
}

register_shutdown_function(function () {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        ob_clean();
        header('Content-Type: application/json');
        $msg = 'PHP Fatal: ' . $error['message'] . ' in ' . $error['file'] . ' line ' . $error['line'];
        file_put_contents(
            '/home/istudio/logs/purchased-internships.log',
            '[' . date('Y-m-d H:i:s') . '] [FATAL] ' . $msg . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
        echo json_encode(['status' => 'error', 'message' => $msg]);
    }
});

global $conn;
if (!$conn) {
    logErr('INIT', 'DB connection failed');
    echo json_encode(['status' => 'error', 'message' => 'DB failed']);
    exit;
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   FETCH ALL — calls fetch_all_internships()
   IMPORTANT: function returns false when empty, not []
   Columns returned: user_id, name, email, phone,
     internship_id, internship_name, batch, total_duration,
     payment_id, paid_at, internship_level, project_status,
     charge_amount (added in loop)
════════════════════════════════════════ */
if ($action === 'fetch_all') {
    $limit  = (int)($_POST['limit']  ?? 10);
    $offset = (int)($_POST['offset'] ?? 0);

    try {
        /* ── total count ── */
        $countRes = mysqli_query($conn, "SELECT COUNT(*) AS count FROM internship_payment");
        if (!$countRes) {
            logErr('fetch_all', 'COUNT failed: ' . mysqli_error($conn));
            $total = 0;
        } else {
            $total = (int)(mysqli_fetch_assoc($countRes)['count'] ?? 0);
        }

        /* ── main data query ── */
        $sql = "
            SELECT
                u.user_id,
                u.name,
                u.email,
                u.phone,
                il.id            AS internship_id,
                il.internship_name,
                ip.batch,
                ip.refund,
                ip.total_duration,
                ip.payment_id,
                ip.paid_at,
                ip.internship_level,
                ip.batch_freeze,
                ip.upgraded_payment_id,
                ps.status        AS project_status,
                COALESCE(pst.amount, 0) AS charge_amount
            FROM internship_payment ip
            INNER JOIN users u
                ON ip.user_id = u.user_id
            INNER JOIN internship_list il
                ON ip.internship COLLATE utf8mb4_unicode_ci = il.internship_name COLLATE utf8mb4_unicode_ci
            LEFT JOIN project_submission ps
                ON (u.user_id = ps.user_id AND il.id = ps.internship_id)
            LEFT JOIN payment_status pst
                ON pst.payment_id COLLATE utf8mb4_unicode_ci = ip.payment_id COLLATE utf8mb4_unicode_ci
            ORDER BY ip.paid_at DESC
            LIMIT $limit OFFSET $offset
        ";

        $res = mysqli_query($conn, $sql);
        if (!$res) {
            logErr('fetch_all', 'Main query failed: ' . mysqli_error($conn));
            echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
            exit;
        }

        $data = [];
        while ($r = mysqli_fetch_assoc($res)) $data[] = $r;

        echo json_encode(['status' => 'success', 'data' => $data, 'total' => $total]);

    } catch (Throwable $e) {
        logErr('fetch_all', 'Throwable: ' . $e->getMessage() . ' line ' . $e->getLine());
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

/* ════════════════════════════════════════
   SEARCH BY KEYWORD — calls fetch_internship_by_keyword()
   IMPORTANT: function returns false when no match, not []
   Same columns as fetch_all_internships
════════════════════════════════════════ */
if ($action === 'fetch_by_keyword') {
    $keyword = trim($_POST['keyword'] ?? '');

    if (empty($keyword)) {
        echo json_encode(['status' => 'success', 'data' => [], 'total' => 0]);
        exit;
    }

    try {
        $kw = mysqli_real_escape_string($conn, $keyword);

        $sql = "
            SELECT
                u.user_id,
                u.name,
                u.email,
                u.phone,
                il.id            AS internship_id,
                il.internship_name,
                ip.batch,
                ip.refund,
                ip.total_duration,
                ip.payment_id,
                ip.paid_at,
                ip.internship_level,
                ip.batch_freeze,
                ip.upgraded_payment_id,
                ps.status        AS project_status,
                COALESCE(pst.amount, 0) AS charge_amount
            FROM internship_payment ip
            INNER JOIN users u
                ON ip.user_id = u.user_id
            INNER JOIN internship_list il
                ON ip.internship COLLATE utf8mb4_unicode_ci = il.internship_name COLLATE utf8mb4_unicode_ci
            LEFT JOIN project_submission ps
                ON (u.user_id = ps.user_id AND il.id = ps.internship_id)
            LEFT JOIN payment_status pst
                ON pst.payment_id COLLATE utf8mb4_unicode_ci = ip.payment_id COLLATE utf8mb4_unicode_ci
            WHERE u.email    LIKE '%$kw%'
               OR u.phone    LIKE '%$kw%'
               OR u.name     LIKE '%$kw%'
               OR ip.payment_id LIKE '%$kw%'
               OR ip.internship LIKE '%$kw%'
            ORDER BY ip.paid_at DESC
            LIMIT 200
        ";

        $res = mysqli_query($conn, $sql);
        if (!$res) {
            logErr('fetch_by_keyword', 'Query failed: ' . mysqli_error($conn) . ' keyword:' . $keyword);
            echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
            exit;
        }

        $data = [];
        while ($r = mysqli_fetch_assoc($res)) $data[] = $r;

        echo json_encode(['status' => 'success', 'data' => $data, 'total' => count($data)]);

    } catch (Throwable $e) {
        logErr('fetch_by_keyword', 'Throwable: ' . $e->getMessage());
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

// function fetch_user_by_keyword($keyword)
//     {
//         global $conn;
//         $sql = "SELECT * FROM users INNER JOIN additional_details ON users.user_id = additional_details.user_id WHERE (email LIKE '%$keyword%' OR phone LIKE '%$keyword%')";
//         $result = mysqli_query($conn, $sql);
//         if (mysqli_num_rows($result) > 0) {
//             // Clear the password from the array
//             while ($row = mysqli_fetch_assoc($result)) {
//                 unset($row['password']);
//                 $users[] = $row;
//             }
//             return $users;
//         } else {
//             return false;
//         }
//     }

function fetch_user_by_keyword($keyword)
{
    global $conn;
    $kw = mysqli_real_escape_string($conn, $keyword);

    // 1. Exact email or phone match — instant via B-tree index
    $exact = mysqli_query($conn, "
        SELECT u.*, ad.*
        FROM users u
        INNER JOIN additional_details ad ON u.user_id = ad.user_id
        WHERE u.email = '$kw' OR u.phone = '$kw'
        LIMIT 50
    ");
    if ($exact && mysqli_num_rows($exact) > 0) {
        $rows = [];
        while ($r = mysqli_fetch_assoc($exact)) { unset($r['password']); $rows[] = $r; }
        return $rows;
    }

    // 2. FULLTEXT ngram — fast substring search (only if ftx_email_phone exists)
    if (strlen($kw) >= 2) {
        $ft = mysqli_query($conn, "
            SELECT u.*, ad.*
            FROM users u
            INNER JOIN additional_details ad ON u.user_id = ad.user_id
            WHERE MATCH(u.email, u.phone) AGAINST ('$kw' IN BOOLEAN MODE)
            LIMIT 50
        ");
        if ($ft && mysqli_num_rows($ft) > 0) {
            $rows = [];
            while ($r = mysqli_fetch_assoc($ft)) { unset($r['password']); $rows[] = $r; }
            return $rows;
        }
    }

    // 3. Fallback — prefix LIKE (uses B-tree index; only the leading-wildcard variant is slow)
    $like = mysqli_query($conn, "
        SELECT u.*, ad.*
        FROM users u
        INNER JOIN additional_details ad ON u.user_id = ad.user_id
        WHERE u.email LIKE '$kw%' OR u.phone LIKE '$kw%' OR u.name LIKE '$kw%'
        LIMIT 50
    ");
    if ($like && mysqli_num_rows($like) > 0) {
        $rows = [];
        while ($r = mysqli_fetch_assoc($like)) { unset($r['password']); $rows[] = $r; }
        return $rows;
    }

    return false;
}


/* ════════════════════════════════════════
   FETCH INTERNSHIP LIST — calls fetch_internship_list()
   IMPORTANT: returns false when empty, not []
   Columns: all from internship_list table
════════════════════════════════════════ */
if ($action === 'fetch_internship_list') {
    try {
        $result = fetch_internship_list();

        if ($result === false) {
            logErr('fetch_internship_list', 'returned false: ' . mysqli_error($conn));
            $result = [];
        }

        echo json_encode(['status' => 'success', 'data' => $result]);

    } catch (Throwable $e) {
        logErr('fetch_internship_list', 'Throwable: ' . $e->getMessage());
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

/* ════════════════════════════════════════
   FETCH EXAM DATES — calls fetch_exam_dates()
   Returns: [ ['date'=>'...', 'refund'=>'no'|'yes'], ... ]
   NOTE: no 'status' key — refund key instead
════════════════════════════════════════ */
if ($action === 'fetch_exam_dates') {
    try {
        $result = fetch_exam_dates();

        if (!is_array($result)) {
            logErr('fetch_exam_dates', 'returned non-array: ' . mysqli_error($conn));
            $result = [];
        }

        echo json_encode(['status' => 'success', 'data' => $result]);

    } catch (Throwable $e) {
        logErr('fetch_exam_dates', 'Throwable: ' . $e->getMessage());
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

/* ════════════════════════════════════════
   FETCH USER BY KEYWORD — calls fetch_user_by_keyword()
   IMPORTANT: returns false when no match, not []
   Columns: all from users + additional_details (password removed)
════════════════════════════════════════ */
if ($action === 'fetch_user_by_keyword') {
    $keyword = trim($_POST['keyword'] ?? '');

    if (strlen($keyword) < 3) {
        echo json_encode(['status' => 'success', 'data' => []]);
        exit;
    }

    try {
        $result = fetch_user_by_keyword($keyword);

        if ($result === false) {
            $result = [];
        }

        echo json_encode(['status' => 'success', 'data' => $result]);

    } catch (Throwable $e) {
        logErr('fetch_user_by_keyword', 'Throwable: ' . $e->getMessage() . ' keyword:' . $keyword);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

/* ════════════════════════════════════════
   GET SINGLE BY PAYMENT ID — calls get_internship_by_payment_id()
   Used by edit modal to prefill form
════════════════════════════════════════ */
if ($action === 'get_by_payment_id') {
    $payment_id = trim($_POST['payment_id'] ?? '');

    if (empty($payment_id)) {
        echo json_encode(['status' => 'error', 'message' => 'payment_id required']);
        exit;
    }

    try {
        $result = get_internship_by_payment_id($payment_id);

        if ($result === false) {
            logErr('get_by_payment_id', "not found: payment_id=$payment_id");
            echo json_encode(['status' => 'error', 'message' => 'Record not found']);
        } else {
            echo json_encode(['status' => 'success', 'data' => $result]);
        }

    } catch (Throwable $e) {
        logErr('get_by_payment_id', 'Throwable: ' . $e->getMessage());
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit;
}

/* ════════════════════════════════════════
   DELETE INTERNSHIP
   Same as delete_internship in functions.php
   Deletes from internship_payment by payment_id
════════════════════════════════════════ */
if ($action === 'delete_internship') {
    $payment_id = mysqli_real_escape_string($conn, $_POST['payment_id'] ?? '');

    if (empty($payment_id)) {
        logErr('delete_internship', 'payment_id is empty');
        echo json_encode(['status' => 'error', 'message' => 'payment_id is required']);
        exit;
    }

    if (mysqli_query($conn, "DELETE FROM internship_payment WHERE payment_id = '$payment_id'")) {
        echo json_encode(['status' => 'success', 'message' => 'Internship deleted successfully']);
    } else {
        logErr('delete_internship', 'DELETE failed: ' . mysqli_error($conn) . " | payment_id: $payment_id");
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   PROVIDE CERTIFICATE
   Same as provide_certificate in functions.php
════════════════════════════════════════ */
if ($action === 'provide_certificate') {
    $user_id       = (int)($_POST['user_id']       ?? 0);
    $internship_id = (int)($_POST['internship_id'] ?? 0);

    if (!$user_id || !$internship_id) {
        logErr('provide_certificate', "Missing params — user_id:$user_id internship_id:$internship_id");
        echo json_encode(['status' => 'error', 'message' => 'user_id and internship_id are required']);
        exit;
    }

    $check = mysqli_query($conn, "SELECT user_id FROM project_submission
                                  WHERE user_id = $user_id AND internship_id = $internship_id");
    if (!$check) {
        logErr('provide_certificate', 'Check query failed: ' . mysqli_error($conn));
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
        exit;
    }

    if (mysqli_num_rows($check) === 0) {
        $ins = mysqli_query($conn, "INSERT INTO project_submission (user_id, status, internship_id)
                                    VALUES ($user_id, 'approved', $internship_id)");
        if ($ins) {
            $upd = mysqli_query($conn, "UPDATE user_steps SET
                istudio_training_portal    = 1,
                istudio_project_submission = 1
                WHERE user_id = $user_id");
            if (!$upd) {
                logErr('provide_certificate', 'user_steps UPDATE failed: ' . mysqli_error($conn) . " user_id:$user_id");
            }
            echo json_encode(['status' => 'success', 'message' => 'Certificate Issued']);
        } else {
            logErr('provide_certificate', 'INSERT failed: ' . mysqli_error($conn) . " user_id:$user_id internship_id:$internship_id");
            echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
        }
    } else {
        logErr('provide_certificate', "Already issued — user_id:$user_id internship_id:$internship_id");
        echo json_encode(['status' => 'error', 'message' => 'Certificate already issued']);
    }
    exit;
}


/* ════════════════════════════════════════
   ALLOCATE INTERNSHIPS VIA CSV
   IDs: allocated_pay_<YmdHis>_<rand>  and  allocated_ord_<YmdHis>_<rand>
   - Same payment_id is written to BOTH payment_status & internship_payment
     for the same (user_id, internship)
   - When an existing 'initiated' payment_status row is found for the same
     user_id+internship, its status flips to 'success' and its payment_id /
     order_id are updated to the newly generated ones (so joins still work)
════════════════════════════════════════ */
if ($action === 'allocate_internships_csv') {
    $rowsJson = $_POST['rows'] ?? '[]';
    $rows = json_decode($rowsJson, true);

    if (!is_array($rows) || empty($rows)) {
        echo json_encode(['status' => 'error', 'message' => 'No rows provided']);
        exit;
    }

    /* helper: convert "2026-05-14" / "14/05/2026" / "14th May 2026" → "14th May, 2026" */
    $formatBatch = function ($input) {
        $input = trim((string)$input);
        if ($input === '') return null;

        if (preg_match('/^(\d{1,2})(st|nd|rd|th)\s+([A-Za-z]+),?\s+(\d{4})$/i', $input, $m)) {
            $ts = strtotime((int)$m[1] . ' ' . ucfirst(strtolower($m[3])) . ' ' . $m[4]);
            if ($ts === false) return null;
            $input = date('Y-m-d', $ts);
        }

        $ts = false;
        foreach (['Y-m-d','d/m/Y','d-m-Y','m/d/Y','Y/m/d','d.m.Y','d M Y','d F Y'] as $fmt) {
            $dt = DateTime::createFromFormat($fmt, $input);
            if ($dt && $dt->format($fmt) === $input) { $ts = $dt->getTimestamp(); break; }
        }
        if ($ts === false) $ts = strtotime($input);
        if ($ts === false) return null;

        $day = (int)date('j', $ts);
        $mod100 = $day % 100; $mod10 = $day % 10;
        $ord = ($mod100 >= 11 && $mod100 <= 13) ? 'th'
             : ['th','st','nd','rd','th','th','th','th','th','th'][$mod10];
        return $day . $ord . ' ' . date('F', $ts) . ', ' . date('Y', $ts);
    };

    /* helper: unique allocated_* ID with date+time + random */
    $genId = function ($kind) {
        // kind = 'pay' or 'ord'
        return 'allocated_' . $kind . '_' . date('YmdHis') . '_' . bin2hex(random_bytes(4));
    };

    $results = [];
    $now = date('Y-m-d H:i:s');

    foreach ($rows as $row) {
        $email      = trim($row['email'] ?? '');
        $batchInput = trim($row['batch'] ?? '');
        $amount     = (float)($row['amount'] ?? 0);
        $internship = trim($row['internship name'] ?? $row['internship_name'] ?? '');
        $duration   = (int)($row['duration'] ?? 35);

        if ($email === '' || $internship === '') {
            $results[] = ['email' => $email, 'status' => 'error', 'message' => 'Missing email or internship name'];
            continue;
        }

        $batch = $formatBatch($batchInput);
        if (!$batch) {
            $results[] = ['email' => $email, 'status' => 'error', 'message' => 'Invalid batch date: ' . $batchInput];
            continue;
        }

        try {
            $emailEsc = mysqli_real_escape_string($conn, $email);
            $intEsc   = mysqli_real_escape_string($conn, $internship);
            $batchEsc = mysqli_real_escape_string($conn, $batch);

            /* 1. resolve user_id */
            $uRes = mysqli_query($conn, "SELECT user_id FROM users WHERE email = '$emailEsc' LIMIT 1");
            if (!$uRes || mysqli_num_rows($uRes) === 0) {
                $results[] = ['email' => $email, 'status' => 'error', 'message' => 'User not found'];
                continue;
            }
            $user_id = (int)mysqli_fetch_assoc($uRes)['user_id'];

            /* 2. generate fresh allocated_* IDs (shared across both tables) */
            $payment_id = $genId('pay');
            $order_id   = $genId('ord');
            // brief sleep avoids same-second collisions when CSV is huge
            usleep(1000); // 1 ms

            $pidEsc = mysqli_real_escape_string($conn, $payment_id);
            $oidEsc = mysqli_real_escape_string($conn, $order_id);

            /* 3. payment_status: update existing 'initiated', else insert */
            $psRes = mysqli_query($conn, "
                SELECT id FROM payment_status
                WHERE user_id = $user_id
                  AND internship_name COLLATE utf8mb4_unicode_ci = '$intEsc' COLLATE utf8mb4_unicode_ci
                  AND status = 'initiated'
                ORDER BY id DESC LIMIT 1
            ");

            if ($psRes && mysqli_num_rows($psRes) > 0) {
                $psId = (int)mysqli_fetch_assoc($psRes)['id'];
                $upd = mysqli_query($conn, "
                    UPDATE payment_status
                    SET status     = 'success',
                        order_id   = '$oidEsc',
                        payment_id = '$pidEsc',
                        timestamp  = '$now'
                    WHERE id = $psId
                ");
                if (!$upd) logErr('allocate_csv', 'payment_status UPDATE failed: ' . mysqli_error($conn) . " id:$psId");
            } else {
                $ins = mysqli_query($conn, "
                    INSERT INTO payment_status
                    (user_id, order_id, payment_id, amount, internship_name, batch_date, status, timestamp, refund)
                    VALUES ($user_id, '$oidEsc', '$pidEsc', $amount, '$intEsc', '$batchEsc', 'success', '$now', 'no')
                ");
                if (!$ins) logErr('allocate_csv', 'payment_status INSERT failed: ' . mysqli_error($conn) . " email:$email");
            }

            /* 4. internship_payment: skip if (user, internship, batch) already exists */
            $chk = mysqli_query($conn, "
                SELECT id FROM internship_payment
                WHERE user_id = $user_id
                  AND internship COLLATE utf8mb4_unicode_ci = '$intEsc' COLLATE utf8mb4_unicode_ci
                  AND batch     COLLATE utf8mb4_unicode_ci = '$batchEsc' COLLATE utf8mb4_unicode_ci
                LIMIT 1
            ");
            if ($chk && mysqli_num_rows($chk) > 0) {
                $results[] = ['email' => $email, 'status' => 'success', 'message' => 'Already allocated; payment_status updated'];
                continue;
            }

            /* status='completed' included per request — drop it if your schema has no status column */
            $ipIns = mysqli_query($conn, "
    INSERT INTO internship_payment
    (user_id, internship, batch, payment_id, paid_at, batch_freeze, total_duration, internship_level)
    VALUES ($user_id, '$intEsc', '$batchEsc', '$pidEsc', '$now', 0, $duration, 'Silver')
");

            if ($ipIns) {
                $results[] = ['email' => $email, 'status' => 'success', 'message' => 'Allocated', 'payment_id' => $payment_id];
            } else {
                $err = mysqli_error($conn);
                logErr('allocate_csv', 'internship_payment INSERT failed: ' . $err . " email:$email");
                $results[] = ['email' => $email, 'status' => 'error', 'message' => $err];
            }

        } catch (Throwable $e) {
            logErr('allocate_csv', 'Throwable: ' . $e->getMessage() . " email:$email");
            $results[] = ['email' => $email, 'status' => 'error', 'message' => $e->getMessage()];
        }
    }

    echo json_encode(['status' => 'success', 'results' => $results]);
    exit;
}


/* ════════════════════════════════════════
   ADD INTERNSHIP
   Same as add_by_admin.php
   Inserts into internship_payment
════════════════════════════════════════ */
if ($action === 'add_internship') {
    $user_id          = (int)($_POST['user_id']          ?? 0);
    $internship       = mysqli_real_escape_string($conn, $_POST['internship']       ?? '');
    $batch            = mysqli_real_escape_string($conn, $_POST['batch']            ?? '');
    $payment_id       = mysqli_real_escape_string($conn, $_POST['payment_id']       ?? '');
    $total_duration   = (int)($_POST['total_duration']   ?? 35);
    $internship_level = mysqli_real_escape_string($conn, $_POST['internship_level'] ?? 'Silver');
    $refund           = ($_POST['refund'] ?? 'no') === 'yes' ? 'yes' : 'no';
    $paid_at          = date('Y-m-d H:i:s');

    if (!$user_id || !$internship || !$batch) {
        logErr('add_internship', "Missing fields — user_id:$user_id internship:$internship batch:$batch");
        echo json_encode(['status' => 'error', 'message' => 'user_id, internship and batch are required']);
        exit;
    }

    $chk = mysqli_query($conn, "SELECT id FROM internship_payment
                                 WHERE user_id = $user_id AND internship = '$internship' AND batch = '$batch' AND refund = '$refund'");
    if (!$chk) {
        logErr('add_internship', 'Duplicate check failed: ' . mysqli_error($conn));
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
        exit;
    }
    if (mysqli_num_rows($chk) > 0) {
        logErr('add_internship', "Duplicate — user_id:$user_id internship:$internship batch:$batch refund:$refund");
        echo json_encode(['status' => 'error', 'message' => 'This entry already exists for this student and batch']);
        exit;
    }

    $sql = "INSERT INTO internship_payment
            (user_id, internship, batch, payment_id, paid_at, batch_freeze, total_duration, internship_level, refund)
            VALUES ($user_id, '$internship', '$batch', '$payment_id', '$paid_at', 0, $total_duration, '$internship_level', '$refund')";

    if (mysqli_query($conn, $sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Internship added successfully']);
    } else {
        logErr('add_internship', 'INSERT failed: ' . mysqli_error($conn) . " user_id:$user_id internship:$internship");
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   UPDATE INTERNSHIP
   Same as edit_by_admin.php
   Updates internship_payment by payment_id
════════════════════════════════════════ */
if ($action === 'update_internship') {
    $orig_payment_id     = mysqli_real_escape_string($conn, $_POST['payment_id']          ?? '');
    $internship          = mysqli_real_escape_string($conn, $_POST['internship']           ?? '');
    $batch               = mysqli_real_escape_string($conn, $_POST['batch']               ?? '');
    $new_payment_id      = mysqli_real_escape_string($conn, $_POST['new_payment_id']       ?? '');
    $batch_freeze        = (int)($_POST['batch_freeze']        ?? 0);
    $total_duration      = (int)($_POST['total_duration']      ?? 35);
    $internship_level    = mysqli_real_escape_string($conn, $_POST['internship_level']    ?? 'Silver');
    $upgraded_payment_id = mysqli_real_escape_string($conn, $_POST['upgraded_payment_id'] ?? '');
    $refund              = ($_POST['refund'] ?? 'no') === 'yes' ? 'yes' : 'no';

    if (empty($orig_payment_id)) {
        logErr('update_internship', 'orig payment_id empty');
        echo json_encode(['status' => 'error', 'message' => 'payment_id is required']);
        exit;
    }

    $sql = "UPDATE internship_payment SET
            internship          = '$internship',
            batch               = '$batch',
            refund              = '$refund',
            payment_id          = '$new_payment_id',
            batch_freeze        = $batch_freeze,
            total_duration      = $total_duration,
            internship_level    = '$internship_level',
            upgraded_payment_id = '$upgraded_payment_id'
            WHERE payment_id    = '$orig_payment_id'";

    if (mysqli_query($conn, $sql)) {
        echo json_encode(['status' => 'success', 'message' => 'Updated successfully']);
    } else {
        logErr('update_internship', 'UPDATE failed: ' . mysqli_error($conn) . " orig_id:$orig_payment_id");
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   BULK UPLOAD
   Same as upload_bulk_data in functions.php
════════════════════════════════════════ */
if ($action === 'upload_bulk_data') {
    $payment_type = $_POST['payment_type'] ?? 'razorpay';
    $response     = ['success' => false, 'message' => '', 'data' => []];

    if (!isset($_FILES['file'])) {
        logErr('upload_bulk_data', 'No file in $_FILES');
        $response['message'] = 'No file uploaded';
        echo json_encode($response); exit;
    }

    $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
    if ($ext !== 'csv') {
        logErr('upload_bulk_data', 'Invalid file: ' . $_FILES['file']['name']);
        $response['message'] = 'Please upload a CSV file only';
        echo json_encode($response); exit;
    }

    $existingRes = mysqli_query($conn, "SELECT payment_id FROM internship_payment");
    if (!$existingRes) {
        logErr('upload_bulk_data', 'existing IDs query failed: ' . mysqli_error($conn));
        $response['message'] = mysqli_error($conn);
        echo json_encode($response); exit;
    }
    $existingIds = [];
    while ($r = mysqli_fetch_assoc($existingRes)) $existingIds[] = $r['payment_id'];

    $usersRes = mysqli_query($conn, "SELECT user_id, email FROM users");
    if (!$usersRes) {
        logErr('upload_bulk_data', 'users query failed: ' . mysqli_error($conn));
        $response['message'] = mysqli_error($conn);
        echo json_encode($response); exit;
    }
    $usersByEmail = [];
    while ($r = mysqli_fetch_assoc($usersRes)) $usersByEmail[$r['email']] = $r['user_id'];

    $handle = fopen($_FILES['file']['tmp_name'], 'r');
    if (!$handle) {
        logErr('upload_bulk_data', 'Cannot open file');
        $response['message'] = 'Cannot open file';
        echo json_encode($response); exit;
    }

    $header = fgetcsv($handle);
    if (!$header) {
        logErr('upload_bulk_data', 'Cannot read header');
        $response['message'] = 'Cannot read CSV header';
        echo json_encode($response); exit;
    }

    $data   = [];
    $rowNum = 1;

    while (($row = fgetcsv($handle)) !== false) {
        $rowNum++;
        if (count($header) !== count($row)) {
            logErr('upload_bulk_data', "Column mismatch row $rowNum: header=" . count($header) . " row=" . count($row));
            continue;
        }
        $rowData = array_combine($header, $row);

        if ($payment_type === 'razorpay') {
            $amount          = (int)($rowData['amount']          ?? 0);
            $status          = $rowData['status']                ?? '';
            $amount_refunded = (int)($rowData['amount_refunded'] ?? 0);

            if ($status !== 'captured' || $amount_refunded > 0) continue;

            $pid     = $rowData['id']          ?? '';
            $email   = $rowData['email']        ?? '';
            $desc    = $rowData['description']  ?? '';
            $paid_at = $rowData['created_at']   ?? '';

            if (in_array($pid, $existingIds)) continue;

            $uid = $usersByEmail[$email] ?? null;
            if (!$uid) {
                logErr('upload_bulk_data', "Razorpay: no user for email=$email pid=$pid");
                continue;
            }

            $parts = explode('|', $desc, 2);
            $data[] = [
                'user_id'    => $uid,
                'email'      => $email,
                'payment_id' => $pid,
                'amount'     => $amount / 100,
                'internship' => trim($parts[0] ?? '') . '|' . trim($parts[1] ?? ''),
                'paid_at'    => $paid_at,
            ];

        } elseif ($payment_type === 'phonepe') {
            $pid     = $rowData['order_id']       ?? '';
            $email   = $rowData['customer_id']    ?? '';
            $amount  = $rowData['amount']         ?? 0;
            $status  = $rowData['payment_status'] ?? '';
            $paid_at = $rowData['created_at']     ?? '';

            if (strtolower($status) !== 'success') continue;
            if (in_array($pid, $existingIds)) continue;

            $uid = $usersByEmail[$email] ?? null;
            if (!$uid) {
                logErr('upload_bulk_data', "PhonePe: no user for email=$email pid=$pid");
                continue;
            }
            $data[] = ['user_id'=>$uid,'email'=>$email,'payment_id'=>$pid,'amount'=>$amount,'internship'=>'|','paid_at'=>$paid_at];

        } elseif ($payment_type === 'hdfc_smartgateway') {
            $pid     = $rowData['order_id']       ?? '';
            $email   = $rowData['customer_id']    ?? '';
            $amount  = $rowData['amount']         ?? 0;
            $status  = $rowData['payment_status'] ?? '';
            $desc    = $rowData['description']    ?? '';
            $paid_at = $rowData['created_at']     ?? '';

            if (strtolower($status) !== 'success') continue;
            if (in_array($pid, $existingIds)) continue;

            $uid = $usersByEmail[$email] ?? null;
            if (!$uid) {
                logErr('upload_bulk_data', "HDFC: no user for email=$email pid=$pid");
                continue;
            }
            $data[] = ['user_id'=>$uid,'email'=>$email,'payment_id'=>$pid,'amount'=>$amount,'internship'=>$desc.'|','paid_at'=>$paid_at];
        }
    }
    fclose($handle);

    $response['success'] = true;
    $response['data']    = $data;
    echo json_encode($response);
    exit;
}

/* ── fallback ── */
logErr('fallback', "Unknown action='$action' POST=" . json_encode(array_keys($_POST)));
echo json_encode(['status' => 'error', 'message' => 'Invalid action: ' . $action]);
exit;
?>