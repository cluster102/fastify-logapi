"use strict";

class InternalServerError extends Error {

    constructor(code = '500', ...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, InternalServerError);
        }

        this.name = 'InternalServerError';
        this.code = code;
        this.date = new Date();
    }
}

module.exports = InternalServerError;