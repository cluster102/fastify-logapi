'use strict';

const joi = require('@hapi/joi');
var queue = require('bull');


const envVarsSchema = joi.object({
    BULL_URL: joi.string().required(),
    BULL_USERPROCEDURE: joi.string().required(),
    BIZ_ORDERPROCEDURE: joi.string().required(),
    BULL_PRODUCTPROCEDURE: joi.string().required(),
    BIZ_WEBHOOKPROCEDURE: joi.string().required(),

    BULL_REGISTERUSER: joi.string().required(),
    BULL_REGISTERCONFIRMATION: joi.string().required(),
    BULL_FORGOTPASSWORD: joi.string().required(),

    BULL_REGISTERFAILED: joi.string().required(),
    BIZ_CREATEORDER: joi.string().required(),
    BIZ_PAIDORDER: joi.string().required(),
//    BIZ_RESENDTOCHANNEL: joi.string().required(),
    HOOK_SALES_ORDER_STATUS: joi.string().required(),
    BIZ_PAYMENTRECEIPT: joi.string().required(),


    BIZ_ADDPRODUCT: joi.string().required(),
}).unknown().required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

var config = {
    bull: { 
        server: envVars.BULL_URL,
        user_procedure: envVars.BULL_USERPROCEDURE,
        product_procedure: envVars.BULL_PRODUCTPROCEDURE,
        biz_order_procedure: envVars.BIZ_ORDERPROCEDURE,
        biz_webhook_procedure: envVars.BIZ_WEBHOOKPROCEDURE,

        biz_addproduct: envVars.BIZ_ADDPRODUCT,

        register_user: envVars.BULL_REGISTERUSER,
        register_confirmation: envVars.BULL_REGISTERCONFIRMATION,
        forgot_password: envVars.BULL_FORGOTPASSWORD,



        register_failed: envVars.BULL_REGISTERFAILED,
        biz_createorder: envVars.BIZ_CREATEORDER,
        biz_payorder: envVars.BIZ_PAIDORDER,
//        biz_resendtochannel: envVars.BIZ_RESENDTOCHANNEL,
        hook_sales_order: envVars.HOOK_SALES_ORDER_STATUS,
        biz_paymentreceipt: envVars.BIZ_PAYMENTRECEIPT,

    },
};

const queueProduct = new queue(config.bull.product_procedure, config.bull.server);
const queueUser = new queue(config.bull.user_procedure, config.bull.server);
const queueOrder = new queue(config.bull.biz_order_procedure, config.bull.server)
const queueHook = new queue(config.bull.biz_webhook_procedure, config.bull.server)
//const queueKacs = new queue(config.bull.kacs_queue, config.bull.server)

config.bull.instance = {
    user: queueUser,
    order: queueOrder,
    hook: queueHook,
    product: queueProduct
}

module.exports = config;