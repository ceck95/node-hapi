/*
 * @Author: toan.nguyen
 * @Date:   2016-09-07 10:48:59
* @Last modified by:   nhutdev
* @Last modified time: 2016-11-12T09:39:09+07:00
 */

'use strict';

const Hapi = require('hapi');
const Path = require('path');
const config = require('config');
const Hoek = require('hoek');
const BPromise = require('bluebird');
const nodeBusiness = require('node-business');

const fs = BPromise.promisifyAll(require('fs'));
const helpers = require('node-helpers');
const Inert = require('inert');
const Vision = require('vision');
const goodConfig = require('./good');
const HapiSwagger = require('hapi-swagger');
const AuthManager = nodeBusiness.AuthManager;
const ProfileBusiness = nodeBusiness.business.Profile;
// const NotificationBusiness = nodeBusiness.business.Notification;
const ThriftManager = nodeBusiness.ThriftManager;

class NexxHAPIServer {

  /**
   * [constructor description]
   *
   * @param  {[type]} commonLib [description]
   * @param  {[type]} options [description]
   * @return {[type]}         [description]
   */
  constructor(commonLib, options) {
    options = options || {};
    if (!options.config) {
      options.config = commonLib.config;
    }

    this.options = options;
    this._registerModules = this.defaultRegisterModules();
    this._thriftManager = new ThriftManager(commonLib, options.config.thrift);
    this._translator = commonLib.helpers.language;
    this._errorManager = commonLib.helpers.error;
    if (options.config.user.openUser) {
      this._initAuthUser(options);
    }
    // this._initNotification(commonLib, options);
    this._init(options);
  }

  get server() {
    return this._server;
  }

  // _initNotification(commonLib, options) {
  //   if (options.config.notification) {
  //     let notificationManager = new NotificationBusiness(options.config.notification, commonLib.resources.default.notification, commonLib.helpers.language);
  //
  //     this._notificationManager = notificationManager;
  //   }
  // }

  _initAuthUser(options) {
    let userClass = options.config.user.className.split('.');
    this._thriftManager.userStore = this._thriftManager.getStore(userClass);
    this._userManager = new ProfileBusiness();
  }

  _init(options) {
    let self = this,
      server = new Hapi.Server();

    server.connection({
      host: options.config.server.host,
      port: options.config.server.port,
      routes: {
        validate: {
          options: {
            abortEarly: false,
          }
        }
      }
    });

    server.ext('onRequest', (request, reply) => {
      request.config = options.config;
      request.dataStore = self._thriftManager;
      if (this._notificationManager) {
        request.notificationManager = this._notificationManager;
      }

      request.userManager = this._userManager;
      request.errorManager = this._errorManager;
      request.translator = this._translator;
      request.common = {};

      for (let k in options.common) {
        if (k === 'config') {
          continue;
        }
        request.common[k] = options.common[k];
      }

      return reply.continue();
    });

    server.ext('onPreResponse', (request, reply) => {

      let response = request.response;

      if (response.isBoom) {
        if (response.data) {
          request.log(['debug', 'response', 'error'], response.data);
          response.output.payload = helpers.Error.translate(response.data);
          return reply.continue();
        }

        switch (response.output.statusCode) {
          case 404:
            if (response.output.payload.statusCode === 404) {
              response.output.statusCode = 501;
              response.output.payload = helpers.Error.translate({
                message: 'Not implemented',
                uiMessage: 'API service has not been implemented'
              });
            }

            break;
          case 401:
            if (response.output.payload.attributes) {
              if (response.output.payload.attributes.credentials) {
                response.output.payload = response.output.payload.attributes.credentials;
              }
            } else {
              response.output.payload = helpers.Error.translate({
                message: response.output.payload.message,
                uiMessage: 'Unauthorized'
              });
            }

            break;
          case 400:
            if (!response.output.payload.errors) {
              response.output.payload = helpers.Error.translate({
                message: response.output.payload.error,
                uiMessage: response.output.payload.message
              });
            }

            break;
          case 500:
            response.output.payload = helpers.Error.translate({
              code: '1000'
            });

            break;
          default:
            response.output.payload = helpers.Error.translate({
              message: response.output.payload.error,
              uiMessage: response.output.payload.message
            });
            break;
        }
      }
      return reply.continue();
    });

    this._server = server;
  }

  defaultRegisterModules() {

    let swaggerCfg = Hoek.clone(config.get('swagger'));

    return [Inert,
      Vision, {
        register: require('good'),
        options: goodConfig
      }, {
        register: HapiSwagger,
        options: {
          info: {
            title: swaggerCfg.info.title,
            version: swaggerCfg.info.version,
            contact: {
              name: swaggerCfg.info.contact.name,
              email: swaggerCfg.info.contact.email
            },
          },
          jsonEditor: swaggerCfg.jsonEditor,
          documentationPath: swaggerCfg.documentationPath,
          jsonPath: swaggerCfg.jsonPath,
        },
      },

    ];
  }

  buildRoutes() {
    let self = this;

    return new BPromise((resolve) => {
      self.routes = [];

      let routeDir = 'routes',
        routePath = Path.join(process.cwd(), routeDir);

      fs.readdirAsync(routePath).then(files => {
        files.forEach((element) => {
          let requiredPath = Path.join(process.cwd(), routeDir, element),
            routes = require(requiredPath);
          self.routes = self.routes.concat(routes);
        });
      });

      return resolve(self.routes);
    }).catch(e => {
      throw e;
    });

  }

  run() {
    let self = this,
      server = this._server,
      authConfig = this.options.config.user.authorization,
      authManager = new AuthManager(authConfig);

    // add auth schemes into server
    this._registerModules = this._registerModules.concat(authManager.schemes);

    self._server.register(self._registerModules, (err) => {
      if (err) {
        console.error(err);
        return;
      }
      authManager.register(self._server);

      return this.buildRoutes().then(() => {

        server.start((err) => {
          console.log('Server environment:', process.env.NODE_ENV || 'Development');

          if (err) {
            console.error(err);
          } else {
            console.log('Server running at:', server.info.uri);
          }
        });

        self._server.route(self.routes);
      }).catch((e) => {
        console.error(e);
      });
    });


  }
}

module.exports = NexxHAPIServer;
