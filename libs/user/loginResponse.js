"use strict";

const _ = require('lodash');
const util = require('util')
const config = require('../../config');
let NotFoundError = require('../../models/errors/NotFound');

module.exports = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { user, headers } = request;
        const { mysql, redis, createToken } = fastify;
        const hget = util.promisify(redis.hget).bind(redis);
        try {
            // get vendor data
            let result = await hget(config.redis.store_desc, user.store_id);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                return new NotFoundError(404, `Store Data not found`); 
            }
            const store_data = result[0][0];
 
            const masterkey = `${user.user_email.toLowerCase()}_5_${user.store_id.toLowerCase()}`;
			result = await createToken({key: masterkey, 
                id: user.id, 
                user_email: user.user_email,
                user_name: user.user_name},
                {
                    from: headers["x-forwarded-for"],
                    origin: headers.origin,
                    referer: headers.referer
                }, config.jwt_expiration_user, 3)

            let userData = {
                key: masterkey,
                name: user.user_name,
                email: user.user_email,
                role: 'seller',
                id: result.id,
                store_url: store_data.store_url,
                store_id: user.store_id,
                vendor: user.vendor.name
            }

            // get customer id
            result = await mysql.query(`SELECT id  FROM tb_customeruser WHERE status='REGISTERED' AND user_id=?`, [user.id]);            

            return resolve({
                status: `ok`,
                customer_id: result[0][0].id,
                user: userData,
                token: result.token
            });
        } catch(err){
            return reject({
                code: err.code ? Number(err.code) : 500, 
                status: "failed", 
                message: err.message, 
                name: err.name ? err.name : "InternalServerError"});
        }
    })
}

