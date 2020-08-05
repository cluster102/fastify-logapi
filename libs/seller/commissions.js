"use strict"

const util = require("util");
const _ = require("lodash");
const logger = require('../../config').logger.instance;


module.exports =  (payload, conn) => {
    const {id} = payload;
    return new Promise(async(resolve, reject)=>{

        try {
            const ORDER_STATE = '("new", "confirmed", "on_process", "ready_to_pickup", "sent", "delivered")';
            const PERCENTAGE = 0.01;
            let results = await conn.query(`select sel.id seller_id, seller_hashid,
                                    sum(case 
                                    when levpr.discount_type = 1 then 
                                        discount_value*${PERCENTAGE}*item_sellingprice*item_count
                                    else
                                        discount_value*item_count
                                    end)
                                    commission_will_received
                                    from tb_orders ord
                                    join tb_orderitems orit on (orit.order_id = ord.id) 
                                    join tb_storeorders stord on (stord.order_id = ord.id)
                                    join tb_seller sel on (sel.seller_hashid=stord.store_id)
                                    join tb_levelprice levpr on (sel.level_id = levpr.level_id and orit.price_id=levpr.price_id)
                                    join tb_sellervendor s on (sel.id=s.seller_id and s.user_id=?)
                                    where order_state in ${ORDER_STATE}
                                    group by sel.seller_hashid, sel.id`, [id]);
            if (_.isUndefined(results[0]) || _.isNull(results[0]) || _.isEmpty(results[0])) {
                return resolve ({
                    ewallet: 0,
                    commission: 0,
                    commission_will_received: 0
                })
            }

            let commission_will_received = results[0][0].commission_will_received;
            results = await conn.query(`select b.seller_id, ewallet, commission from
                                                    (select seller_id, amount ewallet from tb_ewallet a where seller_id=? order by id desc limit 1
                                                    ) b join (select seller_id, sum(commission_value) commission from tb_commission where seller_id=?
                                                    ) c on b.seller_id = c.seller_id`, [results[0][0].seller_id, results[0][0].seller_id]);

            if (_.isUndefined(results[0]) || _.isNull(results[0]) || _.isEmpty(results[0])) {
                return resolve ({
                    ewallet: 0,
                    commission: 0,
                    commission_will_received: 0
                })
            }

            return resolve ({
                ewallet: results[0][0].ewallet,
                commission: results[0][0].commission,
                commission_will_received: commission_will_received[0]
            })

        } catch (err){
            logger.log({level: "warn", message: `Error in /libs/seller/commissions`})
            return reject(err);
        }
    })
}