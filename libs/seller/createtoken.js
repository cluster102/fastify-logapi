"use strict";

const db = require('../db');
const util = require('util');
const _ = require('lodash');
const CONFIG = require('../../config');
const JWT = require("jsonwebtoken");
const {PasswordCheck, LoginAuthData} = require('../index');
const rdClient = CONFIG.redis.instance;

module.exports = (payload, conn) => {
    const {headers, user} = payload;
    return new Promise (async(resolve, reject)=>{
        let errData = [];
        let iCnt = 0;
        let pSql = "";
      
        const query = util.promisify(conn.query).bind(conn);
        const hget = util.promisify(rdClient.hget).bind(rdClient);
        try {

            // get user data
            let masterkey = `${user.user_email}_4_${user.vendor.name.toLowerCase()}`;

            // get vendor data
            let result = await hget(CONFIG.redis.vendor_data, user.vendor.name.toLowerCase());
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                conn.release();
                return reject({
                    code: 404, 
                    status: "failed", 
                    message: `Unknown vendor`, 
                    name: "NotFoundError"});
            }
            const vendor_data = JSON.parse(result);
            result = await query(`SELECT s.seller_name as name, s.store_name, s.seller_hashid, v.vendor_resellerurl
                                    FROM tb_seller s
                                    INNER JOIN tb_sellervendor sv ON s.id=sv.seller_id
                                    INNER JOIN tb_vendor v ON v.id=sv.vendor_id
                                    WHERE sv.user_id=? AND v.id=?`, [user.id, user.vendor.id]);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                return reject({
                    code: 404, 
                    status: "failed", 
                    message: `Seller Data not found`, 
                    name: "NotFoundError"});
            }
            const seller_data = result[0];
            const sessionid = Date.now();
            let userData = {
                key: masterkey,
                name: user.user_name,
                role: user.user_role.toLowerCase(),
                id: `${user.id}${sessionid}`,
                store_url: `${seller_data.vendor_resellerurl}/${seller_data.store_name}`,
                store_id: seller_data.seller_hashid,
                vendor: user.vendor.name
              }
  
            // get token
            const token = JWT.sign(userData, CONFIG.jwt_encryption, {expiresIn: CONFIG.jwt_expiration_admin});
            //console.log(userData);

            // save for log information
            await LoginAuthData({   connection: conn, 
                headers, 
                user_data: {
                    login_id: userData.id, 
                    id: user.id, 
                    key: masterkey
                }
            });

            return resolve({
                status: `ok`,
                user: userData,
                token: token
            });
        } catch(err){
            return reject({
                code: 500, 
                status: "failed", 
                message: err.message, 
                name: "InternalServerError"});
        }
    })
}
