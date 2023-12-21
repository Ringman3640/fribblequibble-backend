// quibble.js
// 
// Implements the route actions pertaining to quibble management and actions.

'use strict'

// util
const RouteError = require('../util/routeerror.js')
const RouteResolver = require('../util/routeresolver.js');
const validation = require('../util/validation.js');

// POST /quibble route
// 
// Adds a new quibble post.
// 
// Expected body parameters:
//   - discussion-id (int): ID of the target discussion
//   - content (string): Text content of the quibble
//
// Returns the formatted JSON quibble with the following structure:
// {
//     id:          (BigInt string) ID of the quibble,
//     authorName:  (string) Name of the quibble author,
//     authorId:    (int) ID of the quibble author,
//     timestamp:   (number) Time the quibble was posted in UNIX time,
//     content:     (string) Text content of the quibble
// }
// 
// If the quibble could not be added, an error code and message is returned with
// the following structure:
// {
//     error:   (string) Error code
//     message: (string) Descriptive error message
// }
exports.addQuibble = new RouteResolver(async (req, res) => {
    const discussionId = req.body['discussion-id'];
    const content = req.body['content'];
    if (!discussionId) {
        throw new RouteError(
            400,
            'NO_DISCUSSION_ID',
            'No discussion ID was provided in the body request');
    }
    if (!Number.isInteger(+discussionId)) {
        throw new RouteError(
            400,
            'INVALID_DISCUSSION_ID',
            'The provided discussion ID value must be an int');
    }
    if (!content) {
        throw new RouteError(
            400,
            'NO_CONTENT',
            'No text content was provided in the body request');
    }
    if (typeof content !== 'string') {
        throw new RouteError(
            400,
            'INVALID_CONTENT',
            'The provided text content value must be a string');
    }
    if (content.length > process.env.QUIBBLE_MAX_LEN) {
        throw new RouteError(
            400,
            'CONTENT_TOO_LONG',
            `The length of the content cannot exceed ${process.env.QUIBBLE_MAX_LEN} characters`);
    }

    await res.locals.conn.beginTransaction();
    await res.locals.conn.query(`
        INSERT INTO quibble (discussion_id, author_id, content)
        VALUES (?, ?, ?);
    `, [discussionId, res.locals.userInfo.id, content]);
    const dbRes = await res.locals.conn.query(`
        SELECT quibble.id, username, author_id, UNIX_TIMESTAMP(date_posted) as timestamp, content
        FROM quibble
        JOIN user ON (author_id = user.id)
        WHERE quibble.id = LAST_INSERT_ID();
    `);
    try {
        await res.locals.conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    }

    const quibble = dbRes[0];
    res.status(201).send({
        id: quibble.id,
        authorName: quibble.username,
        authorId: quibble.author_id,
        timestamp: quibble.timestamp,
        content: quibble.content
    });
},
{
    ER_NO_REFERENCED_ROW_2: {
        status: 400,
        code: 'DISCUSSION_ID_NOT_FOUND',
        message: 'The provided discussion ID was not found'
    }
});

// POST /quibble/:id/condemning-user route
// 
// Adds a user to the condemn list of a specific quibble.
// 
// Expected URL parameters:
//   - id (BigInt string): ID of the target quibble
exports.addCondemningUser = new RouteResolver(async (req, res) => {
    let quibbleId = translateQuibbleId(req.params['id']);

    await res.locals.conn.query(`
        INSERT INTO condemning_user (user_id, quibble_id)
        VALUES (?, ?);
    `, [res.locals.userInfo.id, quibbleId]);

    res.status(201).send({
        message: 'Successfully added user to the condemning list'
    });
},
{
    ER_NO_REFERENCED_ROW_2: {
        status: 400,
        code: 'QUIBBLE_NOT_FOUND',
        message: 'The provided quibble ID was not found'
    },
    ER_DUP_ENTRY: {
        status: 400,
        code: 'USER_ALREADY_CONDEMNED',
        message: 'The user has already condemned the quibble'
    }
});

// DELETE /quibble/:id route
// 
// Removes a specific quibble. Only accessible by moderator-level users.
// 
// Expected URL parameters:
//   - id (BigInt string): ID of the target quibble
exports.removeQuibble = new RouteResolver(async (req, res) => {
    await validation.validateAccessLevel(process.env.ACCESS_LEVEL_ADMIN,
        res.locals.userInfo.id,
        res.locals.conn);

    const quibbleId = translateQuibbleId(req.params['id']);
    
    const dbRes = await res.locals.conn.query(`
        SELECT content FROM quibble
        WHERE id = ?;
    `, [quibbleId]);
    if (dbRes.length == 0) {
        throw new RouteError(
            400,
            'QUIBBLE_ID_NOT_FOUND',
            `Quibble with ID ${quibbleId} not found`);
    }
    if (dbRes[0].content == null) {
        throw new RouteError(
            400,
            'QUIBBLE_ALREADY_DELETED',
            `The quibble was already deleted`);
    }
    await res.locals.conn.query(`
        UPDATE quibble
        SET content = NULL
        WHERE id = ?;
    `, [quibbleId]);

    res.status(200).send({
        message: 'Successfully removed quibble'
    });
});

// translateQuibbleId
// 
// Helper function for Translating and validating a given quibbleId
// representation (such as a string) into a BigInt value. 
// 
// Throws a RouteError if the quibbleId is undefined or if the quibbleId
// representation cannot be turned into a BigInt value.
function translateQuibbleId(quibbleId) {
    if (!quibbleId) {
        throw new RouteError(
            400,
            'NO_QUIBBLE_ID',
            'No quibble ID was provided in the URL parameters');
    }
    try {
        return BigInt(quibbleId);
    } catch {
        throw new RouteError(
            400,
            'INVALID_QUIBBLE_ID',
            'The provided quibble ID value must be a BigInt string');
    }
}