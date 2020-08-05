'use strict';

const joi = require('@hapi/joi');

const envVarsSchema = joi.object({
    PORT: joi.number().required(),
    SESSION_KEY: joi.string().required(),
    ADMIN_URL: joi.string().uri().required(),
    STORE_URL: joi.string().uri().required(),
    INIT_URL: joi.string().uri().required(),
    PAYMENTGATEWAY_URL: joi.string().uri().required(),
    RESELLER_URL: joi.string().uri().required(),
    DELIVERY_URL: joi.string().required(),
    JWT_ENCRYPTION: joi.string().required(),
    JWT_EXPIRATION_ADMIN: joi.string().default('12h'),
    JWT_REFRESH_EXPIRATION_ADMIN: joi.string().default('1h'),
    JWT_EXPIRATION_USER: joi.string().default('24h'),
    MIN_PASSWORD_LENGTH: joi.number().default(8),
    CHECKOUT_BOOKING_EXPIRED_TIME: joi.number().default(6),   
    HASH_USER: joi.string().required(),
    HASH_REGISTER:joi.string().required(),
    CHANNEL_WEBCOMMERCE: joi.number().default(53),
    DATAINIT_URL: joi.string().uri().required(),
    DOCUMENT_HOST: joi.string().required(),
    DOCUMENTATION_ENABLED: joi.boolean()
        .truthy('TRUE')
        .truthy('true')
        .falsy('FALSE')
        .falsy('false')
        .default(false)


}).unknown().required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const config = {
    min_password_length: envVars.MIN_PASSWORD_LENGTH,
    jwt_encryption:        	envVars.JWT_ENCRYPTION,
    jwt_expiration_admin:  	envVars.JWT_EXPIRATION_ADMIN,
    jwt_refresh_expiration:	envVars.JWT_REFRESH_EXPIRATION_ADMIN,
    jwt_expiration_user:	envVars.JWT_EXPIRATION_USER,

    checkout_booking_expired_time: envVars.CHECKOUT_BOOKING_EXPIRED_TIME,

    server: {
        port: envVars.PORT
    },
    datainit: {
        url: envVars.DATAINIT_URL
    }, 
    default_url: {
        admin: envVars.ADMIN_URL,
        store: envVars.STORE_URL,
        reseller: envVars.RESELLER_URL,
        payment_gateway: envVars.PAYMENTGATEWAY_URL,
    },
    delivery: {
        url: envVars.DELIVERY_URL
    },

    keys: {
        hashkey_user: envVars.HASH_USER,
        hashkey_registerlink: envVars.HASH_REGISTER,
        session: envVars.SESSION_KEY
    },
    channels: {
        webcommerce: envVars.CHANNEL_WEBCOMMERCE
    },
    pre_numbering: ['OD', 'IV', 'PO'],
    documentation: envVars.DOCUMENTATION_ENABLED,

    document_host: envVars.DOCUMENT_HOST

};

module.exports = config;