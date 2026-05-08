<?php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);
/*
 * /api/roadmap-api.php
 *
 * Uses middleware/auth.php JWT auth (same pattern as other APIs)
 *
 * ── Domains ──────────────────────────────────────────────
 * GET  action=get_domains         → domains with counts
 * POST action=add_domain          → name, logo
 * POST action=edit_domain         → id, name, logo
 * POST action=delete_domain       → id
 *
 * ── Companies ────────────────────────────────────────────
 * GET  action=get_companies       → domain_id
 * POST action=add_company         → domain_id, company_name, logo
 * POST action=edit_company        → id, company_name, logo
 * POST action=delete_company      → id
 *
 * ── Internships ──────────────────────────────────────────
 * GET  action=get_internships     → domain_id
 * POST action=add_internship      → domain_id, company, logo, title, description, fullDescription, skills
 * POST action=edit_internship     → id, company, logo, title, description, fullDescription, skills
 * POST action=delete_internship   → id
 *
 * ── Roles ────────────────────────────────────────────────
 * GET  action=get_roles           → domain_id
 * GET  action=get_role_details    → role_id
 * POST action=add_role            → domain_id, title, skills, year?, salary?, projectedSalary?
 * POST action=edit_role           → id, title, skills
 * POST action=add_salary          → role_id, year, salary, projectedSalary?
 * POST action=delete_role         → id
 *
 * ── Trainings ────────────────────────────────────────────
 * GET  action=get_trainings       → domain_id
 * POST action=add_training        → domain_id, title, icon, completion
 * POST action=edit_training       → id, title, icon, completion
 * POST action=delete_training     → id
 *
 * ── Skills ───────────────────────────────────────────────
 * GET  action=get_skills          → domain_id
 * POST action=add_skill           → domain_id, skill
 * POST action=edit_skill          → id, skill, old_skill
 * POST action=delete_skill        → id, skill
 *
 * ── Bulk assign ──────────────────────────────────────────
 * GET  action=get_all_items       → for bulk assign dropdowns
 * POST action=bulk_assign         → to_domains[], internships[], companies[], roles[], trainings[], skills[]
 */

require_once '/home/istudio/public_html/cit3/admin/react-api/config/database.php';
require_once '/home/istudio/public_html/cit3/admin/react-api/middleware/auth.php';

$jwt        = require_jwt();
$method     = $_SERVER['REQUEST_METHOD'];
$action     = $_GET['action'] ?? $_POST['action'] ?? '';

/* ── helper: parse comma-separated skills ── */
function parseSkills(string $raw): array {
    return array_values(array_filter(array_map('trim', explode(',', $raw))));
}

/* ── helper: insert skills for internship ── */
function insertInternshipSkills($conn, int $id, array $skills): void {
    foreach ($skills as $s) {
        if ($s === '') continue;
        $s = $conn->real_escape_string($s);
        $conn->query("INSERT INTO career_roadmap_internship_skills (internship_id, skill) VALUES ($id, '$s')");
    }
}

/* ── helper: insert skills for role ── */
function insertRoleSkills($conn, int $id, array $skills): void {
    foreach ($skills as $s) {
        if ($s === '') continue;
        $s = $conn->real_escape_string($s);
        $conn->query("INSERT INTO career_roadmap_role_skills (role_id, skill) VALUES ($id, '$s')");
    }
}

/* ════════════════════════════════════
   DOMAINS
════════════════════════════════════ */
if ($action === 'get_domains') {
    $res = $conn->query("
        SELECT d.*,
               COUNT(DISTINCT c.company_id)     AS companies_count,
               COUNT(DISTINCT i.internship_id)  AS internships_count,
               COUNT(DISTINCT r.role_id)         AS roles_count,
               COUNT(DISTINCT t.training_id)     AS trainings_count,
               COUNT(DISTINCT s.skill_id)        AS skills_count
        FROM career_roadmap_domains d
        LEFT JOIN career_roadmap_companies    c ON d.domain_id = c.domain_id
        LEFT JOIN career_roadmap_internships  i ON d.domain_id = i.domain_id
        LEFT JOIN career_roadmap_roles        r ON d.domain_id = r.domain_id
        LEFT JOIN career_roadmap_trainings    t ON d.domain_id = t.domain_id
        LEFT JOIN career_roadmap_skills       s ON d.domain_id = s.domain_id
        GROUP BY d.domain_id
        ORDER BY d.name
    ");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    api_success(['domains' => $rows]);
}

if ($action === 'add_domain') {
    $name = $conn->real_escape_string(trim($_POST['name'] ?? ''));
    $logo = $conn->real_escape_string(trim($_POST['logo'] ?? ''));
    if (!$name) api_error('Name required');
    $conn->query("INSERT INTO career_roadmap_domains (name, logo) VALUES ('$name', '$logo')");
    api_success(['id' => $conn->insert_id], 'Domain added');
}

if ($action === 'edit_domain') {
    $id   = (int)($_POST['id'] ?? 0);
    $name = $conn->real_escape_string(trim($_POST['name'] ?? ''));
    $logo = $conn->real_escape_string(trim($_POST['logo'] ?? ''));
    if (!$id) api_error('ID required');
    $conn->query("UPDATE career_roadmap_domains SET name='$name', logo='$logo' WHERE domain_id=$id");
    api_success([], 'Domain updated');
}

if ($action === 'delete_domain') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) api_error('ID required');
    $conn->query("DELETE FROM career_roadmap_domains WHERE domain_id=$id");
    api_success([], 'Domain deleted');
}

/* ════════════════════════════════════
   COMPANIES
════════════════════════════════════ */
if ($action === 'get_companies') {
    $did = (int)($_GET['domain_id'] ?? 0);
    if (!$did) api_error('domain_id required');
    $res = $conn->query("SELECT * FROM career_roadmap_companies WHERE domain_id=$did ORDER BY company_name");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    api_success(['companies' => $rows]);
}

if ($action === 'add_company') {
    $did  = (int)($_POST['domain_id'] ?? 0);
    $name = $conn->real_escape_string(trim($_POST['company_name'] ?? ''));
    $logo = $conn->real_escape_string(trim($_POST['logo'] ?? ''));
    if (!$did || !$name) api_error('domain_id and company_name required');
    $conn->query("INSERT INTO career_roadmap_companies (domain_id, company_name, logo) VALUES ($did, '$name', '$logo')");
    api_success(['id' => $conn->insert_id], 'Company added');
}

if ($action === 'edit_company') {
    $id   = (int)($_POST['id'] ?? 0);
    $name = $conn->real_escape_string(trim($_POST['company_name'] ?? ''));
    $logo = $conn->real_escape_string(trim($_POST['logo'] ?? ''));
    if (!$id) api_error('ID required');
    $conn->query("UPDATE career_roadmap_companies SET company_name='$name', logo='$logo' WHERE company_id=$id");
    api_success([], 'Company updated');
}

if ($action === 'delete_company') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) api_error('ID required');
    $conn->query("DELETE FROM career_roadmap_companies WHERE company_id=$id");
    api_success([], 'Company deleted');
}

/* ════════════════════════════════════
   INTERNSHIPS
════════════════════════════════════ */
if ($action === 'get_internships') {
    $did = (int)($_GET['domain_id'] ?? 0);
    if (!$did) api_error('domain_id required');
    $res = $conn->query("
        SELECT i.*, GROUP_CONCAT(s.skill SEPARATOR ', ') AS skills
        FROM career_roadmap_internships i
        LEFT JOIN career_roadmap_internship_skills s ON i.internship_id = s.internship_id
        WHERE i.domain_id=$did
        GROUP BY i.internship_id
        ORDER BY i.title
    ");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    api_success(['internships' => $rows]);
}

if ($action === 'add_internship') {
    $did     = (int)($_POST['domain_id'] ?? 0);
    $company = $conn->real_escape_string(trim($_POST['company'] ?? ''));
    $logo    = $conn->real_escape_string(trim($_POST['logo'] ?? ''));
    $title   = $conn->real_escape_string(trim($_POST['title'] ?? ''));
    $desc    = $conn->real_escape_string(trim($_POST['description'] ?? ''));
    $full    = $conn->real_escape_string(trim($_POST['fullDescription'] ?? ''));
    $skills  = parseSkills($_POST['skills'] ?? '');
    if (!$did || !$title || !$company) api_error('domain_id, company, title required');
    $conn->query("INSERT INTO career_roadmap_internships (domain_id,company,logo,title,description,fullDescription) VALUES ($did,'$company','$logo','$title','$desc','$full')");
    $new_id = $conn->insert_id;
    insertInternshipSkills($conn, $new_id, $skills);
    api_success(['id' => $new_id], 'Internship added');
}

if ($action === 'edit_internship') {
    $id      = (int)($_POST['id'] ?? 0);
    $company = $conn->real_escape_string(trim($_POST['company'] ?? ''));
    $logo    = $conn->real_escape_string(trim($_POST['logo'] ?? ''));
    $title   = $conn->real_escape_string(trim($_POST['title'] ?? ''));
    $desc    = $conn->real_escape_string(trim($_POST['description'] ?? ''));
    $full    = $conn->real_escape_string(trim($_POST['fullDescription'] ?? ''));
    $skills  = parseSkills($_POST['skills'] ?? '');
    if (!$id) api_error('ID required');
    $conn->query("UPDATE career_roadmap_internships SET company='$company',logo='$logo',title='$title',description='$desc',fullDescription='$full' WHERE internship_id=$id");
    $conn->query("DELETE FROM career_roadmap_internship_skills WHERE internship_id=$id");
    insertInternshipSkills($conn, $id, $skills);
    api_success([], 'Internship updated');
}

if ($action === 'delete_internship') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) api_error('ID required');
    $conn->query("DELETE FROM career_roadmap_internship_skills WHERE internship_id=$id");
    $conn->query("DELETE FROM career_roadmap_internships WHERE internship_id=$id");
    api_success([], 'Internship deleted');
}

/* ════════════════════════════════════
   ROLES
════════════════════════════════════ */
if ($action === 'get_roles') {
    $did = (int)($_GET['domain_id'] ?? 0);
    if (!$did) api_error('domain_id required');
    $res = $conn->query("
        WITH LatestSalary AS (
            SELECT role_id, salary, projectedSalary, year
            FROM career_roadmap_salary_data sd1
            WHERE year = (SELECT MAX(year) FROM career_roadmap_salary_data sd2 WHERE sd2.role_id = sd1.role_id)
        )
        SELECT r.*,
               GROUP_CONCAT(DISTINCT rs.skill SEPARATOR ', ') AS skills,
               ls.salary        AS current_salary,
               ls.projectedSalary AS projected_salary,
               ls.year          AS salary_year
        FROM career_roadmap_roles r
        LEFT JOIN career_roadmap_role_skills rs ON r.role_id = rs.role_id
        LEFT JOIN LatestSalary ls               ON r.role_id = ls.role_id
        WHERE r.domain_id=$did
        GROUP BY r.role_id, r.domain_id, r.title, ls.salary, ls.projectedSalary, ls.year
        ORDER BY r.title
    ");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    api_success(['roles' => $rows]);
}

if ($action === 'get_role_details') {
    $rid = (int)($_GET['role_id'] ?? 0);
    if (!$rid) api_error('role_id required');
    $sr = $conn->query("SELECT skill FROM career_roadmap_role_skills WHERE role_id=$rid ORDER BY skill");
    $skills = [];
    if ($sr) while ($r = $sr->fetch_assoc()) $skills[] = $r['skill'];
    $sd = $conn->query("SELECT year,salary,projectedSalary FROM career_roadmap_salary_data WHERE role_id=$rid ORDER BY year DESC");
    $salaries = [];
    if ($sd) while ($r = $sd->fetch_assoc()) $salaries[] = $r;
    api_success(['skills' => $skills, 'salaries' => $salaries]);
}

if ($action === 'add_role') {
    $did    = (int)($_POST['domain_id'] ?? 0);
    $title  = $conn->real_escape_string(trim($_POST['title'] ?? ''));
    $skills = parseSkills($_POST['skills'] ?? '');
    $year   = !empty($_POST['year'])   ? (int)$_POST['year']   : null;
    $salary = !empty($_POST['salary']) ? (int)$_POST['salary'] : null;
    $proj   = !empty($_POST['projectedSalary']) ? (int)$_POST['projectedSalary'] : null;
    if (!$did || !$title) api_error('domain_id, title required');
    $conn->query("INSERT INTO career_roadmap_roles (domain_id, title) VALUES ($did, '$title')");
    $new_id = $conn->insert_id;
    insertRoleSkills($conn, $new_id, $skills);
    if ($year && $salary) {
        $ps = $proj ?? 'NULL';
        $conn->query("INSERT INTO career_roadmap_salary_data (role_id,year,salary,projectedSalary) VALUES ($new_id,$year,$salary,$ps)");
    }
    api_success(['id' => $new_id], 'Role added');
}

if ($action === 'edit_role') {
    $id     = (int)($_POST['id'] ?? 0);
    $title  = $conn->real_escape_string(trim($_POST['title'] ?? ''));
    $skills = parseSkills($_POST['skills'] ?? '');
    if (!$id) api_error('ID required');
    $conn->query("UPDATE career_roadmap_roles SET title='$title' WHERE role_id=$id");
    $conn->query("DELETE FROM career_roadmap_role_skills WHERE role_id=$id");
    insertRoleSkills($conn, $id, $skills);
    api_success([], 'Role updated');
}

if ($action === 'add_salary') {
    $rid    = (int)($_POST['role_id'] ?? 0);
    $year   = (int)($_POST['year'] ?? 0);
    $salary = (int)($_POST['salary'] ?? 0);
    $proj   = !empty($_POST['projectedSalary']) ? (int)$_POST['projectedSalary'] : null;
    if (!$rid || !$year || !$salary) api_error('role_id, year, salary required');
    $ps = $proj ?? 'NULL';
    // Upsert
    $chk = $conn->query("SELECT id FROM career_roadmap_salary_data WHERE role_id=$rid AND year=$year");
    if ($chk && $chk->num_rows > 0) {
        $conn->query("UPDATE career_roadmap_salary_data SET salary=$salary, projectedSalary=$ps WHERE role_id=$rid AND year=$year");
    } else {
        $conn->query("INSERT INTO career_roadmap_salary_data (role_id,year,salary,projectedSalary) VALUES ($rid,$year,$salary,$ps)");
    }
    api_success([], 'Salary data saved');
}

if ($action === 'delete_role') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) api_error('ID required');
    $conn->query("DELETE FROM career_roadmap_role_skills WHERE role_id=$id");
    $conn->query("DELETE FROM career_roadmap_salary_data WHERE role_id=$id");
    $conn->query("DELETE FROM career_roadmap_roles WHERE role_id=$id");
    api_success([], 'Role deleted');
}

/* ════════════════════════════════════
   TRAININGS
════════════════════════════════════ */
if ($action === 'get_trainings') {
    $did = (int)($_GET['domain_id'] ?? 0);
    if (!$did) api_error('domain_id required');
    $res = $conn->query("SELECT * FROM career_roadmap_trainings WHERE domain_id=$did ORDER BY title");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    api_success(['trainings' => $rows]);
}

if ($action === 'add_training') {
    $did        = (int)($_POST['domain_id'] ?? 0);
    $title      = $conn->real_escape_string(trim($_POST['title'] ?? ''));
    $icon       = $conn->real_escape_string(trim($_POST['icon'] ?? ''));
    $completion = (int)($_POST['completion'] ?? 0);
    if (!$did || !$title) api_error('domain_id, title required');
    $conn->query("INSERT INTO career_roadmap_trainings (domain_id,title,icon,completion) VALUES ($did,'$title','$icon',$completion)");
    api_success(['id' => $conn->insert_id], 'Training added');
}

if ($action === 'edit_training') {
    $id         = (int)($_POST['id'] ?? 0);
    $title      = $conn->real_escape_string(trim($_POST['title'] ?? ''));
    $icon       = $conn->real_escape_string(trim($_POST['icon'] ?? ''));
    $completion = (int)($_POST['completion'] ?? 0);
    if (!$id) api_error('ID required');
    $conn->query("UPDATE career_roadmap_trainings SET title='$title',icon='$icon',completion=$completion WHERE training_id=$id");
    api_success([], 'Training updated');
}

if ($action === 'delete_training') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) api_error('ID required');
    $conn->query("DELETE FROM career_roadmap_trainings WHERE training_id=$id");
    api_success([], 'Training deleted');
}

/* ════════════════════════════════════
   SKILLS
════════════════════════════════════ */
if ($action === 'get_skills') {
    $did = (int)($_GET['domain_id'] ?? 0);
    if (!$did) api_error('domain_id required');
    $res = $conn->query("
        SELECT s.*,
               COUNT(DISTINCT CASE WHEN r.domain_id = s.domain_id THEN rs.role_id END)        AS roles_count,
               COUNT(DISTINCT CASE WHEN i.domain_id = s.domain_id THEN ist.internship_id END) AS internships_count,
               GROUP_CONCAT(DISTINCT CASE WHEN r.domain_id = s.domain_id THEN r.title END)    AS role_titles,
               GROUP_CONCAT(DISTINCT CASE WHEN i.domain_id = s.domain_id THEN i.title END)    AS internship_titles
        FROM career_roadmap_skills s
        LEFT JOIN career_roadmap_role_skills        rs  ON s.skill = rs.skill
        LEFT JOIN career_roadmap_roles              r   ON rs.role_id = r.role_id
        LEFT JOIN career_roadmap_internship_skills  ist ON s.skill = ist.skill
        LEFT JOIN career_roadmap_internships        i   ON ist.internship_id = i.internship_id
        WHERE s.domain_id=$did
        GROUP BY s.skill_id
        ORDER BY s.skill
    ");
    $rows = [];
    if ($res) while ($r = $res->fetch_assoc()) $rows[] = $r;
    api_success(['skills' => $rows]);
}

if ($action === 'add_skill') {
    $did   = (int)($_POST['domain_id'] ?? 0);
    $skill = $conn->real_escape_string(trim($_POST['skill'] ?? ''));
    if (!$did || !$skill) api_error('domain_id, skill required');
    $conn->query("INSERT INTO career_roadmap_skills (domain_id, skill) VALUES ($did, '$skill')");
    api_success(['id' => $conn->insert_id], 'Skill added');
}

if ($action === 'edit_skill') {
    $id        = (int)($_POST['id'] ?? 0);
    $skill     = $conn->real_escape_string(trim($_POST['skill'] ?? ''));
    $old_skill = $conn->real_escape_string(trim($_POST['old_skill'] ?? ''));
    if (!$id) api_error('ID required');
    $conn->begin_transaction();
    try {
        $conn->query("UPDATE career_roadmap_skills SET skill='$skill' WHERE skill_id=$id");
        $conn->query("UPDATE career_roadmap_role_skills SET skill='$skill' WHERE skill='$old_skill'");
        $conn->query("UPDATE career_roadmap_internship_skills SET skill='$skill' WHERE skill='$old_skill'");
        $conn->commit();
        api_success([], 'Skill updated');
    } catch (Exception $e) {
        $conn->rollback();
        api_error('Failed to update skill');
    }
}

if ($action === 'delete_skill') {
    $id    = (int)($_POST['id'] ?? 0);
    $skill = $conn->real_escape_string(trim($_POST['skill'] ?? ''));
    if (!$id) api_error('ID required');
    $conn->begin_transaction();
    try {
        $conn->query("DELETE FROM career_roadmap_role_skills WHERE skill='$skill'");
        $conn->query("DELETE FROM career_roadmap_internship_skills WHERE skill='$skill'");
        $conn->query("DELETE FROM career_roadmap_skills WHERE skill_id=$id");
        $conn->commit();
        api_success([], 'Skill deleted');
    } catch (Exception $e) {
        $conn->rollback();
        api_error('Failed to delete skill');
    }
}

/* ════════════════════════════════════
   BULK ASSIGN (for dashboard)
════════════════════════════════════ */
if ($action === 'get_all_items') {
    $companies   = []; $res = $conn->query("SELECT company_id,company_name FROM career_roadmap_companies ORDER BY company_name");
    if ($res) while ($r=$res->fetch_assoc()) $companies[] = $r;
    $internships = []; $res = $conn->query("SELECT internship_id,title FROM career_roadmap_internships ORDER BY title");
    if ($res) while ($r=$res->fetch_assoc()) $internships[] = $r;
    $trainings   = []; $res = $conn->query("SELECT training_id,title FROM career_roadmap_trainings ORDER BY title");
    if ($res) while ($r=$res->fetch_assoc()) $trainings[] = $r;
    $skills_all  = []; $res = $conn->query("SELECT skill_id,skill FROM career_roadmap_skills ORDER BY skill");
    if ($res) while ($r=$res->fetch_assoc()) $skills_all[] = $r;
    $roles       = []; $res = $conn->query("SELECT role_id,title FROM career_roadmap_roles ORDER BY title");
    if ($res) while ($r=$res->fetch_assoc()) $roles[] = $r;
    api_success(compact('companies','internships','trainings','skills_all','roles'));
}

if ($action === 'bulk_assign') {
    $to_domains  = json_decode($_POST['to_domains']    ?? '[]', true);
    $internships = json_decode($_POST['internships']   ?? '[]', true);
    $companies   = json_decode($_POST['companies']     ?? '[]', true);
    $roles_list  = json_decode($_POST['roles']         ?? '[]', true);
    $trainings   = json_decode($_POST['trainings']     ?? '[]', true);
    $skills_list = json_decode($_POST['skills']        ?? '[]', true);

    if (empty($to_domains)) api_error('Select at least one target domain');

    foreach ($to_domains as $d) {
        $d = (int)$d;

        // Internships
        foreach ($internships as $iid) {
            $iid = (int)$iid;
            $r = $conn->query("SELECT company,logo,title,description,fullDescription FROM career_roadmap_internships WHERE internship_id=$iid")->fetch_assoc();
            if (!$r) continue;
            $c=$conn->real_escape_string($r['company']); $l=$conn->real_escape_string($r['logo']);
            $t=$conn->real_escape_string($r['title']); $de=$conn->real_escape_string($r['description']);
            $f=$conn->real_escape_string($r['fullDescription']);
            $conn->query("INSERT INTO career_roadmap_internships (domain_id,company,logo,title,description,fullDescription) VALUES ($d,'$c','$l','$t','$de','$f')");
            $new = $conn->insert_id;
            $sq = $conn->query("SELECT skill FROM career_roadmap_internship_skills WHERE internship_id=$iid");
            if ($sq) while ($sr=$sq->fetch_assoc()) { $sk=$conn->real_escape_string($sr['skill']); $conn->query("INSERT INTO career_roadmap_internship_skills (internship_id,skill) VALUES ($new,'$sk')"); }
        }

        // Companies
        foreach ($companies as $cid) {
            $cid = (int)$cid;
            $r = $conn->query("SELECT company_name,logo FROM career_roadmap_companies WHERE company_id=$cid")->fetch_assoc();
            if (!$r) continue;
            $n=$conn->real_escape_string($r['company_name']); $l=$conn->real_escape_string($r['logo']);
            $conn->query("INSERT INTO career_roadmap_companies (domain_id,company_name,logo) VALUES ($d,'$n','$l')");
        }

        // Trainings
        foreach ($trainings as $tid) {
            $tid = (int)$tid;
            $r = $conn->query("SELECT title,icon,completion FROM career_roadmap_trainings WHERE training_id=$tid")->fetch_assoc();
            if (!$r) continue;
            $t=$conn->real_escape_string($r['title']); $ic=$conn->real_escape_string($r['icon']); $cp=(int)$r['completion'];
            $conn->query("INSERT INTO career_roadmap_trainings (domain_id,title,icon,completion) VALUES ($d,'$t','$ic',$cp)");
        }

        // Skills
        foreach ($skills_list as $sid) {
            $sid = (int)$sid;
            $r = $conn->query("SELECT skill FROM career_roadmap_skills WHERE skill_id=$sid")->fetch_assoc();
            if (!$r) continue;
            $sk=$conn->real_escape_string($r['skill']);
            $conn->query("INSERT INTO career_roadmap_skills (domain_id,skill) VALUES ($d,'$sk')");
        }

        // Roles (with skills + salary)
        foreach ($roles_list as $rid) {
            $rid = (int)$rid;
            $r = $conn->query("SELECT title FROM career_roadmap_roles WHERE role_id=$rid")->fetch_assoc();
            if (!$r) continue;
            $t=$conn->real_escape_string($r['title']);
            $conn->query("INSERT INTO career_roadmap_roles (domain_id,title) VALUES ($d,'$t')");
            $new = $conn->insert_id;
            $sq = $conn->query("SELECT skill FROM career_roadmap_role_skills WHERE role_id=$rid");
            if ($sq) while ($sr=$sq->fetch_assoc()) { $sk=$conn->real_escape_string($sr['skill']); $conn->query("INSERT INTO career_roadmap_role_skills (role_id,skill) VALUES ($new,'$sk')"); }
            $sq2 = $conn->query("SELECT year,salary,projectedSalary FROM career_roadmap_salary_data WHERE role_id=$rid");
            if ($sq2) while ($sr=$sq2->fetch_assoc()) { $ps=$sr['projectedSalary']??'NULL'; $conn->query("INSERT INTO career_roadmap_salary_data (role_id,year,salary,projectedSalary) VALUES ($new,{$sr['year']},{$sr['salary']},$ps)"); }
        }
    }
    api_success([], 'Items assigned successfully');
}

api_error('Unknown action');