import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import Firebase
import GoogleMaps
@main
class AppDelegate: RCTAppDelegate {
  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    // Prefer a platform-restricted Maps key supplied by build settings. Reuse the
    // bundled Google configuration when no separate Maps key is configured.
    let configuredMapsKey = Bundle.main.object(forInfoDictionaryKey: "GoogleMapsAPIKey") as? String ?? ""
    let googleConfigPath = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist")
    let googleConfig = googleConfigPath.flatMap { NSDictionary(contentsOfFile: $0) }
    let mapsKey = !configuredMapsKey.isEmpty && !configuredMapsKey.hasPrefix("$(")
      ? configuredMapsKey : (googleConfig?["API_KEY"] as? String ?? "")
    if !mapsKey.isEmpty { GMSServices.provideAPIKey(mapsKey) }
    self.moduleName = "GTPL"
    self.dependencyProvider = RCTAppDependencyProvider()
    if FirebaseApp.app() == nil { FirebaseApp.configure() }
    // You can add your custom initial props in the dictionary below.
    // They will be passed down to the ViewController used by React Native.
    // FirebaseApp.configure()
    self.initialProps = [:]
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
