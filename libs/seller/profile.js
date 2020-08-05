"use strict";

const util = require('util');
const _ = require('lodash');
const common = require("../index");
const config = require("../../config");
const NotFoundError = require('../../models/errors/NotFound')

module.exports = {
    get: (fastify, request) => {
        return new Promise (async(resolve, reject)=>{
            const { mysql } = fastify;
            const { user } = request;
            try {
    
                let result = await mysql.query(`SELECT u.user_firstname,
                                                u.user_name, 
                                                u.user_email, 
                                                u.user_phone, 
                                                s.seller_name, 
                                                s.store_name, 
                                                ad.address_line1, 
                                                ad.address_line2, 
                                                ad.area_city as city, 
                                                ad.area_country as country, 
                                                ad.area_province as province,
                                                ad.country_id, 
                                                ad.city_id, 
                                                ad.area_id,
                                                v.vendor_resellerurl,
                                                i.image_path, i.image_name
                                            FROM tb_user u 
                                                INNER JOIN tb_sellervendor sv ON u.id=sv.user_id
                                                INNER JOIN tb_seller s ON sv.seller_id=s.id 
                                                INNER JOIN tb_selleraddress sa ON s.id=sa.seller_id
                                                INNER JOIN tb_address ad ON sa.address_id=ad.id
                                                INNER JOIN tb_vendor v ON sv.vendor_id=v.id 
                                                LEFT JOIN tb_images i ON i.user_id=s.id AND i.content_id=13 AND i.is_valid=1
                                                WHERE u.id=?`, [user.id]);
                let profile_url = null;

                if (_.isEmpty(result[0]) || _.isNull(result[0])){
                    throw new NotFoundError(404, 'User Not found');
                }

                if (result[0][0].image_path && result[0][0].image_path.length>0){
                    profile_url = `${config.images.url}/${result[0][0].image_path}/${result[0][0].image_name}`
                }

                const user_profile = result[0][0];

                return resolve({status: "ok", 
                                data: {
                                    user_data: {
                                        firstname: user_profile.user_firstname,
                                        name: user_profile.user_name,
                                        email: user_profile.user_email,
                                        phone: user_profile.user_phone
                                    },
                                    store_data: {
                                        name: user_profile.seller_name,
                                        store_name: user_profile.store_name,
                                        address: {
                                            address_line1: user_profile.address_line1,
                                            address_line2: user_profile.address_line2,
                                            city: user_profile.city,
                                            province: user_profile.province,
                                            country: user_profile.country,
                                            country_id: user_profile.country_id,
                                            city_id: user_profile.city_id,
                                            area_id: user_profile.area_id
                                        },
                                        profile_url: profile_url
                                    },
                                    url: user_profile.vendor_resellerurl
                                }});

            } catch (err){
                return reject(err);
            }
        })
    },

    put: (payload) => {
        const {user_id, user_data, address_data } = payload;
        return new Promise (async(resolve, reject)=>{
            if (_.isUndefined(user_id) || _.isNull(user_id)){
                return resolve({status: "failed", message: "user_id is missing"});
            }

            if (_.isUndefined(user_data) || _.isNull(user_data)){
                return resolve({status: "failed", message: "user_data is missing"});
            }

            if (_.isUndefined(address_data) || _.isNull(address_data)){
                return resolve({status: "failed", message: "address_data is missing"});
            }


            const conn = await db.newConnection();
            try {
                const query = util.promisify(conn.query).bind(conn);

                // update
                await query(`UPDATE tb_user SET user_name=?, user_firstname=?, user_phone=? WHERE id=?`,
                                    [user_data.name, user_data.first_name, user_data.phone, user_id]);


                // get seller address
                let result = await query(`SELECT sa.address_id FROM tb_selleraddress sa 
                                            INNER JOIN tb_sellervendor sv ON sv.seller_id=sa.seller_id
                                            WHERE sv.user_id=?`, [user_id]);
                let address_id = result[0].address_id;

                await common.updateAddressData({address_id, address_data, conn});

                let pSql = `SELECT u.user_name, u.user_email, u.user_phone, s.seller_name, s.store_name, 
                                    ad.address_line1, ad.address_line2, ad.area_city as city, 
                                    ad.area_country as country, ad.area_province as province,
                                    ad.country_id, ad.city_id, ad.area_id,
                                    v.vendor_resellerurl,
                                    i.image_path, i.image_name
                                FROM tb_user u INNER JOIN tb_sellervendor sv ON u.id=sv.user_id
                                    INNER JOIN tb_seller s ON sv.seller_id=s.id 
                                    INNER JOIN tb_selleraddress sa ON s.id=sa.seller_id
                                    INNER JOIN tb_address ad ON sa.address_id=ad.id
                                    INNER JOIN tb_vendor v ON sv.vendor_id=v.id 
                                    LEFT JOIN tb_images i ON i.user_id=u.id AND i.content_id=13 AND i.is_valid=1
                                    WHERE u.id=?`;
                result = await query(pSql, [user_id]);
                conn.destroy();
                let profile_url = null;
                console.log('image: ', result[0].image_path);
                if (result[0].image_path){
                    profile_url = `${config.images.url}/${result[0].image_path}/${result[0].image_name}`
                }
                return resolve({status: "ok", 
                                data: {
                                    user_data: {
                                        name: result[0].user_name,
                                        email: result[0].user_email,
                                        phone: result[0].user_phone
                                    },
                                    seller_data: {
                                        name: result[0].seller_name,
                                        store_name: result[0].store_name,
                                        address: {
                                            address_line1: result[0].address_line1,
                                            address_line2: result[0].address_line2,
                                            city: result[0].city,
                                            province: result[0].province,
                                            country: result[0].country,
                                            country_id: result[0].country_id,
                                            city_id: result[0].city_id,
                                            area_id: result[0].area_id
                                        },
                                        profile_url: profile_url

                                    },
                                    url: result[0].vendor_resellerurl 
                                }});

            } catch (err){
                conn.release()
                return reject(err);
            }
        })
    }
}; 