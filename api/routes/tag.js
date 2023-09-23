'use strict'

// utils
const RouteError = require('../util/routeerror.js');
const RouteResolver = require('../util/routeresolver.js');

// POST /tag route
// 
// Adds a new tag. Only accessible by admin-level users.
// 
// Expected body parameters:
//   - name (string): Name of the new tag
exports.addTag = new RouteResolver(async (req, res) => {
    if (res.locals.userInfo.access_level < 3) {
        throw new RouteError(
            403,
            'UNAUTHORIZED_ACCESS',
            'Only admin-level users or above can add tags');
    }

    const tagName = req.body['name'];
    if (!tagName) {
        throw new RouteError(
            400,'NO_TAG_NAME',
            'No tag name was provided in the body request');
    }

    await res.locals.conn.query(`
        INSERT INTO tag (tag_name)
        VALUES (?);
    `, [tagName]);

    res.status(201).send({
        message: `Successfully added tag ${tagName}`
    });
},
{
    ER_DUP_ENTRY: {
        status: 400,
        code: 'TAG_ALREADY_EXISTS',
        message: 'The provided tag name already exists'
    }
});