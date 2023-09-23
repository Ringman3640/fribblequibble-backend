// user.js
// 
// Implements the route actions pertaining to user modifications and actions.

'use strict'

// bcrypt
const bcrypt = require('bcryptjs');

// dotenv
const dotenv = require('dotenv');
dotenv.config();

// util
const RouteError = require('../util/routeerror.js')
const RouteResolver = require('../util/routeresolver.js');
const validation = require('../util/validation.js');

// POST /user route
// 
// Adds a new user account.
// 
// Expected body parameters:
//   - username (string): Username of the new user
//   - password (string): Password for the account
exports.addUser = new RouteResolver(async (req, res) => {
    const { username, password } = req.body;
    validation.validateUsername(username);
    validation.validatePassword(password);

    const passwordHash = bcrypt.hashSync(password, +process.env.PASSWORD_SALT_ROUNDS);
    await res.locals.conn.query(`
        INSERT INTO \`user\` (username, password_hash) 
        VALUES (?, ?);
    `, [username, passwordHash]);
    
    res.status(201).send({
        message: `Successfully added user ${username}`
    });
}, 
{
    ER_DUP_ENTRY: {
        status: 400,
        code: 'USERNAME_ALREADY_TAKEN',
        message: 'Username is already being used'
    }
});

// DELETE /user/:id route
// 
// Removes a user from the service. Only accessible by admin-level users.
// 
// Expected URL parameters:
//   - id (int): ID of the user to remove
exports.removeUser = new RouteResolver(async (req, res) => {
    if (res.locals.userInfo.access_level < process.env.ACCESS_LEVEL_ADMIN) {
        throw new RouteError(
            403,
            'UNAUTHORIZED',
            'Only admin-level or above users can remove users');
    }

    const userId = req.params['id'];
    validation.validateUserId(userId);

    const dbRes = await res.locals.conn.query(`
        SELECT id FROM user
        WHERE id = ?;
    `, [userId]);
    if (dbRes.length == 0) {
        throw new RouteError(400,
            'USER_ID_NOT_FOUND',
            `User with ID ${userId} not found`);
    }
    await res.locals.conn.query(`
        DELETE FROM user
        WHERE id = ?;
    `, [userId]);

    res.status(200).send({
        message: 'Successfully removed user'
    });
});

// PUT /user/:id/username route
// 
// Updates a user's username. Moderator-level users and below are only 
// authorized to change their own usernames. Admin-level users and above can
// change the username of other users below their access level.
// 
// Expected URL parameters:
//   - id (int): ID of the user to update
// 
// Expected body parameters:
//   - username (string): New username to apply to the user
exports.changeUsername = new RouteResolver(async (req, res) => {
    const userId = req.params['id'];
    const username = req.body['username'];
    validation.validateUserId(userId);
    validation.validateUsername(username);

    // Check if target user exists and get access level
    const dbRes = await res.locals.conn.query(`
        SELECT access_level FROM user
        WHERE id = ?;
    `, [userId]);
    if (dbRes.length == 0) {
        throw new RouteError(
            400,
            'USER_ID_NOT_FOUND',
            `User with ID ${userId} not found`);
    }

    // Authorization for changing other users' usernames
    if (userId != res.locals.userInfo.id) {
        if (res.locals.userInfo.access_level < process.env.ACCESS_LEVEL_ADMIN) {
            throw new RouteError(
                403,
                'UNAUTHORIZED',
                'Moderator-level users and below can only change their own usernames');
        }
        if (res.locals.userInfo.access_level <= dbRes[0].access_level) {
            throw new RouteError(
                403,
                'UNAUTHORIZED',
                'The target user\'s access level must be less than the changing user');
        }
    }

    // Apply username change
    await res.locals.conn.query(`
        UPDATE user
        SET username = ?
        WHERE id = ?;
    `, [username, userId]);

    res.status(200).send({
        message: 'Successfully updated username'
    });
},
{
    ER_DUP_ENTRY: {
        status: 400,
        code: 'USERNAME_ALREADY_TAKEN',
        message: 'Username is already being used'
    }
});

// PUT /user/:id/access-level route
// 
// Updates a user's access level. Only accessible by admin-level users. Access
// levels can only be set if the set level does not exceed the access level of
// the requesting user.
// 
// Expected URL parameters:
//   - id (int): ID of the user to update
// 
// Expected body parameters:
//   - access-level (int): Access level to apply to the user
exports.changeAccessLevel = new RouteResolver(async (req, res) => {
    if (res.locals.userInfo.access_level < process.env.ACCESS_LEVEL_ADMIN) {
        throw new RouteError(
            403,
            'UNAUTHORIZED',
            'Only admin-level or above users can update access levels');
    }

    const userId = req.params['id'];
    const accessLevel = req.body['access-level'];
    validation.validateUserId(userId);
    if (!accessLevel) {
        throw new RouteError(
            400,
            'NO_ACCESS_LEVEL',
            'No access level was provided in the body request');
    }
    if (!Number.isInteger(+accessLevel) 
        || accessLevel < 1
        || accessLevel > process.env.ACCESS_LEVEL_DEVELOPER) {
        throw new RouteError(
            400,
            'INVALID_ACCESS_LEVEL',
            'The provided access level value must be an int and must be a valid access value')
    }
    if (accessLevel > res.locals.userInfo.access_level) {
        throw new RouteError(
            403,
            'UNAUTHORIZED_ACCESS_LEVEL',
            'The provided access level cannot exceed the requester\'s access level');
    }

    let dbRes = await res.locals.conn.query(`
        SELECT id FROM user
        WHERE id = ?;
    `, [userId]);
    if (dbRes.length == 0) {
        throw new RouteError(
            400,
            'USER_ID_NOT_FOUND',
            `User with ID ${userId} not found`);
    }
    await res.locals.conn.query(`
        UPDATE user
        SET access_level = ?
        WHERE id = ?;
    `, [accessLevel, userId]);

    res.status(200).send({
        message: 'Successfully updated access level'
    });
});