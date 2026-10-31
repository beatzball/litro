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
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            return decisionHandler(.cancel)
        }
        if configuration.allows(url) {
            return decisionHandler(.allow)
        }
        if navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }
}
