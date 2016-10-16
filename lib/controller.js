/*
 * @Author: toan.nguyen
 * @Date:   2016-09-14 10:17:31
 * @Last Modified by:   toan.nguyen
 * @Last Modified time: 2016-10-09 16:09:02
 */

'use strict';

const Hoek = require('hoek');
const config = require('config');
const helpers = require('nexx-helpers');
const BPromise = require('bluebird');
const defaultPageSize = config.has('default.pageSize') ? config.get('default.pageSize') : 20;
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

    this._profileStoreName = data.profileStoreName;
    this._storeName = data.storeName;
    this._schemas = data.schemas;
    this._userKey = data.userKey || 'userId';
    this._defaultPageSize = data.pageSize || defaultPageSize;
    this._dataKey = data.dataKey ? data.dataKey : helpers.Stringer.pascalToCamelCase(this._storeName);
    this._dataKeyPlural = data.dataKeyPlural ? data.dataKeyPlural : (this._dataKey + 's');
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
   * Before filter hook
   *
   * @param  {Request} request The request object is created internally
   *                           for each incoming request
   * @param  {Object} params  Before filter params
   */
  beforeFilter(request, params) {
    let profile = request.auth.credentials.profile;

    if (!params.filter.status) {
      params.status = helpers.Const.status.ACTIVE.toString();
    }

    if (!params.filter[this._userKey]) {
      params.filter[this._userKey] = profile.uid;
    }
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
      params = helpers.Uri.parseQuery(request.query);

    if (this.beforeFilter) {
      this.beforeFilter(request, params);
    }

    let searchModel = model.toThriftQuery(params.filter),
      queryForm = new PagingQuery(params);

    queryForm.pageSize = params.pageSize ? parseInt(params.pageSize) : this._defaultPageSize;

    return dataStore.filterPagination(searchModel, queryForm).then((results) => {

      let models = [];
      results.data.forEach((element) => {
        models.push(element.responseObject({
          schema: self._schema.responseItem
        }));
      });

      let pagination = new PaginationModel(results, params),
        message = `Get list ${self._dataKeyPlural} successfully`,
        data = {};

      data[self._dataKeyPlural] = models;

      reply(pagination.response(request, {
        meta: {
          message: message
        },
        data: data
      }));
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
      store = this.getStore(request);

    return new BPromise((resolve, reject) => {
      return store.getOneByPk(uid).then((model) => {
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
   * Get one model with pagination
   *
   * @param  {Request} request The request object is created internally for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface to return control to the framework and a response generator.
   */
  detail(request, reply) {
    let self = this;

    return this.getModel(request, reply, request.params.uid).then((model) => {
      let message = `Get ${self._dataKey} successfully`,
        data = {};

      data[self._dataKey] = model.responseObject({
        schema: this._schema.response
      });

      let responseObject = helpers.Json.response(request, {
        meta: {
          message: message
        },
        data: data
      });

      return reply(responseObject);

    });
  }

  create(request, reply) {

  }

  update(request, reply) {

  }

  delete(request, reply) {

  }
}

module.exports = Controller;
