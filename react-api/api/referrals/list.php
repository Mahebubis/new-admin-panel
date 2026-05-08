<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();
require_permission('manage_referrals', $jwt);

// The original PHP referral page fetches from dashboard.internshipstudio.com
// We proxy the same call here
$page = intval($_GET['page'] ?? 1);
$search = $_GET['search'] ?? '';
$status = $_GET['status'] ?? '';
$from_date = $_GET['from_date'] ?? '';
$to_date = $_GET['to_date'] ?? '';

// AFTER — pass per_page explicitly
$per_page = intval($_GET['per_page'] ?? 20);

$url = "https://dashboard.internshipstudio.com/api/get_referral_request.php?"
     . "page=$page"
     . "&per_page=$per_page"
     . "&search=" . urlencode($search)
     . "&status=" . urlencode($status)
     . "&from_date=" . urlencode($from_date)
     . "&to_date=" . urlencode($to_date);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER => ['Accept: application/json'],
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error || $httpCode >= 400) {
    // Fallback: query local DB
    [$pg, $per_page, $offset] = get_pagination();
    $searchTerm = get_search();

    $where = "WHERE EXISTS(SELECT 1 FROM referrals r WHERE r.referrer_user_id = u.user_id)";
    $params = []; $types = '';
    if ($searchTerm) { $like = "%$searchTerm%"; $where .= " AND (u.name LIKE ? OR u.email LIKE ?)"; $params = [$like,$like]; $types = 'ss'; }

    $stmt = $conn->prepare("SELECT COUNT(DISTINCT u.user_id) AS c FROM users u $where");
    if ($params) $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $total = $stmt->get_result()->fetch_assoc()['c'];

    $sql = "
        SELECT u.user_id, u.name AS referrer_name, u.email AS referrer_email, u.photo,
               CASE WHEN u.active=1 THEN 'active' ELSE 'inactive' END AS status,
               DATE(u.registered_at) AS joined_at,
               COUNT(DISTINCT r.id) AS referred_count,
               COALESCE(SUM(re.amount),0) AS total_earnings
        FROM users u
        LEFT JOIN referrals r ON r.referrer_user_id = u.user_id
        LEFT JOIN referral_earnings re ON re.referral_id = r.id
        $where GROUP BY u.user_id ORDER BY total_earnings DESC LIMIT ? OFFSET ?
    ";
    $stmt = $conn->prepare($sql);
    $allParams = array_merge($params, [$per_page, $offset]);
    $stmt->bind_param($types . 'ii', ...$allParams);
    $stmt->execute();
    $referrals = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    api_success(['referrals' => $referrals, 'total' => (int)$total, 'page' => $pg]);
}

// Parse dashboard API response
$data = json_decode($response, true);

if ($data && ($data['status'] ?? '') === 'success') {
    $referrals = [];
    foreach (($data['data'] ?? []) as $item) {
        $referrals[] = [
            'user_id' => $item['user_id'] ?? '',
            'referrer_name' => $item['name'] ?? '',
            'referrer_email' => $item['email'] ?? '',
            'photo' => $item['photo'] ?? '',
            'status' => $item['status'] ?? 'pending',
            'answer1' => $item['answer1'] ?? '',
            'answer2' => $item['answer2'] ?? '',
            'joined_at' => $item['requested_at'] ?? '',
        ];
    }
    api_success([
        'referrals' => $referrals,
        'total' => $data['pagination']['total'] ?? count($referrals),
        'page' => $data['pagination']['page'] ?? $page,
        'total_pages' => $data['pagination']['total_pages'] ?? 1,
    ]);
} else {
    api_error('Failed to fetch referral data', 502);
}
