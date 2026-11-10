//  The dispatcher: one message in, one reply out.
//
//  Every decision the bridge makes lives here, and nothing here touches UIKit,
//  WebKit or a global. The transport converts the message and delivers the
//  reply; this file decides what the reply is. That split is what lets every
//  capability have a real test with no simulator.

import Foundation

/// What a build must provide to offer haptics.
///
/// A protocol rather than a concrete type so the test can drive the dispatcher
/// with a recorder, and so `LitroBridge` never imports UIKit.
///
/// Main-actor bound because every implementation of it will touch UIKit, and a
/// haptic raised off the main thread is a runtime complaint rather than a buzz.
@MainActor
public protocol HapticsHost: AnyObject {
    func impact(_ style: HapticStyle)
    func notify(_ type: HapticNotify)
    func selection()
}

/// What a build must provide to offer badging.
@MainActor
public protocol BadgingHost: AnyObject {
    /// Sets the home screen badge. `0` clears it.
    ///
    /// Returns `false` when the system refused, which on iOS means the user
    /// declined the badge permission.
    ///
    /// Async because that is what the platform is: setting a badge needs the
    /// notification permission, and asking for it is a prompt. A synchronous
    /// signature here could only be honored by answering before the system had,
    /// which would report success for a badge that never appeared.
    func set(count: Int) async -> Bool
}

/// What a build must provide to offer local notifications.
///
/// The decisions -- validation, which trigger, whether the page still waits --
/// are in Notifications.swift. This is only what needs the system.
@MainActor
public protocol NotificationsHost: AnyObject {
    /// The stored authorization, read without prompting.
    func authorization() async -> NotificationAuthorization
    /// Asks for the permission. Shows the prompt when nobody has been asked;
    /// otherwise the system answers from the stored setting without one. The
    /// dispatcher reads `authorization()` again afterward rather than trusting
    /// a yes, because a yes can still be a grant that shows nothing.
    func requestPermission() async
    /// Hands one notification to the system. Throws when the system refused.
    func schedule(_ request: NotificationRequest, trigger: NotificationTrigger) async throws
    /// Removes a pending or delivered notification. An unknown id is not an error.
    func cancel(id: String) async
}

/// Main-actor bound, because the transport's messages arrive on the main thread
/// and every capability module it calls is main-actor bound too. Declaring it
/// here means a capability added later cannot quietly introduce a hop.
@MainActor
public final class BridgeDispatcher {
    private let info: ShellInfo
    private let haptics: HapticsHost?
    private let badging: BadgingHost?
    private let notifications: NotificationsHost?
    private let secureStorage: SecureStorageHost?
    private let sharing: ShareHost?
    private let review: ReviewHost?
    /// Whether a share sheet is on screen now. A second `share` while one is
    /// open would be refused by UIKit without a word and without a callback,
    /// so the page would wait out its whole budget for a sheet nobody saw.
    private var shareSheetOpen = false
    private let now: @MainActor () -> Date
    private let monotonic: @MainActor () -> ContinuousClock.Instant
    private let calendar: @MainActor () -> Calendar
    private let makeID: @MainActor () -> String

    /// Builds a dispatcher over the modules this build compiled in.
    ///
    /// A module that is absent is `nil`, and that single fact drives both the
    /// handshake's capability list and what happens to a call for it. Keeping one
    /// source means a build cannot advertise a capability it cannot serve.
    ///
    /// `now`, `monotonic`, `calendar` and `makeID` are seams for the tests.
    /// `now` is the wall clock, for the instants a page sends. `monotonic` is
    /// for measuring how long a call has waited: it keeps counting while the
    /// device sleeps and no change to the device time moves it. The calendar
    /// is read per call rather than held, so a reminder scheduled after the
    /// user changed time zone uses the new one.
    public init(info: ShellInfo,
                haptics: HapticsHost? = nil,
                badging: BadgingHost? = nil,
                notifications: NotificationsHost? = nil,
                secureStorage: SecureStorageHost? = nil,
                share: ShareHost? = nil,
                review: ReviewHost? = nil,
                now: @escaping @MainActor () -> Date = { Date() },
                monotonic: @escaping @MainActor () -> ContinuousClock.Instant = { ContinuousClock.now },
                calendar: @escaping @MainActor () -> Calendar = { Calendar.current },
                makeID: @escaping @MainActor () -> String = { UUID().uuidString }) {
        self.info = info
        self.haptics = haptics
        self.badging = badging
        self.notifications = notifications
        self.secureStorage = secureStorage
        self.sharing = share
        self.review = review
        self.now = now
        self.monotonic = monotonic
        self.calendar = calendar
        self.makeID = makeID
    }

    /// The capabilities this build reports in the handshake, in protocol order.
    public var capabilities: [Capability] {
        Capability.allCases.filter { capability in
            switch capability {
            case .haptics: return haptics != nil
            case .notifications: return notifications != nil
            case .badging: return badging != nil
            case .secureStorage: return secureStorage != nil
            case .share: return sharing != nil
            case .review: return review != nil
            }
        }
    }

    /// Whether this build can serve `capability`.
    private func isEnabled(_ capability: Capability) -> Bool {
        capabilities.contains(capability)
    }

    /// Handles one decoded message that arrived from `origin`.
    ///
    /// Returns `nil` only when the message cannot be addressed at all — no usable
    /// `id` means there is nowhere to send a reply, and inventing one would have
    /// the page resolve a call it never made. The transport logs that case.
    ///
    /// The origin is required, not defaulted. Secure storage is kept per
    /// origin, and a default would be a store every caller silently shares.
    public func handle(_ value: JSONValue, from origin: MessageOrigin) async -> BridgeResponse? {
        switch BridgeRequest.parse(value) {
        case let .failure(reason):
            guard let id = reason.id else { return nil }
            return .failure(id: id, code: reason.code, message: Self.message(for: reason))
        case let .success(request):
            return await handle(request, from: origin)
        }
    }

    /// Handles one message as it came off the transport.
    ///
    /// A body holding a value that is not JSON is answered `INVALID_REQUEST`
    /// against its id, never dropped, when it has a usable id.
    public func handle(_ message: IncomingMessage, from origin: MessageOrigin) async -> BridgeResponse? {
        switch message {
        case let .json(value):
            return await handle(value, from: origin)
        case let .notJSON(id):
            guard let id else { return nil }
            return .failure(id: id, code: .invalidRequest,
                            message: "the message held a value that is not JSON, such as a Date")
        }
    }

    private static func message(for reason: RequestParseFailure) -> String {
        switch reason {
        case .invalidRequest: return "not a valid request for protocol version \(bridgeProtocolVersion)"
        case .methodNotFound: return "unknown method"
        }
    }

    /// Handles a request whose envelope is already known to be valid.
    public func handle(_ request: BridgeRequest, from origin: MessageOrigin) async -> BridgeResponse {
        if request.method == .handshake {
            let result = HandshakeResult(info: info, capabilities: capabilities)
            return .success(id: request.id, result: result.json)
        }

        // A capability this build did not compile in is answered with the
        // contract's documented empty behavior, NOT an error.
        //
        // The page is supposed to gate the call itself and never send it, and
        // the protocol has no error code for a missing capability. But a shell
        // that answered an unexpected call with an error would break the
        // contract's promise that a capability call never fails for a missing
        // platform feature — and that page may be an old deploy we cannot fix.
        // So the shell holds the promise too. The spec names this as the thing
        // to review Phase 4's shell for directly.
        if let needed = request.method.capability, !isEnabled(needed) {
            return .success(id: request.id, result: Self.emptyResult(for: request.method))
        }

        switch request.method {
        case .handshake:
            // Answered above; repeated here because the switch is exhaustive and
            // a fallthrough would be a silent change if a case were reordered.
            let result = HandshakeResult(info: info, capabilities: capabilities)
            return .success(id: request.id, result: result.json)

        case .hapticsImpact:
            guard let raw = request.params["style"]?.stringValue,
                  let style = HapticStyle(rawValue: raw) else {
                return .failure(id: request.id, code: .invalidParams,
                                message: "style must be one of \(HapticStyle.allCases.map(\.rawValue).joined(separator: ", "))")
            }
            haptics?.impact(style)
            return .success(id: request.id, result: .null)

        case .hapticsNotify:
            guard let raw = request.params["type"]?.stringValue,
                  let type = HapticNotify(rawValue: raw) else {
                return .failure(id: request.id, code: .invalidParams,
                                message: "type must be one of \(HapticNotify.allCases.map(\.rawValue).joined(separator: ", "))")
            }
            haptics?.notify(type)
            return .success(id: request.id, result: .null)

        case .hapticsSelection:
            haptics?.selection()
            return .success(id: request.id, result: .null)

        case .badgingSet:
            guard let count = request.params["count"]?.intValue, count >= 0 else {
                return .failure(id: request.id, code: .invalidParams,
                                message: "count must be a whole number of 0 or more")
            }
            guard await badging?.set(count: count) == true else {
                return .failure(id: request.id, code: .permissionDenied,
                                message: "the badge permission was declined")
            }
            return .success(id: request.id, result: .null)

        case .badgingClear:
            guard await badging?.set(count: 0) == true else {
                return .failure(id: request.id, code: .permissionDenied,
                                message: "the badge permission was declined")
            }
            return .success(id: request.id, result: .null)

        case .notificationsSchedule:
            return await schedule(request)

        case .notificationsCancel:
            guard let id = request.params["id"]?.stringValue else {
                return .failure(id: request.id, code: .invalidParams, message: "id must be a string")
            }
            // An empty id is the "nothing was scheduled" answer. Canceling it
            // is a no-op, not a mistake.
            if !id.isEmpty { await notifications?.cancel(id: id) }
            return .success(id: request.id, result: .null)

        case .secureStorageGet:
            return keychain(request) { host, key in
                guard let value = try host.get(key, origin: origin) else { return .null }
                return .string(value)
            }

        case .secureStorageSet:
            switch SecureStorageParams.value(request.params) {
            case let .failure(reason):
                return .failure(id: request.id, code: .invalidParams, message: reason.message)
            case let .success(value):
                return keychain(request) { host, key in
                    try host.set(key, value: value, origin: origin)
                    return .null
                }
            }

        case .secureStorageRemove:
            return keychain(request) { host, key in
                try host.remove(key, origin: origin)
                return .null
            }

        case .canShare:
            // A question, not a request: a payload `share` would refuse is a
            // no, never an error. The browser's own check answers the same way.
            guard case .success = ShareContent.parse(request.params) else {
                return .success(id: request.id, result: .bool(false))
            }
            return .success(id: request.id, result: .bool(true))

        case .share:
            return await share(request)

        case .requestReview:
            // Answered at once, and with nothing. The system decides whether a
            // prompt appears, rate-limits it, and does not say. So the reply
            // means "the request was passed on", never "a prompt was shown".
            review?.requestReview()
            return .success(id: request.id, result: .null)
        }
    }

    /// `share`, with each way the sheet can close answered deliberately.
    ///
    /// Completed and dismissed both answer `null`. The page's `share()` is
    /// `Promise<void>` and is documented to resolve when the sheet closes, so
    /// `null` says "the sheet is closed" and never "something was shared". A
    /// cancel is not an error: the person changed their mind, and the web
    /// adapter swallows the browser's `AbortError` for the same reason.
    ///
    /// A target that failed, and a sheet that never appeared, are errors: the
    /// person tried, or saw nothing, and the page may want to offer another way.
    private func share(_ request: BridgeRequest) async -> BridgeResponse {
        // Absence first. The capability gate in `handle` already answers an
        // absent module, so this is unreachable today; it is ordered so that if
        // the gate ever moves, an absent module with a bad payload still gets
        // the empty answer and never INVALID_PARAMS (NATIVE-004).
        guard let sharing else {
            return .success(id: request.id, result: Self.emptyResult(for: request.method))
        }
        let content: ShareContent
        switch ShareContent.parse(request.params) {
        case let .failure(reason):
            return .failure(id: request.id, code: .invalidParams, message: reason.message)
        case let .success(value):
            content = value
        }
        guard !shareSheetOpen else {
            return .failure(id: request.id, code: .internalError,
                            message: "a share sheet is already open; nothing was shown")
        }
        shareSheetOpen = true
        defer { shareSheetOpen = false }

        switch await sharing.share(content) {
        case .completed, .dismissed:
            return .success(id: request.id, result: .null)
        case .failed:
            return .failure(id: request.id, code: .internalError,
                            message: "the chosen share target reported an error")
        case .notPresented:
            return .failure(id: request.id, code: .internalError,
                            message: "the share sheet could not be shown; nothing was shown")
        }
    }

    /// `notifications.schedule`, in the order that keeps the id reachable.
    ///
    /// Validate first, against the moment the call arrived, so a bad call is
    /// rejected before anyone is shown a prompt. Then the permission, which may
    /// be a prompt a person reads for a long time. Then, before scheduling,
    /// whether the page is still waiting: past the budget it sent, the page has
    /// already rejected the call, and a notification scheduled now would carry
    /// an id it may never learn.
    private func schedule(_ request: BridgeRequest) async -> BridgeResponse {
        let arrived = now()
        let started = monotonic()
        let parsed: NotificationRequest
        let budget: ScheduleBudget
        switch (NotificationRequest.parse(request.params, now: arrived, makeID: makeID),
                ScheduleBudget.parse(request.params)) {
        case let (.failure(reason), _), let (_, .failure(reason)):
            return .failure(id: request.id, code: .invalidParams, message: reason.message)
        case let (.success(value), .success(stated)):
            parsed = value
            budget = stated
        }
        guard let notifications else {
            return .success(id: request.id, result: Self.emptyResult(for: request.method))
        }

        var authorization = await notifications.authorization()
        switch authorization.stepForNotification {
        case .allowed:
            break
        case .denied:
            return .failure(id: request.id, code: .permissionDenied,
                            message: "the notification permission was declined")
        case .ask:
            await notifications.requestPermission()
            authorization = await notifications.authorization()
        }
        guard authorization.allowsNotification else {
            let message = authorization == .denied
                ? "the notification permission was declined"
                : "notifications are allowed but turned off for banners, the Lock Screen and Notification Center"
            return .failure(id: request.id, code: .permissionDenied, message: message)
        }

        guard budget.isStillAwaited(after: monotonic() - started) else {
            return .failure(id: request.id, code: .internalError,
                            message: "the page stopped waiting before permission was given; nothing was scheduled")
        }
        do {
            try await notifications.schedule(parsed, trigger: parsed.trigger(now: now(), calendar: calendar()))
        } catch {
            return .failure(id: request.id, code: .internalError,
                            message: "the system refused to schedule the notification")
        }
        return .success(id: request.id, result: .string(parsed.id))
    }

    /// One keychain call: validate the key, run it, and map a refusal.
    ///
    /// The message carries the status code and never the key or the value. A
    /// reply is evaluated in the page, and page script can log it.
    private func keychain(_ request: BridgeRequest,
                          _ body: (SecureStorageHost, String) throws -> JSONValue) -> BridgeResponse {
        let key: String
        switch SecureStorageParams.key(request.params) {
        case let .failure(reason):
            return .failure(id: request.id, code: .invalidParams, message: reason.message)
        case let .success(value):
            key = value
        }
        guard let secureStorage else {
            return .success(id: request.id, result: Self.emptyResult(for: request.method))
        }
        do {
            return .success(id: request.id, result: try body(secureStorage, key))
        } catch SecureStorageFailure.status(let status) where SecureStorageFailure.refusesTheInput.contains(status) {
            // The same key or value fails the same way every time, so this is
            // not offered as retryable.
            return .failure(id: request.id, code: .invalidParams,
                            message: "the keychain refused this key or value (status \(status))")
        } catch SecureStorageFailure.status(let status) {
            return .failure(id: request.id, code: .internalError,
                            message: "the keychain refused the operation (status \(status))")
        } catch SecureStorageFailure.unreadable {
            // Reading again will not help; writing a new value replaces it.
            return .failure(id: request.id, code: .internalError,
                            message: "the stored value is damaged; set a new value to replace it")
        } catch {
            return .failure(id: request.id, code: .internalError, message: "the keychain refused the operation")
        }
    }

    /// What a method answers when its capability does nothing here.
    ///
    /// These match the web adapter's documented degradation, so a page cannot
    /// tell a disabled module from the web fallback — which is the whole point
    /// of the contract.
    static func emptyResult(for method: BridgeMethod) -> JSONValue {
        switch method {
        // An empty id means nothing was scheduled. Callers that store the id
        // treat an empty one as "no reminder set".
        case .notificationsSchedule: return .string("")
        // Nothing can be shared when there is nothing to share it with.
        case .canShare: return .bool(false)
        // Reading a store that does not exist finds nothing.
        case .secureStorageGet: return .null
        default: return .null
        }
    }
}
