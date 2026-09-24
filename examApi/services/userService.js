const dbPool = require('../db');
const crypto = require('crypto');

const userLoginInitiate = async (userId, examId) => {
    const connection = await dbPool.getConnection();

    try {
        // Check if previous user_id and exam_id exists
        let query = 'SELECT * FROM cit_exam_login WHERE user_id = ? AND exam_id = ?';
        let [results] = await connection.query(query, [userId, examId]);

        const hash = crypto.createHash('md5').update(crypto.randomBytes(16)).digest('hex');

        if (results.length > 0) {
            // Update hash
            query = 'UPDATE cit_exam_login SET hash = ? WHERE user_id = ? AND exam_id = ?';
            await connection.query(query, [hash, userId, examId]);
            return hash;
        }

        // Verify user exists
        query = 'SELECT email FROM users WHERE user_id = ?';
        [results] = await connection.query(query, [userId]);

        if (results.length > 0) {
            // Insert new login record
            query = 'INSERT INTO cit_exam_login (user_id, hash, exam_id) VALUES (?, ?, ?)';
            await connection.query(query, [userId, hash, examId]);
            return hash;
        } else {
            return false;
        }
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};

const userLoginVerify = async (userId, hash, examId) => {
    const connection = await dbPool.getConnection();

    try {
        // Check user login
        let query = 'SELECT * FROM cit_exam_login WHERE user_id = ? AND hash = ?';
        let [results] = await connection.query(query, [userId, hash]);

        if (results.length > 0) {
            // Update exam_id in the login table
            query = 'UPDATE cit_exam_login SET exam_id = ? WHERE user_id = ? AND hash = ?';
            await connection.query(query, [examId, userId, hash]);

            // Fetch user details
            const userDetails = await fetchUserDetails(userId, connection);
            userDetails.start_exam = results[0].start_exam;
            userDetails.end_exam = results[0].end_exam;

            // Check if the start_exam date is present
            if (results[0].start_exam) {
                // Fetch data from cit_exam_data
                query = 'SELECT data FROM cit_exam_data WHERE user_id = ? AND exam_id = ?';
                [results] = await connection.query(query, [userId, examId]);
                if (results.length > 0) {
                    const dataField = results[0].data;
                    if (dataField && typeof dataField === 'string') {
                        try {
                            userDetails.exam_data = JSON.parse(dataField);
                        } catch (parseError) {
                            console.error('Error parsing exam data:', parseError.message);
                            userDetails.exam_data = {};
                        }
                    } else if (dataField && typeof dataField === 'object') {
                        userDetails.exam_data = dataField;
                    } else {
                        userDetails.exam_data = {};
                    }
                }
            }

            return userDetails;
        } else {
            return false;
        }
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
};

const fetchUserDetails = async (userId, connection = null) => {
    let localConnection = false;
    if (!connection) {
        connection = await dbPool.getConnection();
        localConnection = true;
    }

    try {
        const query = 'SELECT user_id, name, email FROM users WHERE user_id = ?';
        const [results] = await connection.query(query, [userId]);
        return results.length > 0 ? results[0] : null;
    } catch (error) {
        throw error;
    } finally {
        if (localConnection) connection.release();
    }
};

module.exports = {
    userLoginInitiate,
    userLoginVerify,
    fetchUserDetails,
};
