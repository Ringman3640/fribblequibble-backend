// auth.js
// 
// Implements the route actions pertaining to user authentication.

'use strict'

// bcrypt
const bcrypt = require('bcryptjs');

// dotenv
const dotenv = require('dotenv');
dotenv.config();

// jsonwebtoken
const jwt = require('jsonwebtoken');

// utils
const RouteError = require('../util/routeerror.js')
const RouteResolver = require('../util/routeresolver.js');
const validation = require('../util/validation.js');
const createAccessToken = require('../util/createaccesstoken.js');

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

    let accessToken = await createAccessToken(userInfo.id, res.locals.conn);

    res.cookie('refresh_token', refreshToken, { httpOnly: true });
    res.cookie('access_token', accessToken);
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