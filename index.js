/*
 * @Author: toan.nguyen
 * @Date:   2016-09-09 12:23:34
 * @Last Modified by:   toan.nguyen
 * @Last Modified time: 2016-09-29 14:46:37
 */

'use strict';

module.exports = {
  Server: require('./lib/server'),
  controllers: {
    Notification: require('./controllers/notification'),
    Profile: require('./controllers/profile')
  }
};
