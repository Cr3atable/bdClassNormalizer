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

    this.patchGuildHeader();
    this.renderGuildClasses();
    this.renderFolderClasses();

    if (window.__OVERLAY__) {
      document.body.classList.add('overlay');
    }
  }

  async patchGuildHeader () {
    const GuildHeader = await getModuleByDisplayName('GuildHeader');
    inject('bd-cnn-gh', GuildHeader.prototype, 'renderHeader', function (_, res) {
      res.props['data-guild-id'] = this.props.guild.id;
      return res;
    });

    const guildHeaderQuery = `.${(await getModule([ 'iconBackgroundTierNone', 'container' ])).header.split(' ')[0]}`;
    if (document.querySelector(guildHeaderQuery)) {
      forceUpdateElement(guildHeaderQuery);
    }
  }

  /* Credit goes to Cadence#3263 for partially coming up with and writing this implementation */
  async renderGuildClasses () {
    const guildClasses = await getModule([ 'blobContainer' ]);
    const guildElement = (await waitFor(`.${guildClasses.blobContainer.split(' ')[0]}`)).parentElement;
    const instance = getOwnerInstance(guildElement);
    inject('bd-cnn-gc', instance.__proto__, 'render', function (_, res) {
      // const { hovered } = res._owner.memoizedState;
      const { audio, badge: mentions, selected, unread, video } = this.props;

      /* eslint-disable-next-line object-property-newline */
      const conditionals = { unread, /* hovered, */ selected, audio, video, mentioned: mentions > 0 };

      Object.keys(conditionals).forEach(key => {
        if (conditionals[key]) {
          res.props.className += ` ${key}`;
        }
      });

      res.props['data-guild-name'] = this.props.guild.name;
      res.props['data-guild-id'] = this.props.guildId;

      return res;
    });

    forceUpdateElement(`.${guildElement.className.split(' ')[0]}`, true);
  }

  async renderFolderClasses () {
    const folderClasses = await getModule([ 'wrapper', 'folder' ]);
    const instance = getOwnerInstance(await waitFor(`.${folderClasses.wrapper.split(' ')[0]}`));
    inject('bd-cnn-fc', instance.__proto__, 'render', function (_, res) {
      // const { hovered } = res._owner.memoizedState;
      const { audio, badge: mentions, selected, expanded, unread, video } = this.props;

      /* eslint-disable-next-line object-property-newline */
      const conditionals = { unread, /* hovered, */ selected, expanded, audio, video, mentioned: mentions > 0 };

      Object.keys(conditionals).forEach(key => {
        if (conditionals[key]) {
          res.props.className += ` ${key}`;
        }
      });

      res.props['data-folder-name'] = this.props.folderName;

      return res;
    });

    forceUpdateElement(`.${folderClasses.wrapper.split(' ')[0]}`, true);
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