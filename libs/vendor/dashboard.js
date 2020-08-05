"use strict";

const _ = require('lodash');
const lastSoldItems = require("./lastsolditems");
const orderSummary = require("./ordersummary");
const graphSummary = require("./graphsummary");
const allCommissions = require("./commissions");

module.exports = {
    get: (fastify, request) => {
        const { mysql } = fastify;
        const {user, query, headers} = request;
        const order_state = '("new", "confirmed", "on_process", "ready_to_pickup", "sent", "delivered", "completed")';
        return new Promise (async(resolve, reject)=>{
            const db = await mysql.getConnection();
            try {
                const {timezone} = query;
                let {solditems_limit, graph_timespan} = query;
                if (_.isUndefined(solditems_limit) || _.isNull(solditems_limit)){
                    solditems_limit = 10            
                } else {
                    solditems_limit = Number(solditems_limit);
                    if (solditems_limit<1){
                        solditems_limit=1;
                    }
                }

                if (_.isUndefined(graph_timespan) || _.isNull(graph_timespan)){
                    graph_timespan = "week"            
                } 

                // get last sold items
                const sold_items = await lastSoldItems({vendor_id: user.vendor.id, limit: solditems_limit, order_state}, db);
                const order_summary = await orderSummary({vendor_id: user.vendor.id}, db);
                const graph_summary = await graphSummary({vendor_id: user.vendor.id, time_zone: timezone,
                                                time_span: graph_timespan, order_state}, db);
                const commissions = await allCommissions({vendor_id: user.vendor.id}, db);
                db.release();
                return resolve({
                    lastItems: sold_items, 
                    orderSummary: order_summary, 
                    graphSummary: graph_summary, 
                    commissions: commissions});
            } catch (err){
                db.release();
                return reject(err);
            }
        })
    }
}; 