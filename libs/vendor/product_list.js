"use strict";

const db = require('../db');
const util = require('util');
const _ = require('lodash');
let { asyncGetPriceList, asyncGetSubCategorieIds } = require('../../routes/utils/utils');
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

        if (_.isUndefined(limit) || _.isNull(limit)) {
          limit = 100;
        } else {
          limit = Number(limit);
        }
        let offset = 0;

        if (_.isUndefined(page) || _.isNull(page) || _.isEmpty(page)) {
          offset = 0;
          page = 1;
        } else {
          offset = (Number(page) - 1)*limit;
          if (offset <= 0) {
            offset = 0;
          }
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
        let conn = null;
        let productid_list=[];
        try {
            conn = await db.newConnection();
            const query = util.promisify(conn.query).bind(conn);
            let pSql = "";
            let params=[];
            let result = null;
          
            // get all category including subs
            if (categoryId>0){
                let category_list = [{id: categoryId}];
                const catResp = await asyncGetSubCategorieIds(categoryId, conn);
                category_list = category_list.concat(catResp);
        
                // get all data
                for (let i=0; i<category_list.length; i++){
                  pSql = `SELECT DISTINCT p.id, p.uuid as product_id, p.created_at 
                            FROM tb_product p 
                              INNER JOIN tb_catalog c ON c.product_id=p.id
                              INNER JOIN tb_vendoruser vu ON p.vendor_id=vu.vendor_id 
                              WHERE vu.user_id=? AND p.is_valid=1 
                              AND p.category_id = ? order by p.created_at desc LIMIT ?, ?`;
                  result = await query(pSql, [user.id, category_list[i].id, offset, limit]);
                  if (!_.isUndefined(result) && !_.isNull(result) && !_.isEmpty(result)){
                      productid_list = productid_list.concat(result);
                  }
                } 
              
            } else {
                pSql = `SELECT p.id, p.uuid as product_id, p.created_at
                        FROM tb_product p 
                        INNER JOIN tb_vendoruser vu ON p.vendor_id=vu.vendor_id
                        INNER JOIN tb_vendor v ON p.vendor_id=v.id
                        WHERE vu.user_id=? AND p.is_valid=1 LIMIT ?,?`;
                result = await query(pSql, [user.id, offset, limit]);
                productid_list = productid_list.concat(result);
            }
      
            pSql = `SELECT v.vendor_hashid
                      FROM tb_vendor v 
                      INNER JOIN tb_vendoruser vu ON v.id=vu.vendor_id
                      WHERE vu.user_id=?`;
            result = await query(pSql, [user.id]);
            let level_id = result[0].level_id;
            let vendor_hashid = result[0].vendor_hashid;

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
                const new_product = await asyncGetPriceList(selectedProductData, conn);

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
            return resolve({ "status": "ok",
                            "id": vendor_hashid,
                            "page": page,
                            "limit": limit,
                            "category_id": categoryId,
                            "data": product_list})
        } catch (err){
          conn.release();
          return reject(err);
        }
    })
}

module.exports = product; 