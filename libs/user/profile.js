"use strict";

const util = require('util');
const _ = require('lodash');

module.exports = {
    get: (fastify, request) => {
        let { mysql } = fastify;
        const {user} = request;
        return new Promise (async(resolve, reject)=>{
            if (_.isUndefined(user_id) || _.isNull(user_id)){
                return resolve({status: "failed", message: "user_id is missing"});
            }
            try {
                let result = await mysql.query(`SELECT  b.id, b.is_default, cont.contact_firstname, cont.contact_name, cont.contact_phone, cont_ba.address_line1, cont_ba.address_line2, 
                                                cont_ba.area_subdistrict as area, cont_ba.area_district as dsitrict, cont_ba.area_city as city, cont_ba.add_codepos as postalcode, 
                                                cont_ba.area_province as province, cont_ba.area_country as country,
                                                cont_ba.city_id, cont_ba.area_id, cont_ba.country_id
                                            FROM tb_datarecord b
                                            INNER JOIN tb_contact cont ON b.contact_id=cont.id
                                            INNER JOIN tb_address cont_ba ON cont.address_id=cont_ba.id 
                                            WHERE b.user_id=? AND b.data_type='billing'`, [user.id]);
                let billing_data = [];
                if (result[0] && result[0].length>0) { billing_data = result[0] }
    
                result = await query(`SELECT  b.id, b.is_default, cont.contact_firstname, cont.contact_name, cont.contact_phone, cont_ba.address_line1, cont_ba.address_line2, 
                                    cont_ba.area_subdistrict as area, cont_ba.area_district as dsitrict, cont_ba.area_city as city, cont_ba.add_codepos as postalcode, 
                                    cont_ba.area_province as province, cont_ba.area_country as country, 
                                    cont_ba.city_id, cont_ba.area_id, cont_ba.country_id
                                FROM tb_datarecord b
                                INNER JOIN tb_contact cont ON b.contact_id=cont.id
                                INNER JOIN tb_address cont_ba ON cont.address_id=cont_ba.id 
                                WHERE b.user_id=? AND b.data_type='shipping'`, [user.id]);
                let shipping_data = [];
                if (result[0] && result[0].length>0) { shipping_data = result[0] }
    
                result = await query(`SELECT cu.id, u.user_firstname, u.user_name, u.user_email, u.user_phone                        
                                            FROM tb_user u INNER JOIN tb_customeruser cu ON cu.user_id=u.id
                                            WHERE u.id=?`, [user.id]);

                const reviewResult = await query(`select tp.id as review_id, 
                                    tor.order_number, tpro.product_title title,  
                                    tpig.image_path, tprod.detail_shortdesc sort_desc, tprod.detail_longdesc long_desc
                                    from tb_customeruser tc
                                    join tb_orders tor on (tor.customer_id=tc.id and tc.user_id=?) 
                                    join tb_orderitems toi on (toi.order_id = tor.id) 
                                    join tb_catalog cat on (cat.id = toi.catalog_id) 
                                    join tb_product tpro on (tpro.id = cat.product_id) 
                                    join tb_productdetail tprod on (tprod.product_id=tpro.id) 
                                    join tb_productimages tpig on (tpig.product_id=tpro.id) 
                                    join tb_productreviewreq tp on (tp.item_id = toi.id and req_status in ('new','read'))`, [user_id]);
                const product_review_req = reviewResult ? reviewResult : [];

                return resolve({
                  status: "ok",
                  data: {
                    id: result[0][0].id,
                    user_data: result[0][0],
                    shipping_data: shipping_data,
                    billing_data: billing_data,
                    product_review_req: product_review_req
                  }
                });
    
            } catch (err){
                return reject(err);
            }
        })
    }
}; 