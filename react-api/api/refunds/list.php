<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/cache.php';
require_once __DIR__ . '/../../middleware/auth.php';

/* ─── helpers ─── */
function rl_calculateAttendance($conn, $user_id, $batch) {
    if (!$batch) return 0;
    $cleanBatch = preg_replace('/(\d+)(st|nd|rd|th)/i', '$1', $batch);
    try { $start = new DateTime($cleanBatch); } catch (Exception $e) { return 0; }
    $end = clone $start; $end->modify('+29 days');
    $startStr = $start->format('Y-m-d'); $endStr = $end->format('Y-m-d');
    $sql = "SELECT COUNT(DISTINCT DATE(login_date)) AS present_days FROM user_login_activity WHERE user_id=? AND DATE(login_date) BETWEEN ? AND LEAST(?,CURDATE()) AND activity_level >= 1";
    $stmt = $conn->prepare($sql); $stmt->bind_param("iss", $user_id, $startStr, $endStr); $stmt->execute();
    $present = (int)($stmt->get_result()->fetch_assoc()['present_days'] ?? 0);
    return round(($present / 30) * 100, 1);
}

function rl_getDurationInMonths($days) {
    if (!$days) return '—';
    if ($days <= 35) return '1 month';
    if ($days <= 65) return '2 months';
    if ($days <= 95) return '3 months';
    if ($days <= 125) return '4 months';
    if ($days <= 155) return '5 months';
    return '6 months';
}

function rl_wrapEmail($html) {
    $year = date('Y');
    return "<!DOCTYPE html><html><head><meta charset='utf-8'><style>
body{margin:0;padding:0;background:#f0faf8;font-family:'Segoe UI',Arial,sans-serif;}
.wrap{max-width:620px;margin:32px auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);}
.hdr{background:linear-gradient(135deg,#0d2137,#164a3e);padding:28px 32px;text-align:center;}
.hdr h2{color:#fff;font-size:18px;margin:12px 0 0;font-weight:700;}
.body{padding:32px 36px;font-size:14px;color:#1a2e2b;line-height:1.7;}
.foot{background:#f0faf8;border-top:1px solid #d4efeb;padding:18px 32px;text-align:center;font-size:11px;color:#6b8f8a;}
</style></head><body><div class='wrap'><div class='hdr'><h2>Internship Studio</h2></div><div class='body'>{$html}</div><div class='foot'>&copy; {$year} Internship Studio | This is an automated email.</div></div></body></html>";
}

$jwt = require_jwt();
require_permission('manage_refund', $jwt);

/* ─── GET: Fetch refund list ─── */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    $page     = max(1, (int)($_GET['page'] ?? 1));
    $per_page = max(1, min(100, (int)($_GET['per_page'] ?? 20)));
    $search   = trim($_GET['search'] ?? '');
    $status   = trim($_GET['status'] ?? '');
    $batch    = trim($_GET['batch'] ?? '');

    /* Base SELECT & FROM */
    $selectCols = "ip.id AS payment_row_id, ip.user_id, u.name, u.email, u.phone AS contact,
        u.registered_at, ip.internship AS internship_name, il.id AS internship_id,
        ip.batch, ip.total_duration, ip.paid_at, ip.payment_id,
        ps.id AS ps_id, ps.status AS project_status, ps.file_link,
        ps.created_at AS project_submitted_date,
        CASE WHEN ps.status='approved' THEN ps.updated_at END AS project_approved_date,
        rc.id AS claim_id, rc.status AS refund_claim_status, rc.admin_notes,
        rc.processed_at, rc.proof_url";

    $from = "FROM internship_payment ip
        INNER JOIN users u ON u.user_id = ip.user_id
        LEFT JOIN internship_list il ON il.internship_name = ip.internship
        LEFT JOIN refund_claims rc ON rc.user_id = ip.user_id AND rc.internship_id = il.id
        LEFT JOIN project_submission ps ON ps.user_id = ip.user_id AND ps.internship_id = il.id
        WHERE ip.refund = 'yes'";

    $params = [];
    $types  = '';
    $where  = '';

    /* Search filter */
    if ($search !== '') {
        $like = '%' . $search . '%';
        $where .= " AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR ip.internship LIKE ? OR ip.payment_id LIKE ?)";
        $params = array_merge($params, [$like, $like, $like, $like, $like]);
        $types .= 'sssss';
    }

    /* Batch filter */
    if ($batch !== '') {
        $where .= " AND ip.batch = ?";
        $params[] = $batch;
        $types .= 's';
    }

    /* Status filter (SQL-level) */
    $phpPostFilter = '';
    if ($status !== '' && !in_array($status, ['completed', 'active'])) {
        switch ($status) {
            case 'under_review':
                $where .= " AND rc.status = 'under_review'";
                break;
            case 'refunded':
                $where .= " AND rc.status = 'refunded'";
                break;
            case 'rejected':
                $where .= " AND rc.status = 'rejected'";
                break;
            case 'project_submitted':
                $where .= " AND ps.status = 'pending'";
                break;
            case 'project_approved':
                $where .= " AND ps.status = 'approved'";
                break;
            case 'project_rejected':
                $where .= " AND ps.status = 'rejected'";
                break;
        }
    } elseif ($status === 'completed' || $status === 'active') {
        $where .= " AND rc.id IS NULL";
        $phpPostFilter = $status;
    }

    $orderBy = " ORDER BY CASE WHEN rc.status = 'under_review' THEN 0 ELSE 1 END ASC, ip.paid_at DESC, u.name ASC";

    /* ── Stats: count each category from full result set ── */
    $statsWhere = '';
    $statsParams = [];
    $statsTypes  = '';
    if ($search !== '') {
        $statsWhere .= " AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR ip.internship LIKE ? OR ip.payment_id LIKE ?)";
        $statsParams = array_merge($statsParams, [$like, $like, $like, $like, $like]);
        $statsTypes .= 'sssss';
    }
    if ($batch !== '') {
        $statsWhere .= " AND ip.batch = ?";
        $statsParams[] = $batch;
        $statsTypes .= 's';
    }

    $statsSql = "SELECT $selectCols $from $statsWhere $orderBy";
    $statsStmt = $conn->prepare($statsSql);
    if ($statsTypes) $statsStmt->bind_param($statsTypes, ...$statsParams);
    $statsStmt->execute();
    $allRows = $statsStmt->get_result()->fetch_all(MYSQLI_ASSOC);

    $statsCount = [
        'total' => 0, 'under_review' => 0, 'refunded' => 0, 'rejected' => 0,
        'completed' => 0, 'active' => 0,
        'project_submitted' => 0, 'project_approved' => 0, 'project_rejected' => 0
    ];

    foreach ($allRows as &$row) {
        $row['attendance'] = rl_calculateAttendance($conn, $row['user_id'], $row['batch']);
        $row['duration'] = rl_getDurationInMonths($row['total_duration']);

        $statsCount['total']++;

        if ($row['refund_claim_status'] === 'under_review') {
            $statsCount['under_review']++;
        } elseif ($row['refund_claim_status'] === 'refunded') {
            $statsCount['refunded']++;
        } elseif ($row['refund_claim_status'] === 'rejected') {
            $statsCount['rejected']++;
        } elseif ($row['project_status'] === 'pending') {
            $statsCount['project_submitted']++;
        } elseif ($row['project_status'] === 'approved') {
            if ($row['attendance'] >= 100) {
                $statsCount['completed']++;
            } else {
                $statsCount['project_approved']++;
            }
        } elseif ($row['project_status'] === 'rejected') {
            $statsCount['project_rejected']++;
        } else {
            // No claim, no project submission
            if (!$row['ps_id']) {
                $statsCount['active']++;
            }
        }
    }
    unset($row);

    /* ── Fetch filtered rows ── */
    if ($phpPostFilter !== '') {
        // completed or active requires PHP post-filtering
        $filtered = [];
        foreach ($allRows as $row) {
            if ($row['refund_claim_status']) continue; // has claim, skip

            if ($phpPostFilter === 'completed') {
                if ($row['project_status'] === 'approved' && $row['attendance'] >= 100) {
                    $filtered[] = $row;
                }
            } elseif ($phpPostFilter === 'active') {
                // active = no claim, not completed, no project submission
                $isCompleted = ($row['project_status'] === 'approved' && $row['attendance'] >= 100);
                if (!$isCompleted && !$row['ps_id']) {
                    $filtered[] = $row;
                }
            }
        }
        $totalFiltered = count($filtered);
        $totalPages = max(1, ceil($totalFiltered / $per_page));
        $page = min($page, $totalPages);
        $offset = ($page - 1) * $per_page;
        $refunds = array_slice($filtered, $offset, $per_page);
    } else {
        // SQL-level filtering already done; re-query with LIMIT or slice from allRows
        // For status-filtered queries, we need a separate count + paginated fetch
        $countSql = "SELECT COUNT(*) AS cnt $from $where";
        $countStmt = $conn->prepare($countSql);
        if ($types) $countStmt->bind_param($types, ...$params);
        $countStmt->execute();
        $totalFiltered = (int)$countStmt->get_result()->fetch_assoc()['cnt'];

        $totalPages = max(1, ceil($totalFiltered / $per_page));
        $page = min($page, $totalPages);
        $offset = ($page - 1) * $per_page;

        $dataSql = "SELECT $selectCols $from $where $orderBy LIMIT ? OFFSET ?";
        $dataParams = $params;
        $dataTypes  = $types;
        $dataParams[] = $per_page;
        $dataParams[] = $offset;
        $dataTypes .= 'ii';

        $dataStmt = $conn->prepare($dataSql);
        $dataStmt->bind_param($dataTypes, ...$dataParams);
        $dataStmt->execute();
        $refunds = $dataStmt->get_result()->fetch_all(MYSQLI_ASSOC);

        // Calculate attendance and duration for paginated rows
        foreach ($refunds as &$row) {
            $row['attendance'] = rl_calculateAttendance($conn, $row['user_id'], $row['batch']);
            $row['duration'] = rl_getDurationInMonths($row['total_duration']);
        }
        unset($row);
    }

    /* ── Batches ── */
    $batchSql = "SELECT DISTINCT ip.batch FROM internship_payment ip WHERE ip.refund = 'yes' AND ip.batch IS NOT NULL AND ip.batch != '' ORDER BY STR_TO_DATE(REGEXP_REPLACE(ip.batch, '(st|nd|rd|th)', ''), '%d %M, %Y') ASC";
    $batchResult = $conn->query($batchSql);
    $batches = [];
    while ($b = $batchResult->fetch_assoc()) {
        $batches[] = $b['batch'];
    }

    api_success([
        'refunds'     => $refunds,
        'total'       => $totalFiltered,
        'total_pages' => $totalPages,
        'page'        => $page,
        'batches'     => $batches,
        'stats'       => $statsCount,
    ]);
}

/* ─── POST: Handle actions ─── */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // Handle file upload (multipart) vs JSON body
    $action = $_POST['action'] ?? '';
    if (!$action) {
        $body = json_decode(file_get_contents('php://input'), true);
        $action = $body['action'] ?? '';
    } else {
        $body = $_POST;
    }

    switch ($action) {

        /* ── Update refund claim ── */
        case 'update_refund_claim':
            $user_id       = (int)($body['user_id'] ?? 0);
            $internship_id = (int)($body['internship_id'] ?? 0);
            $claimStatus   = $body['status'] ?? '';
            $admin_notes   = $body['admin_notes'] ?? '';
            $proof_url     = $body['proof_url'] ?? '';

            if (!$user_id || !$internship_id || !in_array($claimStatus, ['under_review', 'refunded', 'rejected'])) {
                api_error('Invalid parameters', 400);
            }

            $sql = "UPDATE refund_claims SET status=?, admin_notes=?, proof_url=?, processed_at=IF(? IN ('refunded','rejected'),NOW(),processed_at), updated_at=NOW() WHERE user_id=? AND internship_id=?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("ssssii", $claimStatus, $admin_notes, $proof_url, $claimStatus, $user_id, $internship_id);
            $stmt->execute();

            if ($stmt->affected_rows >= 0) {
                api_success([], 'Refund claim updated successfully');
            } else {
                api_error('Failed to update refund claim', 500);
            }
            break;

        /* ── Approve project ── */
        case 'approve_project':
            $user_id       = (int)($body['user_id'] ?? 0);
            $internship_id = (int)($body['internship_id'] ?? 0);

            if (!$user_id || !$internship_id) {
                api_error('Invalid parameters', 400);
            }

            $sql = "UPDATE project_submission SET status='approved', updated_at=NOW() WHERE user_id=? AND internship_id=?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("ii", $user_id, $internship_id);
            $stmt->execute();

            api_success([], 'Project approved successfully');
            break;

        /* ── Decline project ── */
        case 'decline_project':
            $user_id       = (int)($body['user_id'] ?? 0);
            $internship_id = (int)($body['internship_id'] ?? 0);
            $reason        = $body['reason'] ?? '';

            if (!$user_id || !$internship_id) {
                api_error('Invalid parameters', 400);
            }

            $sql = "UPDATE project_submission SET status='rejected', reject_reason=?, updated_at=NOW() WHERE user_id=? AND internship_id=?";
            $stmt = $conn->prepare($sql);
            $stmt->bind_param("sii", $reason, $user_id, $internship_id);
            $stmt->execute();

            api_success([], 'Project declined successfully');
            break;

        /* ── Send email ── */
        case 'send_email':
            $to      = $body['to'] ?? '';
            $subject = $body['subject'] ?? '';
            $html    = $body['html'] ?? '';

            if (!$to || !$subject || !$html) {
                api_error('Missing email parameters', 400);
            }

            $emailBody = rl_wrapEmail($html);
            $headers = "MIME-Version: 1.0\r\nContent-type: text/html; charset=UTF-8\r\nFrom: Internship Studio <noreply@internshipstudio.com>\r\n";
            $sent = mail($to, $subject, $emailBody, $headers);

            if ($sent) {
                api_success([], 'Email sent successfully');
            } else {
                api_error('Failed to send email', 500);
            }
            break;

        /* ── Upload proof ── */
        case 'upload_proof':
            if (!isset($_FILES['proof']) || $_FILES['proof']['error'] !== UPLOAD_ERR_OK) {
                api_error('No file uploaded or upload error', 400);
            }

            $uploadDir = __DIR__ . '/../../uploads/refund_proofs/';
            if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
            $ext = pathinfo($_FILES['proof']['name'], PATHINFO_EXTENSION);
            $filename = 'proof_' . uniqid() . '.' . $ext;
            move_uploaded_file($_FILES['proof']['tmp_name'], $uploadDir . $filename);
            $url = 'https://cit3.internshipstudio.com/admin/react-api/uploads/refund_proofs/' . $filename;

            api_success(['url' => $url], 'Proof uploaded successfully');
            break;

        default:
            api_error('Unknown action', 400);
    }
}
