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
        let {storeid} = headers;
        const query = util.promisify(conn.query).bind(conn);
        try {

            // get user data
            let masterkey = `${user.user_email}_5_${storeid}`;

            // get customer id
            let result = await query(`SELECT id  FROM tb_customeruser WHERE user_id=?`, [user.id]);
            /* get jwt token */
            const sessionid = Date.now();
            let userData = {
                key: masterkey,
                id: `${user.id}${sessionid}`,
                user_email: user.user_email,
                user_name: user.user_name
            }
  
            // get token
            const token = JWT.sign(userData, CONFIG.jwt_encryption, {expiresIn: CONFIG.jwt_expiration_user});
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
