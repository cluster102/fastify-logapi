'use strict';

const environment = require('./components/environment');
//const sap = require('./components/sap');
const logger = require('./components/logger');
const server = require('./components/server');
const database = require('./components/database');
const redis = require('./components/redis');
const bull = require('./components/bull');
const images = require('./components/images');

module.exports = Object.assign({}, environment, logger, server, database, redis, bull, images);
