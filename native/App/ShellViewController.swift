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
    /// The screen shown over the web view when a navigation failed. Non-nil
    /// only while it is on screen.
    private var failureView: LoadFailureView?

    init(configuration: AppConfiguration, dispatcher: BridgeDispatcher) {
        self.configuration = configuration
        self.transport = BridgeTransport(dispatcher: dispatcher, configuration: configuration)
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

        // The web view is a child of a plain container rather than the root view
        // itself, so the failure screen can be its sibling. Added to the web
        // view it would scroll with the page content.
        let container = UIView()
        container.backgroundColor = .systemBackground
        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
        ])
        view = container
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        load()
    }

    /// Starts the app at its configured address.
    ///
    /// A provisional navigation that failed left no page behind, so there is
    /// nothing for `reload()` to reload. Retrying means starting again from the
    /// start URL.
    private func load() {
        webView.load(URLRequest(url: configuration.startURL))
    }

    private func show(_ failure: LoadFailure) {
        dismissFailure()
        let screen = LoadFailureView(failure: failure) { [weak self] in
            // The screen stays up until the retry has actually painted. Taking
            // it down on the tap uncovers the empty web view, which flashes the
            // container's background before the page arrives.
            self?.failureView?.markRetrying()
            self?.load()
        }
        screen.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(screen)
        NSLayoutConstraint.activate([
            screen.topAnchor.constraint(equalTo: view.topAnchor),
            screen.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            screen.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            screen.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        failureView = screen
    }

    private func dismissFailure() {
        failureView?.removeFromSuperview()
        failureView = nil
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

    /// The page never started loading: the server was unreachable, the address
    /// was wrong, or the connection was refused.
    ///
    /// This is the common one. Without a screen here the shell shows an empty
    /// white view and says nothing, and the causes -- a phone on the wrong
    /// network, a dev server that is not running -- are all invisible from
    /// inside the app.
    func webView(_ webView: WKWebView,
                 didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        report(error)
    }

    /// The page started loading and then failed partway through.
    func webView(_ webView: WKWebView,
                 didFail navigation: WKNavigation!,
                 withError error: Error) {
        report(error)
    }

    /// A load that succeeded takes the failure screen back down, so a retry
    /// that worked does not leave it covering the page.
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        dismissFailure()
    }

    /// `LoadFailure` returns nil for a navigation the shell canceled on
    /// purpose, which is every refusal the origin allowlist makes.
    private func report(_ error: Error) {
        guard let failure = LoadFailure(error: error, url: webView.url ?? configuration.startURL)
        else { return }
        show(failure)
    }
}
