/*
 * @Author: toan.nguyen
 * @Date:   2016-12-02 11:49:55
 * @Last modified by:   nhutdev
 * @Last modified time: 2017-03-23T22:07:25+07:00
 */

'use strict';

const Joi = require('joi');
const Hoek = require('hoek');
const helpers = require('node-helpers');
const pluralize = require('pluralize');
const SchemaGenerator = helpers.SchemaGenerator;
const BaseController = require('./controller');

const SWAGGER_HAPI = {
  responses: {
    '400': helpers.schemas.errors.badRequest,
    '403': helpers.schemas.errors.forbidden,
    '404': helpers.schemas.errors.notFound,
    '500': helpers.schemas.errors.internalServer,
  },
};

class NodeRoute {

  /**
   * Constructor, set required data
   *
   * @param  {Object} options Global route options
   */
  constructor(options) {
    Hoek.assert(options, 'Input options must not be empty');
    Hoek.assert(options.basePath, 'Route path is required');

    options = Hoek.applyToDefaults({
      hasSwagger: true,
      autoController: false
    }, options);

    this._routes = [];
    this._hasSwagger = options.hasSwagger;
    this._controller = options.controller;
    this._authName = options.authName;
    this._defaultHeaders = options.defaultHeaders;

    if (!this._defaultHeaders) {
      switch (options.authType) {
        case 'basic_token':
          this._defaultHeaders = helpers.schemas.authHeader.basic;
          break;
        case 'oauth_bearer':
          this._defaultHeaders = helpers.schemas.authHeader.bearer;
          break;
        case 'oauth_bearer_app':
          this._defaultHeaders = helpers.schemas.authHeader.bearerApp;
          break;
      }
    }
    this._basePath = options.basePath;
    this._schemas = options.schemas;
    this._dataKey = options.dataKey;
    this._corsDisable = options.corsDisable || true;

    if (!this._dataKey && options.storeName) {
      this._dataKey = helpers.Stringer.pascalToCamelCase(options.storeName);
      options.dataKey = this._dataKey;
    }

    if (options.dataKeyPlural || this._dataKey) {
      this._dataKeyPlural = options.dataKeyPlural || pluralize.plural(this._dataKey);
      options.dataKeyPlural = this._dataKeyPlural;
    }

    if (!this._controller) {
      if (options.controllerClass) {
        this._controller = new options.controllerClass(options);
      }
    }
    this._controller = this._controller || new BaseController(options);

    let isEmptyActions = helpers.Array.isEmpty(options.actions);
    if (options.autoController || !isEmptyActions) {
      Hoek.assert(options.schemas, 'Schemas of route must not be empty');
      Hoek.assert(options.storeName, 'Store name must not be empty');
      // Hoek.assert(options.dataKey, 'Model data key of route must not be empty');


      if (isEmptyActions) {
        options.actions = ['list', 'detail', 'create', 'update', 'delete'];
      }

      if (options.actions.indexOf('list') !== -1) {
        this.addListRoute();
      }

      if (options.actions.indexOf('detail') !== -1) {
        this.addDetailRoute();
      }

      if (options.actions.indexOf('create') !== -1) {
        this.addCreateRoute();
      }

      if (options.actions.indexOf('update') !== -1) {
        this.addUpdateRoute();
      }

      if (options.actions.indexOf('delete') !== -1) {
        this.addDeleteRoute();
      }
    }
  }

  /**
   * Adds route from options
   *
   * @param  {Object} options Route options
   *
   * @return {Object}       Output route options
   */
  addRoute(options) {
    options = this.createRoute(options);
    this._routes.push(options);
    return options;
  }

  /**
   * Creates route from options
   *
   * @param  {Object} options Route options
   *
   * @return {Object}       Output route options
   */
  createRoute(options) {
    Hoek.assert(options, 'Route config must not be empty');
    Hoek.assert(options.method, 'Route method must not be empty');
    Hoek.assert(options.path, 'Route path must not be empty');
    Hoek.assert(options.config, 'Route config must not be empty');
    Hoek.assert(options.config.handler, 'Route handler must not be empty');

    let controller = options.controller || this._controller;
    if (!options.config.tags) {
      options.config.tags = options.path.split('/').splice(1);
    }
    let handler = options.config.handler;

    options.config.handler = (request, reply) => {
      try {
        if (controller) {
          return handler.call(controller, request, reply);
        } else {
          return handler(request, reply);
        }
      } catch (e) {
        return helpers.HAPI.replyError(request, reply, e, {
          log: ['error'].concat(options.config.tags)
        });
      }
    };

    if (options.config.auth === undefined && this._authName) {
      options.config.auth = this._authName;
      options.config.validate = options.config.validate || {};

      if (!options.config.validate.headers) {
        options.config.validate.headers = this._defaultHeaders;
      }
    } else if (options.config.auth === false) {
      options.config.auth = undefined;
    }

    if (this._corsDisable) {
      options.config.cors = {
        origin: ['*'],
        additionalHeaders: ['cache-control', 'x-requested-with']
      };
    }

    if (!options.config.response) {
      options.config.response = {};
    }

    if (!options.config.response.schema) {
      options.config.response.schema = SchemaGenerator.basicResponse();
    }

    if (!options.config.plugins) {
      options.config.plugins = {};
    }

    if (!options.config.plugins['hapi-swagger'] && this._hasSwagger) {
      options.config.plugins['hapi-swagger'] = SWAGGER_HAPI;
    }
    delete options.controller;

    return options;
  }

  /**
   * Adds route get list
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  addListRoute(options) {
    options = this.createListRoute(options);
    this._routes.push(options);
    return options;
  }

  /**
   * Creates list routes
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  createListRoute(options) {

    options = options || {};

    options.method = options.method || 'GET';
    options.path = options.path || `/${this._basePath}`;
    options.config = options.config || {};
    options.config.handler = options.config.handler || this._controller.list;
    options.config.description = `Get list of ${this._basePath}, with pagination`;
    options.config.notes = 'Responses pagination data';
    options.config.tags = options.tags || ['api', this._basePath, 'list'];
    options.config.validate = options.config.validate || {};
    options.config.validate.query = options.config.validate.query || helpers.schemas.query.simplePagination;
    options.config.response = options.config.response || {};

    let schemas = {};
    schemas[this._dataKeyPlural] = Joi.array().items(this._schemas.responseItem);
    options.config.response.schema = SchemaGenerator.paginate(schemas);

    return this.createRoute(options);
  }

  /**
   * Adds route get detail
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  addDetailRoute(options) {
    options = this.createDetailRoute(options);
    this._routes.push(options);
    return options;
  }

  /**
   * Creates detail routes
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  createDetailRoute(options) {

    options = options || {};

    options.method = options.method || 'GET';
    options.path = options.path || `/${this._basePath}/{uid}`;
    options.config = options.config || {};
    options.config.handler = options.config.handler || this._controller.detail;
    options.config.description = `Get detail of one ${this._basePath} item`;
    options.config.notes = `Responses one item data`;
    options.config.tags = options.tags || ['api', this._basePath, 'detail'];

    options.config.validate = options.config.validate || {};
    options.config.validate.params = options.config.validate.params || {
      uid: Joi.string()
    };
    options.config.response = options.config.response || {};
    let schemas = {};
    schemas[this._dataKey] = this._schemas.response;

    options.config.response.schema = SchemaGenerator.basicResponse(schemas);
    return this.createRoute(options);
  }

  /**
   * Adds route create item
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  addCreateRoute(options) {
    options = this.createCreateRoute(options);
    this._routes.push(options);
    return options;
  }

  /**
   * Creates detail routes
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  createCreateRoute(options) {

    options = options || {};

    options.method = options.method || 'PUT';
    options.path = options.path || `/${this._basePath}`;
    options.config = options.config || {};
    options.config.handler = options.config.handler || this._controller.create;
    options.config.description = `Creates one ${this._basePath} item`;
    options.config.notes = `Responses successully created data`;
    options.config.tags = options.tags || ['api', this._basePath, 'create'];

    options.config.validate = options.config.validate || {};
    options.config.validate.payload = options.config.validate.payload || Joi.object({
      data: this._schemas.createRequest
    }).requiredKeys(['data']);
    options.config.response = options.config.response || {};

    let schemas = {};
    schemas[this._dataKey] = this._schemas.response;

    options.config.response.schema = SchemaGenerator.basicResponse(schemas);

    return this.createRoute(options);
  }

  /**
   * Adds route update item
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  addUpdateRoute(options) {
    options = this.createUpdateRoute(options);
    this._routes.push(options);
    return options;
  }

  /**
   * Creates detail routes
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  createUpdateRoute(options) {

    options = options || {};

    options.method = options.method || 'POST';
    options.path = options.path || `/${this._basePath}/{uid}`;
    options.config = options.config || {};
    options.config.handler = options.config.handler || this._controller.create;
    options.config.description = `Updates one ${this._basePath} item by primary key`;
    options.config.notes = `Responses successully updated data`;
    options.config.tags = options.tags || ['api', this._basePath, 'update'];

    options.config.validate = options.config.validate || {};
    options.config.validate.params = options.config.validate.params || {
      uid: Joi.string()
    };
    options.config.validate.payload = options.config.validate.payload || Joi.object({
      data: this._schemas.updateRequest
    }).requiredKeys(['data']);
    options.config.response = options.config.response || {};

    let schemas = {};
    schemas[this._dataKey] = this._schemas.response;

    options.config.response.schema = SchemaGenerator.basicResponse(schemas);

    return this.createRoute(options);
  }

  /**
   * Adds route delete item
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  addDeleteRoute(options) {
    options = this.createDeleteRoute(options);
    this._routes.push(options);
    return options;
  }

  /**
   * Creates delete routes
   *
   * @param  {Object} options Route option data
   *
   * @return {Object}         Output options
   */
  createDeleteRoute(options) {

    options = options || {};

    options.method = options.method || 'DELETE';
    options.path = options.path || `/${this._basePath}/{id}`;
    options.config = options.config || {};
    options.config.handler = options.config.handler || this._controller.create;
    options.config.description = `Deletes one ${this._basePath} item by primary key`;
    options.config.notes = `Responses successully updated data`;
    options.config.tags = options.tags || ['api', this._basePath, 'delete'];

    options.config.validate = options.config.validate || {};
    options.config.validate.params = options.config.validate.params || {
      id: Joi.number()
    };
    options.config.response = options.config.response || {};
    options.config.response.schema = SchemaGenerator.basicResponse();

    return this.createRoute(options);
  }

  /**
   * Returns HAPI routes list
   *
   * @return {Array}
   */
  get routes() {
    return this._routes;
  }

  /**
   * Returns controller handler
   *
   * @return {Controller}
   */
  get controller() {
    return this._controller;
  }
}

module.exports = NodeRoute;
