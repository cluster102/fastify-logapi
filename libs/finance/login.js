"use strict";

const util = require('util');
const _ = require('lodash');
const config = require('../../config');
const {PasswordCheck, LoginAuthData} = require('../');
const BadRequestError = require('../../models/errors/BadRequest');
const NotFoundError = require('../../models/errors/NotFound');
const UnauthorizedError = require('../../models/errors/UnauthorizedError');

const login = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { redis, db, jwt } = fastify;
        const { user_email, user_role, user_password } = request.body;  
        
        try {
            const hget = util.promisify(redis.hget).bind(redis);

            // get user data
            let masterkey = `${user_email}_7_finance}`;
            
            let result = await hget(config.redis.user_data, masterkey);
            const query = util.promisify(db.query).bind(db);            
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                // TO DO: Additional check in datanase.
                // search first in database
                throw new NotFoundError (404, "user not found")
            }
            let user_data = JSON.parse(result);

            // compare password
            result = await PasswordCheck({passwd: user_password, origin_password: user_data.user_passwd});
            if (!result){
                let logData = {
                    user_id: user_data.id,
                    userlog_ids: 6,
                    userlog_ips: headers["x-forwarded-for"],
                    userlog_data: headers.referer
                }
                db.query('INSERT INTO tb_userlog SET ?', logData);
                throw new UnauthorizedError(401, 'Pasword not match')
            }

            // get vendor data
            var vendor_data;
            result = await hget(config.redis.vendor_data, vendor_name.toLowerCase());
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                result = await query(`SELECT v.vendor_storeurl, v.vendor_hashid FROM tb_vendor v INNER JOIN tb_vendoruser vu ON vu.vendor_id=v.id
                                        WHERE vu.user_id=?`, [user_data.id])
                if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                    throw new NotFoundError (404, "Vendor not found")
                }
                vendor_data = result[0];
            } else {
                vendor_data = JSON.parse(result);
            }
            const sessionid = Date.now();
            let userData = {
              key: masterkey,
              name: user_data.user_name,
              email: user_email,
              role: user_role.toLowerCase(),
              id: `${user_data.id}${sessionid}`,
              store_url: vendor_data.vendor_storeurl,
              store_id: vendor_data.vendor_hashid,
              vendor: vendor_name
            }

            // get token
            const token = jwt.sign(userData, config.jwt_encryption, {expiresIn: config.jwt_expiration_admin});
            //console.log(userData);
            // save for log information
            await LoginAuthData({ 
                headers, 
                user_data: {
                    login_id: userData.id, 
                    id: user_data.id, 
                    key: masterkey
                }
            }, fastify);
            return resolve({
                status: `ok`,
                user: userData,
                token: token
            });
        } catch(err){
            return reject(err)
        }
    })
}

module.exports = login; 