/*
 * @Author: toan.nguyen
 * @Date:   2016-09-14 10:17:31
 * @Last modified by:   nhutdev
 * @Last modified time: 2017-03-23T22:07:56+07:00
 */

'use strict';

const Hoek = require('hoek');
const helpers = require('node-helpers');
const BPromise = require('bluebird');
const pluralize = require('pluralize');
const PaginationModel = helpers.models.Pagination;
const PagingQuery = helpers.models.PagingQuery;

class Controller {

  /**
   * Constructor, set default data
   */
  constructor(data) {
    Hoek.assert(data, 'Input data must not be null');
    Hoek.assert(data.storeName, 'Store name must not be empty');
    Hoek.assert(data.schemas, 'Schema must not be empty');

    // this._profileStoreName = data.profileStoreName;
    this._storeName = data.storeName;
    this._schemas = data.schemas;
    this._checkOwner = data.checkOwner || false;
    this._userKey = data.userKey || 'userId';
    this._defaultPageSize = data.pageSize || helpers.Const.defaultPageSize;
    this._dataKey = data.dataKey ? data.dataKey : helpers.Stringer.pascalToCamelCase(this._storeName);
    this._dataKeyPlural = data.dataKeyPlural || pluralize.plural(this._dataKey);
    this._filterStatus = data.filterStatus || ['ACTIVE'];

    // if (data.actions ? data.actions.list : false) {
    //   this._filterStatus = data.actions.list.beforeFilter;
    // }

    // if (typeof this._filterStatus === 'undefined') {
    //   this._filterStatus = true;
    // }
  }

  /**
   * Get model store from store name
   *
   * @param  {Object} request API request data
   *
   * @return {ThriftDataAccess}
   */
  getStore(request) {
    return request.dataStore.getStore(this._storeName);
  }

  /**
   * Add default params before filter
   *
   * @param  {Object} request The request object is created internally
   *                           for each incoming request
   * @param  {Object} params  Params data
   *
   * @return {Object}         Output params
   */
  beforeFilter(request, params) {
    let credentials = request.auth.credentials;

    if (!params.filter) {
      params.filter = {};
    }

    if (!helpers.Array.isEmpty(this._filterStatus) && !params.filter.status) {
      let status = [];
      this._filterStatus.forEach((sKey) => {
        status.push(helpers.Const.STATUS[sKey]);
      });
      params.filter.status = status.join(',');
    }

    if (this._checkOwner && !params.filter[this._userKey] && credentials) {
      let profile = credentials.profile;
      if (profile) {
        params.filter[this._userKey] = profile.uid;
      }
    }

    return params;
  }

  /**
   * Common response list API data
   *
   * @param  {Request} request The request object is created internally
   *                           for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface
   *                         to return control to the framework and a response generator.
   *
   * @param  {Array} results  Result data as list
   */
  responseList(request, reply, results, params) {
    let models = [];
    results.data.forEach((element) => {
      models.push(element.responseObject({
        schema: this._schemas.responseItem
      }));
    });
    let pagination = new PaginationModel(results, params),
      message = `Get list ${this._dataKeyPlural} successfully `,
      data = {};

    data[this._dataKeyPlural] = models;

    reply(pagination.response(request, {
      meta: {
        message: message
      },
      data: data
    }));

  }

  /**
   * List models with pagination
   *
   * @param  {Request} request The request object is created internally
   *                           for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface
   *                         to return control to the framework and a response generator.
   */
  list(request, reply) {

    let self = this,
      dataStore = this.getStore(request),
      model = dataStore.createModel(),
      params = helpers.Uri.parseQuery(request.query),
      filterParams = this.beforeFilter(request, params) || params,
      searchModel = model.toThriftQuery(filterParams.filter),
      queryForm = new PagingQuery(params);
    queryForm.pageSize = params.pageSize ? parseInt(params.pageSize) : this._defaultPageSize;

    return dataStore.filterPagination(searchModel, queryForm).then((results) => {

      if (self.afterFilter) {
        let prom = this.afterFilter(request, reply, results, params);
        if (prom ? !!prom.then : false) {
          prom.then(results => {
            self.responseList(request, reply, results, params);
          });
        } else {
          self.responseList(request, reply, results, params);
        }
      } else {
        self.responseList(request, reply, results, params);
      }

    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', self._dataKey, 'list']
      });
    });
  }

  /**
   * Get model by uid, response error if not existed
   *
   * @param  {Request} request The request object is created internally
   *                           for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface
   *                         to return control to the framework and a response generator.
   * @param  {mixed} uid     Primary key
   *
   * @return {Promise}         Returned model
   */
  getModel(request, reply, uid) {
    let self = this,
      store = this.getStore(request),
      userId = null;
    if (this._checkOwner) {
      userId = request.auth.credentials.userId;
    }
    return new BPromise((resolve, reject) => {
      return store.getOneByPk(uid).then((model) => {
        if (this._checkOwner ? model[this._userKey] != userId : false) {
          let errors = helpers.Error.translate({
            code: '204',
            source: 'uid'
          });
          return reply(errors).code(403);
        }
        return resolve(model);
      }).catch(e => {
        helpers.HAPI.replyError(request, reply, e, {
          log: ['error', self._dataKey, 'get']
        });

        return reject(e);
      });
    });
  }

  /**
   * Get one model detail
   *
   * @param  {Request} request The request object is created internally for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface to return control to the framework and a response generator.
   */
  detail(request, reply) {
    let self = this;

    return this.getModel(request, reply, request.params.uid).then((model) => {

      let respFunc = (model) => {
        let message = `Get ${self._dataKey} successfully `,
          data = {};
        data[self._dataKey] = model.responseObject({
          schema: this._schemas.response
        });
        let responseObject = helpers.Json.response(request, {
          meta: {
            message: message
          },
          data: data
        });

        return reply(responseObject);
      };

      if (this.afterDetail) {
        let prom = this.afterDetail(request, reply, model);

        if (prom.then) {
          prom.then(result => {
            respFunc(result);
          });
        } else {
          respFunc(model);
        }

      } else {
        respFunc(model);
      }

    });
  }

  /**
   * Creates model from request data
   *
   * @param  {Request} request The request object is created internally for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface to return control to the framework and a response generator.
   */
  create(request, reply) {
    let self = this,
      dataStore = self.getStore(request);

    return dataStore.insertOne(request.payload.data).then(result => {
      let message = `Create ${self._dataKey} successfully `,
        data = {};
      data[self._dataKey] = result.responseObject({
        schema: this._schemas.response
      });
      let responseObject = helpers.Json.response(request, {
        meta: {
          message: message
        },
        data: data
      });

      return reply(responseObject);
    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', self._dataKey, 'delete']
      });
    });
  }

  _commonUpdate(request, reply, modelForm) {

    let self = this,
      dataStore = self.getStore(request);

    return dataStore.updateOne(modelForm).then((result) => {
      let message = `Update ${self._dataKey} successfully `,
        dataModel = dataStore.createModel(result),
        data = {};
      let respFunc = (dataModel) => {

        data[self._dataKey] = dataModel.responseObject({
          schema: this._schemas.response
        });

        let responseObject = helpers.Json.response(request, {
          meta: {
            message: message
          },
          data: data
        });

        return reply(responseObject);

      };

      if (this.afterUpdate) {
        let prom = this.afterUpdate(request, reply, dataModel);

        if (prom.then) {
          prom.then(result => {
            respFunc(result);
          });
        } else {
          respFunc(dataModel);
        }

      } else {
        respFunc(dataModel);
      }

    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', self._dataKey, 'update']
      });
    });
  }

  update(request, reply) {
    let self = this,
      dataStore = self.getStore(request),
      form = request.payload.data,
      modelForm = dataStore.createModel(form);

    if (request.params) {
      modelForm.uid = request.params.uid;
    }

    return this.getModel(request, reply, request.params.uid).then((model) => {
      if (this.beforeUpdate) {
        let prom = this.beforeUpdate(request, model, modelForm);

        if (prom ? prom.then : false) {
          return prom.then(() => {
            return this._commonUpdate(request, reply, modelForm);
          }).catch(err => {
            return helpers.HAPI.replyError(request, reply, err, {
              log: ['error', self._dataKey, 'update']
            });
          });
        }
      }

      return this._commonUpdate(request, reply, modelForm);
    });
  }

  delete(request, reply) {
    let self = this,
      dataStore = self.getStore(request),
      form = {
        id: request.params.id,
        status: helpers.Const.status.DELETED
      },
      modelUpdate = dataStore.createModel(form);

    return dataStore.updateOne(modelUpdate).then(result => {
      let message = `Delete ${self._dataKey} successfully `,
        dataModel = dataStore.createModel(result),
        data = {};
      data[self._dataKey] = dataModel.responseObject({
        schema: this._schemas.response
      });
      let responseObject = helpers.Json.response(request, {
        meta: {
          message: message
        },
        data: data
      });

      return reply(responseObject);
    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', self._dataKey, 'delete']
      });
    });
  }
}

module.exports = Controller;
