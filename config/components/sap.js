'use strict';

const joi = require('@hapi/joi');

const envVarsSchema = joi.object({
    SAP_URL: joi.string().default('https://api.coresyssap.com'),
    SAP_RATE_URL: joi.string().default('https://api.coresyssap.com'),
    SAP_TRACKING_URL: joi.string().default('http://track.coresyssap.com'),
    SAP_KEY: joi.string().required(),
    SAP_RATE_KEY: joi.string().default('global'),
    SAP_TRACKING_KEY: joi.string().default('global')
}).unknown().required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const config = {
    sap: {
        key: envVars.SAP_KEY,
        url: envVars.SAP_URL,
        rate_url: envVars.SAP_RATE_URL,
        rate_key: envVars.SAP_RATE_KEY,
        tracking_url: envVars.SAP_TRACKING_URL,
        tracking_key: envVars.SAP_TRACKING_KEY
    }
};

module.exports = config;