'use strict';

const joi = require('@hapi/joi');
const winston = require('winston');

const envVarsSchema = joi.object({
    LOGGER_LEVEL: joi.string()
        .allow('error', 'warn', 'info', 'verbose', 'debug', 'silly')
        .default('info'),
    LOGGER_ENABLED: joi.boolean()
        .truthy('TRUE')
        .truthy('true')
        .falsy('FALSE')
        .falsy('false')
        .default(true),
    LOGGER_TRANSPORT: joi.string()
        .allow('console', 'file')
        .default('console'),
    LOGGER_FILE_PATH: joi.string()
        .default('fastify-logapi.log')
}).unknown().required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error}`);
}

const config = {
    logger: {
        level: envVars.LOGGER_LEVEL,
        enabled: envVars.LOGGER_ENABLED,
        transport: envVars.LOGGER_TRANSPORT
    }
};

const logger = winston.createLogger({
    level: config.logger.level,
    defaultMeta: { service: 'fatify-logapi-service' }
});

if (!config.logger.enabled) {
    winston.remove(winston.transports.Console);
} else {
    if (config.logger.transport === 'file') {
        logger.add(new winston.transports.File({
            level: config.logger.level,
            format: winston.format.json(),
            filename: envVars.LOGGER_FILE_PATH
        }));
    } else { // default transport to console
        logger.add(new winston.transports.Console({
            level: config.logger.level,
            format: winston.format.combine(winston.format.colorize(), winston.format.simple())
        }));
    }
} 

config.logger.instance = logger;

module.exports = config;
