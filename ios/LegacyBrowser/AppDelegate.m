#import "AppDelegate.h"
#import "LegacyBrowserViewController.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    self.window = [[UIWindow alloc] initWithFrame:[[UIScreen mainScreen] bounds]];
    self.window.rootViewController = [[LegacyBrowserViewController alloc] init];
    [self.window makeKeyAndVisible];
    return YES;
}

@end
