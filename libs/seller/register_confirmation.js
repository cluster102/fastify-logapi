"use strict";

const util = require('util');
const _ = require('lodash');
const config = require('../../config');
const logger = config.logger.instance;
const bcrypt = require("bcrypt");
const hashids = require("hashids/cjs");
const crypto = require("crypto");
const uuid = require('uuid/v4');
let NotFoundError = require('../../models/errors/NotFound');
let BadRequestError = require('../../models/errors/BadRequest');


module.exports = (fastify, request) => {
    return new Promise (async(resolve, reject)=>{
        const { redis, mysql, jwt, validateAddressId, createAddressData, loginAuthData, passwordCheck} = fastify;
        const { headers, body } = request;
        let { user, address, password, link, vendor, bank_data, seller } = body;
        let conn = null;
        const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
        const get = util.promisify(redis["db0"].get).bind(redis["db0"]);
        const hset = util.promisify(redis["db0"].hset).bind(redis["db0"]);
        try {

            // --- VALIDATE Address Data ---
            if (!validateAddressId(address.country_id, address.area_id)){
                throw new BadRequestError(422, `Address area_id invalid or incomplete!`);
            }

            // --- CHECK RESELLER ---
            let result = await hget(config.redis.reseller_data, seller.name.toLowerCase());
            if (result) {
                throw new BadRequestError(422, `Reseller name already registered!`);
            }

            // check if link already expired
            result = await get(link);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                // --- HERE Should add check for link and deleted the user sp that iser can register again
                throw new BadRequestError(422, `Link expired!`);
            }
            let masterkey = `${user.email.toLowerCase()}_4_${vendor.name.toLowerCase()}`;
            result = await hget(config.redis.user_data, masterkey);
            if (_.isUndefined(result) || _.isNull(result) || _.isEmpty(result)){
                // --- HERE Should add searching user from database
                throw new NotFoundError(404, `User not found!`);
            }
            let user_data = JSON.parse(result);

            // start transaction
            conn = await mysql.getConnection();

            // chaek password
            result = await passwordCheck({passwd: password, origin_password: user_data.user_passwd});
            if (!result){
                let logData = {
                    user_id: user_data.id,
                    userlog_ids: 6,
                    userlog_ips: headers["x-forwarded-for"],
                    userlog_data: headers.referer
                }
                await conn.query('INSERT INTO tb_userlog SET ?', logData);
                throw new UnauthorizedError(401, "Password Not Match");
            }

            result = await conn.query(`SELECT id FROM tb_levelmodel 
                                                WHERE level_id=1 AND vendor_id=?`, [user_data.vendor.id]);

            result = await conn.query(`INSERT INTO tb_seller SET ?`, {
                seller_name: user.name,
                store_name: seller.name,
                level_id: result[0][0].id
            });
            const sellerId = result[0].insertId;

            // create hash id
            const b_hash = util.promisify(bcrypt.hash).bind(bcrypt);
            result = new hashids(config.keys.hashkey_user, 16);
            let new_hash = result.encode(sellerId);
            const prevendor_key = `${new_hash}_${user.register_id}_${config.keys.hashkey_user}`;
            let seller_key = await b_hash(prevendor_key, 10)
                            
            let sellerData = {
                id: sellerId,
                hash_id: new_hash,
                key: seller_key,
                name: seller.name
            }

            // --- GET vendor_data
            result = await hget(config.redis.vendor_data, vendor.name.toLowerCase());
            const vendorData = JSON.parse(result);

            // --- Speichern STORE IDS fuer schnelle Zugriff
            const sellerRedisData = {
                id: sellerData.id,
                vendor_id: vendorData.id,
                role: "reseller",
                wh_sourceid: vendorData.vendor_hashid
            };
            hset(config.redis.store_ids, sellerData.hash_id, JSON.stringify(sellerRedisData));

            // --- CREATE Address data
            let address_id = await createAddressData({
                    line1: address.line1,
                    line2: (address.line2 ? address.line2 : ""),
                    country_id: address.country_id,
                    city_id: (address.city_id ? address.city_id : 0),
                    area_id: (address.area_id ? address.area_id : 0),
                    post_code: (address.postcode ? address.postcode : "")
                });

            // safe reseller data
            await conn.query(`UPDATE tb_seller SET seller_hashid=?, seller_key=?, store_enable=0 WHERE id=?`, [sellerData.hash_id, sellerData.key, sellerId]);
            await conn.query(`UPDATE tb_register SET is_valid = 0 WHERE id = ?`, [user.register_id]);
            await conn.query(`INSERT INTO tb_sellervendor SET ?`, {vendor_id: user_data.vendor.id, seller_id: sellerId, user_id: user_data.id});
            await conn.query(`INSERT INTO tb_selleraddress SET ?`, {seller_id: sellerId, address_id: address_id, is_valid: 1});

        
            // --- START save bank information
            const bankData = {
                bank_name: bank_data.name,
                bank_accountnr: bank_data.account_no,
                bank_accountname: bank_data.account_name
            }

            result = await conn.query(`INSERT INTO tb_bankaccount SET ?`, bankData);
            const bank_id = result[0].insertId;

            await conn.query(`INSERT INTO tb_sellerbank SET ?`, {seller_id: sellerId, bank_id: bank_id, bank_state: 1});
            // --- END save bank information

            // --- START NOTITIFICATION process
            const notifData = {
                notif_content: `${user_data.user_name} register as ${user_data.user_role}.`,
                notif_type: 1,
                role_id: 4,
                sender_id: user_data.id
            }
            result = await conn.query(`INSERT INTO tb_notification SET ?`, notifData);
            await conn.query(`INSERT INTO tb_notifreceiver SET ?`, {sender_id: result[0].insertId, role_id: 3, receiver_id: vendor.id});
            await conn.release();
            // --- END NOTITIFICATION process

            // --- UPDATE USER DATA
            let updated_user = {
                id: user_data.id,
                hash_id: user_data.hash_id,
                user_role: user_data.user_role,
                userrole_id:user_data.userrole_id,
                user_name: user_data.user_name,
                user_email: user_data.user_email,
                user_passwd: user_data.user_passwd,
                user_status: 1,
                vendor: user_data.vendor,
                seller:  {name: seller.name, id: sellerId, hash_id: sellerData.hash_id}               
            }
            hset(config.redis.user_data, masterkey, JSON.stringify(updated_user));
            // --- END update to redis

            Object.assign(sellerData, {store_enable: false, address_id: address_id});
            hset(config.redis.reseller_data, seller.name.toLowerCase(), JSON.stringify(sellerData));

            // --- START CREATE STORE DATA
            /*
            logger.log({level:'verbose', message: `Prepare initStoreDataToRedis reseller ${user_data.user_name}`});
            await initStoreDataToRedis(sellerData.hash_id, conn);
            logger.log({level:'verbose', message: `Prepare initStoreDesc reseller ${user_data.user_name}`});
            await initStoreDesc(sellerData.hash_id, conn);
            */

            // --- CREATE jwt token */
            let current_time = Date.now();
            const expire = current_time/1000 + parseInt(config.images.token_expire);
            var img_token = uuid();
            const signature = crypto.createHmac('sha1', config.images.privat_key).update(img_token).digest('hex');
            const signature_data = {
                image_path: `img/${vendorData.vendor_hashid}/ids`,
                public_key: config.images.public_key,
                token: img_token,
                signature: signature, 
                expire: expire
            }

            const sessionid = Date.now();
            let userData = {
                key: masterkey,
                name: user_data.user_name,
                email: user_data.user_email,
                role: 'seller',
                id: `${user_data.id}${sessionid}`,
                store_url: null,
                store_id: sellerData.hash_id,
                vendor: vendor.name
            }
  
            // get token
            const token = jwt.sign(userData, {expiresIn: config.jwt_expiration_admin});

            // save for log information
            await loginAuthData({   
                        from: headers["x-forwarded-for"],
                        origin:  headers.origin,
                        referer: headers.referer,
                        user_data: {
                            login_id: userData.id, 
                            id: user_data.id, 
                            key: masterkey
                        }
                    });
            logger.log({level: 'verbose', message: `Reseller: ${user_data.user_name} register confirmed`})
            return resolve({
                status: `ok`,
                user: userData,
                token: token,
                img_signature: signature_data
            });

        } catch(error) { // BCRYPT.compare
            if (conn && conn.connection._pool){
                await conn.destroy();
            }            
            return reject(error);
        }
    })
}
