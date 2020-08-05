'use strict';

const joi = require('@hapi/joi');

const envVarsSchema = joi.object({
    DB_DIALECT: joi.string().required(),
    DB_HOST: joi.string().required(),
    DB_PORT: joi.number().default(3306),
    DB_NAME: joi.string().required(),
    DB_USER: joi.string().required(),
    DB_PASSWORD: joi.string().required()
}).unknown().required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error}`);
}

var config = {
    database: {
        db_dialect: envVars.DB_DIALECT,
        db_host: envVars.DB_HOST,
        db_port: envVars.DB_PORT,
        db_name: envVars.DB_NAME,
        db_user: envVars.DB_USER,
        db_password: envVars.DB_PASSWORD
    },

    level_chain: [  { name: 'Level 1', discount: 10, id: 1 },
                    { name: 'Level 2', discount: 15, id: 2 },
                    { name: 'Level 3', discount: 20, id: 3 },
                    { name: 'Level 4', discount: 25, id: 4 },
                    { name: 'Level 5', discount: 30, id: 5 }]
};



module.exports = config;