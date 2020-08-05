"use strict";

const db = require('../db');
const util = require('util');
const _ = require('lodash');

const order_list = (req) => {
    let {page, limit} = req.query;
    if (_.isUndefined(page) || _.isNull(page)) {
      page = 0;
    } else {
      page = Number(page) - 1;
      if (page <= 0) {
        page = 0;
      }
    }
    if (_.isUndefined(limit) || _.isNull(limit)) {
      limit = 500;
    } else {
      limit = Number(limit);
    }

    return new Promise(async(resolve, reject)=> {

        try {
            const conn = await db.newConnection();
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
                            WHERE cu.user_id=? order by o.created_at desc LIMIT ${page}, ${limit}`;
            let result = await query(pSql, [req.user.id]);
            conn.destroy();
            return resolve({status: "ok", 
                            data: result});
        } catch(err){
            return reject(err);
        }
    })

    

}

module.exports = order_list;
