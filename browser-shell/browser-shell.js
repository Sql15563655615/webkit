/* ES5 browser shell runtime for iOS 9.3 WKWebView hosts. */
(function (window, document) {
    'use strict';

    var shell;

    function BrowserShell(root) {
        this.root = root;
        this.tabs = [];
        this.activeTabId = null;
        this.nextTabId = 1;
        this.bridge = createBridge();
        this.elements = queryElements(root);
        this.features = detectFeatures();
        bindEvents(this);
        renderFeatures(this);
        this.newTab('https://example.com');
    }

    BrowserShell.prototype.newTab = function (url) {
        var tab = {
            id: this.nextTabId,
            title: '新标签页',
            url: normalizeUrl(url || 'about:blank'),
            canGoBack: false,
            canGoForward: false,
            tls: 'unknown'
        };
        this.nextTabId += 1;
        this.tabs.push(tab);
        this.activateTab(tab.id);
    };

    BrowserShell.prototype.activateTab = function (id) {
        this.activeTabId = id;
        this.load(getActiveTab(this).url);
        renderTabs(this);
    };

    BrowserShell.prototype.load = function (url) {
        var tab = getActiveTab(this);
        if (!tab) {
            return;
        }
        tab.url = normalizeUrl(url);
        this.elements.address.value = tab.url;
        this.elements.status.innerHTML = '正在加载 ' + escapeHtml(tab.url);
        this.bridge.load(tab.url, tab.id);
        renderTabs(this);
    };

    BrowserShell.prototype.goBack = function () {
        this.bridge.back(this.activeTabId);
    };

    BrowserShell.prototype.goForward = function () {
        this.bridge.forward(this.activeTabId);
    };

    BrowserShell.prototype.reload = function () {
        this.bridge.reload(this.activeTabId);
    };

    BrowserShell.prototype.closeActiveTab = function () {
        var index;
        if (this.tabs.length === 1) {
            this.load('about:blank');
            return;
        }
        for (index = 0; index < this.tabs.length; index += 1) {
            if (this.tabs[index].id === this.activeTabId) {
                this.tabs.splice(index, 1);
                break;
            }
        }
        this.activateTab(this.tabs[Math.max(0, index - 1)].id);
    };

    BrowserShell.prototype.onNativeNavigationState = function (state) {
        var tab = getTab(this, state.tabId || this.activeTabId);
        if (!tab) {
            return;
        }
        tab.url = state.url || tab.url;
        tab.title = state.title || tab.title;
        tab.canGoBack = !!state.canGoBack;
        tab.canGoForward = !!state.canGoForward;
        tab.tls = state.tls || tab.tls;
        if (tab.id === this.activeTabId) {
            this.elements.address.value = tab.url;
            this.elements.status.innerHTML = escapeHtml(tab.title || tab.url);
            updateButtons(this, tab);
        }
        renderTabs(this);
    };

    function createBridge() {
        var handlers = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.LegacyBrowser;
        var frame = document.getElementById('browser-frame');

        function post(action, payload) {
            payload = payload || {};
            payload.action = action;
            if (handlers && handlers.postMessage) {
                handlers.postMessage(payload);
                return;
            }
            if (action === 'load' && frame) {
                frame.src = payload.url;
            }
        }

        return {
            load: function (url, tabId) { post('load', { url: url, tabId: tabId }); },
            back: function (tabId) { post('back', { tabId: tabId }); },
            forward: function (tabId) { post('forward', { tabId: tabId }); },
            reload: function (tabId) { post('reload', { tabId: tabId }); },
            close: function (tabId) { post('close', { tabId: tabId }); }
        };
    }

    function queryElements(root) {
        return {
            address: root.querySelector('[data-role="address"]'),
            form: root.querySelector('[data-role="address-form"]'),
            tabs: root.querySelector('[data-role="tabs"]'),
            status: root.querySelector('[data-role="status"]'),
            features: root.querySelector('[data-role="features"]'),
            back: root.querySelector('[data-action="back"]'),
            forward: root.querySelector('[data-action="forward"]'),
            reload: root.querySelector('[data-action="reload"]'),
            close: root.querySelector('[data-action="close-tab"]'),
            newTab: root.querySelector('[data-action="new-tab"]')
        };
    }

    function bindEvents(instance) {
        instance.elements.form.onsubmit = function (event) {
            preventDefault(event);
            instance.load(instance.elements.address.value);
        };
        instance.elements.back.onclick = function () { instance.goBack(); };
        instance.elements.forward.onclick = function () { instance.goForward(); };
        instance.elements.reload.onclick = function () { instance.reload(); };
        instance.elements.close.onclick = function () { instance.closeActiveTab(); };
        instance.elements.newTab.onclick = function () { instance.newTab('about:blank'); };
    }

    function renderTabs(instance) {
        var html = '';
        var index;
        var tab;
        for (index = 0; index < instance.tabs.length; index += 1) {
            tab = instance.tabs[index];
            html += '<button type="button" class="tab-button' + (tab.id === instance.activeTabId ? ' is-active' : '') + '" data-tab-id="' + tab.id + '">' +
                escapeHtml(tab.title || tab.url) + '<span class="tls tls-' + escapeHtml(tab.tls) + '">' + escapeHtml(tab.tls) + '</span></button>';
        }
        instance.elements.tabs.innerHTML = html;
        bindTabButtons(instance);
        updateButtons(instance, getActiveTab(instance));
    }

    function bindTabButtons(instance) {
        var buttons = instance.elements.tabs.querySelectorAll('[data-tab-id]');
        var index;
        for (index = 0; index < buttons.length; index += 1) {
            buttons[index].onclick = function () {
                instance.activateTab(parseInt(this.getAttribute('data-tab-id'), 10));
            };
        }
    }

    function renderFeatures(instance) {
        var features = instance.features;
        var names = ['html5Storage', 'css3', 'es2017Compat', 'webgl', 'fetch', 'tlsBridge', 'modernLoginCompat'];
        var html = '';
        var index;
        var name;
        for (index = 0; index < names.length; index += 1) {
            name = names[index];
            html += '<span class="feature feature-' + (features[name] ? 'ok' : 'warn') + '">' + name + '</span>';
        }
        instance.elements.features.innerHTML = html;
    }

    function updateButtons(instance, tab) {
        tab = tab || {};
        instance.elements.back.disabled = !tab.canGoBack;
        instance.elements.forward.disabled = !tab.canGoForward;
    }

    function detectFeatures() {
        return {
            html5Storage: supportsLocalStorage(),
            css3: supportsCss3(),
            es2017Compat: !!(window.Promise && window.Promise.allSettled && Object.assign && Array.prototype.includes),
            webgl: supportsWebGL(),
            fetch: typeof window.fetch === 'function',
            tlsBridge: !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.LegacyBrowser),
            modernLoginCompat: supportsLocalStorage() && !!window.crypto && typeof window.fetch === 'function'
        };
    }

    function supportsLocalStorage() {
        try {
            window.localStorage.setItem('__legacy_browser_test__', '1');
            window.localStorage.removeItem('__legacy_browser_test__');
            return true;
        } catch (error) {
            return false;
        }
    }

    function supportsCss3() {
        var style = document.createElement('div').style;
        return 'transform' in style || 'webkitTransform' in style;
    }

    function supportsWebGL() {
        var canvas = document.createElement('canvas');
        var gl;
        try {
            gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (error) {
            return false;
        }
    }

    function normalizeUrl(value) {
        value = String(value || '').replace(/^\s+|\s+$/g, '');
        if (!value) {
            return 'about:blank';
        }
        if (/^(about:|https?:\/\/)/i.test(value)) {
            return value;
        }
        if (value.indexOf('.') !== -1 && value.indexOf(' ') === -1) {
            return 'https://' + value;
        }
        return 'https://www.google.com/search?q=' + encodeURIComponent(value);
    }

    function getActiveTab(instance) {
        return getTab(instance, instance.activeTabId);
    }

    function getTab(instance, id) {
        var index;
        for (index = 0; index < instance.tabs.length; index += 1) {
            if (instance.tabs[index].id === id) {
                return instance.tabs[index];
            }
        }
        return null;
    }

    function preventDefault(event) {
        if (event && event.preventDefault) {
            event.preventDefault();
        } else {
            window.event.returnValue = false;
        }
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"]/g, function (character) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character];
        });
    }

    window.LegacyBrowserShell = {
        start: function (root) {
            shell = new BrowserShell(root || document.getElementById('browser-shell'));
            return shell;
        },
        onNativeNavigationState: function (state) {
            if (shell) {
                shell.onNativeNavigationState(state || {});
            }
        }
    };
}(window, document));
