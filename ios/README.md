# LegacyBrowser iOS target

Open `LegacyBrowser.xcodeproj` with Xcode 7.3 or newer and build the `LegacyBrowser` target for an iOS 9.3 device or simulator.

The project compiles the Objective-C WKWebView host and copies these folders into the app bundle:

- `browser-shell/` for the ES5 browser chrome.
- `legacy-webkit/` for the compatibility loader and CSS fallbacks.

The target sets `IPHONEOS_DEPLOYMENT_TARGET = 9.3`, links `UIKit.framework` and `WebKit.framework`, and uses `ios/LegacyBrowser/Info.plist`.
