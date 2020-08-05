'use strict';

const config = require('../config');
var logger = config.logger.instance;
const libs = require('../libs');
const swaggerOption = require('./schema')
/*
const apm = require('elastic-apm-node').start({
    serviceName: config.elasticapm.serviceName,
    secretToken: config.elasticapm.secretToken,
    serverUrl: config.elasticapm.serverUrl
});
*/
const fplugin = require('fastify-plugin')

const fastify = require('fastify')({ 
    logger: {
      level: config.logger_level,
      serializers: {
        res(res) {
          // The default
          return {
            statusCode: res.statusCode
          }
        },
        req(req) {
          return {
            method: req.method,
            url: req.host,
            path: req.path,
            parameters: req.parameters,
            // Including the headers in the log could be in violation 
            // of privacy laws, e.g. GDPR. You should use the "redact" option to
            // remove sensitive fields. It could also leak authentication data in
            // the logs.
            headers: req.headers
          };
        }
      }
    }})

fastify.register(require('fastify-swagger'), swaggerOption)
	.register(require('fastify-helmet'))
	.register(require('fastify-formbody'))
	.register(require('fastify-redis'), { host: config.redis.host, db: 0, namespace: "db0" })
	.register(require('fastify-redis'), { host: config.redis.host, db: 0, namespace: "db2" })
	.register(require('fastify-jwt'), {
		secret: config.jwt_encryption,
		sign: {
			expiresIn: config.jwt_expiration_admin
		}})
	.register(require('fastify-mysql'), {
					promise: true,
					type: "pool",
					host: config.database.db_host,
					user: config.database.db_user,
					password: config.database.db_password,
					database: config.database.db_name,
					multipleStatements: true,
					port: '3306',
					multipleStatements: true,
					connectTimeout: 15000,
					waitForConnections: true,
					connectionLimit: 1000,
					queueLimit: 5000})
  .register(fplugin(libs))
  .register(require('../libs/auth'))
  .register(require('fastify-auth'))
  .register(require('fastify-cookie'))
  .register(require('fastify-session'), {secret: config.keys.session})
	.register(require('./router/data'), { prefix: '/data' })
	.register(require('./router/users'), { prefix: '/users' })
	.register(require('./router/private/data'), { prefix: '/data/private' })
	.register(require('./router/private/users'), { prefix: '/users/private' })
	.register(require('./router/private/promotion'), { prefix: '/promotion/private' });

module.exports = fastify;