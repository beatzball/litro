//  The host: one web view, one bridge, one allowlist.

import UIKit
import WebKit
import LitroBridge
import LitroShellKit

@MainActor
final class ShellViewController: UIViewController {
    private let configuration: AppConfiguration
    private let transport: BridgeTransport
    private var webView: WKWebView!

    init(configuration: AppConfiguration, dispatcher: BridgeDispatcher) {
        self.configuration = configuration
        self.transport = BridgeTransport(dispatcher: dispatcher)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not from a storyboard") }

    override func loadView() {
        let content = WKWebViewConfiguration()
        content.userContentController.add(transport, name: handlerName)
        content.userContentController.addUserScript(BridgeTransport.markerScript)

        webView = WKWebView(frame: .zero, configuration: content)
        webView.navigationDelegate = self
        // The page owns the whole window. A bounce past the edges exposes the
        // view behind it and gives away that this is a web view.
        webView.scrollView.bounces = false
        transport.webView = webView
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: configuration.startURL))
    }
}

extension ShellViewController: WKNavigationDelegate {
    /// Enforces the app's origin allowlist.
    ///
    /// Without this a link in page content turns the shell into a general
    /// purpose browser running with the app's permissions. An outside URL the
    /// user actually tapped is handed to the system browser instead, which is
    /// what the user expects and keeps it out of the app's context.
    /// The async form, not the completion-handler one.
    ///
    /// The completion-handler signature acquired a `@MainActor` attribute on its
    /// closure, so writing it by hand produces a method that only *nearly*
    /// matches the protocol: it compiles with a warning and is never called.
    /// That failure is silent and total -- the allowlist simply does not run.
    /// The async form has no closure to get wrong.
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        guard let url = navigationAction.request.url else { return .cancel }
        if configuration.allows(url) { return .allow }
        if navigationAction.navigationType == .linkActivated {
            // The result says whether the system found a handler. There is
            // nothing useful to do when it did not -- the navigation is refused
            // either way -- so it is discarded rather than branched on.
            _ = await UIApplication.shared.open(url)
        }
        return .cancel
    }
}
