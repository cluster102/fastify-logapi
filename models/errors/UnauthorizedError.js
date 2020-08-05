"use strict";

class UnauthorizedError extends Error {

    constructor(code = '401', ...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, UnauthorizedError);
        }

        this.name = 'UnauthorizedError';
        this.code = code;
        this.date = new Date();
    }
}

module.exports = UnauthorizedError;