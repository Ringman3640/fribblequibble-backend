// auth.js
// 
// Implements the route actions pertaining to user authentication.

'use strict'

// bcrypt
const bcrypt = require('bcryptjs');

// jsonwebtoken
const jwt = require('jsonwebtoken');

// utils
const RouteError = require('../util/routeerror.js')
const RouteResolver = require('../util/routeresolver.js');
const validation = require('../util/validation.js');
const tokenEdit = require('../util/tokenedit.js');

// POST /auth/login route
// 
// Logs-in a user to an account.
// 
// Expected body parameters:
//   - username (string): Username of the new user
//   - password (string): Password for the account
exports.login = new RouteResolver(async (req, res) => {
    const { username, password } = req.body;
    validation.validateUsername(username);
    validation.validatePassword(password);

    const dbRes = await res.locals.conn.query(`
        SELECT * FROM \`user\`
        WHERE username = ?;
    `, [username]);
    if (!dbRes.length) {
        throw new RouteError(
            400,
            'INCORRECT_USERNAME_PASSWORD',
            `Username and/or password was incorrect`);
    }
    
    let userInfo = dbRes[0];
    if (!bcrypt.compareSync(password, userInfo.password_hash.toString())) {
        throw new RouteError(
            400,
            'INCORRECT_USERNAME_PASSWORD',
            `Username and/or password was incorrect`);
    }

    let refreshToken = jwt.sign(
        {
            id: userInfo.id
        }, 
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRE_TIME }
        );

    let accessToken = await tokenEdit.createAccessToken(userInfo.id, res.locals.conn);

    tokenEdit.setRefreshToken(refreshToken, res);
    tokenEdit.setAccessToken(accessToken, res);
    res.status(200).send({
        message: `Successfully logged-in as user ${username}`
    });
});

// POST /auth/logout route
// 
// Logs-out a user.
exports.logout = new RouteResolver((req, res) => {
    res.clearCookie('refresh_token');
    res.clearCookie('access_token');
    res.end();
});

// GET /auth/info route
// 
// Gets information about a logged-in requester. Includes the user's ID,
// username, and access level.
// 
// Return JSON structure:
// {
//     id:           (int) ID of the requesting user,
//     username:     (string) Username of the requesting user,
//     accessLevel:  (int) Access level number of the requesting user,
//     expTimestamp: (int) Date when the info becomes invalid in UNIX seconds
// }
// 
// If the user is not logged-in, a 400-level error response is returned with
// a corresponding error code and error message.
exports.getInfo = new RouteResolver((req, res) => {
    const userInfo = res.locals.userInfo;
    if (!userInfo) {
        res.clearCookie('refresh_token');
        res.clearCookie('access_token');
        throw new RouteError(
            401,
            'NO_USER',
            'The requesting user is not logged-in');
    }
    
    res.status(200).send({
        id: userInfo.id,
        username: userInfo.username,
        accessLevel: userInfo.access_level,
        expTimestamp: userInfo.exp
    });
});

// POST /auth/renew-access-token
// 
// Renews a user's access token using their refresh token.
exports.renewAccessToken = new RouteResolver((req, res) => {
    // Access token renewal and rejection is all handled by the jwtVerifyStrict
    // middleware, so just return success message.
    res.status(201).send({
        message: 'Successfully renewed access token'
    });
});

// POST /auth/login/test route
// 
// Tests if a user is successfully logged-in. Returns a 200 HTTP response status
// if logged-in. Otherwise, returns a 401 HTTP response status.
exports.loginTest = new RouteResolver((req, res) => {
    const userInfo = res.locals.userInfo;

    res.status(200).send({
        message: `User is logged-in as ${userInfo.username}`
    });
    return;
});