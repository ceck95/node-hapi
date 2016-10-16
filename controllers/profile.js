/*
 * @Author: toan.nguyen
 * @Date:   2016-05-06 01:31:10
* @Last modified by:   nhutdev
* @Last modified time: 2016-10-16T20:19:22+07:00
 */

'use strict';

const Hoek = require('hoek');
const helpers = require('node-helpers');
const imageHelper = helpers.Image;


class ProfileController {

  /**
   * Constructor, set default data
   *
   * @param  {Object} options Option data
   */
  constructor(options) {
    this._userSchema = options.userSchema;
    this._userSettingSchema = options.userSettingSchema;
    this._settingSchema = options.settingSchema;
    this._defaultSettings = options.defaultSettings;
    this._defaultUserSettings = options.defaultUserSettings;
  }


  /**
   * After insert event
   *
   * @param  {[type]} request [description]
   * @param  {[type]} profile [description]
   * @return {[type]}         [description]
   */
  afterInsert(request) {
    // to do
  }

  /**
   * Retrieves profile of customer
   *
   * @param  {Request} request The request object is created internally for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface to return control to the framework and a response generator.
   */
  getProfile(request, reply) {

    // var self = this;

    if (request.auth.credentials.isNewUser) {
      this.afterInsert(request);
    }

    let respFunc = () => {
      // check if current user is existed
      let profile = request.auth.credentials.profile,
        responseProfile = profile.responseObject({
          schema: this._userSchema.response
        });


      let settings = {};
      if (profile.settings) {
        if (typeof(profile.settings) === 'string') {
          profile.settings = JSON.parse(profile.settings);

        }
        settings = profile.settings;
      }

      if (helpers.Data.isEmpty(settings)) {
        settings = this._defaultUserSettings;
      }

      let responseObject = helpers.Json.response(request, {
        meta: {
          message: 'Get profile successfully',
          settings: this._defaultSettings
        },
        data: {
          profile: responseProfile,
          userSettings: helpers.Model.toObject(settings, {
            schema: this._userSettingSchema.response
          })
        }
      });

      return reply(responseObject);
    };


    if (this.beforeGetProfile) {
      let prom = this.beforeGetProfile(request);

      if (prom.then) {
        return this.beforeGetProfile(request).then(() => {
          return respFunc();
        }).catch(err => {
          return helpers.HAPI.replyError(request, reply, err, {
            log: ['error', 'profile', 'update']
          });
        });
      }

    }
    return respFunc();

  }

  /**
   * Update profile of customer
   *
   * @param  {Request} request The request object is created internally for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface to return control to the framework and a response generator.
   */
  updateProfile(request, reply) {

    let self = this,
      userId = request.auth.credentials.userId,
      profile = request.auth.credentials.profile,
      form = request.payload.data,
      userStore = request.dataStore.userStore;

    let model = userStore.createModel(form.profile);
    model.uid = profile.uid;
    model.updatedBy = userId;

    if (form.profile.address && profile.address) {
      model.address.uid = profile.address.uid;
    }

    return userStore.updateOne(model).then(result => {

      let newProfile = userStore.createModel(result),
        responseObject = helpers.Json.response(request, {
          meta: {
            message: 'Get profile successfully'
          },
          data: {
            profile: newProfile.responseObject({
              schema: self._userSchema.response
            })
          }
        });

      return reply(responseObject);
    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', 'profile', 'update']
      });
    });
  }

  /**
   * Uploads customer avatar
   *
   * @param  {Request} request Request data
   * @param  {Reply} reply   Reply interface
   */
  uploadAvatar(request, reply) {

    let self = this,
      userId = request.auth.credentials.userId,
      profile = request.auth.credentials.profile,
      data = request.payload;

    if (data.file) {

      let opts = {
        path: 'avatar',
        prefix: request.config.user.prefix || 'user',
        userId: userId
      };

      helpers.File.uploadFile(request, opts, (err, imageInfo) => {

        if (err) {
          return helpers.HAPI.replyError(request, reply, err, {
            log: ['error', 'profile', 'upload']
          });
        }

        // resizes uploaded image
        let imageSizes = request.config.imageSizes.avatar;
        imageHelper.resizeImage(imageInfo, imageSizes, opts, request).then((images) => {
          let userStore = request.dataStore.userStore,
            avatar = JSON.stringify(images);

          userStore.updateAvatar(userId, avatar).then(() => {
            profile.avatar = images;

            var responseObject = helpers.Json.response(request, {
              meta: {
                message: 'Upload avatar successfully'
              },
              data: {
                profile: profile.responseObject({
                  schema: self._userSchema.response
                })
              }
            });

            return reply(responseObject);
          }).catch(err => {
            return helpers.HAPI.replyError(request, reply, err, {
              log: ['error', 'profile', 'avatar']
            });
          });

        }, (err) => {
          request.log(['error', 'profile', 'avatar'], err);
          return reply(err).code(500);
        });
      });
    }
  }



  /**
   * Get customer application settings
   *
   * @param  {Request} request Request data
   * @param  {Reply} reply   Reply interface
   */
  // getSettings(request, reply) {

  //   var profile = request.auth.credentials.profile,
  //     settings = {};

  //   if (profile.settings) {
  //     if (typeof(profile.settings) === 'string') {
  //       profile.settings = JSON.parse(profile.settings);
  //     }
  //     settings = profile.settings;
  //   }

  //   if (helpers.Data.isEmpty(settings)) {
  //     settings = defaultResources.userSettings;
  //   }

  //   var responseObject = helpers.Json.response(request, {
  //     meta: {
  //       message: 'Get settings successfully',
  //       settings: config.get('default.settings')
  //     },
  //     data: {
  //       userSettings: helpers.Model.toObject(settings, {
  //         schema: userSettingsSchema.response
  //       })
  //     }
  //   });

  //   return reply(responseObject);
  // }

  /**
   * Update customer application settings
   *
   * @param  {Request} request Request data
   * @param  {Reply} reply   Reply interface
   */
  updateSettings(request, reply) {

    let self = this,
      profile = request.auth.credentials.profile,
      form = request.payload.data,
      settings = {};

    if (profile.settings) {
      if (typeof(profile.settings) === 'string') {
        profile.settings = JSON.parse(profile.settings);
      }
    } else {
      profile.settings = {};
    }

    if (helpers.Data.isEmpty(settings)) {
      settings = helpers.Model.toObject(self._defaultUserSettings);
    }

    Hoek.merge(settings, form.userSettings, false, false);


    let userStore = request.dataStore.userStore;
    profile.settings = JSON.stringify(settings);

    request.log(['debug', 'profile', 'settings', 'update'], settings);
    return userStore.updateOne(profile).then(() => {
      let responseObject = helpers.Json.response(request, {
        meta: {
          message: 'Update settings successfully',
        },
        data: {
          userSettings: settings
        }
      });

      return reply(responseObject);
    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', 'profile', 'settings', 'update']
      });
    });
  }

  /**
   * Request verification code
   *
   * @param  {Request} request The request object is created internally for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface to return control to the framework and a response generator.
   */
  requestVerificationCode(request, reply) {

    let profile = request.auth.credentials.profile;

    if (profile.isVerified) {
      let errors = helpers.Error.translate({
        code: '310'
      });

      request.log(['info', 'profile', 'verification', 'failed'], errors);
      return reply(errors).code(400);
    }

    return request.userManager.sendVerificationCode(request).then(result => {

      let responseObject = helpers.Json.response(request, {
        meta: {
          message: 'Request OTP successfully'
        },
        data: {
          otp: result
        }
      });

      return reply(responseObject);
    }, err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', 'profile', 'verification'],
        codes: {
          '307': 400,
          '308': 400,
        }
      });
    });


  }

  /**
   * Confirm verification code
   *
   * @param  {Request} request The request object is created internally for each incoming request
   * @param  {Reply} reply   The reply interface acts as both a callback interface to return control to the framework and a response generator.
   */
  confirmVerificationCode(request, reply) {

    let self = this,
      profile = request.auth.credentials.profile,
      userStore = request.dataStore.userStore,
      form = request.payload.data;

    if (profile.isVerified) {
      let errors = helpers.Error.translate({
        code: '310'
      });

      request.log(['info', 'profile', 'verification', 'failed'], errors);
      return reply(errors).code(400);
    }

    if (profile.isVerificationExpired) {
      let errors = helpers.Error.translate({
        code: '309'
      });

      request.log(['info', 'profile', 'verification', 'failed'], errors);
      return reply(errors).code(400);
    }

    if (profile.verificationCode != form.otp) {
      let errors = helpers.Error.translate({
        code: '311'
      });

      request.log(['info', 'profile', 'verification', 'failed'], errors);
      return reply(errors).code(400);
    }

    let thriftForm = profile.toThriftVerificationForm({
      uid: profile.uid,
      isVerified: true,
      updatedBy: profile.uid
    });

    return userStore.updateVerificationCode(thriftForm).then(() => {
      profile.isVerified = true;

      let responseProfile = profile.responseObject({
        schema: self._userSchema.response
      });

      let settings = {};
      if (profile.settings) {
        if (typeof(profile.settings) === 'string') {
          profile.settings = JSON.parse(profile.settings);

        }
        settings = profile.settings;
      }

      if (helpers.Data.isEmpty(settings)) {
        settings = self._defaultUserSettings;
      }

      let responseObject = helpers.Json.response(request, {
        meta: {
          message: 'Confirm OTP successfully'
        },
        data: {
          profile: responseProfile,
          userSettings: helpers.Model.toObject(settings, {
            schema: self._userSettingSchema.response
          })
        }
      });

      return reply(responseObject);

    }).catch(err => {
      return helpers.HAPI.replyError(request, reply, err, {
        log: ['error', 'profile', 'verification', 'confirm']
      });
    });
  }
}

module.exports = ProfileController;
