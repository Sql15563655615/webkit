# GeckoView on iOS 9.3 Compatibility Decision

## Decision

Do not attempt to compile modern Firefox GeckoView for iOS 9.3. GeckoView is an Android embedding API for the Gecko engine, while iOS applications are required to use Apple's WebKit-based browser engine APIs. A modern GeckoView build therefore cannot be shipped as a compliant iOS 9.3 browser engine.

## Requested capability target

The requested target combines these requirements:

- iOS 9.3 runtime compatibility.
- Latest JavaScript features, including WebAssembly, ES2020 and newer syntax and built-ins, and newer Promise APIs.
- Modern CSS features.
- A Firefox GeckoView-based engine.

These requirements are mutually incompatible for a production iOS application. iOS 9.3 predates WebAssembly support in Apple's system WebKit, lacks many ES2020-era JavaScriptCore features, and cannot host the Android GeckoView runtime.

## Recommended implementation strategy

Use the repository's legacy WebKit compatibility path instead of a GeckoView port. The path is implemented by `legacy-webkit/compat-loader.js`, `legacy-webkit/legacy-fallbacks.css`, and the boot example in `examples/legacy-webkit.html`.

1. Treat iOS 9.3 as a legacy WebKit target.
2. Load `compat-loader.js` before application code so iOS 9.3 only parses ES5-safe JavaScript.
3. Serve transpiled ES5 JavaScript bundles to iOS 9.3 devices.
4. Install compatibility shims for supported JavaScript APIs, including Promise, Promise.finally, Promise.allSettled, queueMicrotask, URLSearchParams, fetch, DOM traversal, and other APIs that can be implemented faithfully in JavaScript.
5. Apply CSS fallbacks through the `.legacy-webkit`, `.no-wasm`, and related capability classes, and inject configured CSS-variable fallbacks when native variables are missing.
6. Route WebAssembly modules through `LegacyWebKitCompat.loadWasmOrFallback()` so iOS 9.3 can use a JavaScript implementation instead of losing the feature entirely.
7. Do not advertise native WebAssembly, modern syntax parsing, or modern CSS support on iOS 9.3 when those features require native engine support.
8. Serve a modern bundle with WebAssembly, ES2020+, modern Promise APIs, and modern CSS to current browsers and operating systems.
9. If Firefox engine behavior is required, target supported Android devices with GeckoView rather than iOS 9.3.

## Build policy

A build system for this repository should reject the unsupported combination explicitly:

- Engine: GeckoView
- Platform: iOS
- Minimum OS: 9.3
- Required features: WebAssembly, ES2020+, new Promise APIs, modern CSS

The supported fallback is:

- Engine: system WebKit
- Platform: iOS
- Minimum OS: 9.3
- JavaScript bundle: ES5 plus carefully selected polyfills
- Feature delivery: runtime feature detection and progressive enhancement

## Runtime feature policy

Use feature detection rather than user-agent assumptions. The application should select one of two delivery paths:

- Modern path: native WebAssembly, ES2020+ syntax and built-ins, modern Promise APIs, and modern CSS.
- Legacy iOS 9.3 path: no WebAssembly requirement, ES5-compatible syntax, polyfilled APIs where safe, and CSS fallbacks.

## Rationale

This approach keeps the application deployable on iOS 9.3 without falsely claiming support for engine-level capabilities that the platform cannot provide. It also preserves a fully modern path for browsers and platforms that actually support the requested JavaScript and CSS features.


## Browser shell target

The repository now includes `browser-shell/index.html` and `browser-shell/browser-shell.js` as an ES5 browser chrome prototype for old iPads. The shell is intended to be hosted by a native iOS 9.3 WKWebView wrapper that owns actual page navigation, TLS negotiation, cookie persistence, and login sessions.

The JavaScript shell provides Chrome-like controls on top of that host:

- Address/search input with URL normalization.
- Back, forward, reload, new-tab, and close-tab controls.
- Tab strip state and native navigation-state callbacks.
- HTML5, CSS3, ES2017 compatibility, WebGL, fetch, TLS bridge, and login-readiness feature badges.
- WKScriptMessageHandler bridge support through `window.webkit.messageHandlers.LegacyBrowser`.

The iframe fallback in the static demo is not a replacement for a native WebView because many modern sites block framing. Production iOS 9.3 builds should connect the shell bridge to real WKWebView instances.

## Native wrapper target

The `ios/LegacyBrowser/` Objective-C skeleton is the native side of the browser. It uses WKWebView instead of GeckoView, shares a `WKProcessPool` for login/session continuity, and bridges browser-shell actions through `WKScriptMessageHandler`.

The native wrapper is responsible for the capabilities that JavaScript cannot polyfill:

- HTTPS loading and certificate validation.
- TLS negotiation provided by the iOS 9.3 networking stack.
- Cookie and credential persistence for modern website login flows.
- WebGL and media behavior exposed by WKWebView.
- Popup/new-window handling through WKUIDelegate.
