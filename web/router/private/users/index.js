'use strict';

const schema = require('./schema');
const config = require('../../../../config');
const logger = config.logger.instance;
const util = require('util');
const bcrypt = require("bcrypt");
const NotFoundError = require('../../../../models/errors/NotFound');
const BadRequestError = require('../../../../models/errors/BadRequest')
const sellerProfile = require(`../../../../libs/seller/profile`)

module.exports = (fastify, options, next) =>{ 

    fastify.addHook('preHandler', fastify.auth([fastify.authenticate]));

    fastify.get("/profile/seller", {schema: schema.getSellerProfileSchema}, async (request, reply) => {
        const { user } = request;
        try {
            let result = await sellerProfile.get(fastify, request);
            
            // get user data
            return reply.status(200).send(result);
        } catch (err) {
            logger.log({level: "error", message: err.message})
            return reply.status(err.code ? Number(err.code) : 500).send(err);
        }
    });


    fastify.put("/passwd", {schema: schema.changePasswdSchema}, async (request, reply) => {
        const { headers, user, body: {password, new_password, confirm_password}, headers: {storeid}} = request;
        const { mysql, redis } = fastify;
        if (new_password !== confirm_password) {
            return reply.status(401).send({
                status: 'fail',
                code: 401,
                message: 'Password is different!'
            })
        }

        try {
            // if user
            if (user.userrole_id===5){
                if (_.isUndefined(storeid) || _.isNull(storeid) || _.isEmpty(storeid)) {
                    throw new BadRequestError(422, 'StoreID is missing!')
                }    
            }
        
            // --- CHECK current password
            result = await passwordCheck({passwd: password, origin_password: user.user_passwd});
            if (!result){
                let logData = {
                    user_id: user_data.id,
                    userlog_ids: 6,
                    userlog_ips: headers["x-forwarded-for"],
                    userlog_data: headers.referer
                }
                await mysql.query('INSERT INTO tb_userlog SET ?', logData);
                throw new UnauthorizedError(401, "Password Not Match!");
            }

            const b_hash = util.promisify(bcrypt.hash).bind(bcrypt);
            const hashedPassword = await b_hash(password, 10);
            await mysql.query(`UPDATE tb_user SET user_password = ?, user_lastupdate = now() WHERE id = ?`, 
                            [hashedPassword, user.id]);

            
            // change password in redis
            let new_user = user;
            new_user.user_passwd = hashedPassword;
            redis["db0"].hset(config.redis.user_data, user.key, JSON.stringify(new_user));

            // --- create log
            await mysql.query('INSERT INTO tb_userlog SET ?', ({                    
                user_id: user.id,
                userlog_ids: 8,
                userlog_ips: headers["x-forwarded-for"],
                userlog_data: headers.referer
            })); 

            return reply.status(200).send({
                status: 'ok',
                message: "Password successfulyy changed"
            });
        } catch(err){
            logger.log({level: 'warn', message: `Error: ${err.message}`});
            return reply.status(err.code ? Number(err.code) : 500).send({
                status: 'fail', 
                message: err.message,
                name: err.name
            });
        }
    }); // PUT /passwd
        
    fastify.put('/resetpasswd', {schema: schema.resetPasswdSchema}, async (request, reply) => {
        const { mysql, redis } = fastify;
        const { headers, user, body: {register_link, new_password, confirm_password}, headers: {storeid} } =  request;
        try{
            if (new_password !== confirm_password) {
                throw new BadRequestError(422, 'Password is different!')
            }
        
            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
            // if use
            if (user.userrole_id===5){
                if (_.isUndefined(storeid) || _.isNull(storeid) || _.isEmpty(storeid)) {
                    throw new BadRequestError(422, 'StoreID is missing!')
                }    
            }
            
            const b_hash = util.promisify(bcrypt.hash).bind(bcrypt);
            const hashedPassword = await b_hash(new_password, 10);
            await mysql.query(`UPDATE tb_user SET user_password = ?, user_lastupdate = now() WHERE id = ?`, 
                            [hashedPassword, user.id]);
        
            // change password in redis
            let new_user = user;
            new_user.user_passwd = hashedPassword;
            redis["db0"].hset(config.redis.user_data, user.key, JSON.stringify(new_user));

            // add log data
            let logData = {
                user_id: user.id,
                userlog_ids: 8,
                userlog_ips: headers["x-forwarded-for"],
                userlog_data: headers.referer
            }
            await mysql.query('INSERT INTO tb_userlog SET ?', logData);

            const loginResp = require(`../../../../libs/${user.user_role.toLowerCase()}/loginResponse`);
            const result = await loginResp(fastify, request);
            return reply.send(result);
        } catch(err){
			logger.log({level: 'warn', message: err.message});
			return reply.status(err.code ? err.code : 500).send({
                status: "fail",
                name: err.name,
                message: err.message
            });
        }


    }); // POST /changepasswd




    next();
}




