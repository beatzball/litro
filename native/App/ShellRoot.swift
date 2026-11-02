//  Builds the view controller a window starts on.
//
//  Reading the app's configuration and constructing only the modules it turned
//  on used to live in the app delegate. It moved here when the shell adopted the
//  scene life cycle, because a scene owns the window now and the app delegate
//  owns nothing UI-shaped. Keeping it in one function also means a second scene,
//  if this shell ever wants one, starts from the same place.

import UIKit
import LitroBridge
import LitroShellKit

@MainActor
enum ShellRoot {
    /// The root view controller, or the failure screen when the app cannot
    /// start at all.
    static func make() -> UIViewController {
        do {
            let configuration = try AppConfiguration.load()
            let dispatcher = BridgeDispatcher(
                info: shellInfo(),
                // A module the app did not turn on is never constructed. That
                // single fact drives the handshake too, so a build cannot
                // advertise a capability it cannot serve.
                haptics: configuration.capabilities.contains(.haptics) ? HapticsModule() : nil,
                badging: configuration.capabilities.contains(.badging) ? BadgingModule() : nil
            )
            return ShellViewController(configuration: configuration, dispatcher: dispatcher)
        } catch {
            // Shown rather than logged. A shell that failed to find its config
            // and launched to a blank screen is the hardest version of this
            // mistake to diagnose, and the copy step is easy to skip.
            return FailureViewController(message: String(describing: error))
        }
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
