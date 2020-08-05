"use strict";

class UnprocessableEntityError extends Error {

    constructor(code = '422', ...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, UnprocessableEntityError);
        }

        this.name = 'UnprocessableEntityError';
        this.code = code;
        this.date = new Date();
    }
}

module.exports = UnprocessableEntityError;