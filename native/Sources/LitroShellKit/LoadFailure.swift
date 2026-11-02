//  What the shell says when the page does not load.
//
//  A web view whose navigation fails shows nothing. The shell sits on an empty
//  white view and reports the reason to no one, which is the same mistake the
//  configuration failure screen already avoids, one layer further in. It is
//  worse here, because the usual causes are outside the app and invisible from
//  it: a phone on the wrong network, a dev server that is not running, a start
//  URL with a typo in the port.
//
//  Deciding whether a failure is worth showing, and what to say about it, lives
//  here in Foundation so it can be tested. The screen itself is in ../../App,
//  which is the split Package.swift describes.

import Foundation

/// The text of the screen shown when a navigation fails.
///
/// Built through ``init(error:url:)``, which returns nil for the failures that
/// must stay invisible.
public struct LoadFailure: Equatable, Sendable {
    /// One line naming what went wrong, in the reader's terms rather than the
    /// framework's.
    public let summary: String
    /// The error's own words, with the domain and code to look up.
    public let detail: String
    /// The address that failed, when the error carried one.
    public let failingURL: String?

    public init(summary: String, detail: String, failingURL: String?) {
        self.summary = summary
        self.detail = detail
        self.failingURL = failingURL
    }

    /// Builds the screen's text, or returns nil when this failure must not be
    /// shown.
    ///
    /// A canceled navigation is not a fault. The origin allowlist refuses an
    /// outside origin by cancelling it, and WebKit reports every such refusal
    /// here as an error. Showing a failure screen for one would make the
    /// allowlist doing its job look like the shell breaking, and would cover the
    /// page the user was already reading. The same code arrives when a second
    /// navigation replaces one still in flight, which is also not a fault.
    public init?(error: Error, url: URL?) {
        let error = error as NSError
        if Self.isDeliberate(error) { return nil }

        summary = Self.summary(for: error)
        detail = "\(error.localizedDescription)\n\(error.domain) \(error.code)"
        // The error's own failing URL is preferred: a redirect means the address
        // that failed is not always the one the navigation started from.
        let failing = error.userInfo[NSURLErrorFailingURLStringErrorKey] as? String
        failingURL = failing ?? url?.absoluteString
    }

    /// Whether this error is the shell's own refusal rather than a failure.
    private static func isDeliberate(_ error: NSError) -> Bool {
        if error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled { return true }
        // WebKit reports a canceled policy decision under its own legacy
        // domain in some versions, as "frame load interrupted". Matched by name
        // rather than by importing WebKit, which would cost this target its
        // promise of being pure Foundation and testable with no simulator.
        if error.domain == webKitErrorDomain && error.code == frameLoadInterrupted { return true }
        return false
    }

    /// The headline, chosen from the codes that share one cause.
    private static func summary(for error: NSError) -> String {
        guard error.domain == NSURLErrorDomain else { return "The page did not load." }
        switch error.code {
        case NSURLErrorCannotConnectToHost,
             NSURLErrorCannotFindHost,
             NSURLErrorTimedOut,
             NSURLErrorNetworkConnectionLost,
             NSURLErrorNotConnectedToInternet,
             NSURLErrorDNSLookupFailed:
            // One sentence for the whole family, because the reader's next move
            // is the same for all of them: check the network and the server.
            return "Could not reach the server."
        case NSURLErrorAppTransportSecurityRequiresSecureConnection,
             NSURLErrorSecureConnectionFailed,
             NSURLErrorServerCertificateUntrusted:
            return "The connection was refused as insecure."
        default:
            return "The page did not load."
        }
    }

    /// WebKit's legacy error domain, spelled out so this file imports only
    /// Foundation.
    private static let webKitErrorDomain = "WebKitErrorDomain"
    /// "Frame load interrupted", WebKit's name for a canceled policy decision.
    private static let frameLoadInterrupted = 102
}
