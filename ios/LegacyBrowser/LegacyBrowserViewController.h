#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

@interface LegacyBrowserViewController : UIViewController <WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler>
@end
