// server.js
// 
// This file initializes and starts the API server, and it declares all
// available REST API calls supported by the backend. The implementations for
// API actions are separated into the routes files. 

'use strict'

// Express
const express = require('express');
const app = express();

// jsonwebtoken
const jwt = require('jsonwebtoken');

// cookie-parser
const cookieParser = require('cookie-parser');

// util
const RouteError = require('./util/routeerror.js');
const tokenEdit = require('./util/tokenedit.js');
const dbPool = require('./util/dbpool.js');

// routes
const user = require('./routes/user.js');
const auth = require('./routes/auth.js');
const topic = require('./routes/topic.js');
const tag = require('./routes/tag.js');
const discussion = require('./routes/discussion.js');
const quibble = require('./routes/quibble.js');

// Hijack BigInt to support string serialization
// Needed since some GET requests need to return BigInt values
BigInt.prototype.toJSON = function () {
    return this.toString();
}

// Force close server on SIGTERM for faster Docker container restarts
// Currently not graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received');
    process.exit();
});

app.use(
    cookieParser(),
    express.json()
);
app.listen(process.env.API_PORT, () => {
    console.log('API server is running.');
});

// GET / route
// 
// Gets the default HTML page. Used to test if the database is accessible.
app.get('/', (req, res) => {
    res.sendFile('./resources/test-page.html', {root: __dirname })
});

// POST /user route
// 
// Adds a new user account.
// 
// Expected body parameters:
//   - username (string): Username of the new user
//   - password (string): Password for the account
app.post('/user', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: user.addUser,
        routeName: 'POST /user',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// DELETE /user/:id route
// 
// Removes a user from the service. Only accessible by admin-level users.
// 
// Expected URL parameters:
//   - id (int): ID of the user to remove
app.delete('/user/:id', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: user.removeUser,
        routeName: 'DELETE /user/:id',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// PUT /user/:id/username route
// 
// Updates a user's username.
// 
// Expected URL parameters:
//   - id (int): ID of the user to update
// 
// Expected body parameters:
//   - username (string): New username to apply to the user
app.put('/user/:id/username', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: user.changeUsername,
        routeName: 'POST /user/:id/access-level',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// PUT /user/:id/access-level route
// 
// Updates a user's access level. Only accessible by admin-level users. Access
// levels can only be set if the set level does not exceed the access level of
// the requesting user. Additionally, users cannot modify the access levels
// of other users with equal or higher access levels.
// 
// Expected URL parameters:
//   - id (int): ID of the user to update
// 
// Expected body parameters:
//   - access-level (int): Access level to apply to the user
app.put('/user/:id/access-level', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: user.changeAccessLevel,
        routeName: 'POST /user/:id/access-level',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /user/:id/statistics
// 
// Gets the statistics information about a specific user given their user ID.
// 
// Expected URL parameters:
//   - id (int): ID of the user to update
// 
// Return JSON structure:
// {
//     username:            (string) Username of the user
//     joinTimestamp:       (number) Time the user joined in UNIX seconds
//     totalVotes:          (number) Number of votes the user has submitted
//     totalQuibbles:       (number) Number of quibbles the user has posted
//     sentCondemns:        (number) Number of condemns the user has sent
//     receivedCondemns:    (number) Number of condemns the user has received
// }
// 
// If no user with the specified ID is found, an error code and message is
// returned with the following structure:
// {
//     error:   (string) Error code
//     message: (string) Descriptive error message
// }
app.get('/user/:id/statistics', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: user.getStatistics,
        routeName: 'POST /user/:id/statistics',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /user/:id/top-discussions
// 
// Gets the top 5 discussions that the specified user is most active on
// according to quibble count. 
// 
// Expected URL parameters:
//   - id (int): ID of the user to update
// 
// Return JSON structure:
// {
//     discussions: [
//         {
//             id:              (int) ID of the discussion,
//             title:           (string) Title of the discussion,
//             userQuibbles:    (int) Number of quibbles the user has posted
//         }
//         . . . (min 0, max 5)
//     ]
// }
// 
// The returned discussions array main contain 0 to 5 entries, depending on the
// number of discussions the user has interacted with.
app.get('/user/:id/top-discussions', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: user.getTopDiscussions,
        routeName: 'POST /user/:id/top-discussions',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /user/:id/quibbles route
// 
// Gets the quibbles from a specific user, ordered by most recent. Includes the
// quibble ID, discussion title, discussion ID, timestamp, quibble content, and
// condemns status. Also potentially includes the comdemn count and if the
// current user has condemned a specific quibble. Only returns at most 20
// quibbles per call.
// 
// Expected URL parameters:
//   - id (int): ID of the user
// 
// Optional query parameters:
//   - after-quibble-id (int): ID of a specific quibble in which retrieved
//         quibbles will be after it
//   - count (int): Number of quibbles to retrieve (capped to 20 quibbles)
// 
// Return JSON structure:
// {
//     quibbles: [
//         {
//             id:           (BigInt string) ID of the quibble,
//             discussion:   (string) Title of the quibble's discussion,
//             discussionId: (int) ID of the quibble's discussion,
//             timestamp:    (number) Time the quibble was posted in UNIX time,
//             content:      (string | null) Text content of the quibble,
//             ~condemns:    (int) Count of the number of condemns,
//             ~condemned:   (bool, true) Indicates if the user has
//                               condemned the quibble
//         },
//         . . . (min 0, max 20)
//     ]
// }
// The condemns and condemned attributes are optional, meaning they may or may
// not be provided for a quibble. If the condemns attribute is not provided,
// assume that the quibble has no condemn count. The condemned attribute will
// only be present if the user has condemned the quibble, and the attribute will
// always be set to the value true.
// 
// The quibbles array is sorted by quibble ID, descending.
//
// Quibbles may be deleted by the user or by moderators. Deleted quibbles will
// have their content attribute set to null.
app.get('/user/:id/quibbles', jwtVerifySoft, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: user.getQuibbles,
        routeName: 'GET /user/:id/quibbles',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /auth/login route
// 
// Logs-in a user to an account.
// 
// Expected body parameters:
//   - username (string): Username of the new user
//   - password (string): Password for the account
app.post('/auth/login', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: auth.login,
        routeName: 'POST /auth/login',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /auth/logout route
// 
// Logs-out a user.
app.post('/auth/logout', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: auth.logout,
        routeName: 'POST /auth/logout',
        req: req,
        res: res,
        next: next,
        createConn: false
    });
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
app.get('/auth/info', jwtVerifySoft, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: auth.getInfo,
        routeName: 'GET /auth/info',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /auth/renew-access-token
// 
// Renews a user's access token using their refresh token.
app.post('/auth/renew-access-token', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: auth.renewAccessToken,
        routeName: 'POST /auth/renew-access-token',
        req: req,
        res: res,
        next: next,
        createConn: false
    });
});

// POST /auth/login/test route
// 
// Tests if a user is successfully logged-in. Returns a 200 HTTP response status
// if logged-in. Otherwise, returns a 401 HTTP response status.
app.get('/auth/login/test', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: auth.loginTest,
        routeName: 'POST /auth/login/test',
        req: req,
        res: res,
        next: next,
        createConn: false
    });
});

// POST /topic route
// 
// Adds a new discussion topic. Only accessible by admin-level users.
// 
// Expected body parameters:
//   - name (string): Name of the new topic
// 
// On success, the following JSON structure is returned:
// {
//     topicId: (int) ID of the created topic
// }
app.post('/topic', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: topic.addTopic,
        routeName: 'POST /topic',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
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
app.get('/topic/:id', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: topic.getTopic,
        routeName: 'GET /topic/:id',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /topics route
// 
// Gets a list of all topics.
// 
// Return JSON structure:
// {
//     topics: [
//         {
//             id:      (int) ID of the topic
//             name:    (string) Name of the topic
//         },
//         . . .
//     ]
// }
app.get('/topics', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: topic.getTopics,
        routeName: 'GET /topics',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /tag route
// 
// Adds a new tag. Only accessible by admin-level users.
// 
// Expected body parameters:
//   - name (string): Name of the new tag
app.post('/tag', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: tag.addTag,
        routeName: 'POST /tag',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /discussion route
// 
// Adds a new discussion. Only accessible by admin-level users.
// 
// Expected body parameters:
//   - title (string): Title of the new discussion
//   - topic-id (int): ID of the discussion's topic
// 
// Optional body parameters:
//   - description (string): Description of the new discussion
//   - page-content (string): Content of the discussion page as markdown syntax
// 
// On success, the following JSON structure is returned:
// {
//     discussionId: (int) ID of the created discussion
// }
app.post('/discussion', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.addDiscussion,
        routeName: 'POST /discussion',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /discussions
//
// Gets a list of discussions that include identifying and meta information.
// The discussion list can be filtered given a set of optional query parameters.
// Only returns at most 20 discussions per call.
// 
// Calls that return discussions will include the index of the last discussion
// item. The index is the position of a specific discussion in the given sort
// order and is used to retrieve discussions past the initial 20 and so on.
//
// Optional query parameters:
//   - search (string): Search term to match with retrieved discussion titles
//   - topic-id (int): ID of the topic for the retrieved discussions
//   - after-index (int): Index that specifies a position that discussion
//         retrieval will start from (excluding)
//   - count (int): Number of discussions to retrieve (capped to 20 discussions)
//   - sort-by (string): Sort method to retrieve discussions
// 
// sort-by methods:
//   - 'date-new': Discussions sorted by initial post date ascending (default)
//   - 'date-old': Discussions sorted by initial post date descending
//   - 'activity': Discussions sorted by recent post activity
//   - 'votes': Discussions sorted by vote count
//   - 'quibbles': Discussions sorted by quibble count
// 
// Return JSON structure: 
// {
//     discussions: [
//         {
//             id:           (int) ID of the discussion,
//             title:        (string) Title of the discussion,
//             timestamp:    (int) Time the discussion was posted in UNIX time,
//             lastActivity: (int) Time of the last user activity in UNIX time,
//             topic:        (string) Name of the discussion's topic,
//             topicId:      (int) ID of the discussion's topic,
//             voteCount:    (int) Count of total user votes,
//             quibbleCount: (int) Count of total user quibbles,
//             ~description: (stirng) Description of the discussion
//         },
//         . . .
//     ],
//     ~lastIndex:  (int) Index of the last discussion retrieved in the array
// }
// 
// The optional lastIndex attribute will only be included if at least one
// discussion is included in the discussions array attribute.
app.get('/discussions', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.getDiscussions,
        routeName: 'GET /discussions',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /discussion/:id route
// 
// Gets information about a specific discussion. Includes the discussion title,
// timestamp, topic, topic ID, and choices.
// 
// Expected URL parameters:
//   - id (int): ID of the discussion
// 
// Return JSON structure:
// {
//     title:       (string) Title of the discussion,
//     timestamp:   (int) Time the discussion was posted in UNIX time,
//     topic:       (string) Name of the discussion topic,
//     topicId:     (int) ID of the topic,
//     ~description (string) Description of the discussion,
//     ~pageContent (string) Page content markdown string,
//     choices: [
//         {
//             id:      (int): ID of the choice,
//             name:    (string) Name of the choice
//         },
//         . . .
//     ]
// }
// 
// If no discussion with the specified ID is found, an error code and message
// is returned with the following structure:
// {
//     error:   (string) Error code
//     message: (string) Descriptive error message
// }
app.get('/discussion/:id', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.getDiscussion,
        routeName: 'GET /discussion/:id',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /discussion/:id/tag route
// 
// Adds a tag to a discussion. Only accessible by admin-level users.
// 
// Expected URL parameters:
//   - id (int): ID of the target discussion
// 
// Expected body parameters:
//   - tag-id (int): ID of the tag to add
app.post('/discussion/:id/tag', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.addDiscussionTag,
        routeName: 'POST /discussion/:id/tag',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /discussion/:id/tags route
// 
// Gets the tags applied to a specific discussion. Includes the tag name and tag
// ID.
// 
// Expected URL parameters:
//   - id (int): ID of the discussion
// 
// Return JSON structure:
// {
//     tags: [
//         {
//             id:   (int) ID of the tag
//             name: (string) Name of the tag
//         },
//         . . .
//     ]
// }
// 
// If no discussion with the specified ID is found, an error code and message
// is returned with the following structure:
// {
//     error:   (string) Error code
//     message: (string) Descriptive error message
// }
app.get('/discussion/:id/tags', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.getDiscussionTags,
        routeName: 'GET /discussion/:id/tags',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /discussion/:id/choice route
// 
// Adds a new choice to a discussion. Only accessible by admin-level users.
//
// Expected URL parameters:
//   - id (int): ID of the discussion
// 
// Expected body parameters:
//   - choice-name (string): Name of the choice
app.post('/discussion/:id/choice', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.addDiscussionChoice,
        routeName: 'POST /discussion/:id/choice',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /discussion/choice/:id/user route
// 
// Adds a user's vote to a choice in a discussion.
// 
// Expected URL parameters:
//   - id (int): ID of the choice that was voted
app.post('/discussion/choice/:id/user', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.addUserChoice,
        routeName: 'POST /discussion/:id/user-choice',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /discussion/:id/user-choice route
// 
// Gets the user's choice from a specific discussion. Includes the choice ID and
// choice name.
// 
// Return JSON structure:
// {
//     choiceId:        (int) ID of the choice the user selected,
//     choiceName:      (string) Name of the choice the user selected
// }
// 
// If the user has not selected a choice, a 400 HTTP response will be returned
// with an error code 'USER_HAS_NO_CHOICE'.
// 
// Expected URL parameters:
//   - id (int): ID of the target discussion
app.get('/discussion/:id/user-choice', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.getUserChoice,
        routeName: 'GET /discussion/:id/user-choice',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /discussion/:id/choice-votes route
// 
// Gets the vote count for each choice of the target discussion.
// 
// Return JSON structure:
// {
//     choiceVotes: [
//         {
//             choiceId:  (int) ID of the choice
//             voteCount: (int) Count of how many votes the choice has
//         },
//         . . .
//     ]
// }
// 
// Expected URL parameters:
//   - id (int): ID of the target discussion
app.get('/discussion/:id/choice-votes', async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.getChoiceVotes,
        routeName: 'GET /discussion/:id/choice-votes',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// GET /discussion/:id/quibbles route
// 
// Gets the quibbles from a specific discussion, starting from the newest.
// Includes the quibble ID, author name, author ID, timestamp, and quibble
// content. Also potentially includes the comdemn count and if the current user
// has condemned a specific quibble. Only returns at most 20 quibbles per call.
// 
// Expected URL parameters:
//   - id (int): ID of the discussion
// 
// Optional query parameters:
//   - after-quibble-id (int): ID of a specific quibble in which retrieved
//         quibbles will be after it
//   - count (int): Number of quibbles to retrieve (capped to 20 quibbles)
// 
// Return JSON structure:
// {
//     quibbles: [
//         {
//             id:          (BigInt string) ID of the quibble,
//             authorName:  (string) Name of the quibble author,
//             authorId:    (int) ID of the quibble author,
//             timestamp:   (number) Time the quibble was posted in UNIX time,
//             content:     (string) Text content of the quibble,
//             ~choiceId:   (int) ID of the user's choice
//             ~condemns:   (int) Count of the number of condemns,
//             ~condemned:  (bool, true) Indicates if the user has
//                              condemned the quibble
//         },
//         . . .
//     ]
// }
// The condemns and condemned attributes are optional, meaning they may or may
// not be provided for a quibble. If the condemns attribute is not provided,
// assume that the quibble has no condemn count. The condemned attribute will
// only be present if the user has condemned the quibble, and the attribute will
// always be set to the value true.
// 
// The quibbles array is sorted by quibble ID, descending.
//
// Quibbles may be deleted by the user or my moderators. Deleted quibbles will
// have their content attribute set to null.
// 
// If no discussion with the specified ID is found, an error code and message
// is returned with the following structure:
// {
//     error:   (string) Error code
//     message: (string) Descriptive error message
// }
app.get('/discussion/:id/quibbles', jwtVerifySoft, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: discussion.getQuibbles,
        routeName: 'GET /discussion/:id/quibbles route',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

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
app.post('/quibble', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: quibble.addQuibble,
        routeName: 'POST /quibble',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// POST /quibble/:id/condemning-user route
// 
// Adds a user to the condemn list of a specific quibble.
// 
// Expected URL parameters:
//   - id (BigInt string): ID of the target quibble
app.post('/quibble/:id/condemning-user', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: quibble.addCondemningUser,
        routeName: 'POST /quibble/:id/condemning-user',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

// DELETE /quibble/:id route
// 
// Removes a specific quibble. Only accessible by moderator-level users.
// 
// Expected URL parameters:
//   - id (BigInt string): ID of the target quibble
app.delete('/quibble/:id', jwtVerifyStrict, async (req, res, next) => {
    await resolveRouteHandler({
        routeResolver: quibble.removeQuibble,
        routeName: 'DELETE /quibble/:id',
        req: req,
        res: res,
        next: next,
        createConn: true
    });
});

app.use(errorHandler);

// resolveRouteHandler
// 
// Utility function for resolving route handlers given a RouteResolver object.
// Calls the RouteResolver's routine and handles all thrown exceptions generated
// by attempting to translate them using the RouteResolver's error translator.
// Provides a database connection through res.locals.conn if specified. The
// database connection is automatically ended when the routine exits.
// 
// Arguments are passed to the function using a single object. This is done to
// improve readability when the function is called. 
// 
// Expected parameters in argument object:
//   - routeResolver (RouteResolver): RouteResolver object for handling the
//         requested action and translating any generated errors
//   - routeName (string): Name of the route to use for internal errors
//   - req (object): Express req object
//   - res (object): Express res object
//   - next (object): Express next object
//   - createConn (bool, optional): Indicates if a database connection should be
//         supplied to the routine from res.locals.conn
async function resolveRouteHandler(params) {
    if (!params.routeResolver
        || !params.routeName
        || !params.req
        || !params.res
        || !params.next) {
        console.error('Invalid resolveRouteHandler call (check argument object syntax)');
        if (params.next) params.next(new RouteError());
        return;
    }

    try {
        if (params.createConn) {
            params.res.locals.conn = await dbPool.getConnection();
        }
        await params.routeResolver.routine(params.req, params.res);
    } catch(err) {
        if (err instanceof RouteError) {
            params.next(err);
            return;
        }
        const translatedError = params.routeResolver.translateError(err);
        if (translatedError) {
            params.next(translatedError);
            return;
        }
        console.error(`${params.routeName} error`);
        console.error(err);
        params.next(err);
    } finally {
        if (params.res.locals.conn) params.res.locals.conn.end();
    }
}

// errorHandler
// 
// Middleware function for handling errors. Returns the thrown error if it is
// already formatted as a RouteError object. Otherwise, returns a 500 request
// status. 
function errorHandler(err, req, res, next) {
    if (err instanceof RouteError) {
        res.status(err.status).send({
            error: err.code,
            message: err.message
        });
        return;
    }

    res.status(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to service request'
    });
}

// jwtVerifyStrict
// 
// Middleware function for verifying that the requesting user is logged-in and
// that their JWT login token has not expired. Attempts to generate a new
// access token using the refresh token if the current access token is expired.
// 
// If the user is successfully logged-in, the request will add a userInfo
// attribute with information contained in the JWT to req.locals. Otherwise, a
// 401 HTTP response will be sent to the requester.
async function jwtVerifyStrict(req, res, next) {
    try {
        res.locals.userInfo = jwt.verify(req.cookies.access_token, process.env.JWT_SECRET);
        next();
        return;
    } catch {
    }

    // Try to create access token from refresh token
    try {
        const userId = jwt.verify(req.cookies.refresh_token, process.env.JWT_SECRET).id;
        const accessToken = await tokenEdit.createAccessToken(userId);
        if (!accessToken) {
            throw new Error('User does not exist');
        }
        tokenEdit.setAccessToken(accessToken, res);
        res.locals.userInfo = jwt.verify(accessToken, process.env.JWT_SECRET);
        next();
        return;
    } catch {
        if (req.cookies.refresh_token) {
            res.clearCookie('refresh_token');
            res.clearCookie('access_token');
            res.status(401).send({
                error: 'USER_LOGIN_ENDED',
                message: `The user's login period has ended`
            });
        }
        else {
            res.status(401).send({
                error: 'USER_NOT_LOGGED_IN',
                message: 'The user is not logged-in'
            });
        }
    }
}

// jwtVerifySoft
// 
// Middleware function for verifying that the requesting user is logged-in and
// that their JWT login token has not expired. Attempts to generate a new
// access token using the refresh token if the current access token is expired.
// 
// Similar behavior to jwtVerifyStrict, but will not return a 401 HTTP response
// if the user is not logged-in. Will only add a userInfo attribute to
// res.locals if available. In all situations, the next middleware function
// will be called normally.
async function jwtVerifySoft(req, res, next) {
    try {
        res.locals.userInfo = jwt.verify(req.cookies.access_token, process.env.JWT_SECRET);
        next();
        return;
    } catch {
    }

    // Try to create access token from refresh token
    try {
        const userId = jwt.verify(req.cookies.refresh_token, process.env.JWT_SECRET).id;
        const accessToken = await tokenEdit.createAccessToken(userId);
        if (accessToken) {
            tokenEdit.setAccessToken(accessToken, res);
            res.locals.userInfo = jwt.verify(accessToken, process.env.JWT_SECRET);
        }
    } catch {
        if (req.cookies.refresh_token) {
            res.clearCookie('refresh_token');
            res.clearCookie('access_token');
        }
    }

    next();
}