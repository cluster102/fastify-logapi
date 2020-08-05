'use strict';

const config = require('../../../config');
const logger = config.logger.instance;
const _ = require('lodash');
let geoip = require('geoip-lite');
let requestip = require('request-ip');
const schema = require('./schema');
const util = require('util')
const NotFoundError = require('../../../models/errors/NotFound')

module.exports = (fastify, options, next) =>{ 

    fastify.addHook('preHandler', function(request, reply, next){
        request.clientIp = requestip.getClientIp(request);
        next();        
    })

    // get store data
    fastify.get('/store', {schema: schema.storeSchema}, async (request, replay) => {
        const { store_name } = request.query;
        const { origin } = request.headers;
        const { redis, mysql } = fastify;

        try {
        
            if (_.isUndefined(origin) || _.isNull(origin)){
                throw new BadRequestError(422, "Origin Unknown");
            }
    
            let city = null;
            let region = null;
            let countryCode = 'ID';
            const ip = request.clientIp;
            if (!_.isUndefined(ip) && !_.isNull(ip) && !_.isEmpty(ip)) {
                let geo = geoip.lookup(ip);
                countryCode = geo && geo.country ? geo.country : 'ID';
                city = geo && geo.city ? geo.city : '';
                region = geo && geo.region ? geo.region : '';
            }
    
            let sessionID = request.session.sessionId;
    
            let masterkey = origin;
            if (store_name) {
                masterkey = `${origin}_${store_name.toLowerCase()}`;
            }

            logger.log({level: 'verbose', message: `Origin: ${masterkey}`})
            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
            let result = await hget(config.redis.store_data, masterkey)

            if (_.isEmpty(result) || _.isNull(result)){
                throw new NotFoundError(404, 'Store data not found!')
            }

            const storeData = JSON.parse(result);

    
            (async () => {
                try {
                    let existingSession = await mysql.query(`SELECT COUNT(*) as total FROM tb_session 
                                            WHERE id = ? and seller_id = ?`, [sessionID, storeData.seller_id]);
                    if (existingSession[0][0] && existingSession[0][0].total === 0) {
                        await mysql.query("INSERT INTO tb_session SET ?", 
                                        {
                                            id: sessionID, 
                                            seller_id: storeData.seller_id, 
                                            session_origin: origin, 
                                            session_address: ip, 
                                            session_city: city, 
                                            session_region: region, 
                                            country_code: countryCode
                                        });
                    }
                } catch (err) {
                    logger.log({level: 'warn', message: err.message})
                } finally {
                    return replay.status(200).send({
                        "status": 'ok',
                        "message": storeData,
                        "session_id": sessionID,
                        "country_code": countryCode,
                        "url": "/data/store" + (!_.isUndefined(store_name) && !_.isNull(store_name) && !_.isEmpty(store_name) ? `?store_name=${store_name}` : "")
                    });    
                }
            })();
        }catch(err){
			logger.log({level: 'warn', message: err.message});
            reply.status(err.code ? Number(err.code) : 500).send({
                "status": "fail",
                "name": err.name,
                "message": err.message
            })
        }
    });

    // get store admin data
    fastify.get('/admin', {schema: schema.adminSchema}, (request, replay) => {
        const { origin } = request.headers;
        const { redis } = fastify;
            
        (() => {  
            let city = null;
            let region = null;
            let countryCode = 'ID';
            const ip = request.clientIp;
            if (!_.isUndefined(ip) && !_.isNull(ip) && !_.isEmpty(ip)) {
                let geo = geoip.lookup(ip);
                countryCode = geo && geo.country ? geo.country : 'ID';
                city = geo && geo.city ? geo.city : '';
                region = geo && geo.region ? geo.region : '';
            }
            
            redis["db0"].hget(config.redis.admin_data, origin, (err, result) => {
                if (err) {
                    return replay.status(500).send({
                        "message": `Cannot fetch admin data`,
                        "status": "fail",
                        "name": "InternalServerError"
                        });
                }
                    
                if (!result) {
                    return replay.status(404).send({
                        "message": `Cannot fetch admin data. [Url Not Found]!`,
                        "status": "fail",
                        "name": "NotFoundError",
                    });
                }
            
                return replay.status(200).send({
                    "status": 'ok',
                    "message": JSON.parse(result),        
                    "country_code": countryCode,
                });    
            })
        })()
    });
    


    /* =========================================================
    **  
    ** Get bank
    ** 
    */        
    fastify.get('/bank', {schema: schema.bankSchema}, async (request, reply) => {

        const { mysql } = fastify;

        try {
            const results = await  mysql.query('SELECT id as value, bank_name as label from tb_banklist');
            reply.status(200).send({
                "status": `ok`,
                "list": results[0]
            }) ;
        } catch(err){
			logger.log({level: 'warn', message: err.message});
            reply.status(err.code ? Number(err.code) : 500).send({
                "status": "fail",
                "name": err.name,
                "message": err.message
            })
        }
    });

    /* =========================================================
    **  
    ** Get currency
    ** 
    */
    fastify.get('/currency', {schema: schema.currencySchema}, async (request, reply) => {
        const { mysql } = fastify;

        try {
            const results = await  mysql.query('SELECT id as value, currency_code as label from tb_currency');
            reply.status(200).send({
                "status": `ok`,
                "list": results[0]
            }) ;
        } catch(err){
			logger.log({level: 'warn', message: err.message});
            reply.status(500).send({
                "status": "fail",
                "name": "InternalError",
                "message": err.message
            })
        }
    });

    /* =========================================================
    **  
    ** Get Region
    ** 
    */
    fastify.get('/region/:store_id', {schema: schema.regionSchema}, async (request, reply) => {
        const { mysql, redis } = fastify;
        const {store_id} = request.params;
    
        const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
        try {
            // get vendor id
            let result = await hget(config.redis.store_ids, store_id);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)) {
                throw new NotFoundError(404, `Cannot get store data with seller_id ${store_id}`);
            }
    
            let seller_data=JSON.parse(result);
    
            result = await mysql.query(`SELECT country.id as value, country.area_name as label, country.area_code as code, 
                                        rl.currency_id, cr.currency_code 
                                        FROM tb_vendorregion vr INNER JOIN tb_regionlist rl ON vr.id=rl.vendorregion_id 
                                        INNER JOIN tb_area country ON rl.country_id=country.id 
                                        INNER JOIN tb_currency cr ON rl.currency_id=cr.id 
                                        WHERE vr.vendor_id=?`, [seller_data.vendor_id]);
            return reply.status(200).send({
                "status": "ok",
                "list": result[0],
                "url": `/region/${store_id}`
            });
        } catch (err) {
			logger.log({level: 'warn', message: err.message});
            return reply.status(err.code ? Number(err.code) : 500).send({
                "status": "fail",
                "name": err.name,
                "message": err.message
            });
        }
    });

    /* =========================================================
    **  
    ** Get Region
    ** 
    */
	fastify.get('/areaparent', {schema: schema.areaparentSchema}, async (request, reply) => {
		const { mysql } = fastify;
		const { parentId } = request.query;

		try {
			let result = await mysql.query(`SELECT main_t.id as value, main_t.area_name as main_area, 
								parent_t.area_name as parent_area from tb_area main_t  LEFT JOIN tb_area parent_t 
                                ON parent_t.id=main_t.parent_id  WHERE parent_t.parent_id=? `, [parentId]);
                                console.log(result);
			return reply.status(200).send({
				"status": "ok",
				"parent_id": parentId,
				"list": result[0].map(item=>{return({value: item.value, label: `${item.main_area} - ${item.parent_area}`})}),
				"url": `/areaparent?parentId=${parentId}`
			});
		} catch (err) {
			logger.log({level: 'warn', message: err.message});
            return reply.status(err.code ? Number(err.code) : 500).send({
                "status": "fail",
                "name": err.name,
                "message": err.message
            });
		}
	});

    next();
}




