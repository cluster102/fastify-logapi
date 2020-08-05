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

module.exports = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const {redis, mysql} = fastify;
        const {headers, body} = request;
        let { user_role, user_firstname, user_name, user_email, user_password, vendor_name } = body;

        try {

            if (_.isUndefined(vendor_name) || _.isNull(vendor_name) || _.isEmpty(vendor_name)) {
                throw new BadRequestError(422, `Missing "vendor_name" attribute!`)
            }    
    
            const hget = util.promisify(redis.hget).bind(redis);
            const b_hash = util.promisify(bcrypt.hash).bind(bcrypt);
    
            let main_key = `${user_email.toLowerCase()}_3_${vendor_name.toLowerCase()}`;
            let result = await hget(config.redis.user_data, main_key);

            if (result) {
                // check first if user is deleted or not
                let userD = JSON.parse(result);

                result = await mysql.query(`SELECT count(u.*) as cnt FROM tb_user u 
                                            WHERE u.user_deletetime is NULL AND u.user_email=? AND u.role_id=3 ?`,
                                            [user_email]);
                if (result && result[0].length>0){
                    if (result[0][0].cnt>0){
                        throw new BadRequestError(422, `User email ${user_email} already registered`)
                    }
                } 
            }
            
            // check vendor name
            result = await hget(config.redis.vendor_data, vendor_name.toLowerCase());
            if (!(_.isUndefined(vendor_name) || _.isNull(vendor_name) || _.isEmpty(vendor_name))) {
                throw new BadRequestError(422, `Vendor ${vendor_name.toLowerCase()} already exist!`)
            }    

            // --- create password
            let hashpassword = await b_hash(user_password, 10);
            result = new hashids(config.keys.hashkey_user, 16);
            const user_hashid = result.encode(Math.ceil(Math.random()*200));

            // --- save user to redis first so that no one can add another useremail
            const user_redisdata = { 
                user_role: user_role,
                userrole_id:3,
                user_name:user_name,
                user_email:user_email,
                user_passwd: hashpassword,
                user_status:10,
                vendor: {
                    name: vendor_name
                }};
            hset(config.redis.user_data, main_key, JSON.stringify(user_redisdata));


            // --- SEND to queue
            let queueData = {
                userrole_id: 3,
                userrole: user_role,
                username: user_name,
                useremail: user_email.toLowerCase(),
                userpassword: hashpassword,
                source_ip: headers["x-forwarded-for"],
                referer: headers.referer,
                vendor_name: vendor_name.toLowerCase()
            }

            queue.add(config.bull.register_user, { msg: queueData })
            .then(() => {
                return resolve(user_hashid);
            })
            .catch((err)=>{
                return reject({
                    code: 422, 
                    status: "failed", 
                    message: err.message, 
                    name: "InternalServerError"});
            })

        } catch(err){
            logger.log({level: 'warn', message: err.message});
            return reject({
                code: 500, 
                status: "failed", 
                message: err.message, 
                name: "InternalServerError"});
        }
    })
}
