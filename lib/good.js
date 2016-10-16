/*
 * @Author: toan.nguyen
 * @Date:   2016-09-06 10:53:41
* @Last modified by:   nhutdev
* @Last modified time: 2016-10-16T19:16:52+07:00
 */

'use strict';

const nodeBusiness = require('node-business'),
  Hoek = require('hoek'),
  colors = require('ansicolors'),
  config = require('config'),
  logger = nodeBusiness.logger;

let goodCfg = config.has('good') ? Hoek.clone(config.get('good')) : {};
goodCfg.includes = {
  request: ['headers', 'payload'],
  response: ['payload']
};
goodCfg.reporters = goodCfg.reporters || {};

goodCfg.reporters.bunyan = [{
  module: 'good-bunyan',
  args: [{
    response: '*',
    log: '*',
    error: '*',
    request: '*'
  }, {
    logger: logger,
    levels: {
      response: 'info'
    },
    formatters: {
      response: (payload) => {

        let statusCode = colors.green(payload.statusCode.toString());

        if (payload.statusCode >= 400) {
          statusCode = colors.red(payload.statusCode.toString());
        }

        let res = {
          instance: payload.instance,
          method: colors.green(payload.method.toUpperCase()),
          path: payload.path,
          statusCode: statusCode,
          responseTime: `${payload.responseTime}ms`,
          query: JSON.stringify(payload.query)
        };

        if (payload.headers) {
          res.headers = payload.headers;
        }

        if (payload.requestPayload) {
          res.requestPayload = payload.requestPayload;
        }

        if (payload.responsePayload) {
          res.responsePayload = payload.responsePayload;
        }

        return [res, '[response]'];
      }
    }
  }]
}];

module.exports = goodCfg;
