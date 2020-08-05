"use strict"

const bcrypt = require("bcrypt");
const _ = require('lodash')
const config = require('../config')
const logger = config.logger.instance;
const util = require('util');
const NotFoundError = require('../models/errors/NotFound');
const BadRequestError = require('../models/errors/BadRequest')
const InternalServerError = require('../models/errors/InternalServerError')
const axios = require('axios');

module.exports = (fastify, opt, next) => {

    const PasswordCheck = (payload) => {
        return new Promise((resolve, reject)=> {
            const { passwd, origin_password } = payload;
            bcrypt.compare(passwd, origin_password, (error, result) => {
                if (error || result === false) {
                return resolve(false);
                }
                return resolve(true);
            });  
        })
    } // asyncCheckPassword


    const LoginAuthData = (payload) => {
        return new Promise(async(resolve, reject)=> {
            const { user_data, from, origin, referer} = payload;
            const { mysql, redis } = fastify;
            try {
                // save for saving data
                let user_sessiondata = {
                    from: from,
                    origin: origin,
                    key: user_data.key
                };
                
                // save for sesion data
                redis["db2"].set(
                    user_data.login_id,
                    JSON.stringify(user_sessiondata),
                    "EX",
                    1800
                );

                // add log data
                let logData = {
                    user_id: user_data.id,
                    userlog_ids: 3,
                    userlog_ips: from,
                    userlog_data: referer
                }

                await mysql.query('INSERT INTO tb_userlog SET ?', [logData])
                // back to 0 gain to make sure the next process uses redis 0
                return resolve(true);
            } catch (err){
                return resolve(false);
            }
        })
    } // LoginAuthData

    const GetRoleId = (role) => {
        if (_.isUndefined(role) || _.isNull(role)) {
          return -1;
        }

        switch (role.toLowerCase()) {
            case "superuser": return 1;
            case "admin": return 2;
            case "vendor": return 3;
            case "seller": return 4;
            case "user": return 5;
            case "supplier": return 6;
            case "finance": return 7;
        }
        return -1;
    }

    const CreateAddressData = (payload) => {
        return new Promise(async(resolve, reject)=> {
            const address = payload;
            const { mysql } = fastify;
            let conn = await mysql.getConnection();
            try {
                let result = null;
    
                /// get address data
                let addressData = {};
                if (address.city_id && address.city_id>0){
                    result = await conn.query(`SELECT main_t.area_name as city, parent_t.area_name as province  
                                            FROM tb_area main_t LEFT JOIN tb_area parent_t ON parent_t.id=main_t.parent_id 
                                            WHERE main_t.id=?`, [address.city_id])
                    if (_.isUndefined(result[0]) || _.isNull(result[0]) || _.isEmpty(result[0])){
                        Object.assign(addressData, {province:'', city: ''})
                    } else {
                        Object.assign(addressData, {province: result[0][0].province, city: result[0][0].city})
                    }
                } else {
                    Object.assign(addressData, {province:'', city: ''})
                }
    
                //get area id
                if (address.area_id && address.area_id>0){
    
                    result = await conn.query(`SELECT main_t.area_name as area, parent_t.area_name as district  
                                                FROM tb_area main_t LEFT JOIN tb_area parent_t ON parent_t.id=main_t.parent_id
                                                WHERE main_t.id=?`, [address.area_id]);
                    if (_.isUndefined(result[0]) || _.isNull(result[0]) || _.isEmpty(result[0])){
                        Object.assign(addressData, {district:'', subdistrict: ''})
                    } else {
                        Object.assign(addressData, {district: result[0][0].district, subdistrict: result[0][0].area})
                    }
                } else {
                    Object.assign(addressData, {district:'', subdistrict: ''})
                }
    
                // get country name
                result = await conn.query(`SELECT area_name as country FROM tb_area WHERE id=?`, [address.country_id]);
                
                // save address data
                const addrData = {
                    address_line1: address.line1,
                    address_line2: address.line2,
                    area_country: result[0][0].country,
                    area_province: addressData.province,
                    area_city: addressData.city,
                    area_district: addressData.district,
                    area_subdistrict: addressData.subdistrict,
                    country_id: address.country_id,
                    add_codepos: address.post_code,
                    city_id: address.city_id,
                    area_id: address.area_id
                };
                result = await conn.query(`INSERT INTO tb_address SET ?`, addrData);
                await conn.destroy();
                return resolve(result[0].insertId);
            } catch(err){
                return reject(err)
            }
        })
    } // createAddressData


    const ValidateAddressId = (country_id, area_id) => {
        return new Promise(async(resolve, reject)=> {
            const { mysql } = fastify;
            try {
                let f_isIndonesia = false;
                let result = await mysql.query(`SELECT * FROM tb_area WHERE id=?`, [address.country_id]);
                if (result && result[0].length>0){
                    if (result[0][0].area_name=== 'Indonesia'){
                        f_isIndonesia = true;
                    }
                }

                if (address.area_id===0) {
                    if (f_isIndonesia){
                        return resolve(false);
                    }
                    return resolve (true);
                } 
                
                result = await mysql.query(`SELECT * FROM tb_area WHERE id=?`, [address.area_id]);
                let level = result[0][0].areatype_id;
                if (level===4) { return resolve (true)}
                if (f_isIndonesia) { return resolve (false)}
                return resolve(true);
            } catch (err){
                return resolve(false);
            }
        })
    } 

    const ValidateStore = (vendor, store_id) => {
        return new Promise(async (resolve, reject)=>{
            const { redis } = fastify;
            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
            try {
                // get vendor data
                let result = await hget(config.redis.vendor_data, vendor);
                if (_.isUndefined(result) || _.isEmpty(result) || _.isNull(result)){
                    throw new NotFoundError(404, 'Vendor name unknown');
                }
                const vendor_data = JSON.stringify(result);
                
                // check store id
                result = await hget(config.redis.store_ids, store_id);
                if (_.isUndefined(result) || _.isEmpty(result) || _.isNull(result)){
                    throw new NotFoundError(404, 'StoreId unknown');
                }
                const store_data = JSON.stringify(result);

                if (vendor_data.id !== store_data.vendor_id){
                    throw new BadRequestError(422, 'StoreId not match');
                }
                resolve(true);

            } catch(err){
                reject(err);                
            }        
        })
    } 

    const ValidateUser = (key, store_id) => { 
        return new Promise(async (resolve, reject)=>{
            const { redis } = fastify;
            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);
            try {
                // get user data
                let result = await hget(config.redis.user_data, key);
                if (_.isUndefined(result) || _.isEmpty(result) || _.isNull(result)){
                    throw new NotFoundError(404, 'User unknown|');
                }
                const user_data = JSON.parse(result);
                
                // check store id
                result = await hget(config.redis.store_ids, store_id);
                if (_.isUndefined(result) || _.isEmpty(result) || _.isNull(result)){
                    throw new NotFoundError(404, 'StoreId unknown');
                }
                const store_data = JSON.parse(result);
                if (store_data.role==="vendor"){
                    if (store_data.id === user_data.vendor.id && user_data.vendor.hash_id===store_id){
                        return resolve(true);
                    }
                } else {
                    if (store_data.id === user_data.seller.id && user_data.seller.hash_id===store_id){
                        return resolve(true);
                    }
                }
                throw new BadRequestError(422, 'User and Store not match');

            } catch(err){
                reject(err);
            }        
        })
    } 


    const CreateToken = (userData, source, expiredIn, status=3) => {
        return new Promise( async(resolve, reject) => {
            const {mysql, redis, jwt} = fastify;


            const sessionid = Date.now();

            let data = {
                key: userData.key,
                id: `${userData.id}${sessionid}`,
                user_email: userData.user_email,
                user_name: userData.user_name
            }

            // create token
            const token = jwt.sign(data, { expiresIn: expiredIn });

            let user_sessiondata = {
                from: source.from,
                origin: source.origin,
                key: userData.key
            };
            
            let pre_logdata = data.id + '-'+userData.key;
            
            // add log data
            let logData = {
                user_id: userData.id,
                userlog_ids: status,
                userlog_ips: source.from,
                userlog_data: source.referer ? pre_logdata + '-' + source.referer : pre_logdata
            }

            mysql.query('INSERT INTO tb_userlog SET ?', logData);    

            // save for sesion data
            redis["db2"].set(
                data.id,
                JSON.stringify(user_sessiondata),
                "EX",
                1800
            );
            return resolve({token: token, id: data.id});
        })
    }

    const InitSeller = (id) => {
        return new Promise( async(resolve, reject) => {
            const {mysql} = fastify;

            let result = await mysql.query(`SELECT seller_key from tb_seller WHERE id=?`, [id]);
            if (_.isNull(result) || _.isEmpty(result)){
                logger.log({level: "error", message: `Seller key from selled_id: ${id} not found!!`})
                return resolve(true);
            }

            let param_option = {
                url: `${config.datainit.url}/seller/store`,
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": result[0][0].seller_key
                },
                data: {}
            };
            axios(param_option)
            .catch((err)=>{
                logger.log({level: "error", message: `Axios error while init seller data with id: ${id} with err: ${JSON.stringify(err)}`})
            })
            .finally(()=>{
                return resolve(true)
            })
        })
    }    

    const InitVendor = (id) => {
        return new Promise( async(resolve, reject) => {
            const {mysql} = fastify;

            let result = await mysql.query(`SELECT vendor_key from tb_vendor WHERE id=?`, [id]);
            if (_.isNull(result) || _.isEmpty(result)){
                logger.log({level: "error", message: `vendor_key from vendor_id: ${id} not found!!`})
                return resolve(true);
            }

            let param_option = {
                url: `${config.datainit.url}/vendor/store`,
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": result[0][0].vendor_key
                },
                data: {}
            };
            axios(param_option)
            .catch((err)=>{
                logger.log({level: "error", message: `Axios error while init vendor data with id: ${id} with err: ${err.message}`})
            })
            .finally(()=>{
                return resolve(true)
            })
        })
    }    
    

    fastify.decorate("loginAuthData", LoginAuthData);
    fastify.decorate("getRoleId", GetRoleId);
    fastify.decorate("passwordCheck", PasswordCheck);
    fastify.decorate("validateAddressId", ValidateAddressId);
    fastify.decorate("createAddressData", CreateAddressData);
    fastify.decorate("validateStore", ValidateStore);
    fastify.decorate("validateUser", ValidateUser);
    fastify.decorate("createToken", CreateToken);
    fastify.decorate("initSeller", InitSeller);
    fastify.decorate("initVendor", InitVendor);

    
    next();
}
