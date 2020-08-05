"use strict";

const db = require('../db');
const util = require('util');
const _ = require('lodash');
const CONFIG = require('../../config');
const logger = CONFIG.logger.instance;
const rdClient = CONFIG.redis.instance;
const bcrypt = require("bcrypt");
const hashids = require("hashids");
const crypto = require("crypto");
const uuid = require('uuid/v4');
const jwt = require("jsonwebtoken");
const { createAddressData, initStoreDataToRedis, initStoreDesc, LoginAuthData } = require('../')


module.exports = (payload) => {
    const {headers, body, user} = payload;
    return new Promise (async(resolve, reject)=>{
        let {register_link, new_password, confirm_password} = body;

        bcrypt.hash(new_password, 10, async(error, hashedPassword) => {
            if (error) {
                console.log(error);
                return res.status(500).json({
                    status: 'failed',
                    code: 500,
                    message: 'Failed to create a new password.'
                })
            }
    
            // update password in database
            let conn = await db.newConnection();
            let query = util.promisify(conn.query).bind(conn);
    
            await query(`UPDATE tb_user SET user_password = ?, user_lastupdate = now() WHERE id = ?`, [hashedPassword, user.id]);
    
            // change password in redis
            user.user_passwd = hashedPassword;
            var masterkey = `${user.user_email}_4_${user.vendor.name}`;

            // save changes to redis        
            rdClient.hset(CONFIG.redis.user_data, masterkey, JSON.stringify(user));
    
            // delete register link
            rdClient.del(register_link);
    
            try {
                // set log for change password
                await query('INSERT INTO tb_userlog SET ?', ({                    
                    user_id: user.id,
                    userlog_ids: 8,
                }));  
                let createToken = require(`../../../libs/${user.user_role}/createtoken`)
                let result = await createToken({headers, user}, conn);
    
                conn.release();
    
                return res.status(201).json(result);
            } catch(err){
                logger.log({level: 'warn', message: `Error: ${err.message}`});
                return res.status(405).json({status: 'fail', message: err.message});
            }
        }); //BCRYPT.hash
    })
}
