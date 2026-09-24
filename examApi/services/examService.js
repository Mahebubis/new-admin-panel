const dbPool = require('../db');
const { fetchOptionsForQuestion, fetchCorrectAnswer } = require('./mcqService');
const { updateStudentStep, fetchSetting, getUserDetailsNew, sendNetcoreActivity, updateNetcoreContact } = require('../utils');

const fetchExams = async () => {
    const query = 'SELECT * FROM cit_exams';
    const connection = await dbPool.getConnection();

    try {
        const [results] = await connection.query(query);
        return results;
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};

const fetchExamById = async (examId) => {
    const query = 'SELECT * FROM cit_exams WHERE exam_id = ?';
    const connection = await dbPool.getConnection();

    try {
        const [results] = await connection.query(query, [examId]);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};

const fetchRandomQuestions = async (examId, totalQuestions) => {
    // Define the distribution of question types
    const distribution = {
        'Logical Reasoning': 0.3333,
        'Visual Reasoning': 0.3333,
        'Data Interpretation': 0.1667,
        'Quantitative Aptitude': 0.1667,
    };

    const selectedQuestionIds = [];
    let questions = [];
    const connection = await dbPool.getConnection();

    try {
        for (const [type, percentage] of Object.entries(distribution)) {
            const numOfType = Math.round(totalQuestions * percentage);

            const questionIdList = selectedQuestionIds.length > 0 ? selectedQuestionIds.join(',') : null;
            let query = `SELECT * FROM cit_questions WHERE exam_id = ? AND question_type = ?`;
            const params = [examId, type];
            if (questionIdList) {
                query += ` AND question_id NOT IN (${questionIdList})`;
            }
            query += ` ORDER BY RAND() LIMIT ?`;
            params.push(numOfType);

            const [typeQuestions] = await connection.query(query, params);
            for (const question of typeQuestions) {
                question.options = await fetchOptionsForQuestion(question.question_id, connection);
                question.options = shuffleArray(question.options);
                questions.push(question);
                selectedQuestionIds.push(question.question_id);
            }
        }

        // Adjust if fewer questions were allocated than required
        const remainingQuestions = totalQuestions - questions.length;
        if (remainingQuestions > 0) {
            const questionIdList = selectedQuestionIds.length > 0 ? selectedQuestionIds.join(',') : null;
            let query = `SELECT * FROM cit_questions WHERE exam_id = ?`;
            const params = [examId];
            if (questionIdList) {
                query += ` AND question_id NOT IN (${questionIdList})`;
            }
            query += ` ORDER BY RAND() LIMIT ?`;
            params.push(remainingQuestions);

            const [remaining] = await connection.query(query, params);
            for (const question of remaining) {
                question.options = await fetchOptionsForQuestion(question.question_id, connection);
                question.options = shuffleArray(question.options);
                questions.push(question);
            }
        }

        // Shuffle the entire set of questions
        questions = shuffleArray(questions);

        return questions;
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};

// Helper function to shuffle an array
const shuffleArray = (array) => {
    return array.sort(() => Math.random() - 0.5);
};

const calculateAndStoreResult = async (userId, hash, examId, userAnswers, isWebView = false, instantresult) => {
    const connection = await dbPool.getConnection();
    try {
        // Start transaction
        await connection.beginTransaction();

        // Fetch start_exam time
        let query = 'SELECT start_exam FROM cit_exam_login WHERE user_id = ? AND hash = ? FOR UPDATE';
        let [results] = await connection.query(query, [userId, hash]);
        if (results.length === 0) throw new Error('User not found or invalid hash');
        const startExamTime = results[0].start_exam;

        // Update end_exam time
        const currentTime = new Date();
        query = 'UPDATE cit_exam_login SET end_exam = ? WHERE user_id = ? AND hash = ?';
        await connection.query(query, [currentTime, userId, hash]);

        // Calculate time_taken
        const timeTaken = (currentTime - new Date(startExamTime)) / 1000; // in seconds

        // Check if exam is already completed
        query = 'SELECT status FROM cit_results WHERE user_id = ? AND exam_id = ?';
        [results] = await connection.query(query, [userId, examId]);
        if (results.length > 0 && results[0].status === 'completed') {
            throw new Error('Exam already completed.');
        }

        // Fetch total questions
        query = 'SELECT total_questions FROM cit_exams WHERE exam_id = ?';
        [results] = await connection.query(query, [examId]);
        if (results.length === 0) throw new Error('No exam found with the provided exam ID.');
        const totalQuestions = results[0].total_questions;

        let correctAnswers = 0;
        let wrongAnswers = 0;

        for (const [questionId, userAnswer] of Object.entries(userAnswers)) {
            const correctAnswer = await fetchCorrectAnswer(questionId, connection);
            if (correctAnswer === null) throw new Error(`Error fetching correct answer for question ID: ${questionId}`);

            // Ensure both userAnswer and correctAnswer are integers
            if (parseInt(userAnswer) === parseInt(correctAnswer)) {
                correctAnswers++;
            } else {
                wrongAnswers++;
            }
        }

        if (totalQuestions === 0) throw new Error('Total questions cannot be zero.');

        const score = correctAnswers * 3; // Percentile score
        const status = 'completed';

        // Fetch cit_version
        let citVersion;
        if (examId != 15) {
            citVersion = await fetchSetting('current_cit_version', connection);
            if (!citVersion) {
                throw new Error('Current CIT version not found in settings.');
            }
        } else {
            citVersion = 'Mock';
        }

        // Check if result already exists (for retest scenarios)
        query = 'SELECT * FROM cit_results WHERE user_id = ? AND exam_id = ?';
        [results] = await connection.query(query, [userId, examId]);

        if (results.length > 0) {
            // Update existing result
            query = `UPDATE cit_results SET correct_answers = ?, wrong_answers = ?, score = ?, time_taken = ?, status = ?, cit_version = ?
                     WHERE user_id = ? AND exam_id = ?`;
            await connection.query(query, [correctAnswers, wrongAnswers, score, timeTaken, status, citVersion, userId, examId]);
        } else {
            // Insert new result
            query = `INSERT INTO cit_results (user_id, exam_id, correct_answers, wrong_answers, total_questions, score, time_taken, status, cit_version)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            await connection.query(query, [userId, examId, correctAnswers, wrongAnswers, totalQuestions, score, timeTaken, status, citVersion]);
        }

        // Mark user as eligible for refund flow
        // await connection.query('UPDATE users SET is_from_refund = ? WHERE user_id = ?', ['yes', userId]);

        // Fetch refund_program setting
const refundProgram = await fetchSetting('refund_program', connection);

// Decide value for is_from_refund
const isFromRefund = refundProgram === 'on' ? 'yes' : 'no';

// Update users table
await connection.query(
    'UPDATE users SET is_from_refund = ? WHERE user_id = ?',
    [isFromRefund, userId]
);

        // Optionally, update student step and send Netcore activity
        if (examId == 1) {
            await updateStudentStep(userId, 'cit_exam_details', 1, connection);
            const userDetails = await getUserDetailsNew(userId, connection);
            const resultDate = await fetchSetting('result_date', connection);
            await sendNetcoreActivity('EXAM_SUCCESS', userDetails.email, { result: { score }, instantresult: instantresult, RESULT_DATE: resultDate }, isWebView);
            await updateNetcoreContact(userDetails.email, { RESULT_DATE: resultDate });
        }

        // Commit transaction
        await connection.commit();

        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const requestRetest = async (userId, hash, examId) => {
    const connection = await dbPool.getConnection();

    try {
        // Start transaction
        await connection.beginTransaction();

        // Verify user
        let query = 'SELECT * FROM cit_exam_login WHERE user_id = ? AND hash = ?';
        let [results] = await connection.query(query, [userId, hash]);
        if (results.length === 0) {
            throw new Error('User not found or invalid hash');
        }

        // Check if user's score is eligible for retest (score <= 9)
        query = 'SELECT score FROM cit_results WHERE user_id = ? AND exam_id = ?';
        [results] = await connection.query(query, [userId, examId]);
        if (results.length === 0) {
            throw new Error('No exam result found');
        }

        if (results[0].score > 9) {
            throw new Error('Score is too high for retest eligibility');
        }

        // Reset exam login data for retest
        query = 'UPDATE cit_exam_login SET start_exam = NULL, end_exam = NULL, expected_end_exam = NULL WHERE user_id = ? AND hash = ?';
        await connection.query(query, [userId, hash]);

        // Clear existing exam data
        query = 'DELETE FROM cit_exam_data WHERE user_id = ? AND exam_id = ?';
        await connection.query(query, [userId, examId]);

        // Update result status to indicate retest
        query = 'UPDATE cit_results SET status = ? WHERE user_id = ? AND exam_id = ?';
        await connection.query(query, ['retest_initiated', userId, examId]);

        // Commit transaction
        await connection.commit();

        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const updateExamData = async (userId, hash, examId, userAnswers) => {
    const connection = await dbPool.getConnection();

    try {
        // Verify user
        let query = 'SELECT * FROM cit_exam_login WHERE user_id = ? AND hash = ?';
        let [results] = await connection.query(query, [userId, hash]);
        if (results.length === 0) return null;

        // Fetch existing exam data
        query = 'SELECT data FROM cit_exam_data WHERE user_id = ? AND exam_id = ?';
        [results] = await connection.query(query, [userId, examId]);

        let existingData = {};
        if (results.length > 0) {
            const dataField = results[0].data;

            // Check the type of dataField
            if (dataField && typeof dataField === 'string') {
                try {
                    existingData = JSON.parse(dataField);
                } catch (parseError) {
                    console.error('Error parsing existing exam data:', parseError.message);
                    existingData = {};
                }
            } else if (dataField && typeof dataField === 'object') {
                existingData = dataField;
            } else {
                existingData = {};
            }
        }

        // Merge existing data with new userAnswers
        const updatedData = { ...existingData, ...userAnswers };
        const updatedDataJson = JSON.stringify(updatedData);

        if (results.length > 0) {
            // Update existing record
            query = 'UPDATE cit_exam_data SET data = ? WHERE user_id = ? AND exam_id = ?';
            await connection.query(query, [updatedDataJson, userId, examId]);
        } else {
            // Insert new record
            query = 'INSERT INTO cit_exam_data (user_id, exam_id, data) VALUES (?, ?, ?)';
            await connection.query(query, [userId, examId, updatedDataJson]);
        }

        return true;
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};

const fetchResult = async (userId, examId) => {
    const connection = await dbPool.getConnection();

    try {
        const query = 'SELECT * FROM cit_results WHERE user_id = ? AND exam_id = ?';
        const [results] = await connection.query(query, [userId, examId]);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};

const handleStartExamProcess = async (userId, hash, examId) => {
    const connection = await dbPool.getConnection();

    try {
        // Fetch user login data
        let query = 'SELECT start_exam, end_exam FROM cit_exam_login WHERE user_id = ? AND hash = ?';
        let [results] = await connection.query(query, [userId, hash]);

        if (results.length === 0) {
            return { status: 404, message: 'No exam login found for this user' };
        }

        const { start_exam: startExam, end_exam: endExam } = results[0];

        if (endExam) {
            // Check if this is a retest scenario
            query = 'SELECT status FROM cit_results WHERE user_id = ? AND exam_id = ?';
            [results] = await connection.query(query, [userId, examId]);
            
            if (results.length > 0 && results[0].status === 'retest_initiated') {
                // Allow retest by resetting the end_exam
                query = 'UPDATE cit_exam_login SET end_exam = NULL WHERE user_id = ? AND hash = ?';
                await connection.query(query, [userId, hash]);
            } else {
                return { status: 200, message: 'Exam Ended', data: {} };
            }
        }

        // Check if exam is already completed (and not a retest)
        query = 'SELECT status FROM cit_results WHERE user_id = ? AND exam_id = ?';
        [results] = await connection.query(query, [userId, examId]);

        if (results.length > 0 && results[0].status === 'completed') {
            // Update end_exam time
            const examDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
            const endExamTime = new Date(new Date(startExam).getTime() + examDuration);
            query = 'UPDATE cit_exam_login SET end_exam = ? WHERE user_id = ? AND hash = ?';
            await connection.query(query, [endExamTime, userId, hash]);
            return { status: 200, message: 'Exam Ended', data: {} };
        }

        if (startExam && results.length === 0) {
            // Fetch exam data
            query = 'SELECT data FROM cit_exam_data WHERE user_id = ? AND exam_id = ?';
            [results] = await connection.query(query, [userId, examId]);
            if (results.length > 0) {
                const dataField = results[0].data;

                // Check the type of dataField
                let examData;
                if (dataField && typeof dataField === 'string') {
                    try {
                        examData = JSON.parse(dataField);
                    } catch (parseError) {
                        console.error('Error parsing exam data:', parseError.message);
                        examData = {};
                    }
                } else if (dataField && typeof dataField === 'object') {
                    examData = dataField;
                } else {
                    examData = {};
                }

                const examDataModified = await fetchQuestionsAndOptions(examData, connection);

                return { status: 200, message: 'Exam Started', data: { start_exam: startExam, data: examDataModified } };
            } else {
                return { status: 404, message: 'Exam data not found' };
            }
        } else {
            // Start the exam (or restart for retest)
            const currentTime = new Date();

            const examDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
            const expectedEndExamTime = new Date(currentTime.getTime() + examDuration);

            query = 'UPDATE cit_exam_login SET start_exam = ?, expected_end_exam = ? WHERE user_id = ? AND hash = ?';
            await connection.query(query, [currentTime, expectedEndExamTime, userId, hash]);

            // Fetch total questions
            query = 'SELECT total_questions FROM cit_exams WHERE exam_id = ?';
            [results] = await connection.query(query, [examId]);
            const totalQuestions = results[0].total_questions;

            // Fetch random questions
            const questions = await fetchRandomQuestions(examId, totalQuestions);

            // Prepare exam data for storage
            const questionsStore = {};
            for (const question of questions) {
                questionsStore[question.question_id] = null;
            }

            // Update exam data
            await updateExamData(userId, hash, examId, questionsStore);

            return { status: 200, message: 'Exam Started', data: { start_exam: currentTime, data: questions } };
        }
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};

const fetchQuestionsAndOptions = async (examData, connection) => {
    const questions = [];
    for (const questionId of Object.keys(examData)) {
        const question = await fetchQuestionById(questionId, connection);
        if (question) {
            question.selected_option = examData[questionId];
            questions.push(question);
        }
    }
    return questions;
};

const fetchQuestionById = async (questionId, connection) => {
    try {
        let query = 'SELECT * FROM cit_questions WHERE question_id = ?';
        let [results] = await connection.query(query, [questionId]);
        if (results.length === 0) {
            return null;
        }
        const question = results[0];
        question.options = await fetchOptionsForQuestion(questionId, connection);
        return question;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    fetchExams,
    fetchExamById,
    fetchRandomQuestions,
    calculateAndStoreResult,
    updateExamData,
    fetchResult,
    handleStartExamProcess,
    requestRetest,
};