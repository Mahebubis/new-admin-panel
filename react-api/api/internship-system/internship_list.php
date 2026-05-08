<?php
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
ob_clean();
header('Content-Type: application/json');

global $conn;

if (!$conn) {
    echo json_encode(['status' => 'error', 'message' => 'DB connection failed']);
    exit;
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   FETCH ALL INTERNSHIPS
   Same as fetch_internship_list() + PDF check
════════════════════════════════════════ */
if ($action === 'fetch_list') {
    $sql = "SELECT * FROM internship_list ORDER BY priority ASC";
    $res = mysqli_query($conn, $sql);
    if (!$res) {
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
        exit;
    }

    $rows = [];
    while ($row = mysqli_fetch_assoc($res)) {
        // Check PDF existence via curl (same logic as original PHP page)
        $shortName = $row['short_name'] ?? '';
        $pdfUrl    = "https://cit2.internshipstudio.com/assets/documents/syllabus/{$shortName}.pdf";
        $pdfExists = false;

        if (!empty($shortName)) {
            // $ch = curl_init($pdfUrl);
            // curl_setopt($ch, CURLOPT_NOBODY, true);
            // curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            // curl_setopt($ch, CURLOPT_TIMEOUT, 5);
            // curl_exec($ch);
            // $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            // curl_close($ch);
            // $pdfExists = ($code == 200);
            $pdfPath = "/home/istudio/public_html/cit2/assets/documents/syllabus/{$shortName}.pdf";
$pdfExists = file_exists($pdfPath);
        }

        $row['pdf_exists'] = $pdfExists;
        $rows[] = $row;
    }

    echo json_encode(['status' => 'success', 'data' => $rows]);
    exit;
}

/* ════════════════════════════════════════
   FETCH CATEGORIES
════════════════════════════════════════ */
if ($action === 'fetch_categories') {
    $sql = "SELECT * FROM internship_categories ORDER BY cat_name";
    $res = mysqli_query($conn, $sql);
    if (!$res) {
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
        exit;
    }
    $cats = [];
    while ($row = mysqli_fetch_assoc($res)) $cats[] = $row;
    echo json_encode(['status' => 'success', 'data' => $cats]);
    exit;
}

/* ════════════════════════════════════════
   FETCH SINGLE INTERNSHIP BY ID
════════════════════════════════════════ */
if ($action === 'fetch_by_id') {
    $id  = (int)($_POST['internship_id'] ?? 0);
    $sql = "SELECT il.*, ci.cat_id FROM internship_list il
            LEFT JOIN category_internship ci ON ci.internship_id = il.id
            WHERE il.id = '$id' LIMIT 1";
    $res = mysqli_query($conn, $sql);
    if ($res && mysqli_num_rows($res) > 0) {
        echo json_encode(['status' => 'success', 'data' => mysqli_fetch_assoc($res)]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Not found']);
    }
    exit;
}

/* ════════════════════════════════════════
   DELETE INTERNSHIP
   Same logic as delete_internship_from_system in functions.php
════════════════════════════════════════ */
if ($action === 'delete_internship') {
    $id = mysqli_real_escape_string($conn, $_POST['internship_id'] ?? '');

    // Delete from category_internship first (same as original)
    mysqli_query($conn, "DELETE FROM category_internship WHERE internship_id = '$id'");

    // Then delete from internship_list
    if (mysqli_query($conn, "DELETE FROM internship_list WHERE id = '$id'")) {
        echo json_encode(['status' => 'success', 'message' => 'Internship deleted successfully']);
    } else {
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    }
    exit;
}

/* ════════════════════════════════════════
   UPDATE PRIORITIES
   Same logic as update_internship_priorities in functions.php
════════════════════════════════════════ */
if ($action === 'update_priorities') {
    $priorities = json_decode($_POST['priorities'] ?? '[]', true);
    if (empty($priorities)) {
        echo json_encode(['status' => 'error', 'message' => 'No priorities provided']);
        exit;
    }

    $errors = [];
    foreach ($priorities as $item) {
        $id       = (int)$item['id'];
        $priority = (int)$item['priority'];
        $q = "UPDATE internship_list SET priority = '$priority' WHERE id = '$id'";
        if (!mysqli_query($conn, $q)) {
            $errors[] = mysqli_error($conn);
        }
    }

    if (empty($errors)) {
        echo json_encode(['status' => 'success', 'message' => 'Priorities updated']);
    } else {
        echo json_encode(['status' => 'error', 'message' => implode(', ', $errors)]);
    }
    exit;
}

/* ════════════════════════════════════════
   ADD NEW INTERNSHIP
════════════════════════════════════════ */
if ($action === 'save_internship') {
    try {
        $internship_name    = mysqli_real_escape_string($conn, $_POST['internship_name']    ?? '');
        $short_name         = mysqli_real_escape_string($conn, $_POST['short_name']         ?? '');
        $learnyst_name      = mysqli_real_escape_string($conn, $_POST['learnyst_name']      ?? '');
        $show_internship    = (int)($_POST['show_internship']    ?? 1);
        $has_gold           = (int)($_POST['has_gold']           ?? 0);
        $best_seller        = (int)($_POST['best_seller']        ?? 0);
        $is_full            = (int)($_POST['is_full']            ?? 0);
        $gold_community_link  = mysqli_real_escape_string($conn, $_POST['gold_community_link']  ?? '');
        $basic_community_link = mysqli_real_escape_string($conn, $_POST['basic_community_link'] ?? '');
        $cat_id             = (int)($_POST['cat_id'] ?? 0);

        // Get max priority
        $maxRes  = mysqli_fetch_assoc(mysqli_query($conn, "SELECT MAX(priority) as max_p FROM internship_list"));
        $priority = ($maxRes['max_p'] ?? 0) + 1;

        // Handle image upload to CDN path
        if (!empty($_FILES['change_image']['name']) && $_FILES['change_image']['error'] === 0) {
            $uploadDir  = '/home/istudio/public_html/cit2/assets/img/istudio/icons/';
            $targetFile = $uploadDir . $short_name . '.webp';
            if (!move_uploaded_file($_FILES['change_image']['tmp_name'], $targetFile)) {
                // non-fatal — just log
                error_log("Image upload failed for $short_name");
            }
        }

        // Handle syllabus PDF upload
        if (!empty($_FILES['change_syllabus']['name']) && $_FILES['change_syllabus']['error'] === 0) {
            $uploadDir  = '/home/istudio/public_html/cit2/assets/documents/syllabus/';
            $targetFile = $uploadDir . $short_name . '.pdf';
            if (!move_uploaded_file($_FILES['change_syllabus']['tmp_name'], $targetFile)) {
                error_log("Syllabus upload failed for $short_name");
            }
        }

        $q = "INSERT INTO internship_list
              (internship_name, short_name, learnyst_name, show_internship, has_gold, best_seller,
               is_full, gold_community_link, basic_community_link, priority)
              VALUES
              ('$internship_name', '$short_name', '$learnyst_name', '$show_internship', '$has_gold',
               '$best_seller', '$is_full', '$gold_community_link', '$basic_community_link', '$priority')";

        if (!mysqli_query($conn, $q)) {
            echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
            exit;
        }

        $new_id = mysqli_insert_id($conn);

        // Link to category
        if ($cat_id > 0) {
            mysqli_query($conn, "INSERT INTO category_internship (internship_id, cat_id) VALUES ('$new_id', '$cat_id')");
        }

        echo json_encode(['status' => 'success', 'message' => 'Internship created successfully']);

    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Exception: ' . $e->getMessage()]);
    }
    exit;
}

/* ════════════════════════════════════════
   UPDATE INTERNSHIP
   Same as edit_by_admin.php logic
════════════════════════════════════════ */
if ($action === 'update_internship') {
    try {
        $id                 = (int)($_POST['internship_id'] ?? 0);
        $internship_name    = mysqli_real_escape_string($conn, $_POST['internship_name']    ?? '');
        $short_name         = mysqli_real_escape_string($conn, $_POST['short_name']         ?? '');
        $learnyst_name      = mysqli_real_escape_string($conn, $_POST['learnyst_name']      ?? '');
        $show_internship    = (int)($_POST['show_internship']    ?? 1);
        $has_gold           = (int)($_POST['has_gold']           ?? 0);
        $best_seller        = (int)($_POST['best_seller']        ?? 0);
        $is_full            = (int)($_POST['is_full']            ?? 0);
        $gold_community_link  = mysqli_real_escape_string($conn, $_POST['gold_community_link']  ?? '');
        $basic_community_link = mysqli_real_escape_string($conn, $_POST['basic_community_link'] ?? '');
        $cat_id             = (int)($_POST['cat_id'] ?? 0);

        // Handle image upload
        if (!empty($_FILES['change_image']['name']) && $_FILES['change_image']['error'] === 0) {
            $uploadDir  = '/home/istudio/public_html/cit2/assets/img/istudio/icons/';
            $targetFile = $uploadDir . $short_name . '.webp';
            if (!move_uploaded_file($_FILES['change_image']['tmp_name'], $targetFile)) {
                error_log("Image upload failed for $short_name");
            }
        }

        // Handle syllabus PDF upload
        if (!empty($_FILES['change_syllabus']['name']) && $_FILES['change_syllabus']['error'] === 0) {
            $uploadDir  = '/home/istudio/public_html/cit2/assets/documents/syllabus/';
            $targetFile = $uploadDir . $short_name . '.pdf';
            if (!move_uploaded_file($_FILES['change_syllabus']['tmp_name'], $targetFile)) {
                error_log("Syllabus upload failed for $short_name");
            }
        }

        $q = "UPDATE internship_list SET
              internship_name    = '$internship_name',
              short_name         = '$short_name',
              learnyst_name      = '$learnyst_name',
              show_internship    = '$show_internship',
              has_gold           = '$has_gold',
              best_seller        = '$best_seller',
              is_full            = '$is_full',
              gold_community_link  = '$gold_community_link',
              basic_community_link = '$basic_community_link'
              WHERE id = '$id'";

        if (!mysqli_query($conn, $q)) {
            echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
            exit;
        }

        // Update category: delete old, insert new
        if ($cat_id > 0) {
            mysqli_query($conn, "DELETE FROM category_internship WHERE internship_id = '$id'");
            mysqli_query($conn, "INSERT INTO category_internship (internship_id, cat_id) VALUES ('$id', '$cat_id')");
        }

        echo json_encode(['status' => 'success', 'message' => 'Internship updated successfully']);

    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Exception: ' . $e->getMessage()]);
    }
    exit;
}

/* ── fallback ── */
echo json_encode(['status' => 'error', 'message' => 'Invalid action: ' . $action]);
exit;
?>