"use strict";

const config = require('../../config');
const logger = config.logger.instance;
const _ = require('lodash');
const lastSoldItems = require("./lastsolditems");
const orderSummary = require("./ordersummary");
const graphSummary = require("./graphsummary");
const allCommissions = require("./commissions");

module.exports = {
    get: (fastify, request) => {
        return new Promise (async(resolve, reject)=>{
            const { mysql } = fastify;
            const { user, query, headers} = request;
            const { timezone } = request.headers;
            let { solditems_limit, graph_timespan } = request.query;
            const order_state = '("new", "confirmed", "on_process", "ready_to_pickup", "sent", "delivered", "completed")';
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

            try {
                // get last sold items
                const db = await mysql.getConnection();
                const sold_items = await lastSoldItems({store_id: user.seller.hash_id, limit: solditems_limit, order_state}, db);
                const order_summary = await orderSummary({store_id: user.seller.hash_id}, db);

                const graph_summary = await graphSummary({store_id: user.seller.hash_id, 
                                                            time_zone: timezone, 
                                                            time_span: graph_timespan, 
                                                            order_state}, 
                                                            db);
                console.log(graph_summary);
                const commissions = await allCommissions({id: user.id}, db);
                console.log(commissions);
                db.destroy();
                return resolve({
                    lastItems: sold_items, 
                    orderSummary: order_summary, 
                    graphSummary: graph_summary, 
                    commissions: commissions});
            } catch (err){
                logger.log({level: 'error', message: err.message});
                let code = 500
                if (!_.isUndefined(err.code)){
                    code = err.code;
                }

                let name = "InternalServerError";
                if (!_.isUndefined(err.code)){
                    name = err.name;
                }

                return reject({
                    code: code, 
                    message: err.message, 
                    name: name});
            }
        })
    }
}; 