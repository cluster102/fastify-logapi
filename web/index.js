'use strict';

const config = require('../config');
const app = require('./server');
const logger = config.logger.instance;

const start = async () => {
    console.log(`Starting index ...`);

    try {
        logger.info(`Start --- listening on port ${config.server.port}`);
        await app.listen(config.server.port);
        logger.info(`web server listening on port ${config.server.port}`);
    } catch (err) {
//        logger.info(`web server listening on port ${config.server.port}`);
        //app.log(err);
        logger.log({level: 'warn', message: `Error happened during server start: ${err.message}`});
        process.exit(1);
    }
};

start();