/*
 * Legacy WebKit compatibility loader for iOS 9.3.
 *
 * This file is intentionally written in ES5 syntax so that old JavaScriptCore
 * versions can parse it before the application decides which bundle to load.
 */
(function (window, document) {
    'use strict';

    var root = document.documentElement;
    var config = window.LegacyWebKitCompat || {};
    var tests = {
        promise: typeof window.Promise === 'function',
        fetch: typeof window.fetch === 'function',
        objectAssign: typeof Object.assign === 'function',
        arrayIncludes: typeof Array.prototype.includes === 'function',
        stringIncludes: typeof String.prototype.includes === 'function',
        requestAnimationFrame: typeof window.requestAnimationFrame === 'function',
        customEvent: supportsCustomEvent(),
        classList: !!(root && root.classList),
        cssVariables: supportsCssVariables(),
        webAssembly: typeof window.WebAssembly === 'object',
        modules: supportsModules(),
        urlSearchParams: typeof window.URLSearchParams === 'function',
        elementMatches: !!(window.Element && (window.Element.prototype.matches || window.Element.prototype.webkitMatchesSelector)),
        elementClosest: !!(window.Element && window.Element.prototype.closest),
        promiseFinally: !!(window.Promise && window.Promise.prototype && window.Promise.prototype.finally),
        promiseAllSettled: !!(window.Promise && window.Promise.allSettled),
        queueMicrotask: typeof window.queueMicrotask === 'function'
    };

    var legacy = !!config.forceLegacy || !tests.promise || !tests.fetch || !tests.objectAssign ||
        !tests.arrayIncludes || !tests.stringIncludes || !tests.cssVariables || !tests.modules;

    addClass(legacy ? 'legacy-webkit' : 'modern-webkit');
    addClass(tests.webAssembly ? 'has-wasm' : 'no-wasm');
    addClass(tests.cssVariables ? 'has-css-vars' : 'no-css-vars');

    window.LegacyWebKitCompat = {
        tests: tests,
        legacy: legacy,
        boot: boot,
        loadScript: loadScript,
        loadStylesheet: loadStylesheet,
        applyCssVariableFallbacks: applyCssVariableFallbacks,
        loadWasmOrFallback: loadWasmOrFallback
    };

    installSafePolyfills();
    if (config.cssVariables && !tests.cssVariables) {
        applyCssVariableFallbacks(config.cssVariables);
    }

    if (config.autoBoot !== false) {
        boot(config);
    }

    function boot(options) {
        options = options || {};

        var styles = [].concat(options.stylesheets || []);
        var scripts;

        if (legacy) {
            styles = styles.concat(options.legacyStylesheets || []);
            scripts = [].concat(options.polyfills || [], options.legacyScripts || []);
        } else {
            scripts = [].concat(options.modernScripts || []);
        }

        loadStylesheets(styles);
        loadScriptsInOrder(scripts, options.onReady, options.onError);
    }

    function installSafePolyfills() {
        if (!tests.promise) {
            window.Promise = LegacyPromise;
        }

        if (!window.Promise.prototype.finally) {
            window.Promise.prototype.finally = function (callback) {
                var PromiseCtor = this.constructor;
                return this.then(function (value) {
                    return PromiseCtor.resolve(callback()).then(function () { return value; });
                }, function (reason) {
                    return PromiseCtor.resolve(callback()).then(function () { throw reason; });
                });
            };
        }

        if (!window.Promise.allSettled) {
            window.Promise.allSettled = function (items) {
                return window.Promise.all(mapArray(items, function (item) {
                    return window.Promise.resolve(item).then(function (value) {
                        return { status: 'fulfilled', value: value };
                    }, function (reason) {
                        return { status: 'rejected', reason: reason };
                    });
                }));
            };
        }

        if (!tests.queueMicrotask) {
            window.queueMicrotask = function (callback) {
                window.Promise.resolve().then(callback);
            };
        }

        if (!tests.objectAssign) {
            Object.assign = function (target) {
                var output;
                var index;
                var source;
                var key;

                if (target === null || target === undefined) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }

                output = Object(target);
                for (index = 1; index < arguments.length; index += 1) {
                    source = arguments[index];
                    if (source !== null && source !== undefined) {
                        for (key in source) {
                            if (Object.prototype.hasOwnProperty.call(source, key)) {
                                output[key] = source[key];
                            }
                        }
                    }
                }
                return output;
            };
        }

        if (!tests.arrayIncludes) {
            Array.prototype.includes = function (searchElement, fromIndex) {
                return indexOfSameValueZero(this, searchElement, fromIndex) !== -1;
            };
        }

        if (!tests.stringIncludes) {
            String.prototype.includes = function (searchString, position) {
                return String.prototype.indexOf.call(this, searchString, position || 0) !== -1;
            };
        }

        if (!tests.requestAnimationFrame) {
            window.requestAnimationFrame = function (callback) {
                return window.setTimeout(function () {
                    callback(new Date().getTime());
                }, 16);
            };
            window.cancelAnimationFrame = function (id) {
                window.clearTimeout(id);
            };
        }

        if (!tests.customEvent) {
            window.CustomEvent = function (event, params) {
                var customEventParams = params || { bubbles: false, cancelable: false, detail: null };
                var customEvent = document.createEvent('CustomEvent');
                customEvent.initCustomEvent(event, customEventParams.bubbles, customEventParams.cancelable, customEventParams.detail);
                return customEvent;
            };
            window.CustomEvent.prototype = window.Event.prototype;
        }

        if (!tests.elementMatches && window.Element) {
            window.Element.prototype.matches = window.Element.prototype.webkitMatchesSelector || function (selector) {
                var nodes = (this.parentNode || document).querySelectorAll(selector);
                var index = 0;
                while (nodes[index] && nodes[index] !== this) {
                    index += 1;
                }
                return !!nodes[index];
            };
        }

        if (!tests.elementClosest && window.Element) {
            window.Element.prototype.closest = function (selector) {
                var node = this;
                while (node && node.nodeType === 1) {
                    if (node.matches(selector)) {
                        return node;
                    }
                    node = node.parentElement || node.parentNode;
                }
                return null;
            };
        }

        if (!tests.urlSearchParams) {
            window.URLSearchParams = LegacyURLSearchParams;
        }

        if (!tests.fetch) {
            window.fetch = fetchWithXhr;
        }
    }


    function LegacyPromise(executor) {
        var self = this;
        self.state = 'pending';
        self.value = undefined;
        self.handlers = [];

        function resolve(value) {
            settle(self, 'fulfilled', value);
        }
        function reject(reason) {
            settle(self, 'rejected', reason);
        }

        if (typeof executor !== 'function') {
            throw new TypeError('Promise resolver is not a function');
        }

        try {
            executor(resolve, reject);
        } catch (error) {
            reject(error);
        }
    }

    LegacyPromise.resolve = function (value) {
        if (value instanceof LegacyPromise) {
            return value;
        }
        return new LegacyPromise(function (resolve) { resolve(value); });
    };

    LegacyPromise.reject = function (reason) {
        return new LegacyPromise(function (resolve, reject) { reject(reason); });
    };

    LegacyPromise.all = function (items) {
        return new LegacyPromise(function (resolve, reject) {
            var results = [];
            var remaining = items.length;
            var index;
            if (!remaining) {
                resolve(results);
                return;
            }
            for (index = 0; index < items.length; index += 1) {
                resolvePromiseItem(items[index], index, results, function () {
                    remaining -= 1;
                    if (!remaining) {
                        resolve(results);
                    }
                }, reject);
            }
        });
    };

    LegacyPromise.race = function (items) {
        return new LegacyPromise(function (resolve, reject) {
            var index;
            for (index = 0; index < items.length; index += 1) {
                LegacyPromise.resolve(items[index]).then(resolve, reject);
            }
        });
    };

    LegacyPromise.prototype.then = function (onFulfilled, onRejected) {
        var self = this;
        return new LegacyPromise(function (resolve, reject) {
            handle(self, {
                onFulfilled: onFulfilled,
                onRejected: onRejected,
                resolve: resolve,
                reject: reject
            });
        });
    };

    LegacyPromise.prototype.catch = function (onRejected) {
        return this.then(null, onRejected);
    };

    function settle(promise, state, value) {
        if (promise.state !== 'pending') {
            return;
        }
        if (state === 'fulfilled' && value && typeof value.then === 'function') {
            value.then(function (resolved) { settle(promise, 'fulfilled', resolved); }, function (reason) { settle(promise, 'rejected', reason); });
            return;
        }
        promise.state = state;
        promise.value = value;
        flushHandlers(promise);
    }

    function handle(promise, handler) {
        if (promise.state === 'pending') {
            promise.handlers.push(handler);
            return;
        }
        asyncCall(function () {
            var callback = promise.state === 'fulfilled' ? handler.onFulfilled : handler.onRejected;
            var result;
            if (typeof callback !== 'function') {
                (promise.state === 'fulfilled' ? handler.resolve : handler.reject)(promise.value);
                return;
            }
            try {
                result = callback(promise.value);
                handler.resolve(result);
            } catch (error) {
                handler.reject(error);
            }
        });
    }

    function flushHandlers(promise) {
        var index;
        for (index = 0; index < promise.handlers.length; index += 1) {
            handle(promise, promise.handlers[index]);
        }
        promise.handlers = [];
    }

    function asyncCall(callback) {
        window.setTimeout(callback, 0);
    }

    function resolvePromiseItem(item, index, results, onDone, reject) {
        LegacyPromise.resolve(item).then(function (value) {
            results[index] = value;
            onDone();
        }, reject);
    }

    function LegacyURLSearchParams(query) {
        this.items = [];
        parseSearchParams(this, query || '');
    }

    LegacyURLSearchParams.prototype.append = function (name, value) {
        this.items.push([String(name), String(value)]);
    };

    LegacyURLSearchParams.prototype.get = function (name) {
        var index;
        name = String(name);
        for (index = 0; index < this.items.length; index += 1) {
            if (this.items[index][0] === name) {
                return this.items[index][1];
            }
        }
        return null;
    };

    LegacyURLSearchParams.prototype.has = function (name) {
        return this.get(name) !== null;
    };

    LegacyURLSearchParams.prototype.toString = function () {
        return mapArray(this.items, function (item) {
            return encodeURIComponent(item[0]) + '=' + encodeURIComponent(item[1]);
        }).join('&');
    };

    function parseSearchParams(params, query) {
        var pairs;
        var index;
        var pair;
        if (query.charAt(0) === '?') {
            query = query.slice(1);
        }
        if (!query) {
            return;
        }
        pairs = query.split('&');
        for (index = 0; index < pairs.length; index += 1) {
            pair = pairs[index].split('=');
            params.append(decodeURIComponent(pair[0] || ''), decodeURIComponent(pair[1] || ''));
        }
    }

    function applyCssVariableFallbacks(variables) {
        var style = document.createElement('style');
        var css = '';
        var selector;
        var property;
        for (selector in variables) {
            if (Object.prototype.hasOwnProperty.call(variables, selector)) {
                css += selector + '{';
                for (property in variables[selector]) {
                    if (Object.prototype.hasOwnProperty.call(variables[selector], property)) {
                        css += property + ':' + variables[selector][property] + ';';
                    }
                }
                css += '}';
            }
        }
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    function loadWasmOrFallback(name, wasmUrl, imports) {
        var fallbackUrl = config.wasmFallbacks && config.wasmFallbacks[name];
        if (tests.webAssembly && tests.fetch && window.WebAssembly.instantiateStreaming) {
            return window.WebAssembly.instantiateStreaming(window.fetch(wasmUrl), imports || {});
        }
        if (tests.webAssembly && tests.fetch && window.WebAssembly.instantiate) {
            return window.fetch(wasmUrl).then(function (response) {
                return response.arrayBuffer();
            }).then(function (bytes) {
                return window.WebAssembly.instantiate(bytes, imports || {});
            });
        }
        if (fallbackUrl) {
            return new window.Promise(function (resolve, reject) {
                loadScript(fallbackUrl, function () { resolve(window[name]); }, reject);
            });
        }
        return window.Promise.reject(new Error('No WebAssembly support or fallback for ' + name));
    }

    function mapArray(items, callback) {
        var results = [];
        var index;
        for (index = 0; index < items.length; index += 1) {
            results.push(callback(items[index], index));
        }
        return results;
    }

    function fetchWithXhr(input, init) {
        init = init || {};
        return new window.Promise(function (resolve, reject) {
            var xhr = new window.XMLHttpRequest();
            var method = init.method || 'GET';
            var headers = init.headers || {};
            var body = init.body || null;
            var key;

            xhr.open(method, input, true);
            for (key in headers) {
                if (Object.prototype.hasOwnProperty.call(headers, key)) {
                    xhr.setRequestHeader(key, headers[key]);
                }
            }
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    resolve({
                        ok: xhr.status >= 200 && xhr.status < 300,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        url: input,
                        text: function () { return window.Promise.resolve(xhr.responseText); },
                        json: function () { return window.Promise.resolve(JSON.parse(xhr.responseText)); }
                    });
                }
            };
            xhr.onerror = reject;
            xhr.ontimeout = reject;
            xhr.send(body);
        });
    }

    function loadScriptsInOrder(urls, onReady, onError) {
        var index = 0;
        function next() {
            if (index >= urls.length) {
                if (typeof onReady === 'function') {
                    onReady();
                }
                return;
            }
            loadScript(urls[index], function () {
                index += 1;
                next();
            }, onError);
        }
        next();
    }

    function loadScript(url, onLoad, onError) {
        var script = document.createElement('script');
        script.src = url;
        script.async = false;
        script.onload = onLoad || null;
        script.onerror = onError || null;
        document.head.appendChild(script);
    }

    function loadStylesheets(urls) {
        var index;
        for (index = 0; index < urls.length; index += 1) {
            loadStylesheet(urls[index]);
        }
    }

    function loadStylesheet(url) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
    }

    function supportsCssVariables() {
        return !!(window.CSS && window.CSS.supports && window.CSS.supports('--legacy-webkit-test', '0'));
    }

    function supportsModules() {
        var script = document.createElement('script');
        return 'noModule' in script;
    }

    function supportsCustomEvent() {
        try {
            new window.CustomEvent('legacy-webkit-test');
            return true;
        } catch (error) {
            return false;
        }
    }

    function addClass(className) {
        if (root.classList) {
            root.classList.add(className);
        } else {
            root.className += ' ' + className;
        }
    }

    function indexOfSameValueZero(list, searchElement, fromIndex) {
        var length = list.length >>> 0;
        var index = Math.max(fromIndex || 0, 0);
        var current;
        while (index < length) {
            current = list[index];
            if (current === searchElement || (current !== current && searchElement !== searchElement)) {
                return index;
            }
            index += 1;
        }
        return -1;
    }
}(window, document));
