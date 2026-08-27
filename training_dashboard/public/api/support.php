<?php
/**
 * support.php — the learner's support desk.
 * ---------------------------------------------------------------------------
 *   GET  ?action=topics            the pre-set queries the portal offers
 *   GET  ?action=list              this learner's tickets, newest activity first
 *   GET  ?action=get&id=           one thread, with every message
 *   POST ?action=create            {topic, subject, course_id, body} + optional file
 *   POST ?action=reply             {ticket_id, body} + optional file
 *   POST ?action=close             {ticket_id}
 *
 * A ticket raised here is answered by an admin in the LMS panel
 * (react-api/api/lms/lms_api.php, ?resource=support). Both sides read the same
 * two tables in istudio_cit, so a reply lands in the thread the learner is
 * already looking at — see _bootstrap.php (learn_install) for the DDL.
 *
 * Notes
 *   • create and reply arrive as multipart when a file is attached and as JSON
 *     when it is not. learn_input() reads either, because it falls back to
 *     $_POST when php://input is not JSON.
 *   • The message body is REQUIRED and the attachment is OPTIONAL. A ticket
 *     that is nothing but a screenshot cannot be triaged.
 *   • Uploads are written under api/uploads/support/ with a generated name and
 *     an extension allow-list. The stored URL is absolute, because the admin
 *     panel reads these rows from a different host.
 *   • Everything is scoped to the session's user_id. A ticket id belonging to
 *     someone else answers 404, not 403 — there is no reason to confirm that
 *     an id exists.
 */

require_once __DIR__ . '/_bootstrap.php';

$uid    = learn_require_user();
$action = $_GET['action'] ?? '';
$in     = learn_input();

/* ── the pre-set queries ───────────────────────────────────────────────────
   Served rather than hard-coded in the React app so that both sides validate
   against ONE list: `topic` is checked against these keys on the way in, and
   the label is what a ticket with no subject of its own is titled. */
const SUPPORT_TOPICS = [
    'video'       => "A video won't play or keeps buffering",
    'access'      => 'I cannot open a course I have paid for',
    'certificate' => 'My certificate has not arrived',
    'quiz'        => 'A quiz or assignment is not accepting my answer',
    'progress'    => 'My progress or completion is not saving',
    'attachment'  => 'A PDF or attachment will not open',
    'login'       => 'Trouble signing in to the portal',
    'other'       => 'Something else',
];

/* jpg/png/webp/gif for a screenshot, pdf for a document. Deliberately no
   office formats or archives: nothing here needs them, and every extra type
   is another thing that has to be safe to hand back over HTTP. */
const SUPPORT_MAX_BYTES = 5 * 1024 * 1024;      // 5 MB
const SUPPORT_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf'];

/** Trim, collapse the runaway newlines a paste brings, and cap. */
function support_text($v, $max) {
    $s = trim((string)$v);
    $s = preg_replace("/\r\n?/", "\n", $s);
    $s = preg_replace("/\n{4,}/", "\n\n\n", $s);
    return mb_substr($s, 0, $max);
}

/**
 * Take the optional upload and return
 * [url, name, type, size], or nulls when nothing was sent.
 *
 * A file that IS sent but fails a check is a hard error: silently dropping the
 * screenshot someone waited to upload is worse than refusing the message.
 */
function support_upload() {
    $f = $_FILES['file'] ?? null;
    if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return [null, null, null, 0];
    }
    if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) {
        learn_error('That file is too large — 5 MB is the limit.');
    }
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
        learn_error('That file did not upload completely. Please try again.');
    }
    if ((int)$f['size'] <= 0)                      learn_error('That file is empty.');
    if ((int)$f['size'] > SUPPORT_MAX_BYTES)       learn_error('That file is too large — 5 MB is the limit.');

    $name = (string)($f['name'] ?? 'file');
    $ext  = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, SUPPORT_EXT, true)) {
        learn_error('Only images (PNG, JPG, WEBP, GIF) and PDF files can be attached.');
    }
    /* The extension is what the browser will trust when serving this back, so
       it has to agree with what the bytes actually are. */
    if ($ext === 'pdf') {
        if (strncmp((string)@file_get_contents($f['tmp_name'], false, null, 0, 5), '%PDF-', 5) !== 0) {
            learn_error('That does not look like a real PDF file.');
        }
    } elseif (@getimagesize($f['tmp_name']) === false) {
        learn_error('That image could not be read. Please try another file.');
    }

    $dir = __DIR__ . '/uploads/support';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        learn_log('SUPPORT', 'could not create ' . $dir);
        learn_error('We could not store that file. Please try again, or send the message without it.');
    }
    /* Anything reachable under the document root has to be inert. The rewrite
       rules leave /api/ alone, so these bytes are served as-is — which is what
       we want for a PDF and must never happen for a .php.

       Deliberately NOT `php_flag engine off`: that directive only exists under
       mod_php, and this host runs the ea-php81 handler (FPM), where Apache
       rejects it as an invalid command and answers 500 for the whole
       directory — which would take the attachments down with it. A FilesMatch
       deny is mod_authz_core and works either way, and the upload path already
       refuses every extension but images and PDF, so this is the second lock
       rather than the only one. */
    $guard = $dir . '/.htaccess';
    if (!is_file($guard)) {
        @file_put_contents($guard,
            "<FilesMatch \"\\.(php|phtml|phps|php[0-9]|pl|py|cgi|sh|htaccess)$\">\n"
            . "  Require all denied\n"
            . "</FilesMatch>\n"
            . "Options -ExecCGI -Indexes\n"
            . "RemoveHandler .php .phtml .php8 .php81\n");
    }

    /* The learner's own file name is kept only as a label in the database; the
       name on disk is generated, so it can carry no path and collide with
       nothing. */
    $safe = bin2hex(random_bytes(16)) . '.' . $ext;
    if (!@move_uploaded_file($f['tmp_name'], "$dir/$safe")) {
        learn_log('SUPPORT', 'move_uploaded_file failed into ' . $dir);
        learn_error('We could not store that file. Please try again, or send the message without it.');
    }
    @chmod("$dir/$safe", 0644);

    $scheme = (($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'training.internshipstudio.com';
    $url    = "$scheme://$host/api/uploads/support/$safe";

    return [$url, mb_substr($name, 0, 190), mb_substr((string)($f['type'] ?? ''), 0, 90), (int)$f['size']];
}

/** The signed-in learner's display name, for the message author line. */
function support_author($conn, $uid) {
    $r = $conn->query("SELECT name, email FROM users WHERE user_id = " . (int)$uid . " LIMIT 1");
    $u = $r ? $r->fetch_assoc() : null;
    return mb_substr((string)($u['name'] ?: $u['email'] ?? 'Learner'), 0, 120);
}

/** One message row, shaped for the client. */
function support_message_row($r) {
    return [
        'id'         => (int)$r['id'],
        'sender'     => $r['sender'],
        'author'     => $r['author'],
        'body'       => $r['body'],
        'file_url'   => $r['file_url'],
        'file_name'  => $r['file_name'],
        'file_type'  => $r['file_type'],
        'file_size'  => (int)$r['file_size'],
        'created_at' => $r['created_at'],
    ];
}

function support_ticket_row($r) {
    return [
        'id'             => (int)$r['id'],
        'subject'        => $r['subject'],
        'topic'          => $r['topic'],
        'topic_label'    => SUPPORT_TOPICS[$r['topic']] ?? SUPPORT_TOPICS['other'],
        'course_id'      => (int)$r['course_id'],
        'course_title'   => $r['course_title'] ?? null,
        'status'         => $r['status'],
        'messages'       => (int)$r['messages'],
        'unread'         => (int)$r['learner_unread'],
        'last_message_at'=> $r['last_message_at'],
        'created_at'     => $r['created_at'],
        'preview'        => $r['preview'] ?? null,
    ];
}

/* ── topics ────────────────────────────────────────────────────────────── */
if ($action === 'topics') {
    $out = [];
    foreach (SUPPORT_TOPICS as $k => $v) $out[] = ['key' => $k, 'label' => $v];
    learn_ok(['topics' => $out, 'max_bytes' => SUPPORT_MAX_BYTES, 'extensions' => SUPPORT_EXT]);
}

/* ── the learner's tickets ─────────────────────────────────────────────── */
if ($action === 'list') {
    $rows = [];
    $res = $conn->query("SELECT t.*, c.title course_title,
                                (SELECT m.body FROM lms_support_messages m
                                  WHERE m.ticket_id = t.id ORDER BY m.id DESC LIMIT 1) preview
                         FROM lms_support_tickets t
                         LEFT JOIN lms_courses c ON c.id = t.course_id
                         WHERE t.user_id = " . (int)$uid . "
                         ORDER BY COALESCE(t.last_message_at, t.created_at) DESC, t.id DESC");
    while ($res && ($r = $res->fetch_assoc())) $rows[] = support_ticket_row($r);

    learn_ok([
        'tickets' => $rows,
        /* The badge the header can show without loading the list. */
        'unread'  => array_sum(array_column($rows, 'unread')),
    ]);
}

/* ── one thread ────────────────────────────────────────────────────────── */
if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) learn_error('A ticket id is required');

    $res = $conn->query("SELECT t.*, c.title course_title FROM lms_support_tickets t
                         LEFT JOIN lms_courses c ON c.id = t.course_id
                         WHERE t.id = $id AND t.user_id = " . (int)$uid . " LIMIT 1");
    $t = $res ? $res->fetch_assoc() : null;
    if (!$t) learn_error('That ticket could not be found', 404);

    $messages = [];
    $mr = $conn->query("SELECT * FROM lms_support_messages WHERE ticket_id = $id ORDER BY id ASC");
    while ($mr && ($m = $mr->fetch_assoc())) $messages[] = support_message_row($m);

    /* Opening the thread IS reading it. */
    if ((int)$t['learner_unread'] > 0) {
        $conn->query("UPDATE lms_support_tickets SET learner_unread = 0 WHERE id = $id");
        $t['learner_unread'] = 0;
    }

    learn_ok(['ticket' => support_ticket_row($t), 'messages' => $messages]);
}

/* ── raise a ticket ────────────────────────────────────────────────────── */
if ($action === 'create') {
    $body = support_text($in['body'] ?? '', 4000);
    if ($body === '')            learn_error('Please describe the problem before sending.');
    if (mb_strlen($body) < 10)   learn_error('Please add a little more detail — at least a sentence.');

    $topic = (string)($in['topic'] ?? 'other');
    if (!isset(SUPPORT_TOPICS[$topic])) $topic = 'other';

    /* A subject of their own if they typed one, otherwise the pre-set query
       they picked — a list of tickets all called "Support request" is useless
       to whoever has to work through it. */
    $subject = support_text($in['subject'] ?? '', 190);
    if ($subject === '') $subject = SUPPORT_TOPICS[$topic];

    /* A course is only recorded when the learner really is enrolled in it, so
       the admin's course filter cannot be fed a number from nowhere. */
    $cid = max(0, (int)($in['course_id'] ?? 0));
    if ($cid) {
        $chk = $conn->query("SELECT id FROM lms_enrollments
                             WHERE user_id = " . (int)$uid . " AND course_id = $cid LIMIT 1");
        if (!$chk || !$chk->num_rows) $cid = 0;
    }

    /* Rate limit: a stuck submit button must not become fifty tickets. */
    $r = $conn->query("SELECT COUNT(*) c FROM lms_support_tickets
                       WHERE user_id = " . (int)$uid . "
                         AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    if ($r && (int)$r->fetch_assoc()['c'] >= 10) {
        learn_error('That is a lot of tickets in one hour. Please add to an existing one instead.', 429);
    }

    /* The file is taken BEFORE the insert: if it is going to be refused, the
       learner should get that back with their text still in the form, not a
       ticket that is missing the thing they meant to attach. */
    [$url, $fname, $ftype, $fsize] = support_upload();

    $conn->query("INSERT INTO lms_support_tickets
        (user_id, subject, topic, course_id, status, messages, admin_unread, learner_unread, last_message_at)
        VALUES (" . (int)$uid . ", '" . learn_esc($conn, $subject) . "', '" . learn_esc($conn, $topic) . "',
                $cid, 'open', 1, 1, 0, NOW())");
    $tid = (int)$conn->insert_id;
    if (!$tid) learn_error('We could not raise that ticket. Please try again.', 500);

    $conn->query("INSERT INTO lms_support_messages
        (ticket_id, sender, author, body, file_url, file_name, file_type, file_size)
        VALUES ($tid, 'learner', '" . learn_esc($conn, support_author($conn, $uid)) . "',
                '" . learn_esc($conn, $body) . "',
                " . ($url ? "'" . learn_esc($conn, $url) . "'" : 'NULL') . ",
                " . ($fname ? "'" . learn_esc($conn, $fname) . "'" : 'NULL') . ",
                " . ($ftype ? "'" . learn_esc($conn, $ftype) . "'" : 'NULL') . ",
                $fsize)");

    learn_ok(['ticket_id' => $tid], 'Your ticket has been raised — we will reply here.');
}

/* ── add to a thread ───────────────────────────────────────────────────── */
if ($action === 'reply') {
    $tid = (int)($in['ticket_id'] ?? 0);
    if (!$tid) learn_error('A ticket id is required');

    $res = $conn->query("SELECT id, status FROM lms_support_tickets
                         WHERE id = $tid AND user_id = " . (int)$uid . " LIMIT 1");
    $t = $res ? $res->fetch_assoc() : null;
    if (!$t) learn_error('That ticket could not be found', 404);

    $body = support_text($in['body'] ?? '', 4000);
    if ($body === '') learn_error('Please type a message before sending.');

    [$url, $fname, $ftype, $fsize] = support_upload();

    $conn->query("INSERT INTO lms_support_messages
        (ticket_id, sender, author, body, file_url, file_name, file_type, file_size)
        VALUES ($tid, 'learner', '" . learn_esc($conn, support_author($conn, $uid)) . "',
                '" . learn_esc($conn, $body) . "',
                " . ($url ? "'" . learn_esc($conn, $url) . "'" : 'NULL') . ",
                " . ($fname ? "'" . learn_esc($conn, $fname) . "'" : 'NULL') . ",
                " . ($ftype ? "'" . learn_esc($conn, $ftype) . "'" : 'NULL') . ",
                $fsize)");

    /* Writing again re-opens a closed ticket: the learner does not agree that
       it is finished, and a reply into a closed thread nobody watches is how
       a support desk loses people. */
    $conn->query("UPDATE lms_support_tickets
                  SET messages = messages + 1,
                      admin_unread = admin_unread + 1,
                      status = IF(status = 'closed', 'open', status),
                      last_message_at = NOW()
                  WHERE id = $tid");

    learn_ok(['ticket_id' => $tid], 'Sent');
}

/* ── the learner is done with it ───────────────────────────────────────── */
if ($action === 'close') {
    $tid = (int)($in['ticket_id'] ?? 0);
    if (!$tid) learn_error('A ticket id is required');
    $conn->query("UPDATE lms_support_tickets SET status = 'closed'
                  WHERE id = $tid AND user_id = " . (int)$uid);
    learn_ok([], 'Ticket closed');
}

learn_error('Unknown support action: ' . $action, 404);
