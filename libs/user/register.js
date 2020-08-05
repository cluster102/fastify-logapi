"use strict";

const util = require('util');
const _ = require('lodash');
const config = require('../../config');
const logger = config.logger.instance;
const bcrypt = require("bcrypt");
const hashids = require("hashids/cjs");
const queue = config.bull.instance.user;
const uuid = require('uuid/v4');
let NotFoundError = require('../../models/errors/NotFound');
let BadRequestError = require('../../models/errors/BadRequest');

module.exports = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { mysql, redis} = fastify;
        const { headers, body} = request;
        let { user_firstname, user_name, user_email, user_password, user_phone } = body;

        let conn = null;
        try {
            logger.log({level: 'verbose', message: 'new register'});
            const storeId = headers.storeid;
            if (_.isUndefined(storeId) || _.isNull(storeId) || _.isEmpty(storeId)) {
                throw new BadRequestError(422, `Missing "storeId" attribute!`);
            }

            const hget = util.promisify(redis.hget).bind(redis);
            // check if store data exist
            let  result = await hget(config.redis.store_ids, storeId);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)) {
                throw new NotFoundError(404, `StoreId; ${storeId} unknown`);
            }
            const store_data = JSON.parse(result);
            
            // --- CHECK USER
            let user_id;
            conn = await mysql.getConnection()
            await conn.beginTransaction();
            result = await conn.query(`SELECT u.*, cu.id as customer_id, cu.status FROM tb_user u 
                                            INNER JOIN tb_customeruser cu ON cu.user_id=u.id 
                                            WHERE u.user_deletetime is null AND u.user_email=? AND u.role_id=? AND cu.store_id=?`, 
                                            [user_email, 5, storeId]);
            if ((result && result[0].length>0)){
                let reg_rs = result[0].filter(i=>i.status==='REGISTERED')
                if (reg_rs.length>0){
                    throw new BadRequestError(422, `Email ${user_email} already registered`);
                }

                user_id = result[0][0].id
            } else {
                const newUser = {
                    user_email: user_email,
                    user_firstname: user_firstname,
                    user_name: user_name,
                    user_phone: user_phone,
                    role_id: 5,
                    user_status: 10
                };
                result = await conn.query('INSERT INTO tb_user SET ?', newUser);
                user_id=result[0].insertId;
            }

            // --- create password
            const b_hash = util.promisify(bcrypt.hash).bind(bcrypt);
            const hashpassword = await b_hash(user_password, 10);    

            result = new hashids(config.keys.hashkey_user, 16);
            const user_hashid = result.encode(user_id);
            result = new hashids(config.keys.hashkey_register, 30);
            var link = result.encode(user_id);
            await conn.query(`UPDATE tb_user set user_hashid=?, user_password=? WHERE id=?`, 
                                [user_hashid, hashpassword, user_id]);


            // --- add to customer user store
            const customer_id = uuid();
            result = await conn.query(`SELECT id FROM tb_vendorchannel WHERE channel_id=? AND vendor_id=?`,
                                        [config.channels.webcommerce, store_data.vendor_id])
            
            await conn.query('INSERT INTO tb_customeruser SET ?', {id: customer_id,
                                                                        user_id: user_id, 
                                                                        store_id: storeId, 
                                                                        vendorchannel_id: result[0][0].id, 
                                                                        status: 'REGISTERED'});

            result = await conn.query(`INSERT into tb_register SET ?`, {user_id: user_id, register_link: link}) ;
            const register_id = result[0].insertId;

            await conn.query(`INSERT INTO tb_userlog SET ?`, {user_id: user_id, userlog_ids: 1, userlog_ips: headers["x-forwarded-for"], userlog_data: headers.referer });
            await conn.commit();

            // ************************************************
            // save user data to redis for fast response
            // set lifetime on ly for 2 days
            //
            let registerData = {
                    register_id: register_id,
                    name: user_name,
                    email: user_email,
                    role: "user",
                    id: user_hashid,
                    status: `OK`
            }
            redis.set(link, JSON.stringify(registerData), 'EX', 172800);
            
            // save user data for login information
            const userData = {
                id: user_id, 
                hash_id: user_hashid,
                user_role: "user",
                userrole_id: 5,
                user_firstname: user_firstname,
                user_name: user_name,
                user_email: user_email,
                user_passwd: hashpassword,
                user_status:10,
                customer_id: customer_id,
                store_id: storeId
            };

            let masterkey = `${user_email}_5_${storeId}`;
            redis.hset(config.redis.user_data, masterkey, JSON.stringify(userData));

            // --- SEND to queue
            let queueData = {
                userrole_id: 5,
                user_role: "user",
                user_firstname: user_firstname,
                user_name: user_name,
                user_email: user_email.toLowerCase(),
                user_password: hashpassword,
                source_ip: headers["x-forwarded-for"],
                referer: headers.referer,
                customer_id: customer_id, 
                store_id: storeId, 
                link_id: link
            }            
            queue.add(config.bull.register_user, { msg: queueData })
            .then(async() => {
                redis.select(2, (err) => {
                    redis.set(link, JSON.stringify(registerData), 'EX', 172800);
                    redis.select(0, ()=> {return resolve(user_hashid)})
                })
            })
            .catch((err)=>{
                return reject({
                    code: 500, 
                    status: "failed", 
                    message: err.message, 
                    name: "InternalServerError"});
            })

        } catch(err){
            if (conn && conn.connection._pool){
                await conn.rollback();
                await conn.destroy();
            }            
            return reject(err);
        }
    })
}
