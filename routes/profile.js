/*
 * @Author: toan.nguyen
 * @Date:   2016-10-25 16:16:51
* @Last modified by:   nhutdev
* @Last modified time: 2017-02-12T09:32:52+07:00
 */

'use strict';

const Joi = require('joi');
const Hoek = require('hoek');
const config = require('config');
const helpers = require('node-helpers');

const Route = require('../lib/route');

const ProfileController = require('../controllers/profile');
const profileSchema = require('../schemas/profile');

const SchemaGenerator = helpers.SchemaGenerator;
const verificationLength = config.has('user.verification.length') ? config.get('user.verification.length') : 4;


class ProfileRoute extends Route {

  /**
   * Contructor, set options data
   *
   * @param  {Object} options Option data
   */
  constructor(options) {

    Hoek.assert(options, 'Input options must not be empty');
    Hoek.assert(options.authName, 'Authorization name options must not be empty');

    options.basePath = options.basePath || 'profile';

    if (!options.controller) {
      options.controllerClass = options.controllerClass || ProfileController;
      options.controller = new options.controllerClass(options);
    }

    super(options);

    Hoek.assert(options.userSchema, 'Input user schema must not be empty');
    // Hoek.assert(options.settingClass, 'Input setting class must not be empty');
    // Hoek.assert(options.settingSchema, 'Input setting schema must not be empty');
    // Hoek.assert(options.userSettingSchema, 'Input user setting schema must not be empty');

    this._userSchema = options.userSchema;
    this._settingClass = options.settingClass;
    this._settingSchema = options.settingSchema;
    this._userSettingSchema = options.userSettingSchema;
    this._includeRoutes = options.routes || [];
    this._exceptRoutes = options.exceptRoutes || [];

    this._initRoute();
  }

  /**
   * Returns common profile response schema
   *
   * @return {Joi.Object} Common profile response schema
   */
  _commonProfileResponse() {

    if (!this._profileResponse) {
      let responseSchema = {
          profile: this._userSchema.response,
        },
        settingSchema = !this._settingSchema ? null : {
          settings: this._settingSchema.response
        };

      if (this._userSettingSchema) {
        responseSchema.userSettings = this._userSettingSchema.response;
      }
      this._profileResponse = SchemaGenerator.basicResponse(responseSchema, settingSchema);
    }

    return this._profileResponse;
  }

  /**
   * Creates profile detail route options
   *
   * @return {Object} Profile route options
   */
  createProfileRoute() {

    let options = {
      method: 'GET',
      path: `/${this._basePath}`,
      config: {
        auth: this._authName,
        handler: this._controller.getProfile,
        description: 'Get profile data',
        notes: 'Returns profile data',
        tags: ['api', 'profile'],
        validate: {
          headers: helpers.Schema.tokenHeaders
        },
        response: {
          schema: this._commonProfileResponse()
        },
      }
    };

    return this.createRoute(options);
  }

  /**
   * Creates profile detail route options
   *
   * @return {Object} Profile route options
   */
  createUpdateProfileRoute() {

    let options = {
      method: 'POST',
      path: `/${this._basePath}`,
      config: {
        auth: this._authName,
        handler: this._controller.updateProfile,
        description: 'Update profile data',
        notes: 'Returns profile data',
        tags: ['api', 'profile'],
        validate: {
          headers: helpers.Schema.tokenHeaders,
          payload: Joi.object().keys({
            data: Joi.object().keys({
              profile: this._userSchema.request || profileSchema.request
            })
          }).requiredKeys(['data', 'data.profile']),
          options: {
            allowUnknown: true,
            stripUnknown: true,
          },
        },
        response: {
          schema: this._commonProfileResponse()
        },
      }
    };

    return this.createRoute(options);
  }

  /**
   * Creates profile upload avatar route options
   *
   * @return {Object} Profile route options
   */
  createUploadAvatarRoute() {

    let options = {
      method: 'POST',
      path: `/${this._basePath}/avatar`,
      config: {
        auth: this._authName,
        handler: this._controller.uploadAvatar,
        description: 'Update profile avatar',
        notes: 'Returns profile data',
        tags: ['api', 'profile'],
        payload: {
          maxBytes: 209715200,
          output: 'stream',
          parse: true,
          allow: 'multipart/form-data'
        },
        validate: {
          headers: helpers.Schema.tokenHeaders,
          payload: Joi.object().keys({
            file: Joi.any()
          }).requiredKeys(['file'])
        },
        response: {
          schema: SchemaGenerator.basicResponse({
            profile: this._userSchema.response
          })
        },
        plugins: {
          'hapi-swagger': {
            payloadType: 'form'
          },
        },
      }
    };

    return this.createRoute(options);
  }

  /**
   * Creates get setting route options
   *
   * @return {Object} Route options
   */
  createSettingRoute() {

    let options = {
      method: 'GET',
      path: `/settings`,
      config: {
        auth: false,
        handler: this._controller.getAppSettings,
        description: 'Get setting data',
        notes: 'Returns setting data',
        tags: ['api', 'settings'],
        response: {
          schema: SchemaGenerator.basicResponse({
            settings: this._settingSchema.response
          })
        }
      }
    };

    return this.createRoute(options);
  }

  /**
   * Creates profile detail route options
   *
   * @return {Object} Profile route options
   */
  createUpdateSettingRoute() {

    let options = {
      method: 'POST',
      path: `/settings`,
      config: {
        auth: this._authName,
        handler: this._controller.updateSettings,
        description: 'Update profile settings',
        notes: 'Returns profile settings',
        tags: ['api', 'settings'],
        validate: {
          headers: helpers.Schema.tokenHeaders,
          payload: Joi.object().keys({
            data: Joi.object().keys({
              userSettings: this._userSettingSchema.request
            })
          }).requiredKeys(['data', 'data.userSettings']),
        },
        response: {
          schema: SchemaGenerator.basicResponse({
            userSettings: this._userSettingSchema.response
          })
        },
      }
    };

    return this.createRoute(options);
  }

  /**
   * Creates get setting route options
   *
   * @return {Object} Route options
   */
  createNewOtpRoute() {

    let options = {
      method: 'GET',
      path: `/${this._basePath}/new-otp`,
      config: {
        auth: this._authName,
        handler: this._controller.requestVerificationCode,
        description: 'Creates new OTP and response to the user',
        notes: 'Returns OTP data',
        tags: ['api', 'otp'],
        validate: {
          headers: helpers.Schema.tokenHeaders
        },

        response: {
          schema: SchemaGenerator.basicResponse(Joi.object({
            otp: Joi.any()
          }))
        },
      }
    };

    return this.createRoute(options);
  }

  /**
   * Creates confirm OTP route options
   *
   * @return {Object} OTP route options
   */
  createConfirmOtpRoute() {

    let options = {
      method: 'POST',
      path: `/${this._basePath}/confirm-otp`,
      config: {
        auth: this._authName,
        handler: this._controller.confirmVerificationCode,
        description: 'Confirm OTP code',
        notes: 'Returns OTP settings',
        tags: ['api', 'settings'],
        validate: {
          headers: helpers.Schema.tokenHeaders,
          payload: Joi.object().keys({
            data: Joi.object({
              otp: Joi.string().length(verificationLength).required()
            }),
          }).requiredKeys(['data'])
        },
        response: {
          schema: this._commonProfileResponse()
        },
      }
    };

    return this.createRoute(options);
  }

  /**
   * Initialzes default routes
   */
  _initRoute() {
    this._routes = [];

    if (helpers.Array.isEmpty(this._includeRoutes) && helpers.Array.isEmpty(this._exceptRoutes)) {
      this._includeRoutes = ['profile', 'update-profile', 'upload-avatar', 'settings', 'update-settings', 'otp', 'confirm-otp'];
    }

    if (this._includeRoutes.indexOf('profile') !== -1 && this._exceptRoutes.indexOf('profile') === -1) {
      this._routes.push(this.createProfileRoute());
    }

    if (this._includeRoutes.indexOf('update-profile') !== -1 && this._exceptRoutes.indexOf('update-profile') === -1) {
      this._routes.push(this.createUpdateProfileRoute());
    }

    if (this._includeRoutes.indexOf('upload-avatar') !== -1 && this._exceptRoutes.indexOf('upload-avatar') === -1) {
      this._routes.push(this.createUploadAvatarRoute());
    }

    if (this._includeRoutes.indexOf('settings') !== -1 && this._exceptRoutes.indexOf('settings') === -1) {
      this._routes.push(this.createSettingRoute());
    }

    if (this._includeRoutes.indexOf('update-settings') !== -1 && this._exceptRoutes.indexOf('update-settings') === -1) {
      this._routes.push(this.createUpdateSettingRoute());
    }

    if (this._includeRoutes.indexOf('otp') !== -1 && this._exceptRoutes.indexOf('otp') === -1) {
      this._routes.push(this.createNewOtpRoute());
    }

    if (this._includeRoutes.indexOf('confirm-otp') !== -1 && this._exceptRoutes.indexOf('confirm-otp') === -1) {
      this._routes.push(this.createConfirmOtpRoute());
    }

  }

  /**
   * Returns routes
   *
   * @return {Array}
   */
  get routes() {
    return this._routes;
  }
}

module.exports = ProfileRoute;
