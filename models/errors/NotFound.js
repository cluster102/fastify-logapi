"use strict";

class NotFoundError extends Error {

    constructor(code = '404', ...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NotFoundError);
        }

        this.name = 'NotFoundError';
        this.code = code;
        this.date = new Date();
    }
}

module.exports = NotFoundError;