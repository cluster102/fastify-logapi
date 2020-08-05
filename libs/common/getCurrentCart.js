"use strict"

const _ = require('util');

module.exports = (payload, instance)=> {
    return new Promise(async(resolve, reject)=>{
        const {mysql, redis} = instance;
        let {session_id, cart_status, country_id} = payload;

        // In case country_id is not defined then set as default the country = Indonesia
        if (_.isUndefined(country_id) || _.isEmpty(country_id) || _.isNull(country_id)){
            country_id = 228;
        }

        try {
            let result = await mysql.query(
                `SELECT cart.id, cart.session_id, cart.channel_id,
                        p.vendor_id,cart.status, cd.item_id, 
                        cat.catalog_sku, cat.brand_sku,cat.product_title as product_name,
                        cat.catalog_option1, cat.catalog_option2, cat.catalog_option3,
                        cat.product_weight, cat.product_length, cat.product_width, cat.product_height,
                        cat.country_available, cat.preorder_state, 
                        cd.id as cartdetail_id, cd.item_count,cd.cart_id,
                        p.uuid as product_id, 
                        cat.uuid as catalog_uuid, cd.price_id, cd.discount_id 
                    FROM tb_cart cart INNER JOIN tb_cartdetail cd ON cd.cart_id=cart.id
                        LEFT JOIN tb_catalog cat ON cat.id=cd.item_id 
                        LEFT JOIN tb_product p ON p.id=cat.product_id
                    WHERE cart.session_id = ? and cart.status = ? `, 
                    [session_id, cart_status]
                );

            if (_.isUndefined(result[0]) || _.isNull(result[0]) || _.isEmpty(result[0])) {
                return resolve({items: []});
            }

            // check if price and discount still valid and get catalog details
            const hget = util.promisify(redis["db0"].hget).bind(redis["db0"]);				
            let carts = result[0];
            let cartItems =[];
            let conn = await mysql.newConnection();
            for (let i=0; i<carts.length; i++){
                let item = carts[i];
                result = await conn.query(`SELECT p.id as price_id,
                                            p.catalog_id,
                                            p.product_id, 
                                            p.channel_id,
                                            vc.channel_alias as channel_name, 
                                            p.price_msrp, 
                                            coalesce(pd.id,0) as discount_id, 
                                            coalesce(pd.discount_value,0) as discount_rate, 
                                            coalesce(pd.discount_type,0) as discount_type, 
                                            if (pd.discount_value > 0 && pd.discount_type=1, pd.discount_value*p.price_msrp/100,coalesce(pd.discount_value,0)) as discount_value,
                                            CASE pd.discount_type 
                                                WHEN 1 THEN p.price_msrp - (pd.discount_value * p.price_msrp / 100)
                                                WHEN 2 THEN p.price_msrp - pd.discount_value
                                                ELSE p.price_msrp
                                            END as selling_price,
                                            p.country_id,
                                            ar.area_name as country_name,
                                            p.currency_id,
                                            cr.currency_code,
                                            cr.currency_symbol
                                        FROM tb_price p 
                                        INNER JOIN tb_area ar ON ar.id=p.country_id
                                        LEFT JOIN tb_currency cr ON cr.id=p.currency_id
                                        LEFT JOIN tb_vendorchannel vc ON vc.id=p.channel_id 

                                        LEFT JOIN tb_productdiscount pd ON pd.price_id=p.id AND pd.valid_from<= NOW() and pd.valid_until>=NOW() 
                                        WHERE p.catalog_id=? AND p.is_valid=1 AND p.channel_id=?`, 
                                        [item.item_id, item.channel_id]);

                if (result && result.length>0){
                    // add only for selected country if not found just select the first result 
                    let price_data={};
                    let selectedPrice = result.filter(i=>i.country_id===country_id);
                    if (selectedPrice && selectedPrice.length>0){
                        price_data = selectedPrice[0];
                        await query(`UPDATE tb_cartdetail SET price_id=?, discount_id=? WHERE id=?`, [selectedPrice[0].price_id, selectedPrice[0].discount_id, item.cartdetail_id])
                    } else {
                        price_data = result[0];
                    }
                    // update cart with current dicount
                    await query(`UPDATE tb_cartdetail SET price_id=?, discount_id=? WHERE id=?`, [price_data.price_id, price_data.discount_id, item.cartdetail_id])

                    // get catalog details
                    result = await hget(CONFIG.redis.product_data, item.product_id);
                    let product_data = JSON.parse(result);
                    let catalog_data = product_data.catalog_list.filter(catalog=>catalog.catalog_id===item.item_id);
                    cartItems.push({
                        "item_id": item.catalog_uuid,
                        "id": item.product_id,
                        "catalog": catalog_data[0],
                        "price": price_data,
                        "image_url": product_data.thumbimg_url,
                        "qty": item.item_count
                    })
                } else {
                    return reject({
                        name: 'NotFoundError',
                        code: 404,
                        message: result
                    });
                }
            }
            
            return resolve({
                    "id": carts[0].id,
                    "session_id": carts[0].session_id,
                    "vendor_id": carts[0].vendor_id,
                    "channel_id": carts[0].channel_id,
                    "status": carts[0].status,
                    "items": cartItems
                });
        } catch (err) {
            return reject(err);
        }
    })
}