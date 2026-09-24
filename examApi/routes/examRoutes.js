// routes/examRoutes.js

const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');

router.post('/user_login_initiate', examController.handleUserLoginInitiate);
router.post('/user_login_verify', examController.handleUserLoginVerify);
router.post('/fetch_result', examController.handleResult);
router.post('/fetch_all_exams', examController.handleFetchAllExams);
router.post('/fetch_exam_by_id', examController.handleFetchExamById);
router.post('/fetch_random_questions', examController.handleFetchRandomQuestions);
router.post('/start_exam_process', examController.handleStartExamProcess);
router.post('/update_exam_data', examController.handleUpdateExamData);
router.post('/end_exam', examController.handleEndExam);
router.post('/request_retest', examController.handleRequestRetest);

module.exports = router;