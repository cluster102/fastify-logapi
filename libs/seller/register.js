"use strict";

const util = require('util');
const _ = require('lodash');
const config = require('../../config');
const logger = config.logger.instance;
const bcrypt = require("bcrypt");
const hashids = require("hashids/cjs");
const queue = config.bull.instance.user;
const NotFoundError = require('../../models/errors/NotFound');
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
            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
            const hset = util.promisify(redis["db0"].hset).bind(redis["db0"]);
            const b_hash = util.promisify(bcrypt.hash).bind(bcrypt);
    
            let main_key = `${user_email.toLowerCase()}_4_${vendor_name.toLowerCase()}`;
            let result = await hget(config.redis.user_data, main_key);
            if (result) {
                // check first if user is deleted or not
                let userD = JSON.parse(result);

                result = await mysql.query(`SELECT user_deletetime, is_deleted, user_status FROM tb_user WHERE id=?`, [userD.id]);
                if (result && result[0].length>0){
                    if (result[0].is_deleted===0 || _.isNull(result[0][0].user_deletetime)){
                        let message = result[0][0].user_status===10 ? `Please confirm your registration. Your Email already registered.` : `User email already registered`
                        throw new BadRequestError(422, message)
                    } else {
                        throw new BadRequestError(422, `User email ${user_email} already registered`)
                    }
                } 
            } else {
                // TO BE check later if user already registered in case failure of REDIS
                result = await mysql.query(`SELECT count(*) as cnt FROM tb_user u 
                                            INNER JOIN tb_vendoruser vu ON vu.user_id=u.id
                                            INNER JOIN tb_vendor v ON v.id=vu.vendor_id
                                            WHERE u.user_deletetime is NULL AND u.user_email=? AND u.role_id=4 AND v.vendor_name LIKE ?`,
                                            [user_email, vendor_name]);
                if (result && result[0].length>0){
                    if (result[0][0].cnt>0){
                        throw new BadRequestError(422, `User email ${user_email} already registered`)
                    }
                }
            }
            
            // check if vendor exist
            result = await hget(config.redis.vendor_data,vendor_name.toLowerCase())
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)) {
                throw new  NotFoundError(404, `Vendor: '${vendor_name}' not found!`);
            }    
            let vendor_data = JSON.parse(result);
      
            // --- create password
            let hashpassword = await b_hash(user_password, 10);
            result = new hashids(config.keys.hashkey_user, 16);
            const user_hashid = result.encode(Math.ceil(Math.random()*200));
            
            // --- save user to redis first so that no one can add another useremail
            const user_redisdata = { 
                user_role: user_role,
                userrole_id:4,
                user_firstname: user_firstname,
                user_name:user_name,
                user_email:user_email,
                user_passwd: hashpassword,
                user_status:10,
                vendor: {
                    name: vendor_name,
                    id: vendor_data.id,
                    hash_id: vendor_data.hash_id
                }};
            hset(config.redis.user_data, main_key, JSON.stringify(user_redisdata));

            // --- SEND to queue
            let queueData = {
                userrole_id: 4,
                user_role: user_role,
                user_firstname: user_firstname,
                user_name: user_name,
                user_email: user_email.toLowerCase(),
                user_password: hashpassword,
                source_ip: headers["x-forwarded-for"],
                referer: headers.referer,
                vendor_name: vendor_name
            }
            queue.add(config.bull.register_user, { msg: queueData })
            .then(() => {
                return resolve(user_hashid);
            })
            .catch((err)=>{
                return reject({
                    code: 500, 
                    status: "failed", 
                    message: err.message, 
                    name: "InternalServerError"});
            })

        } catch(err){
            logger.log({level: 'warn', message: err.message});
            return reject({
                code: err.code ? Number(err.code) : 500, 
                status: "fail", 
                message: err.message, 
                name: err.name ? err.name : "InternalServerError"});
        }
    })
}
