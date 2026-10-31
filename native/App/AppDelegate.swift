//  The entry point: read the app's configuration, build only the modules it
//  turned on, and show the web view.

import UIKit
import LitroBridge
import LitroShellKit

@main
@MainActor
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        self.window = window

        do {
            let configuration = try AppConfiguration.load()
            let dispatcher = BridgeDispatcher(
                info: Self.shellInfo(),
                // A module the app did not turn on is never constructed. That
                // single fact drives the handshake too, so a build cannot
                // advertise a capability it cannot serve.
                haptics: configuration.capabilities.contains(.haptics) ? HapticsModule() : nil,
                badging: configuration.capabilities.contains(.badging) ? BadgingModule() : nil
            )
            window.rootViewController = ShellViewController(configuration: configuration,
                                                            dispatcher: dispatcher)
        } catch {
            // Shown rather than logged. A shell that failed to find its config
            // and launched to a blank screen is the hardest version of this
            // mistake to diagnose, and the copy step is easy to skip.
            window.rootViewController = FailureViewController(message: String(describing: error))
        }

        window.makeKeyAndVisible()
        return true
    }

    /// What this build reports in the handshake.
    private static func shellInfo() -> ShellInfo {
        ShellInfo(
            os: "ios",
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String,
            osVersion: UIDevice.current.systemVersion
        )
    }
}

/// The screen a build shows when it cannot start.
@MainActor
final class FailureViewController: UIViewController {
    private let message: String

    init(message: String) {
        self.message = message
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not from a storyboard") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let label = UILabel()
        label.text = message
        label.numberOfLines = 0
        label.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        label.textColor = .label
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)

        let guide = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 20),
            label.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -20),
            label.topAnchor.constraint(equalTo: guide.topAnchor, constant: 20),
        ])
    }
}
