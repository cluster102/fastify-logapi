"use strict";

const util = require('util');
const _ = require('lodash');
const config = require('../../config');
let NotFoundError = require('../../models/errors/NotFound');
let BadRequestError = require('../../models/errors/BadRequest');

module.exports = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { mysql, redis, jwt, passwordCheck, loginAuthData} = fastify;
        const { headers, body} = request;
        let { user_email, user_password, link } = body;
        
        const hget = util.promisify(redis.hget).bind(redis);
        try {
            const storeId = headers.storeid;
            if (_.isUndefined(storeId) || _.isNull(storeId) || _.isEmpty(storeId)) {
                throw new BadRequestError(422, `Missing "storeId" attribute!`);
            }

            // check lets check
            let result = await hget(config.redis.store_ids, storeId);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)) {
                throw new NotFoundError(404, `storeId: ${storeId} unknown!`);
            }
                
            let masterkey = `${user_email.toLowerCase()}_5_${storeId}`;
            result = await hget(config.redis.user_data, masterkey);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result) ){
                throw new NotFoundError(404, `Email: ${user_email} unknown!`);
            }
            let user_data = JSON.parse(result);


            result = await passwordCheck({passwd: user_password, origin_password: user_data.user_passwd});
            if (!result){
                let logData = {
                    user_id: user_data.id,
                    userlog_ids: 6,
                    userlog_ips: headers["x-forwarded-for"],
                    userlog_data: headers.referer
                }
                await mysql.query('INSERT INTO tb_userlog SET ?', logData);
                throw new UnauthorizedError(401, "Password Not Match");
            }

            // -- UPDATE user and register data
            await mysql.query(`UPDATE tb_user SET user_status = 1 WHERE id = ?`, [user_data.id]);
            await mysql.query(`UPDATE tb_register SET is_valid = 0 WHERE user_id = ?`, [user_data.id]);

            user_data.user_status=1;
            redis.hset(config.redis.user_data, masterkey, JSON.stringify(user_data));

            /* get jwt token */
            const sessionid = Date.now();
            let userData = {
                key: masterkey,
                id: `${user_data.id}${sessionid}`,
                user_email: user_data.user_email,
                user_name: user_data.user_name                
            }

            // get token
            const token = jwt.sign(userData, {expiresIn: config.jwt_expiration_admin});

            // save for log information
            await loginAuthData({   
                        from: headers["x-forwarded-for"],
                        origin:  headers.origin,
                        referer: headers.referer,
                        user_data: {
                            login_id: userData.id, 
                            id: user_data.id, 
                            key: masterkey
                        }
                    });            

            // get customer id
            result = await mysql.query(`SELECT id  FROM tb_customeruser WHERE user_id=? `, [user_data.id]);
            let appData = {
                status: 'ok',
                customer_id: result[0][0].id,
                user: userData,
                token: token
            };
            redis.select(2, ()=>{
                redis.del(link);
                redis.select(0, ()=>{
                    return resolve(appData);
                })
            })
        } catch(error) {
            return reject(error);
        }
    })
}
