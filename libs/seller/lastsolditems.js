"use strict"
const _ = require("lodash");
const config = require("../../config");
const logger = config.logger.instance;

module.exports =  (payload, conn) => {
    let {store_id, order_state, limit, lang} = payload;
    return new Promise(async(resolve, reject)=>{
        if (_.isUndefined(limit)){
            limit = 10;
        }

        try {
            let results = 
                await conn.query(`SELECT p.id, p.uuid as product_id, o.order_state as status, c.uuid as catalog_id, o.created_at, 
                                c.product_title as name, pi.image_name, pi.image_path
                                FROM tb_orderitems item 
                                INNER JOIN tb_catalog c ON item.catalog_id=c.id
                                INNER JOIN tb_product p ON c.product_id=p.id
                                INNER JOIN tb_productimages pi ON p.id=pi.product_id AND pi.is_show=1
                                INNER JOIN tb_orders o ON item.order_id=o.id 
                                INNER JOIN tb_storeorders st ON o.id=st.order_id 
                                WHERE st.store_id=? AND o.order_state in ${order_state} 
                                ORDER BY o.created_at DESC LIMIT ?`, [store_id, limit]);
            if (_.isEmpty(results[0]) || _.isEmpty(results[0])){
                return resolve([])
            }

            let p_result = results[0].map(async(item)=>{
                let productDetail =  await conn.query(`SELECT pd.detail_shortdesc, l.lang_code as lang FROM tb_productdetail pd 
                                        INNER JOIN tb_lang l ON pd.lang_id=l.id
                                        WHERE pd.product_id=? AND l.lang_code=?`, [item.id, lang]);

                return ({
                    name: item.name,
                    product_id: item.product_id,
                    description: _.isEmpty(productDetail[0]) ? {detail_shortdesc: null, lang: null} : productDetail[0][0],
                    status: item.status,
                    catalog_id: item.catalog_id,
                    created_at: item.created_at,
                    url: `${config.images.url}/${item.image_path}/${item.image_name}`
                })
            })

            Promise.all(p_result)
            .then((result)=>{
                return resolve(result);
            })    
        } catch (err){
            logger.log({level: "warn", message: `Error in /libs/seller/dashboard`})
            return reject(err);
        }
    })
}