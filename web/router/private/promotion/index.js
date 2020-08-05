'use strict';

const schema = require('./schema');
const config = require('../../../../config');
const logger = config.logger.instance;

module.exports = (fastify, options, next) =>{ 

    fastify.addHook('preHandler', fastify.auth([fastify.authenticate]));
        
    fastify.post('/voucer', {schema: schema.postVoucherSchema}, async (request, reply) => {
        try {				
            return reply.status(200).send({status: 'ok'});
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            if (_.isUndefined(err.code)){
              err.code = 500;
            }
            return reply.status(err.code).send(err);
        }
    });

    fastify.put('/voucher', {schema: schema.updateVoucherSchema}, async (request, reply) => {
        try {				
            return reply.status(200).send({status: 'ok'});
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            if (_.isUndefined(err.code)){
              err.code = 500;
            }
            return reply.status(err.code).send(err);
        }
    });

    fastify.delete('/voucher/:id', {schema: schema.deleteVoucherSchema}, async (request, reply) => {
        try {				
            return reply.status(200).send({status: 'ok'});
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            if (_.isUndefined(err.code)){
              err.code = 500;
            }
            return reply.status(err.code).send(err);
        }
    });

    fastify.get('/voucher/:voucher_id', {schema: null}, async (request, reply) => {
        try {
          isUnAuthorize(request);
          const getVoucherDetail = require("../../../../libs/promotion/getVoucherDetail");
          const out = await getVoucherDetail(fastify, request);
          return reply.status(200).send(out);
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            if (_.isUndefined(err.code)){
              err.code = 500;
            }
            return reply.status(err.code).send(err);
        }
    });

    fastify.get('/voucher', async (request, reply) => {
        try {				
            return reply.status(200).send({status: 'ok'});
        } catch (err) {
            logger.log({level: 'warn', message: err.message});
            if (_.isUndefined(err.code)){
              err.code = 500;
            }
            return reply.status(err.code).send(err);
        }
    });



    next();
}




