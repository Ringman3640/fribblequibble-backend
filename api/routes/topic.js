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