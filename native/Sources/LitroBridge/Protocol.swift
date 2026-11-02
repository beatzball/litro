//  The bridge protocol, Swift side.
//
//  This file mirrors packages/litro-native/src/protocol.ts, which is the single
//  source of truth. It is a mirror on purpose: the shell is an installed app and
//  cannot import TypeScript, so the constants exist twice.
//
//  Two copies drift. scripts/check-bridge-parity.mjs reads both files and fails
//  CI when a method name, an error code, a capability or a timeout differs, so
//  the drift is caught by a machine rather than on a device.
//
//  Nothing here imports UIKit or WebKit. The protocol must be testable with
//  `swift test` and no simulator.

import Foundation

/// The protocol version this shell speaks.
///
/// Bumped only when the wire format changes in a way an older peer cannot read.
/// Adding a capability does not bump it: the handshake already reports which
/// capabilities exist, so a shell that gains one is readable by an unchanged page.
public let bridgeProtocolVersion = 1

/// The message handler the page posts to.
public let handlerName = "litroNative"

/// The global the shell injects at document start.
public let globalName = "__litroNative"

/// Every method the page may call.
///
/// Flat rather than nested, because a method name is compared as a string here
/// and a switch over flat cases is the thing hardest to get subtly wrong.
///
/// Named `BridgeMethod` rather than `Method` because the Objective-C runtime
/// exports a `Method` typedef through Foundation. The plain name compiles until
/// something writes `[Method: X]`, and then fails with "ambiguous for type
/// lookup" far from the declaration.
public enum BridgeMethod: String, CaseIterable, Sendable {
    case handshake = "handshake"
    case hapticsImpact = "haptics.impact"
    case hapticsNotify = "haptics.notify"
    case hapticsSelection = "haptics.selection"
    case notificationsSchedule = "notifications.schedule"
    case notificationsCancel = "notifications.cancel"
    case badgingSet = "badging.set"
    case badgingClear = "badging.clear"
    case secureStorageGet = "secureStorage.get"
    case secureStorageSet = "secureStorage.set"
    case secureStorageRemove = "secureStorage.remove"
    case canShare = "canShare"
    case share = "share"
    case requestReview = "requestReview"
}

/// A capability a build may compile in.
public enum Capability: String, CaseIterable, Sendable, Codable {
    case haptics
    case notifications
    case badging
    case secureStorage
    case share
    case review
}

public extension BridgeMethod {
    /// Which capability this method needs, or `nil` when it needs none.
    ///
    /// `share` and `canShare` are gated together, since one answers for the other.
    var capability: Capability? {
        switch self {
        case .handshake: return nil
        case .hapticsImpact, .hapticsNotify, .hapticsSelection: return .haptics
        case .notificationsSchedule, .notificationsCancel: return .notifications
        case .badgingSet, .badgingClear: return .badging
        case .secureStorageGet, .secureStorageSet, .secureStorageRemove: return .secureStorage
        case .canShare, .share: return .share
        case .requestReview: return .review
        }
    }
}

/// The error codes a shell may return.
///
/// The first five are JSON-RPC's own reserved codes and keep their meanings. The
/// rest sit in the implementation-defined range the specification sets aside,
/// `-32000` to `-32099`.
///
/// There is deliberately no code for "this capability is not available here".
/// A capability this build did not compile in is omitted from the handshake, and
/// the page then answers the call itself. A code for it would invite a shell
/// that returns one, and that breaks the contract's promise that a capability
/// call never fails for a missing platform feature.
public enum ErrorCode: Int, CaseIterable, Sendable {
    /// The shell could not parse the message as JSON.
    case parseError = -32700
    /// Well-formed JSON, but not a valid request for this protocol version.
    case invalidRequest = -32600
    /// A method this shell does not know.
    case methodNotFound = -32601
    /// The method is known, but `params` do not satisfy it.
    case invalidParams = -32602
    /// The shell tried and failed. The caller may retry.
    case internalError = -32603
    /// The user declined a permission prompt. Not a fault, and not retryable.
    case permissionDenied = -32000
    /// The page's own timeout. Never sent on the wire by the shell.
    case timeout = -32001
    /// The shell speaks a protocol version the page cannot read.
    case versionUnsupported = -32002
}
