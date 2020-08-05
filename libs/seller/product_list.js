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
        let page = payload.query.page;
        let limit = payload.query.limit;
        let categoryId = payload.query.category_id;
        const {user} = payload;
        if (_.isUndefined(page) || _.isNull(page)) {
          page = 0;
        } else {
          page = Number(page) - 1;
          if (page <= 0) {
            page = 0;
          }
        }
        if (_.isUndefined(limit) || _.isNull(limit)) {
          limit = 100;
        } else {
          limit = Number(limit);
        }
      
        if (_.isUndefined(categoryId) || _.isNull(categoryId) || _.isEmpty(categoryId)){
          categoryId = 0;
        } else {
          categoryId = Number(categoryId);
        }
      
        const hget = util.promisify(rdClient.hget).bind(rdClient);
        /* TODO add sellerId to header for al request     
        const sellerDataResp = await hgetredis(CONFIG.redis.store_ids, sellerId);
        if (_.isUndefined(sellerDataResp) || _.isNull(sellerDataResp) || _.isEmpty(sellerDataResp)) {
          return reject({
            "error": {
              "message": `Cannot fetch products for Seller ID ${sellerId}`,
              "status": "NotFoundError"
            }
          });
        }
      
        const data = JSON.parse(sellerDataResp);
        */
        let productid_list=[];
        try {
            const conn = await db.newConnection();
            const query = util.promisify(conn.query).bind(conn);
            let result = null;

            productid_list = await query(`SELECT p.id, p.uuid as product_id, s.level_id, s.seller_hashid
                            FROM tb_product p 
                            INNER JOIN tb_vendor v ON v.id=p.vendor_id
                            INNER JOIN tb_sellervendor sv ON sv.vendor_id=p.vendor_id
                            INNER JOIN tb_seller s ON s.id=sv.seller_id
                            WHERE sv.user_id=? AND p.is_valid=1`, [user.id]);

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
                    catalog_list: categoryId>0 ? product_data.catalog_list : product_data.catalog_list.filter((c,idx)=>idx===0),
                    showimg_url: product_data.showimg_url,
                    thumbimg_url: product_data.thumbimg_url,
                };
                // get pricelist
                const new_product = await getResellerPriceList(conn, productid_list[i].level_id, selectedProductData);

                // get sold product
                result = await query(`SELECT COALESCE(SUM(item.item_count),0) as sold_items FROM tb_orderitems item 
                                          INNER JOIN tb_catalog c ON c.id=item.catalog_id 
                                          INNER JOIN tb_orders o ON o.id=item.order_id
                                          WHERE c.product_id=? AND o.order_state='new'`,[productid_list[i].id]);
                Object.assign(new_product, {sold_items: result[0].sold_items});
                product_list.push(new_product);
            }
            conn.release();
            return resolve({  "status": "ok",
                            "id": user.seller.hash_id,
                            "page": page,
                            "limit": limit,
                            "data": product_list})
        } catch (err){
            return reject(err);
        }
    })
}

module.exports = product; 