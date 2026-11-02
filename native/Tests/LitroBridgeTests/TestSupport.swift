//  Shared doubles and builders for the bridge suite.

import Foundation
@testable import LitroBridge

/// Records what the dispatcher asked of it, so a capability's native path can be
/// asserted with no device.
@MainActor
final class RecordingHaptics: HapticsHost {
    var impacts: [HapticStyle] = []
    var notifications: [HapticNotify] = []
    var selections = 0

    func impact(_ style: HapticStyle) { impacts.append(style) }
    func notify(_ type: HapticNotify) { notifications.append(type) }
    func selection() { selections += 1 }
}

@MainActor
final class RecordingBadging: BadgingHost {
    var counts: [Int] = []
    /// What the system pretends to answer. `false` is a declined permission.
    var allowed = true

    func set(count: Int) async -> Bool {
        counts.append(count)
        return allowed
    }
}

let testInfo = ShellInfo(os: "ios", appVersion: "1.2.0", osVersion: "27.2")

/// The origin a test message arrives from, unless the test is about origins.
let testOrigin = MessageOrigin(scheme: "https", host: "app.example", port: 443)

/// Most tests are not about where a message came from. These pass `testOrigin`
/// so each call reads as before; a test about origins passes its own.
extension BridgeDispatcher {
    func handle(_ value: JSONValue) async -> BridgeResponse? { await handle(value, from: testOrigin) }
    func handle(_ message: IncomingMessage) async -> BridgeResponse? { await handle(message, from: testOrigin) }
    func handle(_ request: BridgeRequest) async -> BridgeResponse { await handle(request, from: testOrigin) }
}

/// Builds a message as it arrives from the page, with each part replaceable so a
/// test can leave one out or put the wrong type in.
func message(
    jsonrpc: JSONValue? = .string("2.0"),
    id: JSONValue? = .string("7"),
    method: JSONValue?,
    params: JSONValue? = nil
) -> JSONValue {
    var out: [String: JSONValue] = [:]
    if let jsonrpc { out["jsonrpc"] = jsonrpc }
    if let id { out["id"] = id }
    if let method { out["method"] = method }
    if let params { out["params"] = params }
    return .object(out)
}

/// Reaches the failure side of a `Result` without a `do`/`catch` at every call.
extension Result {
    var failure: Failure? {
        if case let .failure(error) = self { return error }
        return nil
    }
}

/// A notification center that records what it was handed.
@MainActor
final class RecordingNotifications: NotificationsHost {
    /// What the stored settings say before anyone is asked.
    var stored: NotificationAuthorization = .authorized(visible: true)
    /// What the stored settings say after asking: the person's tap on a
    /// prompt, or the system's quiet answer when no prompt is shown.
    var afterAsking: NotificationAuthorization = .authorized(visible: true)
    /// Runs while the prompt is open, so a test can move the clock.
    var whilePrompting: () -> Void = {}
    /// When set, the system refuses to schedule.
    var refuses = false

    var prompts = 0
    var scheduled: [(NotificationRequest, NotificationTrigger)] = []
    var canceled: [String] = []

    struct Refused: Error {}

    func authorization() async -> NotificationAuthorization { stored }

    func requestPermission() async {
        prompts += 1
        whilePrompting()
        stored = afterAsking
    }

    func schedule(_ request: NotificationRequest, trigger: NotificationTrigger) async throws {
        if refuses { throw Refused() }
        scheduled.append((request, trigger))
    }

    func cancel(id: String) async { canceled.append(id) }
}

/// A keychain held in a dictionary, one store per origin, as the real one is.
@MainActor
final class MemorySecureStorage: SecureStorageHost {
    var stores: [MessageOrigin: [String: String]] = [:]
    /// When set, every call fails with this.
    var failing: SecureStorageFailure?

    /// The store `testOrigin` reaches, which is the one most tests use.
    var values: [String: String] { stores[testOrigin] ?? [:] }

    func get(_ key: String, origin: MessageOrigin) throws -> String? {
        if let failing { throw failing }
        return stores[origin]?[key]
    }

    func set(_ key: String, value: String, origin: MessageOrigin) throws {
        if let failing { throw failing }
        stores[origin, default: [:]][key] = value
    }

    func remove(_ key: String, origin: MessageOrigin) throws {
        if let failing { throw failing }
        stores[origin]?[key] = nil
    }
}

/// A clock a test can move. Both readings move together unless a test moves
/// one alone: `now` is the wall clock, `monotonic` the elapsed-time clock.
@MainActor
final class TestClock {
    var now: Date
    private let start: ContinuousClock.Instant
    private var elapsed: Duration
    var monotonic: ContinuousClock.Instant { start.advanced(by: elapsed) }

    init(_ now: Date = Date(timeIntervalSince1970: 1_800_000_000)) {
        self.now = now
        start = ContinuousClock.now
        elapsed = .zero
    }

    func advance(_ seconds: TimeInterval) {
        now = now.addingTimeInterval(seconds)
        elapsed += .milliseconds(seconds * 1000)
    }

    /// The device time changes, and no time passes.
    func setWallClock(by seconds: TimeInterval) { now = now.addingTimeInterval(seconds) }
}

/// A calendar fixed to UTC, so trigger components do not depend on the Mac.
let utcCalendar: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "UTC")!
    return c
}()
