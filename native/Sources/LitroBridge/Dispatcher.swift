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
    /// Shows the permission prompt and answers whether the user allowed it.
    /// Called only when `authorization()` said nobody has been asked.
    func requestPermission() async -> Bool
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
    private let now: @MainActor () -> Date
    private let calendar: @MainActor () -> Calendar
    private let makeID: @MainActor () -> String

    /// Builds a dispatcher over the modules this build compiled in.
    ///
    /// A module that is absent is `nil`, and that single fact drives both the
    /// handshake's capability list and what happens to a call for it. Keeping one
    /// source means a build cannot advertise a capability it cannot serve.
    ///
    /// `now`, `calendar` and `makeID` are seams for the tests. The calendar is
    /// read per call rather than held, so a reminder scheduled after the user
    /// changed time zone uses the new one.
    public init(info: ShellInfo,
                haptics: HapticsHost? = nil,
                badging: BadgingHost? = nil,
                notifications: NotificationsHost? = nil,
                secureStorage: SecureStorageHost? = nil,
                now: @escaping @MainActor () -> Date = { Date() },
                calendar: @escaping @MainActor () -> Calendar = { Calendar.current },
                makeID: @escaping @MainActor () -> String = { UUID().uuidString }) {
        self.info = info
        self.haptics = haptics
        self.badging = badging
        self.notifications = notifications
        self.secureStorage = secureStorage
        self.now = now
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
            case .share, .review: return false
            }
        }
    }

    /// Whether this build can serve `capability`.
    private func isEnabled(_ capability: Capability) -> Bool {
        capabilities.contains(capability)
    }

    /// Handles one decoded message.
    ///
    /// Returns `nil` only when the message cannot be addressed at all — no usable
    /// `id` means there is nowhere to send a reply, and inventing one would have
    /// the page resolve a call it never made. The transport logs that case.
    public func handle(_ value: JSONValue) async -> BridgeResponse? {
        switch BridgeRequest.parse(value) {
        case let .failure(reason):
            guard let id = reason.id else { return nil }
            return .failure(id: id, code: reason.code, message: Self.message(for: reason))
        case let .success(request):
            return await handle(request)
        }
    }

    /// Handles one message as it came off the transport.
    ///
    /// A body holding a value that is not JSON is answered `INVALID_REQUEST`
    /// against its id, never dropped, when it has a usable id.
    public func handle(_ message: IncomingMessage) async -> BridgeResponse? {
        switch message {
        case let .json(value):
            return await handle(value)
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
    public func handle(_ request: BridgeRequest) async -> BridgeResponse {
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
                guard let value = try host.get(key) else { return .null }
                return .string(value)
            }

        case .secureStorageSet:
            switch SecureStorageParams.value(request.params) {
            case let .failure(reason):
                return .failure(id: request.id, code: .invalidParams, message: reason.message)
            case let .success(value):
                return keychain(request) { host, key in
                    try host.set(key, value: value)
                    return .null
                }
            }

        case .secureStorageRemove:
            return keychain(request) { host, key in
                try host.remove(key)
                return .null
            }

        // Phase 5's last pair. Until they are compiled in, the capability gate
        // above has already answered them and this line is unreachable. It is
        // spelled out rather than left to a `default`, so adding a method to
        // the protocol fails to compile here instead of quietly falling into a
        // wrong answer.
        case .canShare, .share, .requestReview:
            return .success(id: request.id, result: Self.emptyResult(for: request.method))
        }
    }

    /// `notifications.schedule`, in the order that keeps the id reachable.
    ///
    /// Validate first, against the moment the call arrived, so a bad call is
    /// rejected before anyone is shown a prompt. Then the permission, which may
    /// be a prompt a person reads for a long time. Then, before scheduling,
    /// whether the page is still waiting: past its budget the page has already
    /// rejected the call, and a notification scheduled now would carry an id
    /// it never learns and can never cancel.
    private func schedule(_ request: BridgeRequest) async -> BridgeResponse {
        let arrived = now()
        let parsed: NotificationRequest
        switch NotificationRequest.parse(request.params, now: arrived, makeID: makeID) {
        case let .failure(reason):
            return .failure(id: request.id, code: .invalidParams, message: reason.message)
        case let .success(value):
            parsed = value
        }
        guard let notifications else {
            return .success(id: request.id, result: Self.emptyResult(for: request.method))
        }

        var allowed: Bool
        switch await notifications.authorization().stepForNotification {
        case .allowed: allowed = true
        case .denied: allowed = false
        case .ask: allowed = await notifications.requestPermission()
        }
        guard allowed else {
            return .failure(id: request.id, code: .permissionDenied,
                            message: "the notification permission was declined")
        }

        let scheduling = now()
        guard isStillAwaited(arrived: arrived, now: scheduling) else {
            return .failure(id: request.id, code: .internalError,
                            message: "the page stopped waiting before permission was given; nothing was scheduled")
        }
        do {
            try await notifications.schedule(parsed, trigger: parsed.trigger(now: scheduling, calendar: calendar()))
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
        } catch let failure as SecureStorageFailure {
            return .failure(id: request.id, code: .internalError,
                            message: "the keychain refused the operation (status \(failure.status))")
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
