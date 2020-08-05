"use strict";

class BadRequestError extends Error {

    constructor(code = '400', ...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, BadRequestError);
        }

        this.name = 'BadRequestError';
        this.code = code;
        this.date = new Date();
    }
}

module.exports = BadRequestError;