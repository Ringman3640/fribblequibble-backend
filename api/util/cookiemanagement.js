'use strict'

// jsonwebtoken
const jwt = require('jsonwebtoken');

// dotenv
const dotenv = require('dotenv');
dotenv.config();

// util
const dbPool = require('./dbpool.js');

// createAccessToken
// 
// Creates a new access token for a user given the user's ID and a connection
// to the database. If no connection is provided, one is automatically created
// in the function.
// 
// Returns a signed JWT if the user is found. Otherwise, returns null.
exports.createAccessToken = async (userId, conn) => {
    // Query user info
    let userInfo, dbConn;
    try {
        dbConn = conn || await dbPool.getConnection();
        const dbRes = await dbConn.query(`
            SELECT id, username, access_level FROM \`user\`
            WHERE id = ?;
        `, [userId]);
        userInfo = dbRes[0];
    } catch {
        return null;
    } finally {
        if (!conn && dbConn) dbConn.end();
    }

    // Return signed access token containing user info
    return jwt.sign(
        {
            id: userInfo.id,
            username: userInfo.username,
            access_level: userInfo.access_level
        }, 
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRE_TIME }
        );
}

// setRefreshToken
// 
// Sets a given refresh token to the provided response object. Applies the
// httpOnly and expiry date cookie options.
exports.setRefreshToken = async (refreshToken, res) => {
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        expires: new Date(Date.now() + process.env.COOKIE_EXPIRY_TIME_SECONDS)
    });
}

// setAccessToken
// 
// Sets a given access token to the provided response object. Applies the expiry
// date cookie option.
exports.setAccessToken = async (accessToken, res) => {
    res.cookie('access_token', accessToken, {
        expires: new Date(Date.now() + process.env.COOKIE_EXPIRY_TIME_SECONDS)
    });
}
