"use strict";

const util = require('util');
const _ = require('lodash');
const config = require('../../config');
const logger = config.logger.instance;
const loginResponse = require('./loginResponse')
let NotFoundError = require('../../models/errors/NotFound');
let BadRequestError = require('../../models/errors/BadRequest');
const UnauthorizedError = require('../../models/errors/UnauthorizedError');



const login = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { user_email, user_password, vendor_name } = request.body;
        const { redis, mysql, passwordCheck } = fastify;
      
        try {


            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
                
            // get user data
            let masterkey = `${user_email.toLowerCase()}_4_${vendor_name.toLowerCase()}`;
            let result = await hget(config.redis.user_data, masterkey);
            var user_data;
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                result = await mysql.query(`SELECT u.id,
                                u.user_hashid,
                                u.role_id as userrole_id,
                                u.user_firstname,
                                u.user_name,
                                u.user_email,
                                u.user_password as user_passwd,
                                u.user_status,
                                u.user_createdate,
                                v.id as vendor_id,
                                v.vendor_hashid,
                                s.id seller_id,
                                s.seller_hashid,
                                s.store_name
                            FROM tb_user u INNER JOIN tb_sellervendor sv ON sv.user_id=u.id
                                INNER JOIN tb_vendor v ON v.id=sv.vendor_id
                                INNER JOIN tb_seller s ON s.id=sv.seller_id 
                            WHERE u.user_email LIKE ? AND v.vendor_name=? AND user_deletetime is NULL`,
                            [user_email.toLowerCase(), vendor_name])

                    if (result && result[0].length>0){
                    // save to redis user data
                    
                    user_data = {
                        id: result[0][0].id,
                        hash_id: result[0][0].user_hashid,
                        user_hashid: result[0][0].user_hashid,
                        user_role:"seller",
                        userrole_id:4,
                        user_firstname: result[0][0].user_firstname,
                        user_name: result[0][0].user_name,
                        user_email: result[0][0].user_email,
                        user_passwd: result[0][0].user_passwd,
                        user_status:1,
                        key: masterkey,
                        vendor: {
                            name:vendor_name,
                            id: result[0][0].vendor_id,
                            hash_id: result[0][0].vendor_hashid
                        },
                        seller:{
                            name: result[0][0].store_name,
                            id: result[0][0].seller_id,
                            hash_id:result[0][0].seller_hashid
                        }
                    };
                    redis["db0"].hset(config.redis.user_data, masterkey, JSON.stringify(user_data));
                } else {
                    throw new NotFoundError(404, `User ${user_email} Not found`); 
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
                    userlog_ips: request.headers["x-forwarded-for"],
                    userlog_data: request.headers.referer
                }
                await mysql.query('INSERT INTO tb_userlog SET ?', logData);
                throw new UnauthorizedError(401, "Password Not Match");
            }

            request.user = user_data;
            return resolve(loginResponse(fastify, request));
        } catch(err){
            logger.log({level: 'warn', message: err.message});

            return reject({
                code: err.code ? Number(err.code) : 500, 
                status: "fail", 
                message: err.message, 
                name: err.name ? err.name : "InternalServerError"});
        }
    })
}

module.exports = login; 