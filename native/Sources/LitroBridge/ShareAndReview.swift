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

/// One thing handed to the share sheet.
public enum ShareItem: Equatable, Sendable {
    case text(String)
    case url(URL)
    /// The subject line, for targets that have one, such as Mail. Shares
    /// nothing as an item of its own.
    case subject(String)
}

public extension ShareContent {
    /// What the sheet is handed, in order.
    ///
    /// The subject source is included only when there is a title. The sheet
    /// reads each source's placeholder to decide which targets to offer, so a
    /// subject source with an empty placeholder would present a title-less
    /// share as "a string and a link" (round 2 review, non-blocking item 3).
    var items: [ShareItem] {
        var out: [ShareItem] = []
        if let subject { out.append(.subject(subject)) }
        if let text { out.append(.text(text)) }
        if let url { out.append(.url(url)) }
        return out
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
    /// Also a sheet that left the screen without a callback; see `ShareSheetRun`.
    case dismissed
    /// The picked target reported an error and did not say it finished.
    case failed
    /// The sheet was never on screen, so the person saw nothing.
    case notPresented

    /// The error domain and code a target reports when the person canceled
    /// inside it: `NSCocoaErrorDomain`, `NSUserCancelledError`. Written out so
    /// this target stays pure Foundation on every platform.
    public static let userCancelled = (domain: "NSCocoaErrorDomain", code: 3072)

    /// The outcome UIKit's completion handler describes.
    ///
    /// `completed` wins over an error. Apple documents `completed` as "the
    /// service was performed", so a completed share with an error attached was
    /// still sent. Reporting it as a failure invites the page to offer a second
    /// send of something already sent. `null` -- what `completed` answers --
    /// claims only that the sheet closed, so it cannot be false; a failure
    /// claims something that did not happen.
    ///
    /// An error that says the person canceled is a cancel, not a failure.
    /// Which targets report one rather than no error is not verified.
    public init(completed: Bool, errorDomain: String?, errorCode: Int?) {
        if completed {
            self = .completed
        } else if errorDomain == nil {
            self = .dismissed
        } else if errorDomain == Self.userCancelled.domain && errorCode == Self.userCancelled.code {
            self = .dismissed
        } else {
            self = .failed
        }
    }
}

/// Where the window stands when a share arrives.
public enum ShareSheetPresenterState: Equatable, Sendable {
    /// A controller in a window, not in the middle of a transition.
    case ready
    /// A controller that is being presented or dismissed. UIKit refuses to
    /// present on it and never calls back.
    case transitioning
    /// No foreground window to present from.
    case none

    /// The state, from what UIKit says about the controller found to present
    /// from: whether it is in a window, and whether it is mid-transition.
    public init(inWindow: Bool, transitioning: Bool) {
        if !inWindow {
            self = .none
        } else if transitioning {
            self = .transitioning
        } else {
            self = .ready
        }
    }
}

/// The UIKit half of one share sheet, as the few facts and actions the run
/// needs. `App/` implements it over `UIActivityViewController`; the tests
/// implement it with a script, so every decision about presentation is under
/// `swift test`.
@MainActor
public protocol ShareSheetUI: AnyObject {
    /// Read once, before presenting: whether the controller to present from
    /// is in a window, and whether it is being presented or dismissed.
    func presenterFacts() -> (inWindow: Bool, transitioning: Bool)
    /// Asks UIKit to present the sheet. `onPresented` is UIKit's own
    /// presentation completion. `onClosed` is the sheet's completion handler,
    /// as UIKit reports it. Either may never be called.
    func present(onPresented: @escaping @MainActor () -> Void,
                 onClosed: @escaping @MainActor (_ completed: Bool, _ errorDomain: String?, _ errorCode: Int?) -> Void)
    /// Whether the sheet is in the presentation chain now.
    var isOnScreen: Bool { get }
}

/// How long the run waits for UIKit, in its own words.
public struct ShareSheetTiming: Equatable, Sendable {
    /// How long a presentation may take to put the sheet on screen before it
    /// is judged refused. An animated present takes well under a second.
    public var presentGrace: Duration
    /// How often an open sheet is checked for having left the screen.
    public var poll: Duration
    /// How many checks in a row must find it gone. Two, so a sheet caught
    /// between its dismissal and its completion handler is not judged
    /// abandoned on one reading.
    public var goneAfter: Int

    public static let standard = ShareSheetTiming(presentGrace: .milliseconds(1500),
                                                  poll: .milliseconds(500), goneAfter: 2)

    public init(presentGrace: Duration, poll: Duration, goneAfter: Int) {
        self.presentGrace = presentGrace
        self.poll = poll
        self.goneAfter = goneAfter
    }
}

/// One share sheet, from the request to the one answer.
///
/// Round 2 of the review found the first version read
/// `presentingViewController` on the line after an animated `present`, where
/// it is always nil, and so answered "could not be shown" to every share while
/// the sheet appeared. This run never judges presentation from a synchronous
/// reading. The paths, each with a test:
///
/// - **Presented, then closed.** The completion handler answers.
/// - **Refused.** No window, or one in a transition, is answered at once.
///   Otherwise a sheet that is not on screen when `presentGrace` has passed,
///   and whose presentation never completed, was refused.
/// - **Presented, then abandoned.** A sheet that leaves the presentation chain
///   without its completion handler firing -- a controller beneath it was
///   dismissed, say -- is answered `dismissed`. That is `null` on the wire, the
///   same as `completed`, which claims only "the sheet closed" and so is true
///   either way. It is also what clears the dispatcher's one-sheet guard, so
///   a lost callback cannot refuse every later share.
///
/// What is still open-ended: a sheet that stays on screen. That is a person
/// still deciding, or writing a message in a target, and waiting is the truth.
@MainActor
public enum ShareSheetRun {
    public static func run(_ ui: ShareSheetUI,
                           timing: ShareSheetTiming = .standard,
                           sleep: @escaping @MainActor (Duration) async -> Void) async -> ShareOutcome {
        let facts = ui.presenterFacts()
        guard ShareSheetPresenterState(inWindow: facts.inWindow, transitioning: facts.transitioning) == .ready else {
            return .notPresented
        }
        return await withCheckedContinuation { continuation in
            let once = SingleAnswer<ShareOutcome> { continuation.resume(returning: $0) }
            let progress = PresentationSeen()
            ui.present(
                onPresented: { progress.presented = true },
                onClosed: { completed, domain, code in
                    once.answer(ShareOutcome(completed: completed, errorDomain: domain, errorCode: code))
                })
            Task { @MainActor in
                await watch(ui, once, progress, timing, sleep)
            }
        }
    }

    @MainActor
    private final class PresentationSeen {
        var presented = false
    }

    private static func watch(_ ui: ShareSheetUI, _ once: SingleAnswer<ShareOutcome>, _ progress: PresentationSeen,
                              _ timing: ShareSheetTiming,
                              _ sleep: @MainActor (Duration) async -> Void) async {
        // Presentation. Waited out in poll-sized steps, so a sheet that is
        // presented quickly and closed quickly is not held for the whole grace.
        var waited = Duration.zero
        while !once.isAnswered && !progress.presented && waited < timing.presentGrace {
            await sleep(timing.poll)
            waited += timing.poll
        }
        if once.isAnswered { return }
        guard progress.presented || ui.isOnScreen else {
            once.answer(.notPresented)
            return
        }

        // Open. Watched until the handler answers or the sheet is gone.
        var gone = 0
        while !once.isAnswered {
            await sleep(timing.poll)
            if once.isAnswered { return }
            gone = ui.isOnScreen ? 0 : gone + 1
            if gone >= timing.goneAfter { once.answer(.dismissed) }
        }
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
