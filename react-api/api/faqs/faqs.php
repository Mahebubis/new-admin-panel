<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
// Large content support (answers with base64 images)
ini_set('post_max_size', '50M');
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '300');

ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

function logErr($ctx, $msg) {
    $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 1);
    file_put_contents('/home/istudio/logs/faqs.log',
        '[' . date('Y-m-d H:i:s') . '] [' . $ctx . '] line ' . ($trace[0]['line']??'?') . ': ' . $msg . PHP_EOL,
        FILE_APPEND | LOCK_EX);
}

register_shutdown_function(function() {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        ob_clean(); header('Content-Type: application/json');
        $msg = 'Fatal: ' . $e['message'] . ' line ' . $e['line'];
        file_put_contents('/home/istudio/logs/faqs.log',
            '[' . date('Y-m-d H:i:s') . '] [FATAL] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
        echo json_encode(['status' => 'error', 'message' => $msg]);
    }
});

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

$action = $_POST['action'] ?? '';

/* ════════════════════════════════════════
   GET ALL FAQs WITH CATEGORIES & KEYWORDS
   Exact same query as PHP — joins faq_questions + faq_categories + faq_keywords
   GROUP_CONCAT keywords with | separator
════════════════════════════════════════ */
if ($action === 'get_all_faqs') {
    $sql = "
        SELECT
            fq.faq_id,
            fq.question,
            fq.answer,
            fq.display_order,
            fq.is_active,
            fq.view_count,
            fq.helpful_count,
            fc.category_id,
            fc.category_name,
            GROUP_CONCAT(fk.keyword SEPARATOR '|') as keywords
        FROM faq_questions fq
        INNER JOIN faq_categories fc ON fq.category_id = fc.category_id
        LEFT JOIN faq_keywords fk ON fq.faq_id = fk.faq_id
        GROUP BY fq.faq_id
        ORDER BY fc.display_order, fq.display_order
    ";
    $res = mysqli_query($conn, $sql);
    if (!$res) {
        logErr('get_all_faqs', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        exit;
    }
    $faqs = [];
    while ($row = mysqli_fetch_assoc($res)) {
        // explode keywords the same way PHP does
        $row['keywords_array'] = $row['keywords'] ? explode('|', $row['keywords']) : [];
        $faqs[] = $row;
    }
    echo json_encode(['status'=>'success','data'=>$faqs]);
    exit;
}

/* ════════════════════════════════════════
   GET CATEGORIES
   Exact same query as PHP — only active, ordered by display_order
════════════════════════════════════════ */
if ($action === 'get_categories') {
    $res = mysqli_query($conn, "SELECT * FROM faq_categories WHERE is_active = 1 ORDER BY display_order");
    if (!$res) {
        logErr('get_categories', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>mysqli_error($conn)]);
        exit;
    }
    $cats = [];
    while ($r = mysqli_fetch_assoc($res)) $cats[] = $r;
    echo json_encode(['status'=>'success','data'=>$cats]);
    exit;
}

/* ════════════════════════════════════════
   ADD FAQ
   Exact same as PHP add_faq handler:
   INSERT into faq_questions, then INSERT each keyword into faq_keywords
════════════════════════════════════════ */
if ($action === 'add_faq') {
    $category_id   = (int)($_POST['category_id']    ?? 0);
    $question      = mysqli_real_escape_string($conn, $_POST['question']      ?? '');
    $answer        = $conn->real_escape_string($_POST['answer']               ?? '');
    $display_order = (int)($_POST['display_order']  ?? 0);
    $is_active     = isset($_POST['is_active']) ? (int)$_POST['is_active'] : 0;
    $keywords      = json_decode($_POST['keywords'] ?? '[]', true);

    if (!$category_id || !$question) {
        echo json_encode(['status'=>'error','message'=>'category_id and question are required']);
        exit;
    }

    $sql = "INSERT INTO faq_questions (category_id, question, answer, display_order, is_active)
            VALUES ($category_id, '$question', '$answer', $display_order, $is_active)";

    if (mysqli_query($conn, $sql)) {
        $faq_id = mysqli_insert_id($conn);

        // Insert keywords — same loop as PHP
        if (is_array($keywords) && count($keywords) > 0) {
            foreach ($keywords as $kw) {
                $kw = mysqli_real_escape_string($conn, trim($kw));
                if ($kw) {
                    mysqli_query($conn, "INSERT INTO faq_keywords (faq_id, keyword) VALUES ($faq_id, '$kw')");
                }
            }
        }

        echo json_encode(['status'=>'success','message'=>'FAQ added successfully','id'=>$faq_id]);
    } else {
        logErr('add_faq', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>'Failed to add FAQ']);
    }
    exit;
}

/* ════════════════════════════════════════
   UPDATE FAQ
   Exact same as PHP update_faq handler:
   UPDATE faq_questions, DELETE old keywords, INSERT new keywords
════════════════════════════════════════ */
if ($action === 'update_faq') {
    $faq_id        = (int)($_POST['faq_id']          ?? 0);
    $category_id   = (int)($_POST['category_id']     ?? 0);
    $question      = mysqli_real_escape_string($conn, $_POST['question']     ?? '');
    $answer        = $conn->real_escape_string($_POST['answer']              ?? '');
    $display_order = (int)($_POST['display_order']   ?? 0);
    $is_active     = isset($_POST['is_active']) ? (int)$_POST['is_active'] : 0;
    $keywords      = json_decode($_POST['keywords'] ?? '[]', true);

    if (!$faq_id) {
        echo json_encode(['status'=>'error','message'=>'faq_id is required']);
        exit;
    }

    $sql = "UPDATE faq_questions SET
            category_id    = $category_id,
            question       = '$question',
            answer         = '$answer',
            display_order  = $display_order,
            is_active      = $is_active
            WHERE faq_id   = $faq_id";

    if (mysqli_query($conn, $sql)) {
        // Delete old keywords then re-insert — exact same as PHP
        $conn->query("DELETE FROM faq_keywords WHERE faq_id = $faq_id");

        if (is_array($keywords) && count($keywords) > 0) {
            foreach ($keywords as $kw) {
                $kw = mysqli_real_escape_string($conn, trim($kw));
                if ($kw) {
                    $conn->query("INSERT INTO faq_keywords (faq_id, keyword) VALUES ($faq_id, '$kw')");
                }
            }
        }

        echo json_encode(['status'=>'success','message'=>'FAQ updated successfully']);
    } else {
        logErr('update_faq', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>'Failed to update FAQ']);
    }
    exit;
}

/* ════════════════════════════════════════
   DELETE FAQs (single or bulk)
   Exact same as PHP delete_faqs handler:
   DELETE from faq_keywords first, then faq_questions
════════════════════════════════════════ */
if ($action === 'delete_faqs') {
    $ids = json_decode($_POST['ids'] ?? '[]', true);
    if (is_array($ids) && count($ids) > 0) {
        $id_list = implode(',', array_map('intval', $ids));
        $conn->query("DELETE FROM faq_keywords  WHERE faq_id IN ($id_list)");
        $conn->query("DELETE FROM faq_questions WHERE faq_id IN ($id_list)");
        echo json_encode(['status'=>'success','message'=>count($ids) . ' FAQ(s) deleted successfully']);
    } else {
        echo json_encode(['status'=>'error','message'=>'No IDs provided']);
    }
    exit;
}

/* ════════════════════════════════════════
   TOGGLE ACTIVE STATUS
   Exact same as PHP toggle_active handler:
   UPDATE faq_questions SET is_active = ?
════════════════════════════════════════ */
if ($action === 'toggle_active') {
    $faq_id    = (int)($_POST['faq_id']    ?? 0);
    $is_active = (int)($_POST['is_active'] ?? 0);

    if (!$faq_id) {
        echo json_encode(['status'=>'error','message'=>'faq_id required']);
        exit;
    }

    $conn->query("UPDATE faq_questions SET is_active = $is_active WHERE faq_id = $faq_id");
    echo json_encode(['status'=>'success','message'=>'Status updated successfully']);
    exit;
}

/* ════════════════════════════════════════
   ADD CATEGORY
   Exact same as PHP add_category handler:
   INSERT into faq_categories
════════════════════════════════════════ */
if ($action === 'add_category') {
    $name        = mysqli_real_escape_string($conn, $_POST['category_name']        ?? '');
    $description = mysqli_real_escape_string($conn, $_POST['category_description'] ?? '');
    $order       = (int)($_POST['display_order'] ?? 0);

    if (!$name) {
        echo json_encode(['status'=>'error','message'=>'Category name is required']);
        exit;
    }

    $sql = "INSERT INTO faq_categories (category_name, category_description, display_order)
            VALUES ('$name', '$description', $order)";

    if (mysqli_query($conn, $sql)) {
        echo json_encode(['status'=>'success','message'=>'Category added successfully']);
    } else {
        logErr('add_category', mysqli_error($conn));
        echo json_encode(['status'=>'error','message'=>'Failed to add category']);
    }
    exit;
}

/* ── fallback ── */
logErr('fallback', "Unknown action='$action'");
echo json_encode(['status'=>'error','message'=>'Invalid action: ' . $action]);
exit;
?>