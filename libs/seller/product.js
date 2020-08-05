"use strict";

const db = require('../db');
const util = require('util');
const _ = require('lodash');
let common = require('../../routes/utils/utils');
const CONFIG = require('../../config');


const product = (payload) => {
    return new Promise (async(resolve, reject)=>{
        // This is 
        let { ids, user, page, limit } = payload;
        
        if (_.isUndefined(ids) || _.isNull(ids) || _.isEmpty(ids)) {
            return reject({code: 400, status: "failed", message: "No product ids found"});
        }
    
        const conn = await db.newConnection();
        try {
            const query = util.promisify(conn.query).bind(conn);
            for (let i=0; i<ids.length; i++){
                let currentId = ids[i];

                // get id and insert into store catalog
                let results = await query(`SELECT c.id as catalog_id, COALESCE(sc.id, 0) as storecatalog_id,
                                            COALESCE(sc.is_choosed, 0) as is_active  
                                            FROM tb_catalog c
                                            INNER JOIN tb_product p ON p.id=c.product_id
                                            LEFT JOIN tb_storecatalog sc ON c.id=sc.catalog_id AND sc.seller_id=? 
                                                WHERE p.uuid=?`, [user.seller.id, currentId]);
                if (_.isUndefined(results) || _.isNull(results) || _.isEmpty(results)) {
                    return reject({"code": 400,
                    "error": {
                        "message": `Internal Error while retrieve catalog data`,
                        "status": "InternalServerError"
                    }
                    });
                }

                for (let j=0; j<results.length; j++){
                    let catalogData = results[j];
                    if (catalogData.storecatalog_id === 0){
                        await query (`INSERT INTO tb_storecatalog SET ?`, {seller_id: user.seller.id, 
                                                                            catalog_id: catalogData.catalog_id, product_sold: 0,
                                                                            is_choosed: 1});
                    } else {
                        if (catalogData.is_active === 0){
                            await query (`UPDATE tb_storecatalog SET is_choosed=1 WHERE id=?`, [catalogData.storecatalog_id]);
                        }
                    }
                }
            }

            const response = await common.getProductData({conn: conn, seller_id: user.seller.id, store_id: user.seller.hash_id, page: page, limit: limit})
            conn.release();
            return resolve(response);
        } catch (err) {
            console.log(err);
            return reject({
                "error": {
                    "message": err.message,
                    "status": "NotFoundError"
                }
            });  
        }
    }) // new return promise
}
module.exports = product; 