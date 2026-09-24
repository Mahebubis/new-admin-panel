// db.js

const mysql = require('mysql2/promise');

// MySQL Connection Pool
const dbPool = mysql.createPool({
    connectionLimit: 100, // Adjust as needed
    host: '15.207.59.247',
    user: 'istudio_admin',
    password: 'h;V[ts@#;u{B',
    database: 'istudio_cit',
    timezone: 'Z', // Use 'Z' here for UTC
});

// Export dbPool for use in other modules
module.exports = dbPool;
