'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function makeElement(name) {
  return {
    name,
    value: '',
    innerHTML: '',
    disabled: false,
    src: '',
    style: { webkitTransform: '' },
    children: [],
    onclick: null,
    onsubmit: null,
    setAttribute(key, value) { this[key] = value; },
    getAttribute(key) { return this[key]; },
    appendChild(child) { this.children.push(child); },
    querySelectorAll() { return []; }
  };
}

const elements = {
  '[data-role="address"]': makeElement('address'),
  '[data-role="address-form"]': makeElement('form'),
  '[data-role="tabs"]': makeElement('tabs'),
  '[data-role="status"]': makeElement('status'),
  '[data-role="features"]': makeElement('features'),
  '[data-action="back"]': makeElement('back'),
  '[data-action="forward"]': makeElement('forward'),
  '[data-action="reload"]': makeElement('reload'),
  '[data-action="close-tab"]': makeElement('close'),
  '[data-action="new-tab"]': makeElement('newTab')
};

const root = {
  querySelector(selector) { return elements[selector]; }
};

const frame = makeElement('frame');
const document = {
  getElementById(id) { return id === 'browser-shell' ? root : frame; },
  createElement(name) {
    if (name === 'canvas') {
      return { getContext(type) { return type === 'webgl' ? {} : null; }, style: {} };
    }
    return makeElement(name);
  }
};

const posted = [];
const window = {
  localStorage: {
    setItem() {},
    removeItem() {}
  },
  crypto: {},
  fetch() {},
  Promise,
  webkit: {
    messageHandlers: {
      LegacyBrowser: {
        postMessage(message) { posted.push(message); }
      }
    }
  }
};

const context = { window, document, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync('browser-shell/browser-shell.js', 'utf8'), context);

const shell = window.LegacyBrowserShell.start(root);
assert.strictEqual(shell.tabs.length, 1);
assert.strictEqual(posted[0].action, 'load');
assert.strictEqual(posted[0].url, 'https://example.com');
assert(elements['[data-role="features"]'].innerHTML.indexOf('webgl') !== -1);

shell.load('openai.com');
assert.strictEqual(posted[1].url, 'https://openai.com');

shell.load('现代浏览器');
assert.strictEqual(posted[2].url, 'https://www.google.com/search?q=%E7%8E%B0%E4%BB%A3%E6%B5%8F%E8%A7%88%E5%99%A8');

window.LegacyBrowserShell.onNativeNavigationState({
  tabId: shell.activeTabId,
  url: 'https://openai.com/',
  title: 'OpenAI',
  canGoBack: true,
  canGoForward: false,
  tls: 'tls1.2+'
});
assert.strictEqual(elements['[data-role="address"]'].value, 'https://openai.com/');
assert.strictEqual(elements['[data-action="back"]'].disabled, false);
assert.strictEqual(elements['[data-action="forward"]'].disabled, true);
