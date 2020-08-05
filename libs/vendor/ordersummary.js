"use strict"

const config = require('../../config')
const logger = config.logger.instance;

module.exports =  (payload, conn) => {
    const { vendor_id } = payload;
    return new Promise(async(resolve, reject)=>{
        try {
            let results = 
                await conn.query(`SELECT order_data.order_pending_qty, order_data.order_onprocess_qty, order_data.order_completed_qty, order_data.order_retourreq_qty 
                FROM ( SELECT
                    (SELECT COUNT(od1.id) FROM tb_orders od1 WHERE od1.channel_id=vc.id AND od1.order_state='waiting_payment') as order_pending_qty,
                    (SELECT COUNT(od2.id) FROM tb_orders od2 WHERE od2.channel_id=vc.id AND od2.order_state in ('new', 'confirmed','on_process','ready_to_pickup', 'sent')) as order_onprocess_qty,
                    (SELECT COUNT(od3.id) FROM tb_orders od3 WHERE od3.channel_id=vc.id AND od3.order_state='completed') as order_completed_qty,
                    (SELECT COUNT(od4.id) FROM tb_orders od4 WHERE od4.channel_id=vc.id AND od4.order_state='on_retour_request') as order_retourreq_qty
                    FROM tb_vendorchannel vc 
                    WHERE vc.vendor_id=?
                ) order_data`, [vendor_id]);
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
            logger.log({level: "warn", message: `OrderSummary Error. Error: ${err.message}`})
            return reject(err);
        }
    })
}