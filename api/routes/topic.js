// topic.js
// 
// Implements the route actions pertaining to managing topics.

'use strict'

// utils
const RouteError = require('../util/routeerror.js');
const RouteResolver = require('../util/routeresolver.js');

// POST /topic route
// 
// Adds a new discussion topic. Only accessible by admin-level users.
// 
// Expected body parameters:
//   - name (string): Name of the new topic
exports.addTopic = new RouteResolver(async (req, res) => {
    if (res.locals.userInfo.access_level < 3) {
        throw new RouteError(
            403,
            'UNAUTHORIZED_ACCESS',
            'Only admin-level users or above can add topics');
    }

    const topicName = req.body['name'];
    if (!topicName) {
        throw new RouteError(
            400,
            'NO_TOPIC_NAME',
            'No topic name was provided in the body request');
    }

    await res.locals.conn.query(`
        INSERT INTO topic (topic_name)
        VALUES (?);
    `, [topicName]);

    res.status(201).send({
        message: 'Successfully added topic'
    });
},
{
    ER_DUP_ENTRY: {
        status: 400,
        code: 'TOPIC_ALREADY_EXISTS',
        message: 'The provided topic name already exists'
    }
});

// GET /topic/:id route
// 
// Gets the name of a specific topic given its ID.
// 
// Expected URL parameters:
//   - id (number): ID of the topic
// 
// Return JSON structure:
// {
//     topicName: (string) Name of the given topic ID
// }
// 
// If no topic with the specified ID is found, an error code and message is
// returned with the following structure:
// {
//     error:   (string) Error code
//     message: (string) Descriptive error message
// }
exports.getTopic = new RouteResolver(async (req, res) => {
    const topicId = req.params['id'];
    if (!topicId) {
        throw new RouteError(
            400,
            'NO_TOPIC_ID',
            'No topic ID was provided in the URL parameters');
    }
    if (!Number.isInteger(+topicId)) {
        throw new RouteError(
            400,
            'INVALID_TOPIC_ID',
            'The provided topic ID value must be an int');
    }

    const dbRes = await res.locals.conn.query(`
        SELECT
            topic_name
        FROM topic
        WHERE id = ?;
    `, [topicId]);
    if (dbRes.length === 0) {
        throw new RouteError(
            404,
            'TOPIC_ID_NOT_FOUND',
            'The provided topic ID was not found');
    }

    res.status(200).send({
        topicName: dbRes[0].topic_name
    });
});