//  The scene that owns the window.
//
//  UIKit requires the scene life cycle of any app built with a current SDK.
//  Before this file the app delegate created a `UIWindow` from
//  `UIScreen.main.bounds` and UIKit logged a fault saying so:
//
//    `UIScene` life cycle is now required when building with the latest SDKs.
//    Apps that don't adopt will fail to launch.
//
//  That is not a review problem, it is a launch problem: built against the SDK
//  that enforces it, the app is terminated before anyone sees it. The shell used
//  none of the app-delegate state callbacks the migration takes away, so this is
//  the whole of the change on the code side. The other half is the
//  `UIApplicationSceneManifest` in Support/Info.plist, which names this class.

import UIKit

@MainActor
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        // The manifest asks only for a window scene, so anything else is a
        // scene this build does not serve rather than a state to recover from.
        guard let windowScene = scene as? UIWindowScene else { return }

        // Built from the scene, not from `UIScreen.main`. A window tied to the
        // screen rather than to its scene is the mistake the fault was naming.
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = ShellRoot.make()
        self.window = window
        window.makeKeyAndVisible()
    }
}
