# webkit

This repository contains a compatibility strategy for supporting iOS 9.3-era WebKit while still serving modern JavaScript and CSS to capable browsers.

## Legacy WebKit path

Use `legacy-webkit/compat-loader.js` as the first application script. The loader is ES5-only, detects modern browser features, adds capability classes to `<html>`, and loads either a modern bundle or an iOS 9.3-safe legacy bundle.

The legacy path is designed for compatibility with modern websites by combining:

- ES5-transpiled application code for iOS 9.3.
- Built-in JavaScript compatibility shims for Promise, Promise.finally, Promise.allSettled, queueMicrotask, URLSearchParams, fetch, DOM traversal, and other APIs that can be safely emulated.
- CSS fallbacks in `legacy-webkit/legacy-fallbacks.css`, plus optional runtime CSS-variable fallback injection.
- Runtime feature detection for WebAssembly, CSS variables, modules, fetch, Promise, DOM APIs, and related APIs.
- Progressive enhancement so unsupported engine features do not block page rendering.

WebAssembly and new syntax cannot be fully polyfilled on iOS 9.3, so the compatibility layer exposes `LegacyWebKitCompat.loadWasmOrFallback()` to load a JavaScript implementation when native WebAssembly is unavailable. Sites should ship ES5 legacy bundles for old WebKit and modern bundles for capable browsers.

See `examples/legacy-webkit.html` for the expected boot order.


## iOS 9.3 browser shell prototype

`browser-shell/index.html` is an ES5-compatible browser chrome prototype for a native iOS 9.3 WKWebView host. It provides an address bar, tab strip, navigation controls, feature badges, and a JavaScript bridge named `LegacyBrowser` for native WebView operations.

When embedded in a native iOS shell, the bridge should map these actions to WKWebView operations:

- `load`: navigate the active WebView to the normalized URL.
- `back` / `forward` / `reload`: invoke the matching WebView navigation command.
- Native navigation callbacks should call `LegacyBrowserShell.onNativeNavigationState()` with URL, title, history, and TLS status.

The included iframe fallback is only for local development. Modern login compatibility and new TLS protocol support require the native iOS networking/WebView stack to provide cookies, credential persistence, certificate validation, and TLS negotiation.

## Native iOS 9.3 WKWebView wrapper

`ios/LegacyBrowser/` contains an Objective-C WKWebView host skeleton for iOS 9.3. It embeds the ES5 browser shell as the chrome WebView and creates separate content WKWebViews for page tabs.

The wrapper provides the native side of the `LegacyBrowser` bridge:

- Receives shell actions through `WKScriptMessageHandler`.
- Maps `load`, `back`, `forward`, `reload`, and `close` to WKWebView operations.
- Shares cookies/session state with a common `WKProcessPool`.
- Enables JavaScript popups and inline media where supported by iOS 9.3.
- Publishes URL, title, back/forward state, and TLS status back to `LegacyBrowserShell.onNativeNavigationState()`.

Newer TLS protocol support is limited by the iOS 9.3 system networking stack. The wrapper preserves HTTPS, cookie, and credential behavior available from WKWebView, while the compatibility layer supplies JavaScript/CSS shims above it.


## Buildable Xcode target

`ios/LegacyBrowser.xcodeproj` is a minimal Xcode project for the native wrapper. It builds the `LegacyBrowser` app target with `IPHONEOS_DEPLOYMENT_TARGET = 9.3`, links UIKit/WebKit, uses `ios/LegacyBrowser/Info.plist`, and copies `browser-shell/` plus `legacy-webkit/` into the app bundle.

On macOS with Xcode installed, build with:

```sh
xcodebuild -project ios/LegacyBrowser.xcodeproj -scheme LegacyBrowser -configuration Debug -sdk iphonesimulator
```
