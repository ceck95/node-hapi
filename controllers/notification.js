/*
 * @Author: Chien Pham
 * @Date:   2016-06-28 16:59:55
 * @Last Modified by:   toan.nguyen
 * @Last Modified time: 2016-10-10 17:05:16
 */

'use strict';

const config = require('config');
const helpers = require('nexx-helpers');

const PaginationModel = helpers.models.Pagination;
const NotificationFilter = helpers.forms.NotificationFilter;
const PagingQuery = helpers.models.PagingQuery;

const notificationSchemas = helpers.schemas.notification;

const defaultPageSize = config.has('default.pageSize') ? config.get('default.pageSize') : 20;

class NotificationController {


  /**
   * Get list notification of customer
   *
   * @param  {Object} request Request list notification with paging
   * @param  {Object} reply   Response object
   */
  list(request, reply) {

    let userId = request.auth.credentials.userId;
    request.log(['debug', 'customer-notification', 'get-list'], 'Begins getting notification list from customer ' + userId);

    let searchModel = new NotificationFilter(),
      params = helpers.Uri.parseQuery(request.query),
      queryForm = new PagingQuery(params);

    if (params.filter) {
      helpers.Model.assignCamelCase(searchModel, params.filter);
    }

    searchModel.userId = userId;

    queryForm.pageSize = params.pageSize ? parseInt(params.pageSize) : defaultPageSize;

    let notificationStore = request.notificationManager.getStore(request);
    request.log(['debug', 'notification', 'list'], searchModel);

    notificationStore.filterPagination(searchModel, queryForm).then(result => {
      request.log(['debug', 'customer-notification', 'get-list'], result.pagination);

      let models = [];
      result.data.forEach((element) => {
        let model = element.responseObject({
          schema: notificationSchemas.responseItem,
          userId: userId
        });

        switch (element.type) {
        case 'news_raw':
          model.message = null;
          break;
        default:
        }
        models.push(model);
      });

      notificationStore.markAllAsRead(searchModel.userId, searchModel.type).catch(err => {
        request.log(['error', 'customer-notification', 'get-list'], err);
      });

      let pagination = new PaginationModel(result, params);

      return reply(pagination.response(request, {
        meta: {
          message: 'Get list notifications successfully'
        },
        data: {
          notifications: models
        }
      }));
    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', 'customer', 'get']
      });
    });

  }

  /**
   * Delete notification
   * @param  {Request} request Request object
   * @param  {Reply} reply   Reply object of notification
   *
   */
  delete(request, reply) {

    request.log(['info', 'notification', 'delete', 'uid'], request.params.uid);
    let userId = request.auth.credentials.userId,
      notificationStore = request.notificationManager.getStore(request);

    notificationStore.deleteOneByUser(request.params.uid, userId).then(() => {
      let responseObject = helpers.Json.response(request, {
        meta: {
          message: 'Delete notification successfully'
        }
      });

      return reply(responseObject);
    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', 'notification', 'delete']
      });
    });
  }

  /**
   * Get trip detail of driver
   *
   * @param  {Object} request Request detail of trip
   * @param  {[type]} reply   Reply detail of trip
   */
  detail(request, reply) {

    let userId = request.auth.credentials.userId,
      notificationStore = request.notificationManager.getStore(request);

    return notificationStore.getOneByPk(request.params.uid).then((notification) => {

      return reply(helpers.Json.response(request, {
        meta: {
          message: 'Get notifications successfully'
        },
        data: {
          notification: notification.responseObject({
            schema: notificationSchemas.response,
            userId: userId
          })
        }
      }));
    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', 'trips', 'get']
      });
    });
  }
}

module.exports = NotificationController;
