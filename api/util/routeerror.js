'use strict'

// RouteError
// 
// Error class for representing errors that occur during route handling. Used to
// indicate an internal error versus an external error.
module.exports = class RouteError extends Error {
    constructor(status, code, message) {
        super(message || 'Unable to service request');
        this.status = status || 500;
        this.code = code || 'INTERNAL_SERVER_ERROR';
    }
}

