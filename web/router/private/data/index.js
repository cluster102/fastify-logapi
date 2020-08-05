'use strict';

const schema = require('./schema');
const config = require('../../../../config');
const logger = config.logger.instance;
const util = require('util')
const _ = require('lodash')
const bannerList = require('../../../../libs/common/bannerList')
const axios = require('axios')
const sellerDashboardProc = require('../../../../libs/seller/dashboard');
const vendorDashboardProc = require('../../../../libs/vendor/dashboard');
const crypto = require('crypto')

module.exports = (fastify, options, next) =>{ 

    fastify.addHook('preHandler', fastify.auth([fastify.authenticate]));
        
    fastify.get('/dashboard/seller', {schema: schema.sellerDashboardSchema}, async (request, reply) => {
        try {				
			let result = await sellerDashboardProc.get(fastify, request);
            return reply.status(200).send({status: 'ok', ...result});
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            if (_.isUndefined(err.code)){
              err.code = 500;
            }
            return reply.status(err.code).send(err);
        }
    })

    fastify.get('/dashboard/vendor', {schema: schema.vendorDashboardSchema}, async (request, reply) => {
        try {				
			let result = await vendorDashboardProc.get(fastify, request);
            return reply.status(200).send({status: 'ok', ...result});
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            if (_.isUndefined(err.code)){
              err.code = 500;
            }
            return reply.status(err.code).send(err);
        }
	})
	

	// ******************************************************
	// get token for uploading logo to imagekit
	//
	fastify.get('/token', {schema: schema.getTokenSchema}, async (request, reply) => {
		const { user } = request;
		const { redis } = fastify;

		const hget = util.promisify(redis["db0"].hget).bind(redis["db0"])

		try {
			let result = await hget(config.redis.vendor_data, user.vendor.name.toLowerCase()) 
			if (_.isEmpty(result) || _.isNull(result)){
				throw new NotFoundError(404, `Vendor: ${user.vendor.name} not found!`)
			}

			const { qty } = request.query;
			let token_qty = 1;
			if (!_.isUndefined(qty)) {
				token_qty = parseInt(qty);
			}

			if (token_qty <= 0){
				token_qty = 1;			
			}

			const current_time = Date.now();        
			const vendor_data = JSON.parse(result);
			const expire = current_time/1000 + parseInt(config.images.token_expire);
			let signature_data=[];
			for (i=0; i<token_qty; i++){
				var token = uuidv4();
				const signature = crypto.createHmac('sha1', config.images.privat_key).update(token).digest('hex');
				let tmp_data = {
					image_path: `img/${vendor_data.vendor_hashid}`,
					public_key: config.images.public_key,
					token: token,
					signature: signature, 
					expire: expire
				}
				signature_data.push(tmp_data);
			}

			return res.status(200).send({
				status: "ok",
				message: signature_data
			});
		} catch (err){
			reply.code(err.code ? Number(err.code) : 500).send({
				status: "fail",
				message: err.message,
				name: err.name
			})

		}
	})

    fastify.get('/resellerbannerlist', {schema: schema.getResellerBannerListSchema },  async (request, reply) => {
        const { mysql } = fastify;
		const { user } = request;
		try {
		
			let result = await mysql.query(`SELECT * FROM tb_images 
												WHERE user_id=? AND user_type=1 
												AND content_id=12 AND is_valid=1`, 
										[user.vendor.id])

			const banner_data = result[0].map(dt=>({
					image_id: dt.id, 
					image_name: dt.image_name,
					image_path: dt.image_path,
					ref_id: dt.ref_id,
					type: dt.content_id,
					url: `${config.images.url}/${dt.image_path}/${dt.image_name}`
				}))
				
			return reply.status(200).send({
				status: 'ok',
				seller_id: user.seller.hash_id,
				message: banner_data,
			})  
		} catch (err){
			logger.log({level: "error", message: err.message})
			reply.status(500).send({
				"status": "fail",
				"message": err.message,
				"name": err.name
			})

		}
	}) // END /images
      

	
	fastify.post('/images/:store_id', {schema: schema.postImagesSchema }, async (request, reply) => {
		const { user, params, body } = request;
		const { validateUser, redis, mysql } = fastify;
    const { store_id } = params;

		const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
		try {
          // await validateUser(user.key, store_id);
          let result = await hget(config.redis.store_ids, store_id);
          const seller_data = JSON.parse(result);
          const { image_data } = body;

          const user_type = seller_data.role === "reseller" ? 2 : 1;
          const user_id =
            seller_data.role === "reseller"
              ? seller_data.id
              : seller_data.vendor_id;
          let p_result = image_data.map(async (img) => {
            await mysql.query(`INSERT INTO tb_images SET ?`, {
              image_name: img.name,
              image_size: img.size,
              image_type: img.type,
              image_path: img.path,
              ref_id: img.ref_id,
              user_type: user_type,
              user_id: user_id,
              content_id: img.content_id,
            });

            return true;
          });

          const response = await Promise.all(p_result)
          .then(async () => {
            try {
              // --- UPDATE STORE DATA
              if (seller_data.role==="reseller"){
                fastify.initSeller(seller_data.id)
              } else {
                fastify.initVendor(seller_data.id)
              }

              // --- GET ALL image from selected type as response
              result = await mysql.query(`SELECT * FROM tb_images WHERE user_id=? and user_type=? AND is_valid=1`,
                      [user_id, user_type]);

              return result[0].map(dt=>({
                  image_id: dt.id,
                  image_name: dt.image_name,
                  image_path: dt.image_path,
                  ref_id: dt.ref_id,
                  url: `${config.images.url}/${dt.image_path}/${dt.image_name}`,
                  image_redirecturl: dt.image_redirecturl,
                  type: dt.content_id
                })
                )
			
            } catch(e){
              throw new Error(e);
            }
			
          })
          return reply.status(200).send({
            status: "ok",
            message: response
          })

        } catch(err){
			logger.log({level: 'warn', message: err});
			return reply.status(err.code ? err.code : 500).send({
                status: "fail",
                name: err.name ? err.name : "InternalServerError",
                message: err.message
            });
		}
	}) // END /images


    fastify.get('/banner', {schema: schema.getBannerSchema }, async (request, reply) => {
        let { user } = request;
        const { mysql, redis } = fastify;

        const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);

        try {
            let result = await hget(config.redis.user_data, user.key);
            if (_.isUndefined(result) || _.isEmpty(result) || _.isNull(result)){
                throw new NotFoundError(404, 'User unknown!')
            }
            const user_data = JSON.parse(result);

			// --- GET ALL image from selected type as response
			result = await bannerList(1, user_data.vendor.id, mysql)
			return reply.status(200).send({
					"status": 'ok',
					"message": result})
        } catch (err){
			logger.log({level: 'warn', message: err.message});
			return reply.status(err.code ? err.code : 500).send({
                status: "fail",
                name: err.name ? err.name : "InternalServerError",
                message: err.message
            });
        }
	})	

	fastify.post('/banner', {schema: schema.postBannerSchema }, async (request, reply) => {
		const { user } = request;
		const { redis, mysql } = fastify;
		const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);

		try {
			// get user data
			let result = await hget(config.redis.user_data, user.key);
			if (_.isUndefined(result) || _.isEmpty(result) || _.isNull(result)){
				throw new NotFoundError(404, 'User unknown|');
			}
			const user_data = JSON.stringify(result);

			let p_result = image_data.map(async img => {
				await mysql.query(`INSERT INTO tb_images SET ?`, {
						image_name: img.name,
						image_size: img.size,
						image_type: img.type,
						image_path: `img/${user_data.vendor.hash_id}`,
						ref_id: img.ref_id,
						user_type: 1,
						user_id: user_data.vendor.id,
						content_id: img.content_id
					})

				return true;
			})

			Promise.all(p_result)
			.then(async () => {

				// --- UPDATE STORE DATA
				fastify.initVendor(user_data.vendor.id)

				// --- GET ALL image from selected type as response
				result = await bannerList(1, user_data.vendor.id, mysql)
				return reply.status(200).send({
						"status": 'ok',
						"message": result})
			})
		} catch(err){
			logger.log({level: 'warn', message: err.message});
			return reply.status(err.code ? err.code : 500).send({
                status: "fail",
                name: err.name ? err.name : "InternalServerError",
                message: err.message
            });
		}
	})

	fastify.delete('/banner/:ref_id', {schema: schema.deleteBannerSchema }, async (request, reply) => {
		const { user } = request;
		const { ref_id } = request.params;
		const { mysql, redis } = fastify;

		const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
		try {
			// get user data
			let result = await hget(config.redis.user_data, user.key);
			if (_.isUndefined(result) || _.isEmpty(result) || _.isNull(result)){
				throw new NotFoundError(404, 'User unknown|');
			}
			const user_data = JSON.stringify(result);

			// TODO: add to LOG data for delete logo image
			await mysql.query(`UPDATE tb_images SET is_valid=0 WHERE ref_id=? AND user_id=?`, 
								[ref_id, user_data.vendor.id]);
	  
			// delete in imagekit
			const param_options = {
				url: `${config.images.delete_path}/${ref_id}`,
				method: 'delete',
				headers: {
					'Content-Type': 'application/json'
				},
				auth: {
					username: config.images.privat_key,
					password: ''
				},
				data: {}
			};
	  
			axios(param_options)
			.catch((err)=>{
				logger.log({level: 'err', message: err.message});
			})
			.finally(async()=>{

				// --- UPDATE STORE DATA
				fastify.initVendor(user_data.vendor.id)

				// --- GET ALL image from selected type as response
				result = await bannerList(1, user_data.vendor.id, mysql)
				return reply.status(200).send({
						"status": 'ok',
						"message": result})
			})
		} catch(err){
			logger.log({level: 'warn', message: err.message});
			return reply.status(err.code ? err.code : 500).send({
                status: "fail",
                name: err.name ? err.name : "InternalServerError",
                message: err.message
            });
		}
	})


    next();
}




