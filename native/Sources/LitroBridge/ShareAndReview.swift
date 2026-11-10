//  Share and review: every decision the two modules make, with no UIKit in it.
//
//  The app-side modules in App/Capabilities/ShareModule.swift and
//  ReviewModule.swift only present a sheet and ask the system. What a valid
//  payload is, what each way the sheet can close means to the page, where the
//  sheet is anchored on an iPad, and that a callback answering twice answers
//  once are all decided in this file, so each has a test under `swift test`.

import Foundation

/* ── Share ────────────────────────────────────────────────────────────── */

/// What the share sheet is handed, validated.
public struct ShareContent: Equatable, Sendable {
    /// The text item, if any. When the payload has a title and nothing else,
    /// the title is shared as the text, so a title-only payload still shares
    /// something rather than opening an empty sheet.
    public let text: String?
    /// The link item, if any. Always an absolute `http` or `https` URL.
    public let url: URL?
    /// The title, offered as the subject line to targets that have one, such
    /// as Mail.
    public let subject: String?

    public init(text: String?, url: URL?, subject: String?) {
        self.text = text
        self.url = url
        self.subject = subject
    }
}

public extension ShareContent {
    /// Reads `share` or `canShare` params.
    ///
    /// The page adapter resolves a relative `url` against the page before
    /// sending, as a browser's share does, so a URL that arrives here without
    /// a scheme is a page bug. Only `http` and `https` are accepted: a share
    /// sheet handed a `javascript:` or `file:` URL hands it to whatever the
    /// person picks, and nothing a Litro page needs to share is one of those.
    ///
    /// An empty string counts as absent, the same way an empty `body` does for
    /// a notification. A payload with nothing in it is refused: the sheet would
    /// open with nothing to share.
    static func parse(_ params: [String: JSONValue]) -> Result<ShareContent, ParamsFailure> {
        func field(_ name: String) -> Result<String?, ParamsFailure> {
            guard let raw = params[name], raw != .null else { return .success(nil) }
            guard let text = raw.stringValue else { return .failure(ParamsFailure("\(name) must be a string")) }
            return .success(text.isEmpty ? nil : text)
        }

        let title: String?, text: String?, link: String?
        switch (field("title"), field("text"), field("url")) {
        case let (.failure(reason), _, _), let (_, .failure(reason), _), let (_, _, .failure(reason)):
            return .failure(reason)
        case let (.success(a), .success(b), .success(c)):
            (title, text, link) = (a, b, c)
        }

        var url: URL?
        if let link {
            guard let parsed = URL(string: link),
                  let scheme = parsed.scheme?.lowercased(), scheme == "http" || scheme == "https",
                  let host = parsed.host, !host.isEmpty else {
                return .failure(ParamsFailure("url must be an absolute http or https URL"))
            }
            url = parsed
        }

        guard title != nil || text != nil || url != nil else {
            return .failure(ParamsFailure("nothing to share: give a title, text or url"))
        }
        let shared = text ?? (url == nil ? title : nil)
        return .success(ShareContent(text: shared, url: url, subject: title))
    }
}

/// How a share sheet closed.
///
/// A person, not a function, decides this. The sheet can be closed without
/// picking anything, a target can be picked and then canceled inside its own
/// screen, a target can finish, or a target can fail.
public enum ShareOutcome: Equatable, Sendable {
    /// A target was picked and reported that it finished.
    case completed
    /// Closed without sharing: the sheet itself, or a target's own screen.
    case dismissed
    /// The picked target reported an error.
    case failed
    /// The sheet was never on screen, so the person saw nothing.
    case notPresented

    /// The outcome UIKit's completion handler describes.
    ///
    /// An error wins over `completed`, because a target that reports one did
    /// not finish. No error and not completed is a cancel, which the system
    /// reports with no error at all.
    public init(completed: Bool, failed: Bool) {
        switch (completed, failed) {
        case (_, true): self = .failed
        case (true, false): self = .completed
        case (false, false): self = .dismissed
        }
    }

    /// What to answer straight after asking UIKit to present the sheet.
    ///
    /// UIKit refuses a presentation while another is in progress, or when
    /// there is no window to present from. It logs that, and never calls the
    /// completion handler, so the page would wait out its whole budget for a
    /// sheet nobody saw. A sheet that is not on screen right after `present`
    /// was refused, and the page is told now. `nil` means wait for the person.
    public static func afterPresenting(isOnScreen: Bool) -> ShareOutcome? {
        isOnScreen ? nil : .notPresented
    }
}

/// What a build must provide to offer sharing.
@MainActor
public protocol ShareHost: AnyObject {
    /// Shows the share sheet and returns once it has closed.
    func share(_ content: ShareContent) async -> ShareOutcome
}

/// Where the sheet points on an iPad.
///
/// On an iPad the share sheet is a popover, and UIKit stops the app if a
/// popover has no anchor. The page sends no element position, so the sheet is
/// anchored to the middle of the view with no arrow, which reads as a centered
/// sheet. Setting it on an iPhone is harmless: there is no popover there.
public struct ShareAnchor: Equatable, Sendable {
    public let x: Double
    public let y: Double

    /// The anchor point inside a view of this size: its center.
    public init(width: Double, height: Double) {
        x = max(0, width) / 2
        y = max(0, height) / 2
    }
}

/// One answer, however many times a callback fires.
///
/// UIKit's share completion handler is not promised to run once, and a
/// continuation resumed twice stops the app. The first answer is kept and every
/// later one is dropped.
@MainActor
public final class SingleAnswer<Value: Sendable> {
    private var deliver: ((Value) -> Void)?

    public init(_ deliver: @escaping (Value) -> Void) {
        self.deliver = deliver
    }

    /// Whether an answer has already gone.
    public var isAnswered: Bool { deliver == nil }

    public func answer(_ value: Value) {
        let once = deliver
        deliver = nil
        once?(value)
    }
}

/* ── Review ───────────────────────────────────────────────────────────── */

/// What a build must provide to offer the review prompt.
///
/// Returns nothing a page could act on, because the system tells the app
/// nothing. Apple limits how often the prompt appears, never shows it in some
/// builds, and does not say whether it appeared. A return value here could
/// only be a guess.
@MainActor
public protocol ReviewHost: AnyObject {
    /// Passes the request to the system. Must not wait for a person: the
    /// system call returns at once whether or not anything appears.
    func requestReview()
}
