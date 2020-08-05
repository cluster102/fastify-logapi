"use strict";

const util = require('util');
const _ = require('lodash');
const config = require('../../config');
const logger = config.logger.instance;
const loginResponse = require('./loginResponse')
const BadRequestError = require('../../models/errors/BadRequest');
const NotFoundError = require('../../models/errors/NotFound');
const UnauthorizedError = require('../../models/errors/UnauthorizedError');

const login = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { redis, mysql, jwt, passwordCheck } = fastify;
        const { headers, body } = request;
        const { user_email, user_password, vendor_name } = body;  
        
        try {
            if (_.isUndefined(vendor_name) || _.isNull(vendor_name) ||  _.isEmpty(vendor_name)) {
                throw new BadRequestError (422, "Missing 'vendor' field")
            }
    
            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);

            // get user data
            let masterkey = `${user_email}_3_${vendor_name.toLowerCase()}`;
            let result = await hget(config.redis.user_data, masterkey);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                // search first in database
                throw new NotFoundError (404, "user not found")
            }
            let user_data = JSON.parse(result);

            // compare password
            result = await passwordCheck({passwd: user_password, origin_password: user_data.user_passwd});
            if (!result){
                let logData = {
                    user_id: user_data.id,
                    userlog_ids: 6,
                    userlog_ips: headers["x-forwarded-for"],
                    userlog_data: headers.referer
                }
                mysql.query('INSERT INTO tb_userlog SET ?', logData);
                throw new UnauthorizedError(401, 'Pasword not match')
            }

            // get customer id
            request.user = user_data;
            return resolve(await loginResponse(fastify, request));

        } catch(err){
            logger.log({level: "warn", message: err.message})
            return reject(err)
        }
    })
}

module.exports = login; 