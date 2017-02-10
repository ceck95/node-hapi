/**
 * @Author: Tran Van Nhut <nhutdev>
 * @Date:   2017-02-10T14:56:18+07:00
 * @Email:  tranvannhut4495@gmail.com
* @Last modified by:   nhutdev
* @Last modified time: 2017-02-10T14:56:22+07:00
 */



'use strict';

module.exports = {
  Server: require('./lib/server'),
  controllers: {
    Notification: require('./controllers/notification'),
    Profile: require('./controllers/profile')
  },
  Controler: require('./lib/controller'),
  Route: require('./lib/route'),
  routes: {
    Profile: require('./routes/profile')
  }
};
