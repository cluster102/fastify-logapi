'use strict';

const joi = require('@hapi/joi');

const envVarsSchema = joi.object({
    ELASTIC_APM_SERVICE_NAME: joi.string().default('powerbiz-delivery'),
    ELASTIC_APM_SECRET_TOKEN: joi.string().required(),
    ELASTIC_APM_SERVER_URL: joi.string().required()
}).unknown().required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
    throw new Error (`Config validation error: ${error}`);
}

const config = {
    elasticapm: {
        serviceName: envVars.ELASTIC_APM_SERVICE_NAME,
        secretToken: envVars.ELASTIC_APM_SECRET_TOKEN,
        serverUrl: envVars.ELASTIC_APM_SERVER_URL
    }
};

module.exports = config;