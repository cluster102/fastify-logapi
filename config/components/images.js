const joi = require('@hapi/joi');

const envVarsSchema = joi.object({
    IMAGES_URL: joi.string().uri().required(),
    IMAGE_TOKEN_EXPIRE: joi.number().required(),
    IMAGE_PUBLIC_KEY: joi.string().required(),
    IMAGE_PRIVAT_KEY: joi.string().required()
    
}).unknown().required();

const { error, value: envVars } = envVarsSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const config = {
    images: {
        url: envVars.IMAGES_URL,
        token_expire: envVars.IMAGE_TOKEN_EXPIRE,
        public_key: envVars.IMAGE_PUBLIC_KEY,
        privat_key: envVars.IMAGE_PRIVAT_KEY
    }
};

module.exports = config;