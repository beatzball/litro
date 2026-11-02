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
    var stored: NotificationAuthorization = .authorized(alerts: true)
    /// What the person taps when a prompt is shown.
    var grants = true
    /// Runs while the prompt is open, so a test can move the clock.
    var whilePrompting: () -> Void = {}
    /// When set, the system refuses to schedule.
    var refuses = false

    var prompts = 0
    var scheduled: [(NotificationRequest, NotificationTrigger)] = []
    var canceled: [String] = []

    func authorization() async -> NotificationAuthorization { stored }

    func requestPermission() async -> Bool {
        prompts += 1
        whilePrompting()
        stored = grants ? .authorized(alerts: true) : .denied
        return grants
    }

    func schedule(_ request: NotificationRequest, trigger: NotificationTrigger) async throws {
        if refuses { throw SecureStorageFailure(status: -1) }
        scheduled.append((request, trigger))
    }

    func cancel(id: String) async { canceled.append(id) }
}

/// A keychain held in a dictionary.
@MainActor
final class MemorySecureStorage: SecureStorageHost {
    var values: [String: String] = [:]
    /// When set, every call fails with this status.
    var failing: Int32?

    func get(_ key: String) throws -> String? {
        if let failing { throw SecureStorageFailure(status: failing) }
        return values[key]
    }

    func set(_ key: String, value: String) throws {
        if let failing { throw SecureStorageFailure(status: failing) }
        values[key] = value
    }

    func remove(_ key: String) throws {
        if let failing { throw SecureStorageFailure(status: failing) }
        values[key] = nil
    }
}

/// A clock a test can move.
@MainActor
final class TestClock {
    var now: Date
    init(_ now: Date = Date(timeIntervalSince1970: 1_800_000_000)) { self.now = now }
    func advance(_ seconds: TimeInterval) { now = now.addingTimeInterval(seconds) }
}

/// A calendar fixed to UTC, so trigger components do not depend on the Mac.
let utcCalendar: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "UTC")!
    return c
}()
