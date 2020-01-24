const { Plugin } = require('powercord/entities');
const { camelCaseify, forceUpdateElement, getOwnerInstance, sleep, waitFor } = require('powercord/util');
const { instance, getModule, getModuleByDisplayName } = require('powercord/webpack');
const { inject } = require('powercord/injector');

/*
 * Based on BBD normalizer
 * Credits for normalized class fixes: https://github.com/samuelthomas2774/BetterDiscordApp/commit/2b0d3eb268c7cd708ae29df2916957210fcf72c3
 */

 /* 
 * Based on the old (deprecated) Powercord class normalizer, lmao. 
 */

module.exports = class bdClassNameNormalizer extends Plugin {
  constructor () {
    super();

    this.randClassReg = /^(?!bd-)((?:[a-z]|[0-9]|-)+)-(?:[a-z]|[0-9]|-|_){6}$/i;
    this.normClassReg = /^(([a-zA-Z0-9]+)-[^\s]{6}) bd-([a-zA-Z0-9]+)$/i;
    this.PROPERTY_BLACKLIST = [ 'displayName' ];
    this.ATTRIBUTE_BLACKLIST = [ 'px', 'ch', 'em', 'ms' ];
  }

  async startPlugin () {
    await sleep(2000); // bowserware:tm:

    this.patchModules(this._fetchAllModules());
    this.normalizeElement(document.querySelector('#app-mount'));
    this.patchDOMMethods();

    if (window.__OVERLAY__) {
      document.body.classList.add('overlay');
    }
  }

  patchModules (modules) {
    for (const mod of modules) {
      this.patchModule(mod);
    }
  }

  /*
   * @deprecated, @see patchModules
   */
  patchModule (classNames) {
    for (const baseClassName in classNames) {
      // noinspection JSUnfilteredForInLoop
      const value = classNames[baseClassName];
      if (this._shouldIgnore(value)) {
        continue;
      }

      const classList = value.split(' ');
      for (const normalClass of classList) {
        const match = normalClass.match(this.randClassReg)[1];
        if (!match) {
          continue;
        } // Shouldn't ever happen since they passed the moduleFilter, but you never know

        const camelCase = camelCaseify(match);

        // noinspection JSUnfilteredForInLoop
        classNames[baseClassName] += ` bd-${camelCase}`;
      }
    }
  }

  /*
   * @deprecated, @see patchModules
   */
  patchDOMMethods () {
    const _this = this;
    const { contains } = DOMTokenList.prototype;

    DOMTokenList.prototype.contains = function (token) {
      let match;
      if (typeof token === 'string' && (match = token.match(_this.normClassReg)) && match[2] === match[3]) {
        return contains.call(this, match[1]);
      }
      return contains.call(this, token);
    };
  }

  /*
   * @deprecated, @see patchModules
   */
  normalizeElement (element) {
    if (!(element instanceof Element)) {
      return;
    }

    for (const targetClass of element.classList) {
      if (!this.randClassReg.test(targetClass)) {
        continue;
      }

      const match = targetClass.match(this.randClassReg)[1];
      const newClass = camelCaseify(match);
      element.classList.add(`bd-${newClass}`);
    }

    for (const child of element.children) {
      this.normalizeElement(child);
    }
  }

  /*
   * @deprecated, @see patchModules
   */
  _fetchAllModules () {
    return Object.values(instance.cache)
      .filter(mdl => (
        mdl.exports &&
        Object.keys(mdl.exports)
          .filter(exp => !this.PROPERTY_BLACKLIST.includes(exp))
          .every(prop => typeof mdl.exports[prop] === 'string')
      ))
      .map(mdl => mdl.exports)
      .filter(mdl => {
        if (
          typeof mdl !== 'object' ||
          Array.isArray(mdl) ||
          mdl.__esModule ||
          Object.keys(mdl).length === 0
        ) {
          return false;
        }

        for (const baseClassName of Object.values(mdl)) {
          if (typeof baseClassName !== 'string') {
            return false;
          }

          if (this._shouldIgnore(baseClassName)) {
            continue;
          }

          if (
            !baseClassName.includes('-') ||
            !this.randClassReg.test(baseClassName.split(' ')[0])
          ) {
            return false;
          }
        }

        return true;
      });
  }

  _shouldIgnore (value) {
    return (
      !isNaN(value) ||
      this.ATTRIBUTE_BLACKLIST.some(prop => value.endsWith(prop)) || (
        value.startsWith('#') && (value.length === 7 || value.length === 4)
      ) ||
      value.includes('calc(') || value.includes('rgba')
    );
  }
};