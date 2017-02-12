/*
 * @Author: toan.nguyen
 * @Date:   2016-11-02 14:31:26
* @Last modified by:   nhutdev
* @Last modified time: 2017-02-12T09:38:06+07:00
 */

'use strict';

const Joi = require('joi');
const helpers = require('node-helpers');

let profileRequest = Joi.object({
  displayName: Joi.any(),
  firstName: Joi.any(),
  lastName: Joi.any(),
  email: Joi.any(),
  phoneNumber: Joi.any(),
  gender: Joi.any(),
  dateOfBirth: Joi.any(),
  isVerified: Joi.boolean().default(false)
});

module.exports = {
  request: profileRequest,
};
