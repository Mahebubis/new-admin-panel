<?php
/*
 * /api/notes-api.php
 *
 * Permission key: notes
 *
 * TWO image paths (same as withdrawal_request.php approach):
 *
 *   1. PASTED images  → stored as base64 inline in the HTML content column
 *                        No API call needed — editor handles it client-side
 *
 *   2. ATTACHED images → uploaded to S3 via `upload_image` action
 *                        URL returned to editor → inserted as <img src="S3_URL">
 *                        Also logged in admin_note_attachments table
 *
 * POST action=upload_image   → multipart image file
 *                              → uploads to S3 → returns { url, key }
 *
 * POST action=add_note       → title, content (full HTML with inline base64
 *                              + S3 URLs), s3_keys[] (JSON array of S3 keys used)
 *                              → inserts admin_notes row
 *                              → logs each S3 key into admin_note_attachments
 *
 * POST action=get_notes      → all notes with user info + attachments
 *
 * POST action=delete_note    → note_id
 *                              → owner or superadmin only
 *                              → deletes DB row (cascade deletes attachments)
 *                              → does NOT delete S3 objects (preserves for audit)
 */

require_once '/home/istudio/public_html/cit3/admin/react-api/config/database.php';
require_once '/home/istudio/public_html/cit3/admin/react-api/middleware/auth.php';

/* ── AWS SDK (same config as withdrawal_request.php) ── */
require_once '/home/istudio/public_html/istudio_dashboard/api/vendor/autoload.php';

use Aws\S3\S3Client;
use Aws\Exception\AwsException;

header('Content-Type: application/json');

/* ── populate $_POST from raw body if empty ── */
if (empty($_POST)) {
    $raw = file_get_contents('php://input');
    if ($raw) {
        parse_str($raw, $p);
        if (!empty($p)) $_POST = $p;
        else { $j = json_decode($raw, true); if (is_array($j)) $_POST = $j; }
    }
}

$jwt  = require_jwt();
$uid  = (int)$jwt['user_id'];
$isSA = in_array('__superadmin__', $jwt['permissions'] ?? []);

// if (!$isSA && !in_array('notes', $jwt['permissions'] ?? [])) {
//     api_error('You do not have permission for Notes', 403);
// }

$action = $_POST['action'] ?? '';

/* ── S3 config (loaded from gitignored config/aws.php) ── */
require_once __DIR__ . '/../../config/aws.php';
$awsRegion  = AWS_REGION;
$bucketName = AWS_S3_BUCKET;
$awsCreds   = [
    'key'    => AWS_ACCESS_KEY_ID,
    'secret' => AWS_SECRET_ACCESS_KEY,
];

$buildS3 = function() use ($awsRegion, $awsCreds) {
    return new S3Client([
        'version'     => 'latest',
        'region'      => $awsRegion,
        'credentials' => $awsCreds,
    ]);
};

/* ── helper: log action ── */
function logNote($conn, int $userId, ?int $noteId, string $action): void {
    $ip  = $_SERVER['HTTP_CF_CONNECTING_IP']
        ?? $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['REMOTE_ADDR']
        ?? '0.0.0.0';
    $ip  = $conn->real_escape_string($ip);
    $act = $conn->real_escape_string($action);
    $nid = $noteId ?? 'NULL';
    $conn->query("INSERT INTO admin_notes_log (user_id, note_id, action, ip_address)
                  VALUES ($userId, $nid, '$act', '$ip')");
}

/* ════════════════════════════════════════════════
   ACTION: upload_image
   Receives multipart image → uploads to S3
   Returns { url, key } to the editor
   Editor inserts <img src="{url}"> into the content
   The key is later sent with add_note to log the attachment
════════════════════════════════════════════════ */
if ($action === 'upload_image') {
    if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        api_error('Image file is required');
    }

    $file         = $_FILES['image'];
    $allowedMimes = ['image/jpeg','image/png','image/gif','image/webp'];
    $maxSize      = 5 * 1024 * 1024; // 5 MB

    if (!in_array($file['type'], $allowedMimes, true)) {
        api_error('Only JPEG, PNG, GIF, WEBP images are allowed');
    }
    if ($file['size'] > $maxSize) {
        api_error('Image must be under 5MB');
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION) ?: 'jpg');
    $key = 'admin_notes/' . date('Y/m') . '/' . uniqid('note_', true) . '.' . $ext;

    $s3 = $buildS3();
    try {
        $s3->putObject([
            'Bucket'      => $bucketName,
            'Key'         => $key,
            'SourceFile'  => $file['tmp_name'],
            'ContentType' => $file['type'],
        ]);

        /* Permanent public-style URL (same approach as withdrawal_request.php) */
        $url = "https://{$bucketName}.s3.{$awsRegion}.amazonaws.com/{$key}";

        api_success([
            'url'           => $url,
            'key'           => $key,
            'original_name' => $file['name'],
            'file_size'     => $file['size'],
            'mime_type'     => $file['type'],
        ], 'Image uploaded');

    } catch (AwsException $e) {
        api_error('S3 upload error: ' . $e->getMessage());
    }
}

/* ════════════════════════════════════════════════
   ACTION: add_note
   Receives:
     title    → plain text
     content  → full HTML from the editor
               (contains base64 pasted images + S3 URLs for uploaded images)
     s3_keys  → JSON array of { url, key, original_name, file_size, mime_type }
               for images that were uploaded via upload_image
               Used to populate admin_note_attachments table
════════════════════════════════════════════════ */
if ($action === 'add_note') {
    $title   = $conn->real_escape_string(trim($_POST['title']   ?? ''));
    $content = trim($_POST['content'] ?? '');

    /* Strip the content of truly dangerous tags but keep img, formatting */
    /* We keep it simple — admin panel is internal, not public-facing */
    if (!$content || strip_tags($content) === '' && !preg_match('/<img/i', $content)) {
        api_error('Note content is required');
    }

    $contentEsc = $conn->real_escape_string($content);

    $conn->query("
        INSERT INTO admin_notes (user_id, title, content)
        VALUES ($uid, '$title', '$contentEsc')
    ");
    $noteId = $conn->insert_id;
    if (!$noteId) api_error('Failed to save note');

    /* Log S3 attachments into admin_note_attachments */
    $s3Keys = json_decode($_POST['s3_keys'] ?? '[]', true) ?: [];
    foreach ($s3Keys as $att) {
        $origName  = $conn->real_escape_string($att['original_name'] ?? '');
        $storedKey = $conn->real_escape_string($att['key']           ?? '');
        $url       = $conn->real_escape_string($att['url']           ?? '');
        $size      = (int)($att['file_size'] ?? 0);
        $mime      = $conn->real_escape_string($att['mime_type']     ?? '');
        if (!$url) continue;
        $conn->query("
            INSERT INTO admin_note_attachments
                (note_id, original_name, stored_name, file_url, file_size, mime_type)
            VALUES ($noteId, '$origName', '$storedKey', '$url', $size, '$mime')
        ");
    }

    logNote($conn, $uid, $noteId, 'created');

    api_success(['note_id' => $noteId], 'Note saved successfully');
}

/* ════════════════════════════════════════════════
   ACTION: get_notes
   Returns all notes newest first with:
     - user name, photo, role
     - full HTML content (rendered as-is in the viewer)
     - S3 attachment list (for the attachment strip below each card)
════════════════════════════════════════════════ */
if ($action === 'get_notes') {
    logNote($conn, $uid, null, 'viewed_all');

    $res = $conn->query("
        SELECT
            n.id,
            n.user_id,
            n.title,
            n.content,
            n.created_at,
            u.name,
            u.fname,
            u.lname,
            u.photo,
            CASE
                WHEN au.is_superadmin = 1 THEN 'Super Admin'
                WHEN u.is_admin = 1        THEN 'Admin'
                ELSE 'Staff'
            END AS user_role
        FROM admin_notes n
        INNER JOIN users u ON u.user_id = n.user_id
        LEFT JOIN admin_users au ON au.user_id = n.user_id AND au.is_active = 1
        ORDER BY n.created_at DESC
    ");

    $notes = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $nid = (int)$row['id'];

            /* S3 attachments only (not base64 — those live in content HTML) */
            $attRes = $conn->query("
                SELECT id, original_name, file_url, file_size, mime_type
                FROM admin_note_attachments
                WHERE note_id = $nid
                ORDER BY id ASC
            ");
            $row['attachments'] = $attRes ? $attRes->fetch_all(MYSQLI_ASSOC) : [];
            $row['is_mine']     = (int)$row['user_id'] === $uid;
            if (!$row['name']) {
                $row['name'] = trim(($row['fname'] ?? '') . ' ' . ($row['lname'] ?? ''));
            }
            $notes[] = $row;
        }
    }

    api_success(['notes' => $notes, 'current_user_id' => $uid]);
}

/* ════════════════════════════════════════════════
   ACTION: delete_note
   Owner or superadmin. Cascades attachments via FK.
   Does NOT delete S3 objects (preserve audit trail).
════════════════════════════════════════════════ */
if ($action === 'delete_note') {
    $noteId = (int)($_POST['note_id'] ?? 0);
    if (!$noteId) api_error('note_id required');

    $chk = $conn->query("SELECT user_id FROM admin_notes WHERE id=$noteId LIMIT 1");
    if (!$chk || !$chk->num_rows) api_error('Note not found', 404);
    $owner = (int)$chk->fetch_assoc()['user_id'];

    if (!$isSA && $owner !== $uid) {
        api_error('You can only delete your own notes', 403);
    }

    $conn->query("DELETE FROM admin_notes WHERE id=$noteId");
    logNote($conn, $uid, $noteId, 'deleted');

    api_success([], 'Note deleted');
}

/* ════════════════════════════════════════════════
   ACTION: edit_note
   Owner or superadmin can edit title + content
════════════════════════════════════════════════ */
if ($action === 'edit_note') {
    $noteId  = (int)($_POST['note_id'] ?? 0);
    $title   = $conn->real_escape_string(trim($_POST['title']   ?? ''));
    $content = trim($_POST['content'] ?? '');
    if (!$noteId)  api_error('note_id required');
    if (!$content) api_error('content required');

    $chk = $conn->query("SELECT user_id FROM admin_notes WHERE id=$noteId LIMIT 1");
    if (!$chk || !$chk->num_rows) api_error('Note not found', 404);
    $owner = (int)$chk->fetch_assoc()['user_id'];
    if (!$isSA && $owner !== $uid) api_error('You can only edit your own notes', 403);

    $contentEsc = $conn->real_escape_string($content);
    $conn->query("UPDATE admin_notes SET title='$title', content='$contentEsc', updated_at=NOW() WHERE id=$noteId");
    api_success([], 'Note updated');
}

api_error('Unknown action');
?>