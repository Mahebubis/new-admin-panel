<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('manage_withdrawal', $jwt);

$page       = intval($_GET['page'] ?? 1);
$per_page   = min(intval($_GET['per_page'] ?? 20), 100);
$search     = $_GET['search']     ?? '';
$status     = $_GET['status']     ?? '';
$start_date = $_GET['start_date'] ?? $_GET['startDate'] ?? '';
$end_date   = $_GET['end_date']   ?? $_GET['endDate']   ?? '';

$url = "https://dashboard.internshipstudio.com/api/get_withdrawal_request.php?"
     . "page=$page"
     . "&per_page=$per_page"
     . "&search="     . urlencode($search)
     . "&status="     . urlencode($status)
     . "&start_date=" . urlencode($start_date)
     . "&end_date="   . urlencode($end_date)
     . "&startDate="  . urlencode($start_date)   // send both formats — external API may use either
     . "&endDate="    . urlencode($end_date);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
]);
$response = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error     = curl_error($ch);
curl_close($ch);

if ($error || $httpCode >= 400) {
    // ── Fallback: local DB ──
    [$pg, $per_page_local, $offset] = get_pagination();

    $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM withdrawal_request");
    $stmt->execute();
    $total = $stmt->get_result()->fetch_assoc()['c'] ?? 0;

    $sql = "SELECT w.id AS withdrawal_id, w.user_id,
                   u.name AS student_name, u.email, u.photo,
                   w.payment_amount AS amount,
                   COALESCE(w.upi_id,'') AS upi_id,
                   w.payment_status AS status,
                   w.transaction_screenshot,
                   DATE(w.created_at) AS requested_at
            FROM withdrawal_request w
            JOIN users u ON u.user_id = w.user_id
            ORDER BY w.created_at DESC
            LIMIT ? OFFSET ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ii', $per_page_local, $offset);
    $stmt->execute();
    $withdrawals = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    // Normalize proof field for frontend
    foreach ($withdrawals as &$w) {
        $w['proof'] = $w['transaction_screenshot'] ?? '';
    }
    unset($w);

    api_success(['withdrawals' => $withdrawals, 'total' => (int)$total, 'page' => $pg]);
    return;
}

$data = json_decode($response, true);

if ($data) {
    $withdrawals = [];
    foreach (($data['data'] ?? []) as $item) {

        // ── Resolve proof URL from all possible field names the external API might use ──
        $proof = $item['transaction_screenshot']
              ?? $item['screenshot']
              ?? $item['proof']
              ?? $item['payment_screenshot']
              ?? $item['receipt']
              ?? $item['attachment']
              ?? '';

        $withdrawals[] = [
            'withdrawal_id'          => $item['id']             ?? '',
            'user_id'                => $item['user_id']        ?? '',
            'name'                   => $item['name']           ?? '',
            'email'                  => $item['email']          ?? '',
            'photo'                  => $item['photo']          ?? '',
            'upi_id'                 => $item['upi_id']         ?? '',
            'payment_status'         => $item['payment_status'] ?? $item['status'] ?? 'pending',
            'payment_amount'         => $item['payment_amount'] ?? $item['amount'] ?? 0,
            'transaction_screenshot' => $proof,
            'proof'                  => $proof,   // send under both keys so frontend always finds it
            'requested_at'           => $item['requested_at']   ?? $item['created_at'] ?? '',
        ];
    }

    $pagination = $data['pagination'] ?? [];
    api_success([
        'withdrawals' => $withdrawals,
        'total'       => $pagination['total']       ?? count($withdrawals),
        'page'        => $pagination['page']        ?? $page,
        'total_pages' => $pagination['total_pages'] ?? 1,
    ]);
} else {
    api_error('Failed to fetch withdrawal data', 502);
}