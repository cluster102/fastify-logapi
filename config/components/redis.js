'use strict';

const joi = require('@hapi/joi');

const envVarsSchema = joi.object({
    REDIS_HOST: joi.string().required(),
    REDIS_PORT: joi.number().required(),
    USER_DATA: joi.string().required(),
    PRODUCT_DATA: joi.string().required(),
    SELECTED_PRODUCTTYPE: joi.string().required(),
    ADMIN_DATA: joi.string().required(),
    STORE_DATA: joi.string().required(),
    STORE_IDS: joi.string().required(),
    STORE_DESC: joi.string().required(),
    WAREHOUSES_DATA: joi.string().required(),
    ORIGINS_DATA: joi.string().required(),
    HUBS_DATA: joi.string().required(),

    VENDOR_DATA: joi.string().required(),
    RESELLER_DATA: joi.string().required(),
    CITY_MAP: joi.string().required(),

    PAYMENT_STATUS: joi.string().required(),
    FAILED_REGISTERDATA: joi.string().required(),
    DATA_ERROR: joi.string().required(),
    LOG_PAYMENTRESPONSE: joi.string().required(),
    PRODUCT_CATEGORIES: joi.string().required()
    
}).unknown().required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

var config = {
    redis: {
        host: envVars.REDIS_HOST,
        port: envVars.REDIS_PORT,
        user_data: envVars.USER_DATA,
        product_data: envVars.PRODUCT_DATA,
        selected_product: envVars.SELECTED_PRODUCTTYPE,
        admin_data: envVars.ADMIN_DATA,
        store_data: envVars.STORE_DATA,
        store_ids: envVars.STORE_IDS,
        store_desc: envVars.STORE_DESC,
        warehouses: envVars.WAREHOUSES_DATA,
        origins: envVars.ORIGINS_DATA,
        hubs: envVars.HUBS_DATA,
        vendor_data: envVars.VENDOR_DATA,
        reseller_data: envVars.RESELLER_DATA,
        city_map: envVars.CITY_MAP,

        payment_status: envVars.PAYMENT_STATUS,
        log_paymentresponse: envVars.LOG_PAYMENTRESPONSE,


        failed_createorder: envVars.FAILED_CREATEORDER,
        failed_registerdata: envVars.FAILED_REGISTERDATA,
        data_error: envVars.DATA_ERROR,
        product_categories: envVars.PRODUCT_CATEGORIES

    }
};

module.exports = config;