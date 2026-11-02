//  The transport: the only file that knows how a message crosses the boundary.
//
//  It converts, hands the message to the dispatcher, and evaluates the reply.
//  It makes no decisions about what the reply should be — that is Dispatcher.swift,
//  which has no WebKit in it and is therefore testable.

import WebKit
import LitroBridge
import LitroShellKit
import os

@MainActor
final class BridgeTransport: NSObject, WKScriptMessageHandler {
    private let dispatcher: BridgeDispatcher
    /// Held to answer one question: may the frame that sent this message use
    /// the bridge at all.
    private let configuration: AppConfiguration
    private let logger = Logger(subsystem: "dev.litro.shell", category: "bridge")

    /// Weak, because the web view's content controller holds this handler. A
    /// strong reference here would keep both alive for the life of the process.
    weak var webView: WKWebView?

    init(dispatcher: BridgeDispatcher, configuration: AppConfiguration) {
        self.dispatcher = dispatcher
        self.configuration = configuration
        super.init()
    }

    /// Whether the frame that sent a message may use the bridge.
    ///
    /// `markerScript` is injected `forMainFrameOnly`, but a message handler is
    /// NOT scoped to a frame: `add(_:name:)` puts
    /// `window.webkit.messageHandlers` in every frame, main or not. Without
    /// this check any subframe can call the bridge, and the navigation
    /// allowlist does not stop it -- that allows a frame's request URL, not the
    /// origin the frame runs as. A `sandbox` or `srcdoc` frame loads from an
    /// allowed path and then has an opaque origin.
    ///
    /// Two gates rather than one, deliberately. The main-frame test matches the
    /// contract the marker script already sets. The origin test is what still
    /// holds if the navigation allowlist is ever wired wrong -- which has
    /// happened once here already, silently.
    private func accepts(_ frame: WKFrameInfo) -> Bool {
        guard frame.isMainFrame else {
            logger.error("bridge message from a subframe; refused")
            return false
        }
        let origin = frame.securityOrigin
        guard configuration.allowsBridgeOrigin(scheme: origin.`protocol`,
                                               host: origin.host,
                                               port: origin.port) else {
            logger.error("bridge message from an origin that is not allowed; refused")
            return false
        }
        return true
    }

    /// The script the shell injects before any page script runs.
    ///
    /// It carries only the version, so the page can detect a shell synchronously.
    /// It deliberately does not carry the capability list: what the shell can do
    /// is the handshake's answer, and holding it in two places lets the two
    /// drift apart across an app update.
    ///
    /// `Object.defineProperty` rather than assignment, so page code cannot
    /// replace the marker and make a web page look like a shell.
    static var markerScript: WKUserScript {
        let source = """
        Object.defineProperty(window, "\(globalName)", {
          value: { version: \(bridgeProtocolVersion) },
          writable: false,
          configurable: false,
          enumerable: true
        });
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard accepts(message.frameInfo) else { return }
        guard let value = JSONValue(any: message.body) else {
            // The body held something that is not JSON, so there is no id to
            // answer and nothing to dispatch.
            logger.error("bridge message was not JSON")
            return
        }
        Task { @MainActor in
            guard let reply = await dispatcher.handle(value) else {
                // No usable id. Answering an invented one would have the page
                // resolve a call it never made, so the message is dropped and
                // logged instead.
                logger.error("bridge message had no usable id; dropped")
                return
            }
            do {
                _ = try await webView?.evaluateJavaScript(reply.deliveryScript)
            } catch {
                // The page navigated away, or tore down mid-call. Logged rather
                // than ignored: a reply that never lands leaves the page's call
                // to time out, and this is the only place that knows why.
                logger.error("could not deliver a reply: \(error.localizedDescription, privacy: .public)")
            }
        }
    }
}
