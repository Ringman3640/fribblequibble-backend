'use strict'

// util
const RouteError = require('./routeerror.js');

// RouteResolver
// 
// Class for resolving route actions, including error translation. RouteResolver
// objects have a routine attribute and an error translator object. The routine
// is a function responsible for handling the required actions to complete the
// requested route action. The error translation object handles translating a
// general external error code into a more specific internal error code, status,
// and message.
// 
module.exports = class RouteResolver {
    constructor(route, errorTranslator) {
        this.routine = route;
        this.errorTranslator = errorTranslator;
    }

    // translateError
    // 
    // Translate a given external error into an internal RouteError using the
    // error translator object by matching the error's code attribute with
    // the translator keys. If a match is found, a formatted RouteError object
    // is returned. If a match is not found, null is returned.
    translateError(error) {
        if (!this.errorTranslator || !error.code || !this.errorTranslator[error.code]) {
            return null;
        }
        const translation = this.errorTranslator[error.code];
        return new RouteError(
            translation.status,
            translation.code,
            translation.message);
    }
}