'use strict';

const config = require('../../../config');
const logger = config.logger.instance;
const _ = require('lodash');
let geoip = require('geoip-lite');
let requestip = require('request-ip');
const schema = require('./schema');
const util = require('util')
const BadRequestError = require('../../../models/errors/BadRequest')
const NotFoundError = require('../../../models/errors/NotFound');

module.exports = (fastify, options, next) =>{ 

    fastify.addHook('preHandler', function(request, reply, next){
        request.clientIp = requestip.getClientIp(request);
        next();        
    })

    // get store data
    fastify.get('/store', async (request, replay) => {
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
    
            let session_id = request.session.sessionId;
    
            let masterkey = origin;
            if (store_name) {
                masterkey = `${origin}_${store_name.toLowerCase()}`;
            }

            logger.log({level: 'verbose', message: `Origin: ${masterkey}`})
            const hget = util.promisify(redis.hget).bind(redis);
            let result = await hget(config.redis.store_data, masterkey)

            if (_.isEmpty(result) || _.isNull(result)){
                throw new NotFoundError(404, 'Store data not found!')
            }

            const storeData = JSON.parse(result);

    
            (async () => {
                try {
                    let existingSession = await mysql.query(`SELECT COUNT(*) as total FROM tb_session 
                                            WHERE id = ? and seller_id = ?`, [session_id, storeData.seller_id]);
                    if (existingSession[0][0] && existingSession[0][0].total === 0) {
                        await mysql.query("INSERT INTO tb_session SET ?", 
                                        {
                                            id: session_id, 
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
                        "session_id": session_id,
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

    fastify.get('/checkout/1/:seller_id/:session_id', async (request, replay) => {
        const { store_name } = request.query;
        const { origin } = request.headers;
        const { redis, mysql } = fastify;

        const {session_id, seller_id} = request.params;

        try {
            let result = await mysql.query(`SELECT channel_id, id as cart_id FROM tb_cart 
                                                WHERE session_id=? AND status='OPEN'`, [session_id]);
            if (_.isUndefined(result[0]) || _.isNull(result[0]) || _.isEmpty(result[0])) {
                throw new BadRequestError(422, "Cannot checkout. You cart is empty!");
            }
            let currentCart = result[0];

            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
            result = await hget(config.redis.store_ids, seller_id);
            
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)) {
                throw new NotFoundError(404, `Seller ID ${seller_id} not found!`)
            }        

            // *****************
            //
            // to be Detailed LATER
            //
            // if MORE then 1 Warehouse then make sure first the MAIN WAREHOUSE is in stock
            //
            // ******************
            const sellerData = JSON.parse(result);
            let pSql = `SELECT DISTINCT f.channel_id as vendorchannel_id,f.warehouse_id, w.uuid, 
                    w.warehouse_name, w.address_id,a.area_city,a.area_province,a.area_id,
                    w.is_valid, w.is_pickupenable, vc.vendor_id,vc.channel_id, c.channel_name, c.channel_type 
                    FROM tb_fullfillment f INNER JOIN tb_vendorchannel vc ON vc.id=f.channel_id 
                    INNER JOIN tb_channel c ON c.id=vc.channel_id
                    INNER JOIN tb_warehouse w ON w.id=f.warehouse_id 
                    INNER JOIN tb_address a on a.id=w.address_id
                    WHERE vc.vendor_id=? AND w.is_valid=1`;
            // if (is_shipping === false) { //user choose to pickup at store/warehouse
            //     pSql += ` AND w.is_pickupenable=1`;
            // }
    
            result = await mysql.query(pSql, [sellerData.vendor_id]);
            const warehouses = result[0];
            
            // get available paymentgateway
            /* pSql = `SELECT v.id, pm.methode_name, pm.methode_notes as methode_title, pm.methode_type as payment_type, pv.provider_name ` +
                        `FROM tb_vendorpaymentmethode v INNER JOIN tb_paymentmethode pm ON v.paymentmethode_id=pm.id ` +
                        `INNER JOIN tb_paymentprovider pv ON v.provider_id=pv.id ` +
                        `WHERE vendor_id=?`; */
            pSql = `SELECT 
                    pc.id, 
                    pc.ch_name as methode_title, 
                    pc.ch_slug as methode_name,
                    pc.url,
                    pc.url_lib,
                    mer.api_client_key, 
                    g.name as group_name, 
                    g.sorting as group_sort 
                FROM pg_channels pc  
                INNER JOIN pg_channel_groups g ON pc.group_id = g.id
                    INNER JOIN pg_merchant_channels mer ON pc.id=mer.channel_id 
                    WHERE pc.ch_status=1 AND mer.vendor_id=?`;
            result = await mysql.query(pSql, [sellerData.vendor_id])
    
            const payment_methode = result[0].map(p=>{
                let payment = {
                    id: p.id,
                    methode_title: p.methode_title, 
                    methode_name: p.methode_name, 
                    group_name: p.group_name, 
                    group_sort: p.group_sort
                }
    
                if (p.methode_name==="midtrans_cc"){
                    payment = Object.assign({}, payment, {
                            key: b64.encode(p.api_client_key),
                            url: p.url,
                            lib: p.url_lib,
                            env: config.env === "production" ? "production" : "sandbox"})
                }
    
                return payment;
            })
    
            // stock booking and checking
            // HARD CODED untuk mustika ratu, later flexibility
            let stock_data = {
                stock_status: "out_of_stock",
                stock_detail: []
            };
    
            // get current cart
            let updated_cart = await common.getCurrentCart({session_id: session_id, cart_status: "OPEN"}, conn);
            if (warehouses.length>0){
    
                // get stock
                stock_data = await common.createBookingData({cart_id: currentCart[0].cart_id, warehouse_id:warehouses[0].warehouse_id}, conn);
            } else {
                return res.status(404).json({
                    "error": {
                        "message": 'No Warehouse Found'
                    }
                });
            }
    
            // add booking id at cart
            /*
            let cart_final = updated_cart.items.map(crt => {
                let ist = stock_data.stock_detail.filter(st=>st.catalog_id===crt.catalog.catalog_id);
                logger.log({level: 'verbose', message: `cart_id: ${currentCart[0].cart_id} stock_data: ${stock_data}`})
                Object.assign(crt, {booking_id: ist[0].booking_id});
                return crt;
            })
            
            updated_cart.items = cart_final;
            */
    
            return res.status(200).json({
                "stock_status": stock_data.stock_status,
                "stock_detail": stock_data.stock_detail,
                "booking_expired_time": stock_data.booking_expired_time,
                "cart": updated_cart,
                "data": warehouses.length>0 ? warehouses.filter(w=> (w.is_pickupenable===1)) : [],
                "payment_list": payment_methode,
                "next_url": `/carts/checkout/2/${session_id}`
            });
        } catch (err) {
            if (conn){
                conn.release();
            }
            logger.log({level: 'error', message: err.message});
            return res.status(500).json({
                "error": {
                    "message": err.message
                }
            });
        }
    }); // POST /checkout/1/:session_id

    next();
}




