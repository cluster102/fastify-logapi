"use strict";

const util = require('util');
const _ = require('lodash');
const config = require('../../config');
const loginResponse = require('./loginResponse')
const BadRequestError = require('../../models/errors/BadRequest');
const NotFoundError = require('../../models/errors/NotFound');
const UnauthorizedError = require('../../models/errors/UnauthorizedError');


const login = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { redis, mysql, passwordCheck } = fastify;
        const { headers, body} = request;
        const { user_email, user_password } = body;
      
        try {
            // check auth
            const storeId = headers.storeid;
            if (_.isUndefined(storeId) || _.isNull(storeId) || _.isEmpty(storeId)) {
                throw new BadRequestError(422, `Missing storeId!`);
            }
        
            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
            // check lets check
            let result = await hget(config.redis.store_ids, storeId);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)) {
                throw new NotFoundError(404, `storeId not found`); 
            }
       
            let seller_data = JSON.parse(result);
            let masterkey = `${user_email.toLowerCase()}_5_${storeId}`;
            result = await hget(config.redis.user_data, masterkey);

            // start transaction
            var user_data;
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result) ){
                result = await mysql.query(`SELECT u.id,
                                                u.user_hashid as hash_id,
                                                u.role_id as userrole_id,
                                                u.user_firstname,
                                                u.user_name,
                                                u.user_email,
                                                u.user_password as user_passwd,
                                                u.user_status,
                                                cu.id as cutomer_id,
                                                cu.store_id,
                                                u.user_createdate
                                            FROM tb_user u INNER JOIN tb_customeruser cu ON cu.user_id=u.id
                                        WHERE u.user_email=? AND cu.store_id=? AND cu.status = 'REGISTERED'`,
                                        [user_email.toLowerCase(), storeId]);
                if (result && result.length>0){
                    // save to redis user data
                    
                    user_data = Object.assign({}, result[0][0], {user_role: 'user'});
                    redis["db0"].hset(config.redis.user_data, masterkey, JSON.stringify(user_data));
                } else {
                    throw new NotFoundError(404, `User ${user_email} Not found!`); 
                }
            } else {
                user_data = JSON.parse(result);
            }
      
            // compare password
            result = await passwordCheck({passwd: user_password, origin_password: user_data.user_passwd});
            if (!result){
                let logData = {
                    user_id: user_data.id,
                    userlog_ids: 6,
                    userlog_ips: headers["x-forwarded-for"],
                    userlog_data: headers.referer
                }
                await mysql.query('INSERT INTO tb_userlog SET ?', logData);
                throw new UnauthorizedError(404, `Password Not Match!`); 
            }

            // get customer id
            request.user = user_data;
            return resolve(await loginResponse(fastify, request));
        } catch (err) {
            return reject(err);
        }
    })
}

module.exports = login; 