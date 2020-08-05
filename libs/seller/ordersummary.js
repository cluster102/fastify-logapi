"use strict"

const logger = require('../../config').logger.instance;

module.exports =  (payload, conn) => {
    const {store_id} = payload;
    return new Promise(async(resolve, reject)=>{
        try {    
            let results = 
                await conn.query(`SELECT count(od1.id) as order_pending_qty, count(od2.id) as order_onprocess_qty, COUNT(od3.id) as order_completed_qty, COUNT(od4.id) as order_retourreq_qty
                                    FROM tb_storeorders st 
                                    LEFT JOIN tb_orders od1 ON od1.id=st.order_id AND od1.order_state='waiting_payment'
                                    LEFT JOIN tb_orders od2 ON od2.id=st.order_id AND od2.order_state in ('new', 'confirmed','on_process','ready_to_pickup', 'sent', 'delivered')
                                    LEFT JOIN tb_orders od3 ON od3.id=st.order_id AND od3.order_state='completed'
                                    LEFT JOIN tb_orders od4 ON od4.id=st.order_id AND od4.order_state='on_retour_request'
                                WHERE st.store_id=?`, [store_id]);
            let response = {
                order_pending_qty: 0,
                order_onprocess_qty: 0,
                order_completed_qty: 0,
                order_retourreq_qty: 0
            };

            if (results[0].length>0){
                response = results[0][0];
            } 
            return resolve(response);

        } catch (err){
            logger.log({level: "warn", message: `Error in /libs/seller/ordersummary`})
            return reject(err);
        }
    })
}