<?php
/*
 * /api/sync-exam-users.php
 *
 * POST action=preview   → users with applyforexam=1 who have no exam_credentials yet
 * POST action=run_sync  → for each such user: gen password, insert conn2.users +
 *                          exam_credentials + update_student_step
 *                          Returns: total found, added, skipped
 *
 * Mirrors the PHP page logic exactly.
 * Tables: users (conn / istudio_cit), exam_credentials (conn), user_steps (conn)
 *         users (conn2 / exam DB)
 */
ini_set('display_errors', 0);
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn, $conn2;
if (!$conn) { echo json_encode(['success'=>false,'message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ── same generate_secure_password as helper.php ── */
function gen_password() {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    return substr(str_shuffle($chars), 0, 16);
}

/* ── fetch eligible users (applyforexam=1, not id=1) ── */
function fetchEligibleUsers($conn) {
    $res  = $conn->query("SELECT user_id, name, email, phone FROM users WHERE applyforexam = 1");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) {
        if ($r['user_id'] == 1) continue;
        $rows[$r['user_id']] = $r;
    }
    return $rows;
}

/* ══════════════════════════════════════
   PREVIEW  — show who needs credentials
══════════════════════════════════════ */
if ($action === 'preview') {
    $users    = fetchEligibleUsers($conn);
    $needSync = [];
    $hasSync  = [];

    foreach ($users as $user) {
        $id  = (int)$user['user_id'];
        $chk = $conn->query("SELECT user_id FROM exam_credentials WHERE user_id = $id");
        if ($chk && $chk->num_rows === 0) {
            $needSync[] = ['id'=>$id,'name'=>$user['name'],'email'=>$user['email'],'phone'=>$user['phone']];
        } else {
            $hasSync[]  = ['id'=>$id,'name'=>$user['name'],'email'=>$user['email']];
        }
    }

    echo json_encode([
        'success'       => true,
        'total'         => count($users),
        'need_sync'     => $needSync,
        'already_synced'=> $hasSync,
        'need_count'    => count($needSync),
        'synced_count'  => count($hasSync),
    ]);
    exit;
}

/* ══════════════════════════════════════
   RUN SYNC  — exact port of PHP page logic
══════════════════════════════════════ */
if ($action === 'run_sync') {
    $users   = fetchEligibleUsers($conn);
    $added   = 0;
    $skipped = 0;
    $errors  = [];

    foreach ($users as $user) {
        $id    = (int)$user['user_id'];
        $name  = $conn->real_escape_string($user['name']);
        $email = $conn->real_escape_string($user['email']);
        $phone = $conn->real_escape_string($user['phone']);

        // Check if already has credentials (same as PHP)
        $chk = $conn->query("SELECT user_id FROM exam_credentials WHERE user_id = $id");
        if ($chk && $chk->num_rows > 0) { $skipped++; continue; }

        // Generate password (same function)
        $securePass = gen_password();
        $hash       = md5($securePass);

        // Insert into exam DB users via conn2 (same INSERT IGNORE as PHP)
        if ($conn2) {
            $stmt = $conn2->prepare("INSERT IGNORE INTO users (user_id, user_name, user_email, user_phone, user_role_id, user_pass, otp, active, banned, user_from) VALUES (?, ?, ?, ?, 5, ?, 0, 1, 0, now())");
            $stmt->bind_param('issss', $id, $user['name'], $user['email'], $user['phone'], $hash);
            if (!$stmt->execute()) {
                $errors[] = "conn2 insert failed for user $id: ".$stmt->error;
            }
        }

        // Insert exam_credentials
        $conn->query("INSERT INTO exam_credentials (user_id, password) VALUES ($id, '$securePass')");

        // update_student_step (mirrors PHP call)
        if (function_exists('update_student_step')) {
            update_student_step($id, 'cit_exam_details', 1);
        }

        $added++;
    }

    echo json_encode([
        'success'  => true,
        'total'    => count($users),
        'added'    => $added,
        'skipped'  => $skipped,
        'errors'   => $errors,
        'message'  => count($users) . " users in user database. $added users added to exam database.",
    ]);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Invalid action']);
exit;
?>