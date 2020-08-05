"use strict"

const _ = require("lodash");
const BadRequestError = require('../../models/errors/BadRequest');
const logger = require('../../config').logger.instance;

module.exports =  (payload, conn) => {
    let {store_id, time_zone, time_span, order_state} = payload;
    return new Promise(async(resolve, reject)=>{
        console.log('bis dahin', payload);

        if (_.isUndefined(time_span)){
            time_span = "week";
        }

        try {
            console.log('bis dahin', time_span);
            if (_.isUndefined(time_zone)){
                time_zone = '+07:00'
            }

            await conn.query(`SET sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))`)
            let pSql = "";

            switch (time_span){
                case "week":
                    pSql = `SELECT dayname(convert_tz(o.created_at, "+00:00", ?)) AS sales_day,
                                    SUM(o.order_total) AS total_amount,
                                    COUNT(o.id) AS total_order
                                FROM tb_orders o
                                INNER JOIN tb_storeorders st ON o.id=st.order_id
                                WHERE st.store_id = ? AND o.created_at >= DATE(convert_tz(NOW(), ?, "+00:00") - INTERVAL 6 DAY)
                                        AND o.order_state in ${order_state}
                                GROUP BY DATE(convert_tz(o.created_at, "+00:00", ?))
                                ORDER BY DATE(convert_tz(o.created_at, "+00:00", ?));`;
                    break;
                default:
                    pSql = `SELECT dayname(convert_tz(o.created_at, "+00:00", ?)) AS sales_day,
                                    SUM(o.order_total) AS total_amount,
                                    COUNT(o.id) AS total_order
                                FROM tb_orders o
                                INNER JOIN tb_storeorders st ON o.id=st.order_id
                                WHERE st.store_id = ? AND o.created_at >= DATE(convert_tz(NOW(), ?, "+00:00") - INTERVAL 6 DAY)
                                        AND o.order_state in ${order_state}
                                GROUP BY DATE(convert_tz(o.created_at, "+00:00", ?))
                                ORDER BY DATE(convert_tz(o.created_at, "+00:00", ?));`;
            }

            let results = await conn.query(pSql, [time_zone, store_id, time_zone, time_zone, time_zone]);
            return resolve(results[0]);
        } catch (err){
            logger.log({level: "warn", message: `Error in /libs/seller/graphsummary`})
            return reject(err);
        }
    })
}