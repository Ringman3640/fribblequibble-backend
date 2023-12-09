// discussion.js
// 
// Implements the route actions pertaining to managing discussion posts.

'use strict'

// util
const RouteError = require('../util/routeerror.js')
const RouteResolver = require('../util/routeresolver.js');

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
exports.addDiscussion = new RouteResolver(async (req, res) => {
    if (res.locals.userInfo.access_level < 3) {
        throw new RouteError(
            403,
            'UNAUTHORIZED_ACCESS',
            'Only admin-level users or above can add discussions');
    }

    const title = req.body['title'];
    const topicId = req.body['topic-id'];
    const description = req.body['description'];
    const pageContent = req.body['page-content'];
    if (!title) {
        throw new RouteError(
            400,
            'NO_DISCUSSION_TITLE',
            'No discussion title was provided in the body request')
    }
    if (!topicId) {
        throw new RouteError(
            400,
            'NO_TOPIC_ID',
            'No topic ID was provided in the body request');
    }
    if (!Number.isInteger(topicId)) {
        throw new RouteError(
            400,
            'INVALID_TOPIC_ID',
            'The provided topic ID value must be an int');
    }
    if (pageContent && typeof pageContent !== 'string') {
        throw new RouteError(
            400,
            'INVALID_PAGE_CONTENT',
            'The provided page content value must be a string');
    }

    const sqlStatement = `
        INSERT INTO discussion (
            ${description ? 'description,' : ''} 
            ${pageContent ? 'page_content,' : ''} 
            title, topic_id)
        VALUES (
            ${description ? '?,' : ''} 
            ${pageContent ? '?,' : ''} 
            ?, ?);
    `;
    let sqlArgList = [];
    description && sqlArgList.push(description);
    pageContent && sqlArgList.push(pageContent);
    sqlArgList.push(title, topicId);

    await res.locals.conn.beginTransaction();
    await res.locals.conn.query(sqlStatement, sqlArgList);
    const dbRes = await res.locals.conn.query(`
        SELECT LAST_INSERT_ID() AS id;
    `);
    try {
        await res.locals.conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    }

    console.log(dbRes);

    res.status(201).send({
        discussionId: Number(dbRes[0].id)
    });
},
{
    ER_NO_REFERENCED_ROW_2: {
        status: 400,
        code: 'INVALID_TOPIC_ID',
        message: 'The provided topic ID does not exist'
    },
    ER_DUP_ENTRY: {
        status: 400,
        code: 'DISCUSSION_ALREADY_EXISTS',
        message: 'The provided discussion title already exists'
    }
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
exports.getDiscussions = new RouteResolver(async (req, res) => {
    const search = req.query['search'];
    const topicId = +req.query['topic-id'];
    const afterIndex = +req.query['after-index'] || -1;
    const retrieveCount = +req.query['count'];
    const sortBy = req.query['sort-by'] || 'date-new';

    if (topicId && !Number.isInteger(topicId)) {
        throw new RouteError(
            400,
            'INVALID_TOPIC_ID',
            'The provided topic ID value must be an int');
    }
    if (afterIndex && !Number.isInteger(afterIndex)) {
        throw new RouteError(
            400,
            'INVALID_AFTER_INDEX',
            'The provided after index value must be an int');
    }
    if (retrieveCount && (!Number.isInteger(retrieveCount) || retrieveCount < 0)) {
        throw new RouteError(
            400,
            'INVALID_COUNT',
            'The provided count value must be a positive int');
    }

    let sqlOrderByStatement;
    switch(sortBy) {
        case undefined:
        case 'date-new':
            sqlOrderByStatement = 'ORDER BY timestamp DESC';
            break;
        case 'date-old':
            sqlOrderByStatement = 'ORDER BY timestamp ASC';
            break;
        case 'activity':
            sqlOrderByStatement = 'ORDER BY activity_timestamp DESC';
            break;
        case 'votes':
            sqlOrderByStatement = 'ORDER BY vote_count DESC';
            break;
        case 'quibbles':
            sqlOrderByStatement = 'ORDER BY quibble_count DESC';
            break;
        default:
            throw new RouteError(
                400,
                'INVALID_SORT_BY',
                'The provided sort by value is not one of the selectable types');
    }
    
    let sqlStatement = `
        SELECT
            discussion_with_votes.*
        FROM (
            SELECT
                discussion.id,
                title,
                description,
                discussion.topic_id,
                topic_name,
                UNIX_TIMESTAMP(date_created) as timestamp,
                activity_timestamp,
                COUNT(user_id) AS vote_count,
                quibble_count,
                ROW_NUMBER() OVER (${sqlOrderByStatement}) AS row_index
            FROM discussion
            JOIN topic ON (topic_id = topic.id)
            LEFT JOIN user_choice ON (discussion.id = discussion_id)
            LEFT JOIN (
                SELECT
                    discussion_id,
                    MAX(UNIX_TIMESTAMP(date_posted)) AS activity_timestamp
                FROM quibble
                GROUP BY discussion_id
            ) activity ON (discussion.id = activity.discussion_id)
            LEFT JOIN (
                SELECT
                    discussion.id,
                    COUNT(quibble.id) AS quibble_count
                FROM discussion
                LEFT JOIN quibble ON (discussion.id = discussion_id)
                GROUP BY discussion.id
            ) discussions_with_quibbles ON (discussion.id = discussions_with_quibbles.id)
            ${topicId ? 'WHERE topic_id = ?' : ''}
            ${search && !topicId ? 'WHERE title LIKE ?' : ''}
            ${search && topicId ? 'AND title LIKE ?' : ''}
            GROUP BY discussion.id
        ) discussion_with_votes
        WHERE row_index > ?
        GROUP BY discussion_with_votes.id
        ${sqlOrderByStatement}
        LIMIT ?;
    `;

    const sqlArgList = [];
    if (topicId) {
        sqlArgList.push(topicId);
    }
    if (search) {
        sqlArgList.push('%' + search + '%');
    }
    sqlArgList.push(afterIndex ? afterIndex : 0);
    if (retrieveCount && retrieveCount <= +process.env.DISCUSSIONS_MAX_GET) {
        sqlArgList.push(retrieveCount);
    }
    else {
        sqlArgList.push(+process.env.DISCUSSIONS_MAX_GET);
    }

    const dbRes = await res.locals.conn.query(sqlStatement, sqlArgList);

    const resJSON = {
        discussions: []
    };
    for (const discussion of dbRes) {
        resJSON.discussions.push({
            id: discussion.id,
            title: discussion.title,
            topic: discussion.topic_name,
            topicId: discussion.topic_id,
            timestamp: discussion.timestamp,
            lastActivity: discussion.activity_timestamp || discussion.timestamp,
            voteCount: discussion.vote_count,
            quibbleCount: discussion.quibble_count,
            description: discussion.description || undefined
        });
    }
    if (dbRes.length !== 0) {
        resJSON['lastIndex'] = dbRes[dbRes.length - 1].row_index;
    }

    res.status(200).send(resJSON);
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
//             name:    (string) Name of the choice,
//             ~color:  (string) Hex color of the choice (#FFFFFF format)
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
exports.getDiscussion = new RouteResolver(async (req, res) => {
    const discussionId = req.params['id'];
    if (!discussionId) {
        throw new RouteError(
            400,
            'NO_DISCUSSION_ID',
            'No discussion ID was provided in the URL parameters');
    }
    if (!Number.isInteger(+discussionId)) {
        throw new RouteError(
            400,
            'INVALID_DISCUSSION_ID',
            'The provided discussion ID value must be an int');
    }

    const discussionInfo = await res.locals.conn.query(`
        SELECT 
            title, 
            UNIX_TIMESTAMP(date_created) as timestamp, 
            topic_id, 
            topic_name, 
            description, 
            page_content
        FROM discussion
        JOIN topic ON (discussion.topic_id = topic.id)
        WHERE discussion.id = ?;
    `, [discussionId]);
    if (discussionInfo.length === 0) {
        throw new RouteError(
            400,
            'DISCUSSION_NOT_FOUND',
            'The provided discussion ID was not found');
    }
    const choiceInfo = await res.locals.conn.query(`
        SELECT id, choice_name, color FROM choice
        WHERE discussion_id = ?;
    `, [discussionId]);

    const resJSON = {
        title: discussionInfo[0].title,
        timestamp: discussionInfo[0].timestamp,
        topicId: discussionInfo[0].topic_id,
        topic: discussionInfo[0].topic_name,
        description: discussionInfo[0].description || undefined,
        pageContent: discussionInfo[0].page_content || undefined,
        choices: []
    };
    for (const choice of choiceInfo) {
        resJSON['choices'].push({
            id: choice.id,
            name: choice.choice_name,
            color: choice.color || undefined
        });
    }

    res.status(200).send(resJSON);
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
exports.addDiscussionTag = new RouteResolver(async (req, res) => {
    if (res.locals.userInfo.access_level < 3) {
        throw new RouteError(
            403,
            'UNAUTHORIZED_ACCESS',
            'Only admin-level users or above can add tags to discussions');
    }

    const discussionId = req.params['id'];
    const tagId = req.body['tag-id'];

    if (!discussionId) {
        throw new RouteError(
            400,
            'NO_DISCUSSION_ID',
            'No discussion ID was provided in the URL parameters');
    }
    if (!tagId) {
        throw new RouteError(
            400,
            'NO_TAG_ID',
            'No tag ID was provided in the body request');
    }

    await res.locals.conn.query(`
        INSERT INTO discussion_tag (discussion_id, tag_id)
        VALUES (?, ?);
    `, [discussionId, tagId]);

    res.status(201).send({
        message: 'Successfully added tag to discussion'
    });
},
{
    ER_DUP_ENTRY: {
        status: 400,
        code: 'DISCUSSION_ALREADY_HAS_TAG',
        message: 'The target discussion already had the target tag'
    },
    ER_NO_REFERENCED_ROW_2: {
        status: 400,
        code: 'DISCUSSION_TAG_NOT_FOUND',
        message: 'The provided discussion ID or tag ID was not found'
    }
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
exports.getDiscussionTags = new RouteResolver(async (req, res) => {
    const discussionId = req.params['id'];

    if (!discussionId) {
        throw new RouteError(
            400,
            'NO_DISCUSSION_ID',
            'No discussion ID was provided in the URL parameters');
    }
    if (!Number.isInteger(+discussionId)) {
        throw new RouteError(
            400,
            'INVALID_DISCUSSION_ID',
            'The provided discussion ID value must be an int');
    }

    const tagInfo = await res.locals.conn.query(`
        SELECT id, tag_name FROM tag
        WHERE id IN (
            SELECT tag_id FROM discussion_tag
            WHERE discussion_id = ?
        );
    `, [discussionId]);
    const resJSON = {
        tags: []
    };
    for (const tag of tagInfo) {
        resJSON['tags'].push({
            id: tag.id,
            name: tag.tag_name
        });
    }

    res.status(200).send(resJSON);
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
// 
// Optional body parameters:
//   - choice-color (string): Hex color of the choice (#FFFFFF format)
exports.addDiscussionChoice = new RouteResolver(async (req, res) => {
    if (res.locals.userInfo.access_level < 3) {
        throw new RouteError(
            403,
            'UNAUTHORIZED_ACCESS',
            'Only admin-level users or above can add choices');
    }

    const discussionId = req.params['id'];
    const choiceName = req.body['choice-name'];
    const choiceColor = req.body['choice-color'];
    if (!discussionId) {
        throw new RouteError(
            400,'NO_DISCUSSION_ID',
            'No discussion ID was provided in the body request');
    }
    if (!choiceName) {
        throw new RouteError(
            400,'NO_CHOICE_NAME',
            'No choice name was provided in the body request');
    }
    if (choiceColor && (choiceColor.length != 7 || choiceColor.charAt(0) != '#')) {
        throw new RouteError(
            400,
            'INVALID_CHOICE_COLOR',
            'The choice color must be in the hex format #FFFFFF');
    }

    if (choiceColor) {
        await res.locals.conn.query(`
            INSERT INTO choice (discussion_id, choice_name, color)
            VALUES (?, ?, ?);
        `, [discussionId, choiceName, choiceColor]);
    }
    else {
        await res.locals.conn.query(`
            INSERT INTO choice (discussion_id, choice_name)
            VALUES (?, ?);
        `, [discussionId, choiceName]);
    }

    res.status(201).send({
        message: 'Successfully added choice'
    });
},
{
    ER_DUP_ENTRY: {
        status: 400,
        code: 'CHOICE_ALREADY_EXISTS',
        message: 'The provided choice already exists for the discussion'
    },
    ER_NO_REFERENCED_ROW_2: {
        status: 400,
        code: 'DISCUSSION_ID_NOT_FOUND',
        message: 'The provided discussion ID was not found'
    }
});

// POST /discussion/choice/:id/user route
// 
// Adds a user's vote to a choice in a discussion.
// 
// Expected URL parameters:
//   - id (int): ID of the choice that was voted
exports.addUserChoice = new RouteResolver(async (req, res) => {
    const choiceId = req.params['id'];
    if (!choiceId) {
        throw new RouteError(
            400,
            'NO_CHOICE_ID',
            'No name was provided in the URL parameters');
    }
    if (!Number.isInteger(+choiceId)) {
        throw new RouteError(
            400,
            'INVALID_CHOICE_ID',
            'The provided choice ID value must be an int');
    }

    // Get discussion ID from choice ID
    const dbRes = await res.locals.conn.query(`
        SELECT discussion_id FROM choice
        WHERE id = ?;
    `, [choiceId]);
    if (dbRes.length === 0) {
        throw new RouteError(
            400,
            'CHOICE_NOT_FOUND',
            'The choice ID was not found');
    }
    const discussionId = dbRes[0].discussion_id;

    // Add user choice
    await res.locals.conn.query(`
        INSERT INTO user_choice (choice_id, user_id, discussion_id)
        VALUES (?, ?, ?);
    `, [choiceId, res.locals.userInfo.id, discussionId]);

    res.status(201).send({
        message: 'Successfully added user choice'
    });
},
{
    ER_DUP_ENTRY: {
        status: 400,
        code: 'USER_ALREADY_VOTED',
        message: 'The user has already voted on the discussion'
    }
});

// GET /discussion/:id/user-choice route
// 
// Gets the user's choice from a specific discussion. Includes the choice ID,
// choice name, and optionally a choice color if present.
// and choice color.
// 
// Return JSON structure:
// {
//     choiceId:        (int) ID of the choice the user selected
//     choiceName:      (string) Name of the choice the user selected
//     ~choiceColor:    (string) Hex color of the choice (#FFFFFF format)
// }
// 
// If the user has not selected a choice, a 400 HTTP response will be returned
// with an error code 'USER_HAS_NO_CHOICE'.
// 
// Expected URL parameters:
//   - id (int): ID of the target discussion
exports.getUserChoice = new RouteResolver(async (req, res) => {
    const discussionId = req.params['id'];
    if (!discussionId) {
        throw new RouteError(
            400,
            'NO_DISCUSSION_ID',
            'No discussion ID was provided in the URL parameters');
    }
    if (!Number.isInteger(+discussionId)) {
        throw new RouteError(
            400,
            'INVALID_DISCUSSION_ID',
            'The provided discussion ID value must be an int');
    }

    const dbRes = await res.locals.conn.query(`
        SELECT choice_id, choice_name, color FROM user_choice
        JOIN choice ON (choice_id = id)
        WHERE user_choice.discussion_id = ?
        AND user_id = ?;
    `, [discussionId, res.locals.userInfo.id]);
    if (dbRes.length === 0) {
        throw new RouteError(
            400,
            'USER_HAS_NO_CHOICE',
            'The user has not selected a choice');
    }
    const resJSON = {
        choiceId: dbRes[0].choice_id,
        choiceName: dbRes[0].choice_name,
        choiceColor: dbRes[0].color || undefined
    };

    res.status(200).send(resJSON);
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
exports.getChoiceVotes = new RouteResolver(async(req, res) => {
    const discussionId = req.params['id'];
    if (!discussionId) {
        throw new RouteError(
            400,
            'NO_DISCUSSION_ID',
            'No discussion ID was provided in the URL parameters');
    }
    if (!Number.isInteger(+discussionId)) {
        throw new RouteError(
            400,
            'INVALID_DISCUSSION_ID',
            'The provided discussion ID value must be an int');
    }

    const dbRes = await res.locals.conn.query(`
        SELECT id, COUNT(user_id) AS choice_count FROM choice
        LEFT JOIN user_choice ON (id = choice_id)
        WHERE choice.discussion_id = ?
        GROUP BY id;
    `, [discussionId]);

    const resJSON = {
        choiceVotes: []
    };
    for (const choiceVote of dbRes) {
        resJSON.choiceVotes.push({
            choiceId: choiceVote.id,
            voteCount: Number(choiceVote.choice_count)
        });
    }

    res.status(200).send(resJSON);
},
{

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
exports.getQuibbles = new RouteResolver(async (req, res) => {
    const discussionId = req.params['id'];
    const afterQuibbleId = req.query['after-quibble-id'];
    const retrieveCount = req.query['count'];
    if (!discussionId) {
        throw new RouteError(
            400,
            'NO_DISCUSSION_ID',
            'No discussion ID was provided in the URL parameters');
    }
    if (!Number.isInteger(+discussionId)) {
        throw new RouteError(
            400,
            'INVALID_DISCUSSION_ID',
            'The provided discussion ID value must be an int');
    }
    if (afterQuibbleId && !Number.isInteger(+afterQuibbleId)) {
        throw new RouteError(
            400,
            'INVALID_AFTER_QUIBBLE_ID',
            'The provided after quibble ID value must be an int');
    }
    if (retrieveCount && (!Number.isInteger(+retrieveCount) || retrieveCount < 0)) {
        throw new RouteError(
            400,
            'INVALID_COUNT',
            'The provided count value must be a positive int');
    }

    const sqlStatement = `
        SELECT 
            quibble.id,
            author_id,
            username,
            UNIX_TIMESTAMP(date_posted) as timestamp,
            content, 
            choice_id,
            ${res.locals.userInfo ? 'condemned.user_id AS condemned,' : ''}
            COUNT(condemning_user.user_id) AS condemn_count
        FROM quibble
        JOIN user ON (author_id = user.id)
        LEFT JOIN condemning_user ON (quibble.id = quibble_id)
        LEFT JOIN (
            SELECT
                choice_id,
                user_id
            FROM user_choice
            WHERE discussion_id = ?
        ) user_vote ON (user.id = user_vote.user_id)
        ${res.locals.userInfo ? `
        LEFT JOIN (
            SELECT
                quibble_id,
                user_id
            FROM condemning_user
            WHERE user_id = ?
        ) condemned ON (quibble.id = condemned.quibble_id)` : ''}
        WHERE quibble.discussion_id = ?
        ${afterQuibbleId ? 'AND quibble.id < ?' : ''}
        GROUP BY quibble.id
        ORDER BY quibble.id DESC
        LIMIT ?;
    `;

    const sqlArgList = [];
    sqlArgList.push(+discussionId);
    if (res.locals.userInfo) {
        sqlArgList.push(res.locals.userInfo.id);
    }
    sqlArgList.push(+discussionId);
    if (afterQuibbleId){
        sqlArgList.push(+afterQuibbleId);
    }
    if (!retrieveCount || +retrieveCount > process.env.QUIBBLE_MAX_GET) {
        sqlArgList.push(+process.env.QUIBBLE_MAX_GET);
    }
    else {
        sqlArgList.push(+retrieveCount);
    }

    const dbRes = await res.locals.conn.query(sqlStatement, sqlArgList);
    const resJSON = { quibbles: [] };
    for (const quibble of dbRes) {
        const nextEntry = {
            id: quibble.id,
            authorName: quibble.username,
            authorId: quibble.author_id,
            timestamp: quibble.timestamp,
            content: quibble.content,
            choiceId: quibble.choice_id || undefined
        };
        if (quibble.condemn_count > 0n) {
            nextEntry['condemns'] = Number(quibble.condemn_count);
        }
        if (quibble.condemned) {
            nextEntry['condemned'] = true;
        }

        resJSON.quibbles.push(nextEntry);
    }

    res.status(200).send(resJSON);
});