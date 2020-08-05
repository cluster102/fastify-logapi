"use strict";

const db = require('../db');
const util = require('util');
const _ = require('lodash');
let { getResellerPriceList, asyncGetSubCategorieIds } = require('../../routes/utils/utils');
const CONFIG = require('../../config');
const rdClient = CONFIG.redis.instance;


const product = (payload) => {
    return new Promise (async(resolve, reject)=>{
        // This is 
        // let sellerId = payload.params.id;
        const { user, query } = payload;
        const { type } = query;
        const getredis = util.promisify(rdClient.get).bind(rdClient);
        const selectedTypeList = await getredis(CONFIG.redis.selected_product)
        if (_.isUndefined(selectedTypeList) || _.isNull(selectedTypeList) || _.isEmpty(selectedTypeList)) {
        }
        const iType = JSON.parse(selectedTypeList).filter(i=>i.type.toLowerCase() === type.toLowerCase());
        if (iType.length===0){
            throw new NotFoundError(404, `Cannot get selected item`);
        }

        let productid_list=[];
        const conn = await db.newConnection();
        try {
            const query = util.promisify(conn.query).bind(conn);
            const hget = util.promisify(rdClient.hget).bind(rdClient);
            let pSql = "";
            let params=[];
            let result = null;

            let productid_list = await query(`SELECT DISTINCT p.id, p.uuid as product_id, s.level_id, 
                            s.seller_hashid
                        FROM tb_productselected ps 
                        INNER JOIN tb_catalog c ON ps.catalog_id=c.id 
                        INNER JOIN tb_product p ON c.product_id=p.id AND p.is_valid=1
                        INNER JOIN tb_sellervendor sv ON sv.vendor_id=p.vendor_id
                        INNER JOIN tb_seller s ON s.id=sv.seller_id
                            WHERE s.id=? AND ps.feature_type=?`, [user.seller.id, iType[0].id]);

            let product_list = [];
            for (let i=0; i<productid_list.length; i++)
            {
                // get product detail
                result = await hget(CONFIG.redis.product_data, productid_list[i].product_id);
                let product_data = JSON.parse(result);
        
                let selectedProductData = {
                    id: product_data.id,
                    title: product_data.title,
                    category_id: product_data.category_id,
                    catalog_list: product_data.catalog_list,
                    showimg_url: product_data.showimg_url,
                    thumbimg_url: product_data.thumbimg_url,
                };
                // get pricelist
                const new_product = await getResellerPriceList(conn, productid_list[i].level_id, selectedProductData);

                // get sold product
                pSql = `SELECT COALESCE(SUM(item.item_count),0) as sold_items FROM tb_orderitems item 
                                INNER JOIN tb_catalog c ON c.id=item.catalog_id 
                                INNER JOIN tb_orders o ON o.id=item.order_id
                                WHERE c.product_id=? AND o.order_state='new'`;
                result = await query(pSql,[productid_list[i].id]);
                Object.assign(new_product, {sold_items: result[0].sold_items});
                product_list.push(new_product);
            }
      
            conn.release();
            return resolve({  "status": "ok",
                            "id": user.seller.hash_id,
                            "data": product_list})
        } catch (err){
            conn.release();
            console.log(err);
            return reject(err);
        }
    })
}

module.exports = product; 