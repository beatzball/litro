//  The entry point, and nothing more.
//
//  Under the scene life cycle a window belongs to a scene, so everything that
//  used to happen here -- reading the configuration, building the modules,
//  creating the window -- moved to SceneDelegate and ShellRoot. What is left is
//  the `@main` attribute and the one hook UIKit still calls on the application
//  itself.
//
//  This file staying almost empty is the point. An app delegate that grows UI
//  back is how an app ends up with two owners of one window.

import UIKit

@main
@MainActor
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        true
    }
}
