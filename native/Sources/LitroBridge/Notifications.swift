//  Local notifications: every decision the module makes, with no UIKit in it.
//
//  The app-side module in App/Capabilities/NotificationsModule.swift only asks
//  the system for permission and hands it a request built here. What is valid,
//  when it fires, which id it carries, and whether it is still worth scheduling
//  after a slow permission prompt are all decided in this file, so each has a
//  test that runs with `swift test` and no simulator.

import Foundation

/// The permissions a build asks for, as one set.
///
/// iOS shows the notification permission prompt ONCE. Whatever options the
/// first `requestAuthorization` names are what the user grants; a later call
/// asking for more returns the stored answer without a prompt. So the badge
/// module and the notifications module must ask for the same set, or whichever
/// runs first decides for both. A badge-only grant would leave a build with
/// notifications compiled in unable to show one, with no prompt ever offered.
///
/// Our own option set rather than `UNAuthorizationOptions`, so this file stays
/// free of the UserNotifications framework and the decision stays testable.
public struct PermissionScope: OptionSet, Sendable, Equatable {
    public let rawValue: Int
    public init(rawValue: Int) { self.rawValue = rawValue }

    public static let badge = PermissionScope(rawValue: 1 << 0)
    public static let alert = PermissionScope(rawValue: 1 << 1)
    public static let sound = PermissionScope(rawValue: 1 << 2)

    /// What a build with `capabilities` asks for.
    ///
    /// Badge alone when only badging is compiled in: asking for alerts an app
    /// never shows requests something it does not want, and a reviewer asks
    /// why. Everything when notifications are compiled in, from either module.
    public static func forCapabilities(_ capabilities: [Capability]) -> PermissionScope {
        var scope: PermissionScope = []
        if capabilities.contains(.badging) { scope.insert(.badge) }
        if capabilities.contains(.notifications) { scope.formUnion([.badge, .alert, .sound]) }
        return scope
    }
}

/// The parts of the system's notification settings a decision needs.
///
/// Extracted inside the settings callback by the app module, so a value that
/// is always `Sendable` crosses the isolation boundary rather than the
/// settings object, which is not `Sendable` on every SDK (NATIVE-011).
public enum NotificationAuthorization: Equatable, Sendable {
    /// Nobody has been asked. Asking shows the prompt.
    case notDetermined
    /// Granted. `alerts` is whether alerts in particular are on, which is
    /// false after a badge-only grant or when the user turned alerts off.
    case authorized(alerts: Bool)
    case denied
}

/// What the module does next, given the stored authorization.
public enum PermissionStep: Equatable, Sendable {
    case allowed
    case denied
    /// Show the prompt, then decide from its answer.
    case ask
}

public extension NotificationAuthorization {
    /// Whether a notification may be shown, or whether the user must be asked.
    ///
    /// A previous denial is answered from the stored setting, never by asking
    /// again: iOS does not show a second prompt, so the call would only look
    /// like it hangs. An authorization with alerts off is a denial for a
    /// notification, for the same reason: no prompt can turn alerts back on.
    var stepForNotification: PermissionStep {
        switch self {
        case .notDetermined: return .ask
        case let .authorized(alerts): return alerts ? .allowed : .denied
        case .denied: return .denied
        }
    }
}

/// One notification the page asked for, validated.
public struct NotificationRequest: Equatable, Sendable {
    /// The id the page passed, or one the shell made. Scheduling again with the
    /// same id replaces the earlier notification; that is the system's own
    /// rule for a repeated identifier.
    public let id: String
    public let title: String
    public let body: String?
    /// When it fires. For a daily repeat, only the time of day is used.
    public let at: Date
    public let repeatsDaily: Bool
}

/// When the system should fire a notification.
public enum NotificationTrigger: Equatable, Sendable {
    /// After this many seconds. Used when the time passed while the user read
    /// the permission prompt: the person asked for a reminder and allowed it,
    /// so it fires now rather than never.
    case after(seconds: TimeInterval)
    /// At these calendar components, in the device's current calendar and time
    /// zone. `repeats` is true for a daily reminder, whose components are the
    /// time of day only.
    case calendar(DateComponents, repeats: Bool)
}

public extension NotificationRequest {
    /// Reads a request out of `notifications.schedule` params.
    ///
    /// `now` is the moment the request ARRIVED, before any permission prompt.
    /// A one-off time already past then is a page bug and is rejected. Judging
    /// it after the prompt instead would reject a reminder only because the
    /// person took a while to tap Allow.
    ///
    /// Returns the reason as text on failure, for an `INVALID_PARAMS` reply.
    static func parse(_ params: [String: JSONValue], now: Date,
                      makeID: () -> String) -> Result<NotificationRequest, ParamsFailure> {
        guard let title = params["title"]?.stringValue, !title.isEmpty else {
            return .failure(ParamsFailure("title must be a non-empty string"))
        }

        var body: String?
        if let raw = params["body"], raw != .null {
            guard let text = raw.stringValue else { return .failure(ParamsFailure("body must be a string")) }
            body = text.isEmpty ? nil : text
        }

        guard let ms = params["at"]?.numberValue, ms.isFinite else {
            return .failure(ParamsFailure("at must be a time in epoch milliseconds"))
        }
        let at = Date(timeIntervalSince1970: ms / 1000)

        var repeatsDaily = false
        if let raw = params["repeat"], raw != .null {
            switch raw.stringValue {
            case "daily": repeatsDaily = true
            case "none": repeatsDaily = false
            default: return .failure(ParamsFailure("repeat must be daily or none"))
            }
        }

        // A daily reminder uses only the time of day, so a date in the past is
        // the normal way to say "every day at 9", not a mistake.
        if !repeatsDaily && at <= now {
            return .failure(ParamsFailure("at is in the past"))
        }

        // An empty id is what the web adapter returns for "nothing scheduled",
        // so a page passing one back has no id of its own: make one.
        var id = makeID()
        if let raw = params["id"], raw != .null {
            guard let given = raw.stringValue else { return .failure(ParamsFailure("id must be a string")) }
            if !given.isEmpty { id = given }
        }

        return .success(NotificationRequest(id: id, title: title, body: body, at: at, repeatsDaily: repeatsDaily))
    }

    /// The trigger to schedule with, decided at the moment of scheduling.
    ///
    /// `now` here is AFTER the prompt. A one-off reminder whose time passed
    /// while the person read it fires in one second: they asked for it and
    /// allowed it. A calendar trigger for a past moment would be accepted by the
    /// system and never fire, which is a silent loss.
    func trigger(now: Date, calendar: Calendar) -> NotificationTrigger {
        if repeatsDaily {
            return .calendar(calendar.dateComponents([.hour, .minute, .second], from: at), repeats: true)
        }
        if at <= now {
            return .after(seconds: 1)
        }
        return .calendar(calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: at),
                         repeats: false)
    }
}

/// A reason params were rejected, carried as text for the reply.
public struct ParamsFailure: Error, Equatable, Sendable {
    public let message: String
    public init(_ message: String) { self.message = message }
}

/// Whether a schedule that waited on a prompt is still wanted by the page.
///
/// The page waits `interactiveTimeoutMilliseconds` for `notifications.schedule`
/// and then rejects with TIMEOUT. A notification scheduled after that has an id
/// the page never learns, so the page can never cancel it, and a page that
/// retries on timeout schedules it twice. So past the page's budget the shell
/// schedules nothing. The margin covers the reply's own trip back.
public func isStillAwaited(arrived: Date, now: Date) -> Bool {
    let budget = Double(interactiveTimeoutMilliseconds) / 1000
    let margin: TimeInterval = 2
    return now.timeIntervalSince(arrived) < budget - margin
}
