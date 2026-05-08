<?php
/*
 * /api/skills-api.php
 *
 * Uses middleware/auth.php JWT pattern.
 *
 * Exact SQL ported from:
 *   index.php          → segments CRUD
 *   segment_skills.php → skills CRUD per segment
 *   edit_skill.php     → skill name update + questions CRUD + Excel import
 *
 * Tables:
 *   skill_assessment_segments
 *   skill_assessment_skills
 *   skill_assessment_questions
 *   skill_assessment_options
 *   expected_output
 *   skill_assessment_levels
 *   user_skill_requests
 *
 * POST action=get_segments
 * POST action=add_segment           name, description
 * POST action=edit_segment          id, name, description
 * POST action=delete_segment        id
 *
 * POST action=get_skills            segment_id
 * POST action=add_skill             segment_id, name, description
 * POST action=delete_skill          skill_id, segment_id
 *
 * POST action=get_skill             skill_id
 * POST action=update_skill          skill_id, name
 *
 * POST action=get_levels
 * POST action=get_questions         skill_id
 * POST action=add_question          skill_id, level_id, question_text, question_type,
 *                                   options (JSON), correct_index,
 *                                   inputs (JSON), outputs (JSON)
 * POST action=edit_question         question_id, skill_id, level_id, question_text,
 *                                   question_type, options, correct_index,
 *                                   inputs, outputs
 * POST action=delete_question       question_id, skill_id
 * POST action=upload_excel          skill_id + multipart excel_file
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../middleware/auth.php';

header('Content-Type: application/json');

/* ── Fix: populate $_POST if empty (handles JSON Content-Type from axios) ── */
if (empty($_POST)) {
    $rawBody = file_get_contents('php://input');
    if ($rawBody) {
        parse_str($rawBody, $parsed);
        if (!empty($parsed)) {
            $_POST = $parsed;
        } else {
            $json = json_decode($rawBody, true);
            if (is_array($json)) $_POST = $json;
        }
    }
}

/* Validate JWT — no require_method here so multipart (excel upload) also works */
$jwt = require_jwt();

/* Read action from POST body or GET params */
$action = $_POST['action'] ?? $_GET['action'] ?? '';

/* ════════════════════════════════════════════════
   SEGMENTS  (index.php)
════════════════════════════════════════════════ */

/* ── get_segments
   Exact query from index.php:
   SELECT s.*, COUNT(DISTINCT sk.id) AS skills_count,
          COUNT(DISTINCT q.id) AS questions_count
   FROM skill_assessment_segments s
   LEFT JOIN skill_assessment_skills sk ON s.id = sk.segment_id
   LEFT JOIN skill_assessment_questions q ON sk.id = q.skill_id
   GROUP BY s.id ORDER BY s.name
── */
if ($action === 'get_segments') {
    $res = $conn->query("
        SELECT s.*,
               COUNT(DISTINCT sk.id) AS skills_count,
               COUNT(DISTINCT q.id)  AS questions_count
        FROM skill_assessment_segments s
        LEFT JOIN skill_assessment_skills sk    ON s.id = sk.segment_id
        LEFT JOIN skill_assessment_questions q  ON sk.id = q.skill_id
        GROUP BY s.id
        ORDER BY s.name
    ");
    api_success(['segments' => $res ? $res->fetch_all(MYSQLI_ASSOC) : []]);
}

/* ── add_segment  (index.php: isset($_POST['add_segment'])) ── */
if ($action === 'add_segment') {
    $name = $conn->real_escape_string(trim($_POST['name'] ?? ''));
    $desc = $conn->real_escape_string(trim($_POST['description'] ?? ''));
    if (!$name) api_error('Segment name required');

    $conn->query("INSERT INTO skill_assessment_segments (name, description) VALUES ('$name','$desc')");
    api_success(['id' => $conn->insert_id], 'Segment added');
}

/* ── edit_segment  (index.php: isset($_POST['edit_segment'])) ── */
if ($action === 'edit_segment') {
    $id   = (int)($_POST['id'] ?? 0);
    $name = $conn->real_escape_string(trim($_POST['name'] ?? ''));
    $desc = $conn->real_escape_string(trim($_POST['description'] ?? ''));
    if (!$id)   api_error('id required');
    if (!$name) api_error('Segment name required');

    $conn->query("UPDATE skill_assessment_segments SET name='$name', description='$desc' WHERE id=$id");
    api_success([], 'Segment updated');
}

/* ── delete_segment  (index.php: isset($_POST['delete_segment'])) ── */
if ($action === 'delete_segment') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) api_error('id required');

    $conn->query("DELETE FROM skill_assessment_segments WHERE id=$id");
    api_success([], 'Segment deleted');
}

/* ════════════════════════════════════════════════
   SKILLS  (segment_skills.php)
════════════════════════════════════════════════ */

/* ── get_skills  (segment_skills.php: $skillsSql)
   Exact SQL:
   SELECT s.id, s.name, s.description, COUNT(r.id) AS request_count
   FROM skill_assessment_skills s
   LEFT JOIN user_skill_requests r ON s.id = r.skill_id
   WHERE s.segment_id = $segment_id
   GROUP BY s.id ORDER BY s.name
   Also returns segment name for breadcrumb.
── */
if ($action === 'get_skills') {
    $sid = (int)($_POST['segment_id'] ?? 0);
    if (!$sid) api_error('segment_id required');

    $res = $conn->query("
        SELECT s.id,
               s.name,
               s.description,
               COUNT(r.id) AS request_count
        FROM skill_assessment_skills s
        LEFT JOIN user_skill_requests r ON s.id = r.skill_id
        WHERE s.segment_id = $sid
        GROUP BY s.id
        ORDER BY s.name
    ");
    $skills = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];

    /* segment info for header/breadcrumb */
    $segRes  = $conn->query("SELECT id, name, description FROM skill_assessment_segments WHERE id=$sid LIMIT 1");
    $segment = $segRes ? $segRes->fetch_assoc() : null;
    if (!$segment) api_error('Segment not found', 404);

    api_success(['skills' => $skills, 'segment' => $segment]);
}

/* ── add_skill  (segment_skills.php: isset($_POST['add_skill']))
   INSERT INTO skill_assessment_skills (segment_id, name, description) VALUES (...)
── */
if ($action === 'add_skill') {
    $sid  = (int)($_POST['segment_id'] ?? 0);
    $name = $conn->real_escape_string(trim($_POST['name'] ?? ''));
    $desc = $conn->real_escape_string(trim($_POST['description'] ?? ''));
    if (!$sid)  api_error('segment_id required');
    if (!$name) api_error('Skill name required');

    $conn->query("INSERT INTO skill_assessment_skills (segment_id, name, description) VALUES ($sid,'$name','$desc')");
    api_success(['id' => $conn->insert_id], 'Skill added');
}

/* ── delete_skill  (segment_skills.php: isset($_POST['delete_skill']))
   DELETE FROM skill_assessment_skills WHERE id = $skill_id AND segment_id = $segment_id
── */
if ($action === 'delete_skill') {
    $skillId    = (int)($_POST['skill_id']    ?? 0);
    $segmentId  = (int)($_POST['segment_id']  ?? 0);
    if (!$skillId) api_error('skill_id required');

    $conn->query("DELETE FROM skill_assessment_skills WHERE id=$skillId AND segment_id=$segmentId");
    api_success([], 'Skill deleted');
}

/* ════════════════════════════════════════════════
   SINGLE SKILL  (edit_skill.php top section)
════════════════════════════════════════════════ */

/* ── get_skill
   SELECT id, segment_id, name FROM skill_assessment_skills WHERE id = $skill_id
   Also fetches segment name for breadcrumb.
── */
if ($action === 'get_skill') {
    $id = (int)($_POST['skill_id'] ?? 0);
    if (!$id) api_error('skill_id required');

    $res = $conn->query("
        SELECT sk.id, sk.segment_id, sk.name,
               seg.name AS segment_name
        FROM skill_assessment_skills sk
        LEFT JOIN skill_assessment_segments seg ON seg.id = sk.segment_id
        WHERE sk.id = $id
        LIMIT 1
    ");
    $skill = $res ? $res->fetch_assoc() : null;
    if (!$skill) api_error('Skill not found', 404);

    api_success(['skill' => $skill]);
}

/* ── update_skill  (edit_skill.php: isset($_POST['update_skill']))
   UPDATE skill_assessment_skills SET name='$newName' WHERE id=$skill_id
── */
if ($action === 'update_skill') {
    $id   = (int)($_POST['skill_id'] ?? 0);
    $name = $conn->real_escape_string(trim($_POST['name'] ?? ''));
    if (!$id)   api_error('skill_id required');
    if (!$name) api_error('name required');

    $conn->query("UPDATE skill_assessment_skills SET name='$name' WHERE id=$id");
    api_success([], 'Skill updated');
}

/* ════════════════════════════════════════════════
   LEVELS  (edit_skill.php: levels dropdown)
════════════════════════════════════════════════ */
if ($action === 'get_levels') {
    $res = $conn->query("SELECT id, name FROM skill_assessment_levels ORDER BY id");
    api_success(['levels' => $res ? $res->fetch_all(MYSQLI_ASSOC) : []]);
}

/* ════════════════════════════════════════════════
   QUESTIONS  (edit_skill.php)
════════════════════════════════════════════════ */

/* ── get_questions
   Exact $questionsSql from edit_skill.php:
   Uses correlated subqueries for all_options and all_outputs.
── */
if ($action === 'get_questions') {
    $skillId = (int)($_POST['skill_id'] ?? 0);
    if (!$skillId) api_error('skill_id required');

    $res = $conn->query("
        SELECT q.id,
               q.level_id,
               lv.name AS level_name,
               q.question_text,
               q.correct_answer_index,
               q.question_type,
               (
                   SELECT GROUP_CONCAT(option_text ORDER BY option_index SEPARATOR '||')
                   FROM skill_assessment_options o
                   WHERE o.question_id = q.id
               ) AS all_options,
               (
                   SELECT GROUP_CONCAT(expected_output SEPARATOR '||')
                   FROM expected_output eo
                   WHERE eo.question_id = q.id
               ) AS all_outputs
        FROM skill_assessment_questions q
        LEFT JOIN skill_assessment_levels lv ON q.level_id = lv.id
        WHERE q.skill_id = $skillId
        ORDER BY q.id
    ");

    $questions = [];
    if ($res) {
        while ($q = $res->fetch_assoc()) {
            /* Parse the || separated strings into arrays (for React convenience) */
            $q['options'] = $q['all_options'] ? explode('||', $q['all_options']) : [];
            $q['outputs'] = $q['all_outputs'] ? explode('||', $q['all_outputs']) : [];
            $questions[]  = $q;
        }
    }
    api_success(['questions' => $questions]);
}

/* ── Helper: insert MCQ options
   INSERT INTO skill_assessment_options (question_id, option_index, option_text) VALUES (...)
── */
function insertMcqOptions($conn, int $qId, array $options): void {
    foreach ($options as $idx => $opt) {
        $opt = trim($opt);
        if ($opt === '') continue;
        $esc = $conn->real_escape_string($opt);
        $conn->query("INSERT INTO skill_assessment_options (question_id, option_index, option_text) VALUES ($qId,$idx,'$esc')");
    }
}

/* ── Helper: insert CODING inputs (stored as options) + outputs
   Inputs  → skill_assessment_options  (same as MCQ options table)
   Outputs → expected_output
── */
function insertCodingData($conn, int $qId, array $inputs, array $outputs): void {
    foreach ($inputs as $idx => $inp) {
        $inp = trim($inp);
        if ($inp === '') continue;
        $esc = $conn->real_escape_string($inp);
        $conn->query("INSERT INTO skill_assessment_options (question_id, option_index, option_text) VALUES ($qId,$idx,'$esc')");
    }
    foreach ($outputs as $out) {
        $out = trim($out);
        if ($out === '') continue;
        $esc = $conn->real_escape_string($out);
        $conn->query("INSERT INTO expected_output (question_id, expected_output) VALUES ($qId,'$esc')");
    }
}

/* ── add_question  (edit_skill.php: isset($_POST['add_question']))
   Exact logic:
   1. INSERT question row
   2. If MCQ  → insertOptions
   3. If CODING → insert inputs as options + insert outputs to expected_output
── */
if ($action === 'add_question') {
    $skillId  = (int)($_POST['skill_id']     ?? 0);
    $levelId  = (int)($_POST['level_id']     ?? 0);
    $qText    = $conn->real_escape_string(trim($_POST['question_text'] ?? ''));
    $qType    = $_POST['question_type'] ?? 'MCQ';
    if (!in_array($qType, ['MCQ', 'CODING'])) $qType = 'MCQ';
    $corrIdx  = $qType === 'MCQ' ? (int)($_POST['correct_index'] ?? 0) : 0;

    /* React sends these as JSON strings */
    $options  = json_decode($_POST['options']  ?? '[]', true) ?: [];
    $inputs   = json_decode($_POST['inputs']   ?? '[]', true) ?: [];
    $outputs  = json_decode($_POST['outputs']  ?? '[]', true) ?: [];

    if (!$skillId) api_error('skill_id required');
    if (!$qText)   api_error('question_text required');

    $conn->query("
        INSERT INTO skill_assessment_questions
            (skill_id, level_id, question_text, correct_answer_index, question_type)
        VALUES ($skillId, $levelId, '$qText', $corrIdx, '$qType')
    ");
    $newId = $conn->insert_id;

    if ($qType === 'MCQ')    insertMcqOptions($conn, $newId, $options);
    if ($qType === 'CODING') insertCodingData($conn,  $newId, $inputs, $outputs);

    api_success(['id' => $newId], 'Question added');
}

/* ── edit_question  (edit_skill.php: isset($_POST['edit_question']))
   Exact logic:
   1. UPDATE question row
   2. DELETE old options + old expected_outputs
   3. Re-insert based on question_type
── */
if ($action === 'edit_question') {
    $qId     = (int)($_POST['question_id'] ?? 0);
    $skillId = (int)($_POST['skill_id']    ?? 0);
    $levelId = (int)($_POST['level_id']    ?? 0);
    $qText   = $conn->real_escape_string(trim($_POST['question_text'] ?? ''));
    $qType   = $_POST['question_type'] ?? 'MCQ';
    if (!in_array($qType, ['MCQ', 'CODING'])) $qType = 'MCQ';
    $corrIdx = $qType === 'MCQ' ? (int)($_POST['correct_index'] ?? 0) : 0;

    $options = json_decode($_POST['options']  ?? '[]', true) ?: [];
    $inputs  = json_decode($_POST['inputs']   ?? '[]', true) ?: [];
    $outputs = json_decode($_POST['outputs']  ?? '[]', true) ?: [];

    if (!$qId) api_error('question_id required');

    /* UPDATE main question row */
    $conn->query("
        UPDATE skill_assessment_questions
        SET level_id             = $levelId,
            question_text        = '$qText',
            correct_answer_index = $corrIdx,
            question_type        = '$qType'
        WHERE id = $qId AND skill_id = $skillId
    ");

    /* DELETE old options + outputs (always, then re-insert) */
    $conn->query("DELETE FROM skill_assessment_options WHERE question_id = $qId");
    $conn->query("DELETE FROM expected_output          WHERE question_id = $qId");

    /* Re-insert */
    if ($qType === 'MCQ')    insertMcqOptions($conn, $qId, $options);
    if ($qType === 'CODING') insertCodingData($conn,  $qId, $inputs, $outputs);

    api_success([], 'Question updated');
}

/* ── delete_question  (edit_skill.php: isset($_POST['delete_question']))
   Exact order:
   DELETE expected_output → DELETE skill_assessment_options → DELETE skill_assessment_questions
── */
if ($action === 'delete_question') {
    $qId     = (int)($_POST['question_id'] ?? 0);
    $skillId = (int)($_POST['skill_id']    ?? 0);
    if (!$qId) api_error('question_id required');

    $conn->query("DELETE FROM expected_output            WHERE question_id = $qId");
    $conn->query("DELETE FROM skill_assessment_options   WHERE question_id = $qId");
    $conn->query("DELETE FROM skill_assessment_questions WHERE id = $qId AND skill_id = $skillId");

    api_success([], 'Question deleted');
}

/* ════════════════════════════════════════════════
   EXCEL UPLOAD  (edit_skill.php: isset($_POST['upload_excel']))
   Column map (exact from PHP):
     A = Level name  (matched to skill_assessment_levels.name)
     B = Question text
     C-H = Options 1-6
     I = Answer  e.g. "Option3" → correctIndex = 2
   Skips row 1 (header). Skips rows where Level + Question both empty.
════════════════════════════════════════════════ */
if ($action === 'upload_excel') {
    $skillId = (int)($_POST['skill_id'] ?? 0);
    if (!$skillId) api_error('skill_id required');
    if (empty($_FILES['excel_file']['tmp_name'])) api_error('No file uploaded');

    $vendorPath = __DIR__ . '/../../vendor/autoload.php';
    if (!file_exists($vendorPath)) api_error('PhpSpreadsheet not available on this server');

    require_once $vendorPath;

    /* Build levelMap: lowercase name → id */
    $lvRes    = $conn->query("SELECT id, name FROM skill_assessment_levels ORDER BY id");
    $levelMap = [];
    if ($lvRes) {
        while ($lv = $lvRes->fetch_assoc()) {
            $levelMap[strtolower(trim($lv['name']))] = (int)$lv['id'];
        }
    }

    try {
        $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($_FILES['excel_file']['tmp_name']);
        $rows        = $spreadsheet->getActiveSheet()->toArray(null, true, true, true);
        $inserted    = 0;

        foreach ($rows as $rowIndex => $cols) {
            if ($rowIndex === 1) continue; /* skip header row */

            $levelNameRaw = trim((string)($cols['A'] ?? ''));
            $questionText = trim((string)($cols['B'] ?? ''));
            $opt1 = trim((string)($cols['C'] ?? ''));
            $opt2 = trim((string)($cols['D'] ?? ''));
            $opt3 = trim((string)($cols['E'] ?? ''));
            $opt4 = trim((string)($cols['F'] ?? ''));
            $opt5 = trim((string)($cols['G'] ?? ''));
            $opt6 = trim((string)($cols['H'] ?? ''));
            $answerRaw = trim((string)($cols['I'] ?? ''));

            /* Skip empty rows */
            if ($levelNameRaw === '' && $questionText === '') continue;

            /* Match level name to id */
            $lower = strtolower($levelNameRaw);
            if (!isset($levelMap[$lower])) continue;
            $levelId = $levelMap[$lower];

            /* Build options array (skip empty) */
            $allOptions = array_values(array_filter(
                [$opt1, $opt2, $opt3, $opt4, $opt5, $opt6],
                fn($o) => $o !== ''
            ));

            /* Derive correct answer index from "Option3" style value */
            $answerIndex = 0;
            if (preg_match('/Option(\d+)/i', $answerRaw, $m)) {
                $answerIndex = (int)$m[1] - 1; /* "Option3" → 2 */
                if ($answerIndex < 0) $answerIndex = 0;
                if ($answerIndex >= count($allOptions)) $answerIndex = 0;
            }

            /* INSERT question */
            $qEsc = $conn->real_escape_string($questionText);
            $conn->query("
                INSERT INTO skill_assessment_questions
                    (skill_id, level_id, question_text, correct_answer_index, question_type)
                VALUES ($skillId, $levelId, '$qEsc', $answerIndex, 'MCQ')
            ");
            $newId = $conn->insert_id;

            /* INSERT options */
            insertMcqOptions($conn, $newId, $allOptions);
            $inserted++;
        }

        api_success(['inserted' => $inserted], "Successfully imported $inserted question(s)");

    } catch (\Exception $ex) {
        api_error('Error reading file: ' . $ex->getMessage());
    }
}

api_error('Unknown action');
?>