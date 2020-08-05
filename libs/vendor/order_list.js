"use strict";

const db = require('../db');
const util = require('util');
const _ = require('lodash');

const order_list = (req) => {
    let {page, limit} = req.query;
    let offset = 0;

    if (_.isUndefined(limit) || _.isNull(limit)) {
      limit = 500;
    } else {
      limit = Number(limit);
    }

    if (_.isUndefined(page) || _.isNull(page)) {
      page = 1;
      offset = 0;
    } else {
      offset = (Number(page) - 1)*limit;
      if (offset <= 0) {
        offset = 0;
      }
    }

    return new Promise(async(resolve, reject)=> {
      const ORDER_STATE = `('waiting_payment', 'new', 'confirmed','on_process','ready_to_pickup', 'sent', 'delivered', 'completed')`;
      const conn = await db.newConnection();
        try {
            const query = util.promisify(conn.query).bind(conn);
            let pSql = `SELECT o.order_number, o.order_total, o.created_at, cr.currency_code, u.user_name, 
                                ship_ad.address_line1, ship_ad.address_line2,
                                ship_ad.area_city, ship_ad.area_province as province, ship_ad.area_country as country, 
                                o.order_state as status
                            FROM tb_orders o 
                            INNER JOIN tb_currency cr ON cr.id=o.currency_id
                            INNER JOIN tb_datarecord ship_dt ON o.shippment_data=ship_dt.id 
                            INNER JOIN tb_contact ship_ct ON ship_dt.contact_id=ship_ct.id 
                            INNER JOIN tb_address ship_ad ON ship_ct.address_id=ship_ad.id
                            INNER JOIN tb_customeruser cu ON o.customer_id=cu.id
                            INNER JOIN tb_user u ON cu.user_id=u.id
                            INNER JOIN tb_vendorchannel vc ON o.channel_id=vc.id
                            WHERE vc.vendor_id=? AND o.order_state IN ${ORDER_STATE} order by o.created_at desc LIMIT ?, ?`;
            let result = await query(pSql, [req.user.vendor.id, offset, limit]);
            conn.destroy();
            return resolve({status: "ok",
                            id: req.user.vendor.hash_id,
                            page: page,
                            limit: limit, 
                            data: result});
        } catch(err){
            return reject(err);
        }
    })
}

module.exports = order_list;
