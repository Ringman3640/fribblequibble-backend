// validation.js
// 
// Provides helper functions for validating request parameters.

'use strict'

// routeerror.js
const RouteError = require('./routeerror.js');

// validateUsername
// 
// Validates the given username.
// 
// Throws a RouteError object if the username conditions are not met as defined
// in the environment variables. Otherwise, returns true.
exports.validateUsername = (username) => {
    if (!username) {
        throw new RouteError(
            400,
            'NO_USERNAME',
            'Username not provided');
    }
    if (username.length > process.env.USERNAME_MAX_LENGTH) {
        throw new RouteError(
            400,
            'USERNAME_TOO_LONG',
            `Username cannot be longer than ${ process.env.USERNAME_MAX_LENGTH } characters`);
    }

    return true;
}

// validatePassword
// 
// Validates the given password.
// 
// Throws a RouteError object if the password conditions are not met as defined
// in the environment variables. Otherwise, returns true.
exports.validatePassword = (password) => {
    if (!password) {
        throw new RouteError(
            400,
            'NO_PASSWORD',
            'Password not provided');
    }
    if (!(/^[\x00-\x7F]*$/.test(password))) {
        throw new RouteError(
            400,
            'PASSWORD_NOT_ASCII',
            'Password must only consist of Ascii characters');
    }
    if (password.length > process.env.PASSWORD_MAX_LENGTH) {
        throw new RouteError(
            400,
            'PASSWORD_TOO_LONG',
            `Password cannot be longer than ${ process.env.PASSWORD_MAX_LENGTH } characters`);
    }
    if (password.length < process.env.PASSWORD_MIN_LENGTH) {
        throw new RouteError(
            400,
            'PASSWORD_TOO_SHORT',
            `Password cannot be shorter than ${ process.env.PASSWORD_MIN_LENGTH } characters`);
    }

    return true;
}

// validateUserId
// 
// Validates the given user ID.
// 
// Throws a RouteError object if the user ID is undefined, or if the user Id is
// not an integer value. Otherwise, returns true.
exports.validateUserId = (userId) => {
    if (!userId) {
        throw new RouteError(
            400,
            'NO_USER_ID',
            'No user ID was provided in the URL parameters');
    }
    if (!Number.isInteger(+userId)) {
        throw new RouteError(
            400,
            'INVALID_USER_ID',
            'The provided user ID value must be an int');
    }

    return true;
}