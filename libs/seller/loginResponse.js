"use strict";

const _ = require('lodash');
const config = require('../../config');
let NotFoundError = require('../../models/errors/NotFound');

module.exports = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { user, headers } = request;
        const { mysql, createToken } = fastify;
      
        try {
            // get vendor data
            let result = await mysql.query(`SELECT s.seller_name as name, s.store_name, s.seller_hashid, v.vendor_resellerurl
                                        FROM tb_seller s
                                        INNER JOIN tb_sellervendor sv ON s.id=sv.seller_id
                                        INNER JOIN tb_vendor v ON v.id=sv.vendor_id
                                        WHERE sv.user_id=? AND v.id=?`, [user.id, user.vendor.id]);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                return new NotFoundError(404, `Seller Data not found`); 
            }
            const seller_data = result[0][0];
 
            const masterkey = `${user.user_email.toLowerCase()}_4_${user.vendor.name.toLowerCase()}`;
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
                role: 'seller',
                id: result.id,
                store_url: `${seller_data.vendor_resellerurl}/${seller_data.store_name}`,
                store_id: seller_data.seller_hashid,
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
                status: "failed", 
                message: err.message, 
                name: err.name ? err.name : "InternalServerError"});
        }
    })
}

