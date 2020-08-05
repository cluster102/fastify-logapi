"use strict";

const db = require('../db');
const util = require('util');
const _ = require('lodash');
const config = require('../../config');
const logger = config.logger.instance;
const bcrypt = require("bcrypt");
const hashids = require("hashids");
const queue = config.bull.instance.user;
const BadRequestError = require('../../models/errors/BadRequest');
const UnauthorizedError = require('../../models/errors/UnauthorizedError');
const NotFoundError = require('../../models/errors/NotFound');


module.exports = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const {redis, mysql, jwt, validateAddressId, loginAuthData} = fastify;
        const {headers, body} = request;
        let { user, address, password, link, vendor, bank_data } = body;

        if (_.isUndefined(vendor) || _.isEmpty(vendor) || _.isNull(vendor)) {
            return reject({code: 422, status: 'failed', name: "BadRequestError", message: `Missing "vendor" attribute!`});
        }

        if (_.isUndefined(bank_data) || _.isEmpty(bank_data) || _.isNull(bank_data)) {
            return reject({code: 422, status: 'failed', name: "BadRequestError", message: `Missing "bank_data" attribute!`});
        }

    
        const hget = util.promisify(redis.hget).bind(redis);
        const get = util.promisify(redis.get).bind(redis);
            
        try {
            // check if link already expired
            let result = await get(link);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                throw new UnauthorizedError(401, `Link expired!`)
            }

            let masterkey = `${user.email.toLowerCase()}_3_${vendor.name.toLowerCase()}`;
            result = await hget(config.redis.user_data, masterkey);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                throw new NotFoundError(404, `Email ${user.email} not found!`);
            }
            let user_data = JSON.parse(result);

            if (!validateAddressId(address.country_id, address.area_id)){
                throw new BadRequestError(422, `Area ID invalid, or incomplete!`);
            }

            // chaek password
            bcrypt.compare(password, user_data.user_passwd, async (error, result) => {
                conn = await db.newTransaction();                
                const query = util.promisify(conn.query).bind(conn);
                if (error || result === false) {
                    mysql.query(`INSERT INTO tb_userlog SET ?`, {user_id: user_data.id,
                                                            userlog_ids: 6, 
                                                            userlog_ips: headers["x-forwarded-for"], 
                                                            userlog_data: headers.referer});
                    throw new UnauthorizedError(401, `Password not match!`)
                }


                let vendorData = {
                    vendor_name: vendor.name,
                    vendor_state: 1
                  }
                result = await query('INSERT INTO tb_vendor SET ?', {
                                        vendor_name: vendor.name,
                                        vendor_state: 1
                                    });
        
                const vendorId = result[1].insertId;

                // --- CREATE hash id
                const b_hash = util.promisify(bcrypt.hash).bind(bcrypt);
                result = new hashids(config.keys.hashkey_user, 16);
                let new_hash = result.encode(vendorId);
                const prevendor_key = `${new_hash}_${register_id}_${config.keys.hashkey_user}`;
                let vendor_key = await b_hash(prevendor_key, 10)
                                
                let vendorData = {
                    id: vendorId,
                    vendor_hashid: new_hash,
                    vendor_key: vendor_key,
                    vendor_name: vendor.name
                }
            
                // --- CHECK country id
                if (!validateAddressId(address.country_id, address.area_id)){
                    throw new BadRequestError(422, `Area ID invalid, or incomplete!`);
                }

                // --- PREPARE data for queue
                let dataReg = {
                    user: user_data,
                    address: {
                    line1: address.line1,
                    line2: (address.line2 ? address.line2 : ""),
                    country_id: address.country_id,
                    city_id: (address.city_id ? address.city_id : 0),
                    area_id: (address.area_id ? address.area_id : 0),
                    post_code: (address.postcode ? address.postcode : "")
                    },
                    vendor: vendorData,
                    bank_data: bank_data,
                    register_link: link,
                    register_id: user.register_id
                };

                queue.add(config.bull.register_confirmation, { msg: dataReg })
                .then(async() => {
                    // delete registration link
                    redis.del(link);
                    /* get jwt token */
                    const sessionid = Date.now();
                    let userData = {
                      key: masterkey,
                      name: user_data.user_name,
                      email: user.email,
                      role: "vendor",
                      id: `${user_data.id}${sessionid}`,
                      vendor: vendor.name
                    }
        
                    // get token
                    const token = jwt.sign(userData, {expiresIn: config.jwt_expiration_admin});
        
                    // save for log information
                    // save for log information
                    await loginAuthData({   
                                from: request.headers["x-forwarded-for"],
                                origin:  request.headers.origin,
                                referer: request.headers.referer,
                                user_data: {
                                    login_id: userData.id, 
                                    id: user_data.id, 
                                    key: masterkey
                                }
                            });
                    return resolve({
                        status: `ok`,
                        user: userData,
                        token: token
                    });
                })
                .catch((err) => {
                    logger.log({level: 'error', message: `Error by add data to queue with error: ${err.message}`})
                    return reject({code: 500, status: 'failed', name: "InternalServerError", message: `Failed to confirm registration`});
                });
            })
        } catch(error) { 
            if (conn){
                conn.rollback();				  	
            }
            logger.log({level: 'error', message: `Error: ${error.message}`})
            return reject({code: 500, status: 'failed', name: "InternalServerError", message: `Failed to confirm registration`});
        }
    })
}
