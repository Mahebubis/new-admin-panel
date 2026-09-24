const dbPool = require('../db');

const fetchOptionsForQuestion = async (questionId, connection = null) => {
    let localConnection = false;
    if (!connection) {
        connection = await dbPool.getConnection();
        localConnection = true;
    }

    try {
        const query = 'SELECT option_id, option_text, is_correct FROM cit_options WHERE question_id = ?';
        const [results] = await connection.query(query, [questionId]);
        return results;
    } catch (error) {
        throw error;
    } finally {
        if (localConnection) connection.release();
    }
};

const fetchCorrectAnswer = async (questionId, connection = null) => {
    let localConnection = false;
    if (!connection) {
        connection = await dbPool.getConnection();
        localConnection = true;
    }

    try {
        // Fetch the correct option_id instead of option_text
        const query = 'SELECT option_id FROM cit_options WHERE question_id = ? AND is_correct = 1';
        const [results] = await connection.query(query, [questionId]);
        return results.length > 0 ? results[0].option_id : null;
    } catch (error) {
        throw error;
    } finally {
        if (localConnection) connection.release();
    }
};

module.exports = {
    fetchOptionsForQuestion,
    fetchCorrectAnswer,
};
