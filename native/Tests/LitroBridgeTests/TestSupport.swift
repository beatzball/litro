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
