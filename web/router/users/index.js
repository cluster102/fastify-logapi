'use strict';

const schema = require('./schema');
const config = require('../../../config');
const logger = config.logger.instance;
const _ = require('lodash');
const util = require('util')
const crypto = require("crypto");
const NotFoundError = require('../../../models/errors/NotFound');
const BadRequestError = require('../../../models/errors/BadRequest')
const InternalServerError = require('../../../models/errors/InternalServerError')
const queueUser = config.bull.instance.user;
const sellerConfirmationService = require('../../../libs/seller/register_confirmation')
const userConfirmationService = require('../../../libs/user/register_confirmation')

module.exports = (fastify, options, next) =>{ 

    fastify.post("/", {schema: schema.registerSchema}, async (request, reply) => {
        try {
            const { user_role, user_name, user_email } = request.body;
            let userService = require(`../../../libs/${user_role}/register`);
            let response = await userService(fastify, request);
      
            return reply.send({ status: 'ok', 
                                message: `successfully created user ${user_name} with email: ${user_email}`, 
                                data: {user_id: response}});
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            return reply.status(err.code ? Number(err.code) : 500).send({
                status: 'fail',
                message: err.message,
                name: err.name                        
            });
        }
    }); // POST / register function


    fastify.post("/confirm/user", {schema: schema.confirmUserSchema},  async (request, reply) => {
        try {
            let resp = await userConfirmationService(fastify, request);      
            return reply.send(resp);
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            return reply.status(err.code ? Number(err.code) : 500).send({
                status: 'fail',
                message: err.message,
                name: err.name                        
            });
        }
    }); // POST / register function

    fastify.post("/confirm/seller", {schema: schema.confirmSellerSchema},  async (request, reply) => {
        try {      
            let response = await sellerConfirmationService(fastify, request);
            return reply.send(response);

		} catch (err) {
            logger.log({level: 'warn', message: err.message});
            return reply.status(err.code ? Number(err.code) : 500).send({
                status: 'fail',
                message: err.message,
                name: err.name                        
            });
        }
    }); // POST / register function

    fastify.get("/getConfirmationData", {schema: schema.getConfirmDataSchema}, async (request, reply) => {
		const { link } = request.query;
		const { mysql, redis, jwt } = fastify;
      
		const get = util.promisify(redis["db2"].get).bind(redis["db2"]);

		try{
			let results = await get(link);
			if (_.isUndefined(results) || _.isNull(results) || _.isEmpty(results)){
				let pSql = `SELECT r.*, u.user_email FROM tb_register r INNER JOIN tb_user u ON r.user_id=u.id WHERE register_link=? AND is_valid=1;`;
				results = await mysql.query(pSql, [link]);
				if (_.isUndefined(results[0]) || _.isNull(results[0]) || _.isEmpty(results[0])){
					throw new NotFoundError(404, "Link not found")
				}
			
				// delete user_data
				if (results[0][0].user_role>2){
					let masterkey = `${results[0][0].user_email}_${results[0][0].user_role}_${results[0][0].entity_name}`;
					redis["db0"].hdel(config.redis.user_data, masterkey);
					await mysql.query(`UPDATE tb_user SET user_status=0, user_deletetime=Now(), is_deleted=1 WHERE id=?`,[results[0][0].user_id]);
					await mysql.query(`UPDATE tb_register SET is_valid=0 WHERE id=?`,[results[0][0].id]);
				}

				return reply.status(422).send({
					"status": "fail",
					"name": "BadRequestError",
					"message": "Link expired",
				});
			}
			const userData = JSON.parse(results);
			// get token
			const token = jwt.sign(userData, {expiresIn: config.jwt_expiration_admin});

			return reply.status(200).send({
				"status": "ok",
				"user": userData,
				"token": token,
				"url": `/getConfirmationData/${link}`
			});
			
		} catch (err){
			return reply.status(err.code ? Number(err.code) : 500).send({
				status: 'fail',
				message: err.message,
				name: err.name                        
			});
		}
	});


	/* =========================================================
	**
	** Check if email already registered
	**
	** Inquiry : email
	**
	*/
	fastify.get("/check/:vendor_name", {schema: schema.checkEmailSchema}, async(request, reply) => {
		const { email } = request.body;
		const { vendor_name } = request.params;
		const store_id = request.headers.storeid;
		const { redis, validateStore } = fastify;


		const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
		try {

			await validateStore(vendor_name, store_id)

			// check email
			result = await hget(config.redis.user_data, `${email}_5_${store_id}`);
			if (_.isUndefined(result) || _.isEmpty(result) || _.isNull(result)){
				return reply.status(200).send({
					"id": email,
					"status": "unregistered"
				})
			} 
			return reply.status(200).send({
				"id": email,
				"status": "registered"
			})
		} catch (err){
			return reply.status(err.code ? Number(err.code) : 500).send({
				"id": email,
				"status": "fail",
				"message": err.message,
				"name": err.name
			})
		}
	}); // POST /	

    fastify.post('/login', {schema: schema.loginSchema}, async (request, reply) => {
        try {
            const {user_role} = request.body;
            const loginProc = require(`../../../libs/${user_role.toLowerCase()}/login`);
            let response = await loginProc(fastify, request);
            return reply.send(response);
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
			return reply.status(err.code ? Number(err.code) : 500).send({
                status: "fail",
                name: err.name,
                message: err.message
            });
        }
    });

    fastify.put('/passwd', {schema: schema.putResetPasswordReqSchema}, async (request, reply) => {
		const { mysql, redis, getRoleId, validateStore, jwt } = fastify;
		const { body, headers} = request;
		const { user_email, user_role, vendor_name } = body;
		const store_id = user_role === "user" ? headers.storeid : null;
		const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
		try {
			// --- CHECK COnsisteny of store
			if (user_role === "user"){
				await validateStore(vendor_name, store_id)
			}

			const role_id = getRoleId(user_role);

			// get user data
			const masterkey = `${user_email}_${role_id}_` + (user_role === "user" ? store_id : vendor_name);
			let result = await hget(config.redis.user_data, masterkey);

			if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
				throw new NotFoundError(404, "Email not found")
			}

			let user_data = JSON.parse(result);

			// --- NOTE HASH ID Currently to weak, later should be rfined, and hash id save in environment, not in code
			if (_.isUndefined(config.keys.hashkey_registerlink) || _.isEmpty(config.keys.hashkey_registerlink)){
				logger.log({level: 'error', message: "Variable: config.keys.hashkey_register undefined or empty!"})
				process.exit()
			}

			// create TOKEN
			// create token
			const reset_hashid = crypto.createHash("md5").update(config.keys.hashkey_registerlink+user_email).digest("hex");
			const resetData = {
				link: reset_hashid, 
				email: user_data.user_email,
				name: user_data.user_name
			}
            const token = jwt.sign(resetData, { expiresIn: "24h" });
			const keys = token.split('.');
			let userData = {
				user_id: user_data.id,
				reset_hashid: reset_hashid,
				reset_token: token
			}

			result = await mysql.query('INSERT INTO tb_passwordreset SET ?', userData); 
			const register_id = result[0].insertId;
			let msg = {    
				user: user_data,
				register_id: register_id,
				reset_hashid: reset_hashid,
				reset_token: token
			}

			if (role_id===5){
				msg = Object.assign({}, msg, {store_id})
			}

			// --- ADD IP User to userl og later to be realized
			const userLog = {
				user_id: user_data.id,
				userlog_ids: 5,
				userlog_ips: headers["x-forwarded-for"],
				userlog_data: headers.referer
			}

			await mysql.query('INSERT INTO tb_userlog SET ?', userLog);  
			queueUser.add(config.bull.forgot_password, {msg: msg})
			.then(()=>{
				// SET to redis for 24 Hour
				// save  register link to
				const reg_data = {
					link: reset_hashid,
					key: keys[1],
					register_id: register_id,
					user: user_data
				}					
				redis["db2"].set(reset_hashid, JSON.stringify(reg_data), 'EX', 172800);
				return reply.status(201).send({
					status: "ok",
					link: reset_hashid,
					user_email: user_email
				});
			})
			.catch(err => {
				return reply.status(500).send({
					code: 500,
					message: err.message,
					name: "InternalError"
				});
			})
		} catch (err){  
			logger.log({level: 'warn', message: err.message});
			return reply.status(err.code ? err.code : 500).send({
                status: "fail",
                name: err.name,
                message: err.message
            });
		}
	});	  


	// ----- CHECK Link Forgot Password Request for information
    fastify.get('/passwd', {schema: schema.resetPasswordReqSchema}, async (request, reply) => {
		const { redis, createToken } = fastify;
		const { headers, query } = request;
		const { hashId, token } = query;
		const hget = util.promisify(redis["db0"].get).bind(redis["db0"]);
		try {
			// check registerhashid
			let result = await hget(hashId);
			if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
				throw new NotFoundError(404, 'Register Link Not Found!')
			}
			let register_data = JSON.parse(result);
			if (register_data.key !== token){
				throw new BadRequestError(422, 'Token not match!')
			}

			let store_id;
			if (register_data.user.userrole_id===5){
				store_id = headers.storeid;
				if (_.isUndefined(store_id)|| _.isNull(store_id)){
					throw new BadRequestError(422, 'Missing storeId!')
				}
				Object.assign(register_data, {store_id: store_id});
			}

            const masterkey = `${register_data.user.user_email}_${register_data.user.userrole_id}_` + (register_data.user.userrole_id===5 ? store_id : register_data.user.vendor.name);

			result = await createToken({key: masterkey, 
										id: register_data.user.id, 
										user_email: register_data.user.user_email,
										user_name: register_data.user.user_name},
										{
											from: headers["x-forwarded-for"],
											origin: headers.origin,
											referer: headers.referer
										}, "15m", 10)
			
			return reply.status(200).send({
				status: "ok",
				user: {
					key: masterkey,
					id: result.id,
					user_email: register_data.user.user_email,
					user_name: register_data.user.user_name
				},
				token: result.token,
				link: register_data.link
			})			

		} catch (err){
			logger.log({level: 'warn', message: err.message});
			return reply.status(err.code ? err.code : 500).send({
                status: "fail",
                name: err.name,
                message: err.message
            });
		}
	});

	// ----- END -- CHECK Link Forgot Password Request for information



    next();
}




