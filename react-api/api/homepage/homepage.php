<?php
ob_start();
chdir('/home/istudio/public_html/cit/common');
include '/home/istudio/public_html/cit/common/helper.php';
include '/home/istudio/public_html/cit3/jobs/upload-file.php';
ob_clean();
header('Content-Type: application/json');

global $conn;

if (!$conn) {
    echo json_encode(['status' => 'error', 'message' => 'DB connection missing']);
    exit;
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════
   JOBS  —  table: jobs_home
════════════════════════════════════════ */

if ($action === 'fetch_jobs') {
    $res = mysqli_query($conn, "SELECT * FROM jobs_home ORDER BY id DESC");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode(['status' => 'success', 'data' => $rows]);
    exit;
}

if ($action === 'save_job') {
    $title           = mysqli_real_escape_string($conn, $_POST['title'] ?? '');
    $company         = mysqli_real_escape_string($conn, $_POST['company'] ?? '');
    $location        = mysqli_real_escape_string($conn, $_POST['location'] ?? '');
    $stipendInput    = trim($_POST['stipend'] ?? '');
    $stipend         = $stipendInput === '' ? 'NULL' : "'" . (int)$stipendInput . "'";
    $type            = mysqli_real_escape_string($conn, $_POST['type'] ?? '');
    $postedDate      = mysqli_real_escape_string($conn, $_POST['postedDate'] ?? '');
    $status          = mysqli_real_escape_string($conn, $_POST['status'] ?? 'live');
    $applicationLink = mysqli_real_escape_string($conn, $_POST['applicationLink'] ?? '');
    $companyLogo     = '';

    if (!empty($_FILES['companyLogo']['name'])) {
        $up = uploadToS3($_FILES['companyLogo']);
        if (isset($up['success'])) $companyLogo = $up['success'];
        else { echo json_encode(['status' => 'error', 'message' => $up['error']]); exit; }
    }

    $q = "INSERT INTO jobs_home (title, company, location, stipend, type, postedDate, status, applicationLink, companyLogo)
          VALUES ('$title', '$company', '$location', $stipend, '$type', '$postedDate', '$status', '$applicationLink', '$companyLogo')";

    if (mysqli_query($conn, $q)) echo json_encode(['status' => 'success', 'message' => 'Job created']);
    else echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

if ($action === 'update_job') {
    $id              = (int)($_POST['job_id'] ?? 0);
    $title           = mysqli_real_escape_string($conn, $_POST['title'] ?? '');
    $company         = mysqli_real_escape_string($conn, $_POST['company'] ?? '');
    $location        = mysqli_real_escape_string($conn, $_POST['location'] ?? '');
    $stipendInput    = trim($_POST['stipend'] ?? '');
    $stipend         = $stipendInput === '' ? 'NULL' : "'" . (int)$stipendInput . "'";
    $type            = mysqli_real_escape_string($conn, $_POST['type'] ?? '');
    $postedDate      = mysqli_real_escape_string($conn, $_POST['postedDate'] ?? '');
    $status          = mysqli_real_escape_string($conn, $_POST['status'] ?? 'live');
    $applicationLink = mysqli_real_escape_string($conn, $_POST['applicationLink'] ?? '');

    /* keep existing logo unless a new one is uploaded */
    $row = mysqli_fetch_assoc(mysqli_query($conn, "SELECT companyLogo FROM jobs_home WHERE id='$id'"));
    $companyLogo = $row['companyLogo'] ?? '';

    if (!empty($_FILES['companyLogo']['name'])) {
        $up = uploadToS3($_FILES['companyLogo']);
        if (isset($up['success'])) $companyLogo = $up['success'];
        else { echo json_encode(['status' => 'error', 'message' => $up['error']]); exit; }
    }

    $companyLogo = mysqli_real_escape_string($conn, $companyLogo);
    $q = "UPDATE jobs_home SET title='$title', company='$company', location='$location',
          stipend=$stipend, type='$type', postedDate='$postedDate', status='$status',
          applicationLink='$applicationLink', companyLogo='$companyLogo' WHERE id='$id'";

    if (mysqli_query($conn, $q)) echo json_encode(['status' => 'success', 'message' => 'Job updated']);
    else echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

if ($action === 'delete_job') {
    $id = (int)($_POST['id'] ?? 0);
    if (mysqli_query($conn, "DELETE FROM jobs_home WHERE id='$id'"))
        echo json_encode(['status' => 'success', 'message' => 'Deleted']);
    else echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

/* ════════════════════════════════════════
   PLACEMENTS  —  table: placements_home
════════════════════════════════════════ */

if ($action === 'fetch_placements') {
    $res = mysqli_query($conn, "SELECT * FROM placements_home ORDER BY id DESC");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) {
        $r['skills'] = json_decode($r['skills'] ?? '[]', true);
        $rows[] = $r;
    }
    echo json_encode(['status' => 'success', 'data' => $rows]);
    exit;
}

if ($action === 'save_placement') {
    $name                = mysqli_real_escape_string($conn, $_POST['name'] ?? '');
    $company             = mysqli_real_escape_string($conn, $_POST['company'] ?? '');
    $role                = mysqli_real_escape_string($conn, $_POST['role'] ?? '');
    $stipend             = trim($_POST['stipend'] ?? '') === '' ? '' : trim($_POST['stipend']);
    $linkedinUrl         = mysqli_real_escape_string($conn, $_POST['linkedinUrl'] ?? '');
    $internshipStudioUrl = mysqli_real_escape_string($conn, $_POST['internshipStudioUrl'] ?? '');
    $placementDate       = mysqli_real_escape_string($conn, $_POST['placementDate'] ?? '');
    $location            = mysqli_real_escape_string($conn, $_POST['location'] ?? '');
    $internshipStatus    = mysqli_real_escape_string($conn, $_POST['internshipStatus'] ?? 'internship');
    $skills              = json_encode(array_values(array_filter(array_map('trim', explode(',', $_POST['skills'] ?? '')))));
    $image               = '';

    if (!empty($_FILES['image']['name'])) {
        $up = uploadToS3($_FILES['image']);
        if (isset($up['success'])) $image = $up['success'];
        else { echo json_encode(['status' => 'error', 'message' => $up['error']]); exit; }
    }

    $q = "INSERT INTO placements_home (name, image, company, role, stipend, linkedinUrl, internshipStudioUrl, placementDate, skills, location, internshipStatus)
          VALUES ('$name', '$image', '$company', '$role', '$stipend', '$linkedinUrl', '$internshipStudioUrl', '$placementDate', '$skills', '$location', '$internshipStatus')";

    if (mysqli_query($conn, $q))
        echo json_encode(['status' => 'success', 'message' => 'Placement created']);
    else
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

// if ($action === 'update_placement') {
//     $id                  = (int)($_POST['placement_id'] ?? 0);
//     $name                = mysqli_real_escape_string($conn, $_POST['name'] ?? '');
//     $company             = mysqli_real_escape_string($conn, $_POST['company'] ?? '');
//     $role                = mysqli_real_escape_string($conn, $_POST['role'] ?? '');
//     $stipendInput        = trim($_POST['stipend'] ?? '');
//     $stipend             = $stipendInput === '' ? null : $stipendInput;
//     $linkedinUrl         = mysqli_real_escape_string($conn, $_POST['linkedinUrl'] ?? '');
//     $internshipStudioUrl = mysqli_real_escape_string($conn, $_POST['internshipStudioUrl'] ?? '');
//     $placementDate       = mysqli_real_escape_string($conn, $_POST['placementDate'] ?? '');
//     $location            = mysqli_real_escape_string($conn, $_POST['location'] ?? '');
//     $internshipStatus    = mysqli_real_escape_string($conn, $_POST['internshipStatus'] ?? 'internship');
//     $skills              = json_encode(array_values(array_filter(array_map('trim', explode(',', $_POST['skills'] ?? '')))));

//     /* keep existing image */
//     $row = mysqli_fetch_assoc(mysqli_query($conn, "SELECT image FROM placements_home WHERE id='$id'"));
//     $image = $row['image'] ?? null;

//     if (!empty($_FILES['image']['name'])) {
//         $up = uploadToS3($_FILES['image']);
//         if (isset($up['success'])) $image = $up['success'];
//         else { echo json_encode(['status' => 'error', 'message' => $up['error']]); exit; }
//     }

//     $stipendSql = $stipend === null ? 'NULL' : "'$stipend'";
//     $imageSql   = $image   === null ? 'NULL' : "'" . mysqli_real_escape_string($conn, $image) . "'";
//     $skills     = mysqli_real_escape_string($conn, $skills);

//     $q = "UPDATE placements_home SET name='$name', company='$company', role='$role',
//           stipend=$stipendSql, linkedinUrl='$linkedinUrl', internshipStudioUrl='$internshipStudioUrl',
//           placementDate='$placementDate', skills='$skills', location='$location',
//           internshipStatus='$internshipStatus', image=$imageSql WHERE id='$id'";

//     if (mysqli_query($conn, $q)) echo json_encode(['status' => 'success', 'message' => 'Placement updated']);
//     else echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
//     exit;
// }

if ($action === 'update_placement') {
    $id                  = (int)($_POST['placement_id'] ?? 0);
    $name                = mysqli_real_escape_string($conn, $_POST['name'] ?? '');
    $company             = mysqli_real_escape_string($conn, $_POST['company'] ?? '');
    $role                = mysqli_real_escape_string($conn, $_POST['role'] ?? '');
    $stipend             = mysqli_real_escape_string($conn, trim($_POST['stipend'] ?? ''));
    $linkedinUrl         = mysqli_real_escape_string($conn, $_POST['linkedinUrl'] ?? '');
    $internshipStudioUrl = mysqli_real_escape_string($conn, $_POST['internshipStudioUrl'] ?? '');
    $placementDate       = mysqli_real_escape_string($conn, $_POST['placementDate'] ?? '');
    $location            = mysqli_real_escape_string($conn, $_POST['location'] ?? '');
    $internshipStatus    = mysqli_real_escape_string($conn, $_POST['internshipStatus'] ?? 'internship');
    $skills              = json_encode(array_values(array_filter(array_map('trim', explode(',', $_POST['skills'] ?? '')))));

    $row   = mysqli_fetch_assoc(mysqli_query($conn, "SELECT image FROM placements_home WHERE id='$id'"));
    $image = mysqli_real_escape_string($conn, $row['image'] ?? '');

    if (!empty($_FILES['image']['name'])) {
        $up = uploadToS3($_FILES['image']);
        if (isset($up['success'])) $image = mysqli_real_escape_string($conn, $up['success']);
        else { echo json_encode(['status' => 'error', 'message' => $up['error']]); exit; }
    }

    $q = "UPDATE placements_home SET name='$name', image='$image', company='$company', role='$role',
          stipend='$stipend', linkedinUrl='$linkedinUrl', internshipStudioUrl='$internshipStudioUrl',
          placementDate='$placementDate', skills='$skills', location='$location',
          internshipStatus='$internshipStatus' WHERE id='$id'";

    if (mysqli_query($conn, $q))
        echo json_encode(['status' => 'success', 'message' => 'Placement updated']);
    else
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

if ($action === 'delete_placement') {
    $id = (int)($_POST['id'] ?? 0);
    if (mysqli_query($conn, "DELETE FROM placements_home WHERE id='$id'"))
        echo json_encode(['status' => 'success', 'message' => 'Deleted']);
    else echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

/* ════════════════════════════════════════
   INTERNSHIPS  —  table: internship_home
════════════════════════════════════════ */

if ($action === 'fetch_internships') {
    $res = mysqli_query($conn, "SELECT * FROM internship_home ORDER BY id DESC");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode(['status' => 'success', 'data' => $rows]);
    exit;
}

if ($action === 'save_internship') {
    try {
        $title    = mysqli_real_escape_string($conn, $_POST['title'] ?? '');
        $price    = mysqli_real_escape_string($conn, $_POST['price'] ?? '0');
        $category = mysqli_real_escape_string($conn, $_POST['category'] ?? '');
        $image    = '';

        if (!empty($_FILES['image']['name']) && $_FILES['image']['error'] === 0) {
            $up = uploadToS3($_FILES['image']);
            if (isset($up['success'])) {
                $image = mysqli_real_escape_string($conn, $up['success']);
            } else {
                echo json_encode(['status' => 'error', 'message' => 'Upload failed: ' . ($up['error'] ?? 'unknown')]);
                exit;
            }
        }

        $q = "INSERT INTO internship_home (image, title, price, category) 
              VALUES ('$image', '$title', '$price', '$category')";

        if (mysqli_query($conn, $q))
            echo json_encode(['status' => 'success', 'message' => 'Internship created']);
        else
            echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);

    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'Exception: ' . $e->getMessage()]);
    }
    exit;
}

if ($action === 'update_internship') {
    $id       = (int)($_POST['internship_id'] ?? 0);
    $title    = mysqli_real_escape_string($conn, $_POST['title'] ?? '');
    $price    = mysqli_real_escape_string($conn, $_POST['price'] ?? '0');
    $category = mysqli_real_escape_string($conn, $_POST['category'] ?? '');

    $row   = mysqli_fetch_assoc(mysqli_query($conn, "SELECT image FROM internship_home WHERE id='$id'"));
    $image = mysqli_real_escape_string($conn, $row['image'] ?? '');

    if (!empty($_FILES['image']['name'])) {
        $up = uploadToS3($_FILES['image']);
        if (isset($up['success'])) $image = mysqli_real_escape_string($conn, $up['success']);
        else { echo json_encode(['status' => 'error', 'message' => $up['error']]); exit; }
    }

    $q = "UPDATE internship_home SET title='$title', price='$price', category='$category', image='$image' WHERE id='$id'";

    if (mysqli_query($conn, $q))
        echo json_encode(['status' => 'success', 'message' => 'Internship updated']);
    else
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

if ($action === 'delete_internship') {
    $id = (int)($_POST['id'] ?? 0);
    if (mysqli_query($conn, "DELETE FROM internship_home WHERE id='$id'"))
        echo json_encode(['status' => 'success', 'message' => 'Deleted']);
    else echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

/* ════════════════════════════════════════
   CIT DATES  —  table: add_cit_date
════════════════════════════════════════ */

if ($action === 'fetch_cit_dates') {
    $res = mysqli_query($conn, "SELECT * FROM add_cit_date ORDER BY created_at DESC");
    $rows = [];
    while ($r = mysqli_fetch_assoc($res)) $rows[] = $r;
    echo json_encode(['status' => 'success', 'data' => $rows]);
    exit;
}

// if ($action === 'save_cit_date') {
//     $cit_date = mysqli_real_escape_string($conn, $_POST['cit_date'] ?? '');
//     $stmt = $conn->prepare("INSERT INTO add_cit_date (cit_date) VALUES (?)");
//     $stmt->bind_param('s', $cit_date);
//     if ($stmt->execute()) echo json_encode(['status' => 'success', 'message' => 'Date saved']);
//     else echo json_encode(['status' => 'error', 'message' => $stmt->error]);
//     exit;
// }

// if ($action === 'update_cit_date') {
//     $id       = (int)($_POST['cit_id'] ?? 0);
//     $cit_date = mysqli_real_escape_string($conn, $_POST['cit_date'] ?? '');
//     $stmt = $conn->prepare("UPDATE add_cit_date SET cit_date=? WHERE id=?");
//     $stmt->bind_param('si', $cit_date, $id);
//     if ($stmt->execute()) echo json_encode(['status' => 'success', 'message' => 'Date updated']);
//     else echo json_encode(['status' => 'error', 'message' => $stmt->error]);
//     exit;
// }


if ($action === 'save_cit_date') {
    $cit_date = mysqli_real_escape_string($conn, $_POST['cit_date'] ?? '');
    $q = "INSERT INTO add_cit_date (cit_date) VALUES ('$cit_date')";
    if (mysqli_query($conn, $q))
        echo json_encode(['status' => 'success', 'message' => 'Date saved']);
    else
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

if ($action === 'update_cit_date') {
    $id       = (int)($_POST['cit_id'] ?? 0);
    $cit_date = mysqli_real_escape_string($conn, $_POST['cit_date'] ?? '');
    $q = "UPDATE add_cit_date SET cit_date='$cit_date' WHERE id='$id'";
    if (mysqli_query($conn, $q))
        echo json_encode(['status' => 'success', 'message' => 'Date updated']);
    else
        echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

if ($action === 'delete_cit_date') {
    $id = (int)($_POST['id'] ?? 0);
    if (mysqli_query($conn, "DELETE FROM add_cit_date WHERE id='$id'"))
        echo json_encode(['status' => 'success', 'message' => 'Deleted']);
    else echo json_encode(['status' => 'error', 'message' => mysqli_error($conn)]);
    exit;
}

/* ── fallback ── */
echo json_encode(['status' => 'error', 'message' => 'Invalid action: ' . $action]);
exit;
?>