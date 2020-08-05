"use strict";

const _ = require('lodash');
const config = require('../../config');
const util = require('util');
let NotFoundError = require('../../models/errors/NotFound');

module.exports = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { user, headers } = request;
        const { redis, createToken } = fastify;
        const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
        try {
            // get vendor data
            let result = await hget(config.redis.store_desc, user.vendor.hash_id);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                throw new NotFoundError(404, `Store Data not found`); 
            }
            const vendor_data = JSON.parse(result);
 
            const masterkey = `${user.user_email.toLowerCase()}_3_${user.vendor.name.toLowerCase()}`;
			result = await createToken({key: masterkey, 
                id: user.id, 
                user_email: user.user_email,
                user_name: user.user_name},
                {
                    from: headers["x-forwarded-for"],
                    origin: headers.origin,
                    referer: headers.referer
                }, config.jwt_expiration_admin, 3)

            let userData = {
                key: masterkey,
                name: user.user_name,
                email: user.user_email,
                role: 'vendor',
                id: result.id,
                store_url: vendor_data.vendor_storeurl,
                store_id: vendor_data.vendor_hashid,
                vendor: user.vendor.name
            }
    
            return resolve({
                status: `ok`,
                user: userData,
                token: result.token
            });
        } catch(err){
            return reject({
                code: err.code ? Number(err.code) : 500, 
                status: "fail", 
                message: err.message, 
                name: err.name ? err.name : "InternalServerError"});
        }
    })
}

