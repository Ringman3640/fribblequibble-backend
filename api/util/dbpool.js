// dbpool.js
// 
// Provides a global database pool instance for obtaining connections.

'use strict'

// MariaDB
const db = require('mariadb');
const dbPool = db.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectionLimit: process.env.DB_CONN_LIMIT
});

module.exports = dbPool;