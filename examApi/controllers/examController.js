// controllers/examController.js

const examService = require('../services/examService');
const userService = require('../services/userService');
const { sanitizeInput, sendResponse } = require('../utils');

const handleUserLoginInitiate = async (req, res) => {
    const userId = sanitizeInput(req.body.user_id);
    const examId = sanitizeInput(req.body.exam_id);

    try {
        const userHash = await userService.userLoginInitiate(userId, examId);
        if (userHash) {
            sendResponse(res, 200, 'Exam Initiated', { user_hash: userHash });
        } else {
            sendResponse(res, 500, 'Something went wrong!');
        }
    } catch (error) {
        sendResponse(res, 500, error.message);
    }
};

const handleUserLoginVerify = async (req, res) => {
    const userId = sanitizeInput(req.headers['userid'] || '');
    const hash = sanitizeInput(req.headers['hash'] || '');
    const examId = sanitizeInput(req.body.exam_id || '');

    try {
        const userDetails = await userService.userLoginVerify(userId, hash, examId);
        if (userDetails) {
            sendResponse(res, 200, 'User Verified', { user_details: userDetails });
        } else {
            sendResponse(res, 500, 'Something went wrong!');
        }
    } catch (error) {
        sendResponse(res, 500, error.message);
    }
};

const handleResult = async (req, res) => {
    const userId = sanitizeInput(req.body.user_id);
    const examId = sanitizeInput(req.body.exam_id);

    try {
        const result = await examService.fetchResult(userId, examId);
        if (result) {
            sendResponse(res, 200, 'Result fetched successfully', result);
        } else {
            sendResponse(res, 404, 'No result found');
        }
    } catch (error) {
        sendResponse(res, 500, `Error fetching result: ${error.message}`);
    }
};

const handleFetchAllExams = async (req, res) => {
    try {
        const exams = await examService.fetchExams();
        if (exams) {
            sendResponse(res, 200, 'Exams fetched successfully', { exams });
        } else {
            sendResponse(res, 404, 'No exams found');
        }
    } catch (error) {
        sendResponse(res, 500, error.message);
    }
};

const handleFetchExamById = async (req, res) => {
    const examId = sanitizeInput(req.body.exam_id);

    try {
        const exam = await examService.fetchExamById(examId);
        if (exam) {
            sendResponse(res, 200, 'Exam fetched successfully', { exam });
        } else {
            sendResponse(res, 404, 'Exam not found');
        }
    } catch (error) {
        sendResponse(res, 500, error.message);
    }
};

const handleFetchRandomQuestions = async (req, res) => {
    const examId = sanitizeInput(req.body.exam_id);
    const totalQuestions = sanitizeInput(req.body.total_questions);

    try {
        const questions = await examService.fetchRandomQuestions(examId, totalQuestions);
        if (questions) {
            sendResponse(res, 200, 'Random questions fetched successfully', { questions });
        } else {
            sendResponse(res, 404, 'No questions found or invalid input');
        }
    } catch (error) {
        sendResponse(res, 500, error.message);
    }
};

const handleStartExamProcess = async (req, res) => {
    const userId = sanitizeInput(req.headers['userid'] || '');
    const hash = sanitizeInput(req.headers['hash'] || '');
    const examId = sanitizeInput(req.body.exam_id || '');

    try {
        const response = await examService.handleStartExamProcess(userId, hash, examId);
        sendResponse(res, response.status, response.message, response.data);
    } catch (error) {
        sendResponse(res, 500, `Error processing request: ${error.message}`);
    }
};

const handleUpdateExamData = async (req, res) => {
    const userId = sanitizeInput(req.headers['userid'] || '');
    const hash = sanitizeInput(req.headers['hash'] || '');
    const examId = sanitizeInput(req.body.exam_id || '');
    const userAnswers = req.body.user_answers || {};

    try {
        const result = await examService.updateExamData(userId, hash, examId, userAnswers);
        if (result) {
            sendResponse(res, 200, 'Data updated successfully');
        } else {
            sendResponse(res, 500, 'Error updating data');
        }
    } catch (error) {
        sendResponse(res, 500, error.message);
    }
};

const handleEndExam = async (req, res) => {
    const userId = sanitizeInput(req.headers['userid'] || '');
    const hash = sanitizeInput(req.headers['hash'] || '');
    const examId = sanitizeInput(req.body.exam_id || '');
    const userAnswers = req.body.user_answers || {};
    const isWebView = req.body.is_web_view || false;
    const instantresult = req.body.instant_result || "off";

    try {
        const result = await examService.calculateAndStoreResult(userId, hash, examId, userAnswers, isWebView, instantresult);
        if (result) {
            sendResponse(res, 200, 'Exam Ended');
        } else {
            sendResponse(res, 500, 'Error in processing result');
        }
    } catch (error) {
        sendResponse(res, 500, `Error ending exam: ${error.message}`);
    }
};

const handleRequestRetest = async (req, res) => {
    const userId = sanitizeInput(req.headers['userid'] || '');
    const hash = sanitizeInput(req.headers['hash'] || '');
    const examId = sanitizeInput(req.body.exam_id || '');

    try {
        const result = await examService.requestRetest(userId, hash, examId);
        if (result) {
            sendResponse(res, 200, 'Retest initiated successfully');
        } else {
            sendResponse(res, 500, 'Error initiating retest');
        }
    } catch (error) {
        sendResponse(res, 500, `Error requesting retest: ${error.message}`);
    }
};

module.exports = {
    handleUserLoginInitiate,
    handleUserLoginVerify,
    handleResult,
    handleFetchAllExams,
    handleFetchExamById,
    handleFetchRandomQuestions,
    handleStartExamProcess,
    handleUpdateExamData,
    handleEndExam,
    handleRequestRetest,
};