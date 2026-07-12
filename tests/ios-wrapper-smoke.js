'use strict';

const assert = require('assert');
const fs = require('fs');

const viewController = fs.readFileSync('ios/LegacyBrowser/LegacyBrowserViewController.m', 'utf8');
const header = fs.readFileSync('ios/LegacyBrowser/LegacyBrowserViewController.h', 'utf8');
const appDelegate = fs.readFileSync('ios/LegacyBrowser/AppDelegate.m', 'utf8');

assert(header.includes('WKScriptMessageHandler'));
assert(viewController.includes('LegacyBrowserMessageHandlerName = @"LegacyBrowser"'));
assert(viewController.includes('WKProcessPool'));
assert(viewController.includes('javaScriptCanOpenWindowsAutomatically = YES'));
assert(viewController.includes('allowsInlineMediaPlayback = YES'));
assert(viewController.includes('loadRequest:request'));
assert(viewController.includes('HTTPShouldHandleCookies'));
assert(viewController.includes('onNativeNavigationState'));
assert(viewController.includes('system-tls'));
assert(header.includes('WKNavigationDelegate'));
assert(appDelegate.includes('LegacyBrowserViewController'));

const project = fs.readFileSync('ios/LegacyBrowser.xcodeproj/project.pbxproj', 'utf8');
const plist = fs.readFileSync('ios/LegacyBrowser/Info.plist', 'utf8');
assert(project.includes('IPHONEOS_DEPLOYMENT_TARGET = 9.3'));
assert(project.includes('WebKit.framework'));
assert(project.includes('UIKit.framework'));
assert(project.includes('browser-shell in Resources'));
assert(project.includes('legacy-webkit in Resources'));
assert(plist.includes('<string>9.3</string>'));
assert(plist.includes('NSAppTransportSecurity'));
