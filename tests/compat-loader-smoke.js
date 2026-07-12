'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function Element() {}

const appended = [];
const documentElement = {
  className: '',
  classList: {
    values: [],
    add(value) { this.values.push(value); }
  }
};

const document = {
  documentElement,
  head: {
    appendChild(node) { appended.push(node); }
  },
  createElement(tagName) {
    return {
      tagName,
      style: {},
      appendChild(child) { this.child = child; }
    };
  },
  createEvent() {
    return {
      initCustomEvent(event, bubbles, cancelable, detail) {
        this.type = event;
        this.bubbles = bubbles;
        this.cancelable = cancelable;
        this.detail = detail;
      }
    };
  },
  createTextNode(text) { return { text }; },
  querySelectorAll() { return []; }
};

const window = {
  LegacyWebKitCompat: {
    autoBoot: false,
    cssVariables: {
      '.uses-css-vars': { color: '#111827' }
    }
  },
  Element,
  Event: function Event() {},
  Promise: undefined,
  CSS: undefined,
  WebAssembly: undefined,
  setTimeout(callback) { callback(); return 1; },
  clearTimeout() {},
  XMLHttpRequest: function XMLHttpRequest() {}
};

const context = { window, document, Element, setTimeout: window.setTimeout, clearTimeout: window.clearTimeout };
vm.createContext(context);
vm.runInContext(fs.readFileSync('legacy-webkit/compat-loader.js', 'utf8'), context);

assert.strictEqual(typeof window.Promise, 'function');
assert.strictEqual(typeof window.Promise.prototype.finally, 'function');
assert.strictEqual(typeof window.Promise.allSettled, 'function');
assert.strictEqual(typeof window.queueMicrotask, 'function');
assert.strictEqual(typeof window.URLSearchParams, 'function');
assert.strictEqual(typeof window.LegacyWebKitCompat.loadWasmOrFallback, 'function');
assert(documentElement.classList.values.indexOf('legacy-webkit') !== -1);
assert(documentElement.classList.values.indexOf('no-wasm') !== -1);
assert(documentElement.classList.values.indexOf('no-css-vars') !== -1);
assert(appended.some((node) => node.tagName === 'style'));

const params = new window.URLSearchParams('?a=1&b=two');
assert.strictEqual(params.get('a'), '1');
assert.strictEqual(params.has('b'), true);

window.Promise.allSettled([window.Promise.resolve(1), window.Promise.reject('x')]).then((results) => {
  assert.deepStrictEqual(results, [
    { status: 'fulfilled', value: 1 },
    { status: 'rejected', reason: 'x' }
  ]);
});
