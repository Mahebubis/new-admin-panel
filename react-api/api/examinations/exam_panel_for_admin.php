<?php
ini_set('display_errors', 0);
/*
 * Uses $conn2 (exam panel DB) — same DB as the standalone PHP page's ../config/db.php
 * Tables: cit_questions, cit_options, cit_exams
 * Images: /home/istudio/public_html/cit/assets/exam/
 */
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;
if (!$conn) { echo json_encode(['status'=>'error','message'=>'DB failed']); exit; }

/* ── image upload — same as PHP's uploadQuestionImage() ── */
function uploadQuestionImage($file) {
    if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) return '';
    $allowed = ['image/jpeg','image/png','image/webp'];
    if (!in_array($file['type'], $allowed)) return '';
    $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('qimg_', true) . '.' . $ext;
    $uploadDir = '/home/istudio/public_html/cit/assets/exam/';
    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
    $dest = $uploadDir . $filename;
    return move_uploaded_file($file['tmp_name'], $dest) ? $filename : '';
}

// Read action from multiple sources — GET param most reliable with FormData
$action = $_GET['action'] ?? $_POST['action'] ?? '';

/* ════════════════════════════════════════
   GET ALL QUESTIONS WITH OPTIONS
   Same as PHP: SELECT * FROM cit_questions + cit_options per question
════════════════════════════════════════ */
if ($action === 'get_all_questions') {
    $questions = [];
    $res = $conn->query("SELECT q.*, e.exam_name FROM cit_questions q
                         LEFT JOIN cit_exams e ON q.exam_id = e.exam_id
                         ORDER BY q.question_id DESC");
    if ($res) while ($row = $res->fetch_assoc()) {
        $qid  = (int)$row['question_id'];
        $opts = $conn->query("SELECT * FROM cit_options WHERE question_id = $qid ORDER BY option_id");
        $row['options'] = $opts ? $opts->fetch_all(MYSQLI_ASSOC) : [];
        $questions[] = $row;
    }
    echo json_encode(['status'=>'success','data'=>$questions]);
    exit;
}

/* ── GET EXAMS ── */
if ($action === 'get_exams') {
    $res   = $conn->query("SELECT exam_id, exam_name FROM cit_exams ORDER BY exam_name");
    $exams = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    echo json_encode(['status'=>'success','data'=>$exams]);
    exit;
}

/* ════════════════════════════════════════
   ADD SINGLE QUESTION WITH OPTIONS + image
   Same as PHP's add_question handler
════════════════════════════════════════ */
if ($action === 'add_question') {
    $examId       = mysqli_real_escape_string($conn, $_POST['exam_id']       ?? '');
    $questionText = mysqli_real_escape_string($conn, $_POST['question_text'] ?? '');
    $questionType = mysqli_real_escape_string($conn, $_POST['question_type'] ?? '');
    $questionImage= '';
    if (!empty($_FILES['question_image']['name']))
        $questionImage = uploadQuestionImage($_FILES['question_image']);

    $sql = "INSERT INTO cit_questions (exam_id, question_text, question_image, question_type)
            VALUES ('$examId','$questionText','$questionImage','$questionType')";
    if (mysqli_query($conn, $sql)) {
        $qId    = mysqli_insert_id($conn);
        $options= json_decode($_POST['options'] ?? '[]', true);
        foreach ($options as $opt) {
            $t = mysqli_real_escape_string($conn, $opt['text']);
            $c = (int)$opt['is_correct'];
            $conn->query("INSERT INTO cit_options (question_id, option_text, is_correct) VALUES ($qId, '$t', $c)");
        }
        echo json_encode(['status'=>'success','message'=>'Question added successfully','id'=>$qId]);
    } else {
        echo json_encode(['status'=>'error','message'=>'Failed to add question']);
    }
    exit;
}

/* ════════════════════════════════════════
   BULK ADD QUESTIONS
   Same as PHP's bulk_add_questions handler
   Handles multiple file uploads via bulk_images[index]
════════════════════════════════════════ */
if ($action === 'bulk_add_questions') {
    $items  = json_decode($_POST['items'] ?? '[]', true);
    $saved  = 0;
    $bulkImages = $_FILES['bulk_images'] ?? [];

    foreach ($items as $index => $item) {
        $examId       = mysqli_real_escape_string($conn, $item['exam_id']       ?? '');
        $questionText = mysqli_real_escape_string($conn, $item['question_text'] ?? '');
        $questionType = mysqli_real_escape_string($conn, $item['question_type'] ?? '');
        $questionImage= '';

        if (isset($bulkImages['name'][$index]) && $bulkImages['error'][$index] === UPLOAD_ERR_OK) {
            $file = [
                'name'     => $bulkImages['name'][$index],
                'type'     => $bulkImages['type'][$index],
                'tmp_name' => $bulkImages['tmp_name'][$index],
                'error'    => $bulkImages['error'][$index],
                'size'     => $bulkImages['size'][$index],
            ];
            $questionImage = uploadQuestionImage($file);
        }

        $sql = "INSERT INTO cit_questions (exam_id, question_text, question_image, question_type)
                VALUES ('$examId','$questionText','$questionImage','$questionType')";
        if (mysqli_query($conn, $sql)) {
            $qId = mysqli_insert_id($conn);
            foreach ($item['options'] as $opt) {
                $t = mysqli_real_escape_string($conn, $opt['text']);
                $c = (int)$opt['is_correct'];
                $conn->query("INSERT INTO cit_options (question_id, option_text, is_correct) VALUES ($qId, '$t', $c)");
            }
            $saved++;
        }
    }
    echo json_encode(['status'=>'success','message'=>"$saved question(s) added successfully"]);
    exit;
}

/* ════════════════════════════════════════
   UPDATE QUESTION
   Same as PHP's update_question handler
════════════════════════════════════════ */
if ($action === 'update_question') {
    $questionId   = (int)($_POST['question_id'] ?? 0);
    $examId       = mysqli_real_escape_string($conn, $_POST['exam_id']       ?? '');
    $questionText = mysqli_real_escape_string($conn, $_POST['question_text'] ?? '');
    $questionType = mysqli_real_escape_string($conn, $_POST['question_type'] ?? '');
    $questionImage= $_POST['existing_image'] ?? '';
    if (!empty($_FILES['question_image']['name']))
        $questionImage = uploadQuestionImage($_FILES['question_image']);

    $sql = "UPDATE cit_questions SET exam_id='$examId', question_text='$questionText',
            question_image='$questionImage', question_type='$questionType'
            WHERE question_id = $questionId";
    if (mysqli_query($conn, $sql)) {
        $conn->query("DELETE FROM cit_options WHERE question_id = $questionId");
        $options = json_decode($_POST['options'] ?? '[]', true);
        foreach ($options as $opt) {
            $t = mysqli_real_escape_string($conn, $opt['text']);
            $c = (int)$opt['is_correct'];
            $conn->query("INSERT INTO cit_options (question_id, option_text, is_correct) VALUES ($questionId, '$t', $c)");
        }
        echo json_encode(['status'=>'success','message'=>'Question updated successfully']);
    } else {
        echo json_encode(['status'=>'error','message'=>'Failed to update question']);
    }
    exit;
}

/* ── DELETE QUESTIONS (single or bulk) ── */
if ($action === 'delete_questions') {
    $ids    = json_decode($_POST['ids'] ?? '[]', true);
    if (is_array($ids) && count($ids) > 0) {
        $idList = implode(',', array_map('intval', $ids));
        $conn->query("DELETE FROM cit_options WHERE question_id IN ($idList)");
        $conn->query("DELETE FROM cit_questions WHERE question_id IN ($idList)");
        echo json_encode(['status'=>'success','message'=>count($ids) . ' question(s) deleted successfully']);
    } else {
        echo json_encode(['status'=>'error','message'=>'No IDs provided']);
    }
    exit;
}

echo json_encode(['status'=>'error','message'=>'Invalid action']);
exit;
?>