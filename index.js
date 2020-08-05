/* eslint-disable global-require */

'use strict';

const type = process.env.PROCESS_TYPE;

console.log(`Starting '${type}' process`, { pid: process.pid });

global.my_directory = __dirname;


if (type === 'web') {
    console.log(`Starting ...`);
    require('./web');
} else if (type === 'health-monitoring') { 
    require('./worker/health_monitoring');
} else {
    throw new Error(`
        ${type} is an unsupported process type.
        Use one of: 'web', 'health_monitoring' !
    `);
}