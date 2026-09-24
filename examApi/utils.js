// utils.js

const dbPool = require('./db');
const axios = require('axios');
const crypto = require('crypto');

const sanitizeInput = (data) => {
    if (typeof data === 'string') {
        return data.trim();
    }
    return data;
};

const sendResponse = (res, status, message, data = {}) => {
    res.status(status).json({
        status,
        message,
        data,
    });
};

// Additional utility functions
const updateStudentStep = async (id, key, value, connection = null) => {
    let localConnection = false;
    if (!connection) {
        connection = await dbPool.getConnection();
        localConnection = true;
    }

    try {
        // Check if user_id exists
        let query = 'SELECT * FROM user_steps WHERE user_id = ?';
        let [results] = await connection.query(query, [id]);

        if (results.length > 0) {
            // Update the step
            query = `UPDATE user_steps SET ${key} = ? WHERE user_id = ?`;
            await connection.query(query, [value, id]);
        } else {
            // Insert the step
            query = `INSERT INTO user_steps (user_id, ${key}) VALUES (?, ?)`;
            await connection.query(query, [id, value]);
        }

        return true;
    } catch (error) {
        throw error;
    } finally {
        if (localConnection) connection.release();
    }
};

const fetchSetting = async (setting, connection = null) => {
    let localConnection = false;
    if (!connection) {
        connection = await dbPool.getConnection();
        localConnection = true;
    }

    try {
        const query = 'SELECT settings_value FROM settings WHERE settings_key = ?';
        const [results] = await connection.query(query, [setting]);
        return results.length > 0 ? results[0].settings_value : null;
    } catch (error) {
        throw error;
    } finally {
        if (localConnection) connection.release();
    }
};

const generateRandomString = (length = 10) => {
    return crypto.randomBytes(length).toString('hex');
};

const getUserDetailsNew = async (id, connection = null) => {
    let localConnection = false;
    if (!connection) {
        connection = await dbPool.getConnection();
        localConnection = true;
    }

    try {
        const query = `SELECT * FROM users u
        INNER JOIN additional_details a ON u.user_id = a.user_id
        WHERE u.user_id = ?`;
        const [results] = await connection.query(query, [id]);
        if (results.length > 0) {
            const user = results[0];
            delete user.password;
            return user;
        }
        return null;
    } catch (error) {
        throw error;
    } finally {
        if (localConnection) connection.release();
    }
};

const updateNetcoreContact = async (email, attributes = {}) => {
    const contactData = {
        EMAIL: email,
        ...attributes,
    };

    const contactUrl = 'https://api.netcoresmartech.com/apiv2?type=contact&activity=add&apikey=f8a905473ea1b850801371f4dacc7876&listid=1';

    const params = new URLSearchParams();
    params.append('data', JSON.stringify(contactData));

    try {
        await axios.post(contactUrl, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    } catch (error) {
        console.error('Error updating Netcore contact:', error.message);
    }
};

const sendNetcoreActivity = async (activityName, email, additionalParams = {}, isWebView = false ) => {
    const baseActivityData = {
        asset_id: isWebView ?'0fca60a0577c19b9500a36baad5501fc':'367128938d034de04585304f536da5ef',
        activity_name: activityName,
        timestamp: new Date().toISOString(),
        identity: email,
        activity_source: isWebView ? 'app':'web',
        activity_params: {
            source: isWebView ?'app':'web',
            method: 'email',
            ...additionalParams,
        },
    };

    const activityData = [baseActivityData];
    const activityUrl = 'https://api2.netcoresmartech.com/v1/activity/upload';

    try {
        await axios.post(activityUrl, activityData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer f8a905473ea1b850801371f4dacc7876',
            },
        });
    } catch (error) {
        console.error('Error sending Netcore activity:', error.message);
    }
};

module.exports = {
    sanitizeInput,
    sendResponse,
    updateStudentStep,
    fetchSetting,
    generateRandomString,
    getUserDetailsNew,
    sendNetcoreActivity,
    updateNetcoreContact,
};
