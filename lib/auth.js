/*
 * @Author: toan.nguyen
 * @Date:   2016-09-07 09:54:56
 * @Last Modified by:   toan.nguyen
 * @Last Modified time: 2016-10-02 16:54:44
 */

'use strict';

const Hoek = require('hoek');
const helpers = require('nexx-helpers');
const bearerScheme = helpers.auth.Bearer;

const nexBusiness = require('nex-business');
const BasicAuthenticator = nexBusiness.authenticators.Basic;
const OauthBearerAuthenticator = nexBusiness.authenticators.OAuthBearer;

class AuthManager {

  /**
   * Constructor
   *
   * @param  {Object} cfgs Config data
   */
  constructor(cfgs) {
    this._schemes = {};
    this._authenticators = {};

    this.applyDependencies(cfgs);
  }

  /**
   * Adds scheme into list
   *
   * @param {Object} scheme Authorization scheme
   */
  addScheme(scheme) {

    if (this._schemes[scheme.schemeName]) {
      return false;
    }

    this._schemes[scheme.schemeName] = scheme;

    return true;
  }

  /**
   * Returns scheme list
   *
   * @return {Array}
   */
  get schemes() {
    let schemes = [];

    for (let k in this._schemes) {
      schemes.push(this._schemes[k]);
    }

    return schemes;
  }

  /**
   * Returns authenticator list
   *
   * @return {Array}
   */
  get authenticators() {
    let auths = [];

    for (let k in this._authenticators) {
      auths.push(this._authenticators[k]);
    }

    return auths;
  }

  /**
   * Adds authenticator into list
   *
   * @param {String} name Authenticator name
   * @param {Object} auth Authenticator handler
   */
  addAuthenticator(name, auth) {
    if (this._authenticators[name]) {
      return false;
    }

    this._authenticators[name] = auth;
  }

  /**
   * Registers authenticators dependencies for server
   *
   * @param  {HAPIServer} server HAPI Server
   * @param  {Array} cfgs Authenticator configs
   */
  applyDependencies(cfgs) {

    Hoek.assert(cfgs, 'Authenticator config is null');
    Hoek.assert(Array.isArray(cfgs), 'Authenticator config must be a array');

    cfgs.forEach(cfg => {
      switch (cfg.type) {
      case 'oauth_bearer_token':
        this.addScheme(bearerScheme);
        this.addAuthenticator(cfg.type, new OauthBearerAuthenticator(cfg));
        break;
      case 'basic_token':
        this.addScheme(bearerScheme);
        this.addAuthenticator(cfg.type, new BasicAuthenticator(cfg));
      }
    });
  }

  /**
   * Registers authenticators for server
   *
   * @param  {HAPIServer} server HAPI Server
   * @param  {Array} cfgs Authenticator configs
   */
  register(server) {
    Hoek.assert(server, 'Server instance is null');

    for (let k in this.authenticators) {
      let auth = this.authenticators[k];
      auth.register(server);
    }
  }
}

module.exports = AuthManager;
