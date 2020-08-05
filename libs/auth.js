'use strict'
const util = require('util');
const config = require('../config')
const _ = require('lodash');
const fp = require('fastify-plugin')

module.exports = fp(async function(fastify, option){
    fastify.decorate('authenticate', function(request, replay, next) {
        const authorization = request.headers['x-access-token'] || request.headers['authorization'];
        const token = authorization;

        const { jwt, redis } = fastify;

        jwt.verify(token, (err, decoded) => {
            if (err) {
                // --- TO DO
                // --- check first in th redis.2 if decoded.id still exist
                //     and from and origin is the same
                //     if exist then replay with status message token expired, request new token
                //
                return replay.status(401).send({
                    //"code": 1,
                    "message": "Cannot proceed resource, No Token or Token expired",
                    "status": "fail",
                    "name": "UnauthorizedError"
                })
            }

            redis["db0"].hget(config.redis.user_data, decoded.key, (err, result)=>{
                if (err){
                    return replay.status(401).send({
                        //"code": 1,
                        "message": "Cannot proceed resource, No Token or Token expired",
                        "status": "fail",
                        "name": "UnauthorizedError"
                    })
                }
                request.user = JSON.parse(result);

                // save 
                redis["db2"].set(decoded.id, JSON.stringify({
                                                from: request.headers["x-forwarded-for"],
                                                origin: request.headers.origin,
                                                key: decoded.key                
                                            }), 'EX', 1800)

                next();
            })
        })
    })
});