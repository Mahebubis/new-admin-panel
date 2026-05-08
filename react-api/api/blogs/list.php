<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';
require_method('GET');
$jwt = require_jwt();

// The original PHP blog page fetches from dashboard.internshipstudio.com
$action = $_GET['action'] ?? 'get_data';
$id = $_GET['id'] ?? '';

$url = "https://dashboard.internshipstudio.com/api/post_blogs.php?action=" . urlencode($action);
if ($id) $url .= "&id=" . urlencode($id);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_SSL_VERIFYPEER => false,
]);
$response = curl_exec($ch);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    api_error("Failed to fetch blogs: $error", 502);
}

$data = json_decode($response, true);

if ($data && ($data['status'] ?? '') === 'success') {
    $blogs = [];
    foreach (($data['data'] ?? []) as $item) {
        $blogs[] = [
            'blog_id' => $item['id'] ?? '',
            'title' => $item['title'] ?? '',
            'category' => $item['category'] ?? '',
            'status' => $item['status'] ?? 'draft',
            'published_at' => $item['published_at'] ?? '',
            'author' => $item['author'] ?? 'Admin',
            'created_at' => $item['created_at'] ?? $item['published_at'] ?? '',
        ];
    }
    api_success(['blogs' => $blogs, 'total' => count($blogs), 'page' => 1]);
} else {
    // Fallback: try local blogs table
    $res = $conn->query("SELECT blog_id, title, COALESCE(category,'') AS category, COALESCE(author,'Admin') AS author, status, COALESCE(views,0) AS views, DATE(created_at) AS created_at FROM blogs ORDER BY created_at DESC LIMIT 100");
    $blogs = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    api_success(['blogs' => $blogs, 'total' => count($blogs), 'page' => 1]);
}
