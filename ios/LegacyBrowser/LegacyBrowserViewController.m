#import "LegacyBrowserViewController.h"

static NSString * const LegacyBrowserMessageHandlerName = @"LegacyBrowser";
static NSString * const BrowserShellResourceName = @"index";
static NSString * const BrowserShellResourceType = @"html";

@interface LegacyBrowserTab : NSObject
@property (nonatomic, assign) NSInteger tabId;
@property (nonatomic, strong) WKWebView *webView;
@property (nonatomic, copy) NSString *title;
@property (nonatomic, copy) NSString *lastURL;
@property (nonatomic, copy) NSString *tlsStatus;
@end

@implementation LegacyBrowserTab
@end

@interface LegacyBrowserViewController ()
@property (nonatomic, strong) WKWebView *chromeView;
@property (nonatomic, strong) UIView *contentContainer;
@property (nonatomic, strong) WKProcessPool *processPool;
@property (nonatomic, strong) NSMutableDictionary *tabsById;
@property (nonatomic, assign) NSInteger activeTabId;
@property (nonatomic, assign) NSInteger nextTabId;
@end

@implementation LegacyBrowserViewController

- (void)viewDidLoad
{
    [super viewDidLoad];
    self.view.backgroundColor = [UIColor whiteColor];
    self.processPool = [[WKProcessPool alloc] init];
    self.tabsById = [NSMutableDictionary dictionary];
    self.nextTabId = 1;
    [self installChromeView];
    [self installContentContainer];
    [self loadBrowserShell];
}

- (void)viewDidLayoutSubviews
{
    [super viewDidLayoutSubviews];
    CGFloat chromeHeight = 156.0;
    self.chromeView.frame = CGRectMake(0.0, 0.0, self.view.bounds.size.width, chromeHeight);
    self.contentContainer.frame = CGRectMake(0.0, chromeHeight, self.view.bounds.size.width, self.view.bounds.size.height - chromeHeight);
    [self layoutActiveWebView];
}

- (void)installChromeView
{
    WKUserContentController *userContentController = [[WKUserContentController alloc] init];
    [userContentController addScriptMessageHandler:self name:LegacyBrowserMessageHandlerName];

    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    configuration.processPool = self.processPool;
    configuration.userContentController = userContentController;
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = YES;

    self.chromeView = [[WKWebView alloc] initWithFrame:CGRectZero configuration:configuration];
    self.chromeView.navigationDelegate = self;
    self.chromeView.UIDelegate = self;
    self.chromeView.scrollView.scrollEnabled = NO;
    [self.view addSubview:self.chromeView];
}

- (void)installContentContainer
{
    self.contentContainer = [[UIView alloc] initWithFrame:CGRectZero];
    self.contentContainer.backgroundColor = [UIColor whiteColor];
    [self.view addSubview:self.contentContainer];
}

- (void)loadBrowserShell
{
    NSString *path = [[NSBundle mainBundle] pathForResource:BrowserShellResourceName ofType:BrowserShellResourceType inDirectory:@"browser-shell"];
    if (!path) {
        path = [[NSBundle mainBundle] pathForResource:BrowserShellResourceName ofType:BrowserShellResourceType];
    }
    if (path) {
        NSURL *url = [NSURL fileURLWithPath:path];
        [self.chromeView loadFileURL:url allowingReadAccessToURL:[url URLByDeletingLastPathComponent]];
    }
}

- (LegacyBrowserTab *)createTabIfNeeded:(NSNumber *)tabId
{
    LegacyBrowserTab *tab = [self.tabsById objectForKey:tabId];
    if (tab) {
        return tab;
    }

    WKWebViewConfiguration *configuration = [[WKWebViewConfiguration alloc] init];
    configuration.processPool = self.processPool;
    configuration.preferences.javaScriptCanOpenWindowsAutomatically = YES;
    configuration.allowsInlineMediaPlayback = YES;

    tab = [[LegacyBrowserTab alloc] init];
    tab.tabId = [tabId integerValue];
    tab.tlsStatus = @"unknown";
    tab.webView = [[WKWebView alloc] initWithFrame:self.contentContainer.bounds configuration:configuration];
    tab.webView.navigationDelegate = self;
    tab.webView.UIDelegate = self;
    tab.webView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    tab.webView.hidden = YES;
    [self.contentContainer addSubview:tab.webView];
    [self.tabsById setObject:tab forKey:tabId];
    return tab;
}

- (void)activateTab:(NSNumber *)tabId
{
    LegacyBrowserTab *tab = [self createTabIfNeeded:tabId];
    self.activeTabId = [tabId integerValue];
    for (NSNumber *key in self.tabsById) {
        LegacyBrowserTab *candidate = [self.tabsById objectForKey:key];
        candidate.webView.hidden = ![candidate isEqual:tab];
    }
    [self layoutActiveWebView];
    [self publishNavigationStateForTab:tab];
}

- (void)layoutActiveWebView
{
    LegacyBrowserTab *tab = [self.tabsById objectForKey:@(self.activeTabId)];
    tab.webView.frame = self.contentContainer.bounds;
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message
{
    if (![message.name isEqualToString:LegacyBrowserMessageHandlerName] || ![message.body isKindOfClass:[NSDictionary class]]) {
        return;
    }

    NSDictionary *body = (NSDictionary *)message.body;
    NSString *action = [body objectForKey:@"action"];
    NSNumber *tabId = [body objectForKey:@"tabId"] ?: @(self.nextTabId++);
    [self activateTab:tabId];

    if ([action isEqualToString:@"load"]) {
        [self loadURLString:[body objectForKey:@"url"] inTab:[self.tabsById objectForKey:tabId]];
    } else if ([action isEqualToString:@"back"]) {
        WKWebView *webView = ((LegacyBrowserTab *)[self.tabsById objectForKey:tabId]).webView;
        if ([webView canGoBack]) {
            [webView goBack];
        }
    } else if ([action isEqualToString:@"forward"]) {
        WKWebView *webView = ((LegacyBrowserTab *)[self.tabsById objectForKey:tabId]).webView;
        if ([webView canGoForward]) {
            [webView goForward];
        }
    } else if ([action isEqualToString:@"reload"]) {
        [((LegacyBrowserTab *)[self.tabsById objectForKey:tabId]).webView reload];
    } else if ([action isEqualToString:@"close"]) {
        [self closeTab:tabId];
    }
}

- (void)loadURLString:(NSString *)urlString inTab:(LegacyBrowserTab *)tab
{
    if (![urlString isKindOfClass:[NSString class]] || [urlString length] == 0 || [urlString isEqualToString:@"about:blank"]) {
        [tab.webView loadHTMLString:@"" baseURL:nil];
        return;
    }

    NSURL *url = [NSURL URLWithString:urlString];
    if (!url) {
        return;
    }

    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
    [request setHTTPShouldHandleCookies:YES];
    [request setTimeoutInterval:30.0];
    [tab.webView loadRequest:request];
}

- (void)closeTab:(NSNumber *)tabId
{
    LegacyBrowserTab *tab = [self.tabsById objectForKey:tabId];
    [tab.webView removeFromSuperview];
    [self.tabsById removeObjectForKey:tabId];
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation
{
    LegacyBrowserTab *tab = [self tabForWebView:webView];
    if (!tab) {
        return;
    }
    tab.title = webView.title ?: @"";
    tab.lastURL = webView.URL.absoluteString ?: @"about:blank";
    tab.tlsStatus = [self tlsStatusForURL:webView.URL];
    [self publishNavigationStateForTab:tab];
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error
{
    LegacyBrowserTab *tab = [self tabForWebView:webView];
    if (tab) {
        tab.title = [error localizedDescription] ?: @"Load failed";
        [self publishNavigationStateForTab:tab];
    }
}

- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration forNavigationAction:(WKNavigationAction *)navigationAction windowFeatures:(WKWindowFeatures *)windowFeatures
{
    if (!navigationAction.targetFrame.isMainFrame) {
        NSNumber *tabId = @(self.nextTabId++);
        LegacyBrowserTab *tab = [self createTabIfNeeded:tabId];
        [self activateTab:tabId];
        return tab.webView;
    }
    return nil;
}

- (LegacyBrowserTab *)tabForWebView:(WKWebView *)webView
{
    for (NSNumber *key in self.tabsById) {
        LegacyBrowserTab *tab = [self.tabsById objectForKey:key];
        if ([tab.webView isEqual:webView]) {
            return tab;
        }
    }
    return nil;
}

- (NSString *)tlsStatusForURL:(NSURL *)url
{
    if (![[url scheme] isEqualToString:@"https"]) {
        return @"not-https";
    }
    return @"system-tls";
}

- (void)publishNavigationStateForTab:(LegacyBrowserTab *)tab
{
    if (!tab) {
        return;
    }

    NSDictionary *state = @{
        @"tabId": @(tab.tabId),
        @"url": tab.webView.URL.absoluteString ?: tab.lastURL ?: @"about:blank",
        @"title": tab.webView.title ?: tab.title ?: @"",
        @"canGoBack": @([tab.webView canGoBack]),
        @"canGoForward": @([tab.webView canGoForward]),
        @"tls": tab.tlsStatus ?: @"unknown"
    };
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:state options:0 error:nil];
    NSString *json = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
    NSString *script = [NSString stringWithFormat:@"window.LegacyBrowserShell && window.LegacyBrowserShell.onNativeNavigationState(%@);", json];
    [self.chromeView evaluateJavaScript:script completionHandler:nil];
}

- (void)dealloc
{
    [self.chromeView.configuration.userContentController removeScriptMessageHandlerForName:LegacyBrowserMessageHandlerName];
}

@end
