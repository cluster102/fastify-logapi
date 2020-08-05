"use strict"

const _ = require("lodash");
const config = require('../../config')
const logger = config.logger.instance;


module.exports =  (payload, conn) => {
    let {vendor_id, time_zone, time_span, order_state} = payload;
    return new Promise(async(resolve, reject)=>{
        if (_.isUndefined(time_zone)){
            return reject({code: 400, status: "failed", message: "timezone is missing", name: "BadRequest"});
        }

        if (_.isUndefined(time_span)){
            time_span = "week";
        }

        try {
            await conn.query(`SET sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))`)
            let pSql = "";

            switch (time_span){
                case "week":
                    pSql = `SET sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));
                            SELECT dayname(convert_tz(o.created_at, "+00:00", ?)) AS sales_day,
                                        SUM(o.order_total) AS total_amount,
                                        COUNT(o.id) AS total_order
                                    FROM tb_orders o
                                    INNER JOIN tb_vendorchannel vc ON o.channel_id=vc.id
                                    WHERE vc.vendor_id = ? AND o.created_at >= DATE(convert_tz(NOW(), ?, "+00:00") - INTERVAL 6 DAY)
                                            AND o.order_state in ${order_state}
                                    GROUP BY DATE(convert_tz(o.created_at, "+00:00", ?))
                                    ORDER BY DATE(convert_tz(o.created_at, "+00:00", ?));`;
                    break;
                default:
                    pSql = `SET sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''));
                            SELECT dayname(convert_tz(o.created_at, "+00:00", ?)) AS sales_day,
                                        SUM(o.order_total) AS total_amount,
                                        COUNT(o.id) AS total_order
                                    FROM tb_orders o
                                    INNER JOIN tb_vendorchannel vc ON o.channel_id=vc.id
                                    WHERE vc.vendor_id = ? AND o.created_at >= DATE(convert_tz(NOW(), ?, "+00:00") - INTERVAL 6 DAY)
                                            AND o.order_state in ${order_state}
                                    GROUP BY DATE(convert_tz(o.created_at, "+00:00", ?))
                                    ORDER BY DATE(convert_tz(o.created_at, "+00:00", ?));`;
            }
            
            let results = await conn.query(pSql, [time_zone, vendor_id, time_zone, time_zone, time_zone]);
            return resolve(results[0]);
    } catch (err){
        logger.log({level: "warn", message: `GraphSummary Error. Error: ${err.message}`})
        return reject(err);
        }
    })
}