/*
 * @Author: toan.nguyen
 * @Date:   2016-11-02 14:31:26
 * @Last Modified by:   toan.nguyen
 * @Last Modified time: 2016-11-02 14:33:37
 */

'use strict';

const Joi = require('joi');
const helpers = require('nexx-helpers');

let profileRequest = Joi.object({
  displayName: Joi.any(),
  firstName: Joi.any(),
  lastName: Joi.any(),
  email: Joi.any(),
  phoneNumber: Joi.any(),
  gender: Joi.any(),
  dateOfBirth: Joi.any(),
  isVerified: Joi.boolean().default(false),
  address: helpers.schemas.address.request
});

module.exports = {
  request: profileRequest,
};
