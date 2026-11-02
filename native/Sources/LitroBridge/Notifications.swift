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
    /// Granted. `visible` is whether a notification would appear anywhere:
    /// as a banner, on the Lock Screen, or in Notification Center. It is false
    /// after a badge-only grant, or when the person turned all three off.
    case authorized(visible: Bool)
    case denied
}

/// What the module does next, given the stored authorization.
public enum PermissionStep: Equatable, Sendable {
    case allowed
    case denied
    /// Ask, then decide from the settings read again afterward.
    case ask
}

public extension NotificationAuthorization {
    /// Whether a notification may be shown, or whether the shell should ask.
    ///
    /// A stored denial is answered from the setting, never by asking again:
    /// iOS does not show a second prompt, so the call would only look like it
    /// hangs.
    ///
    /// A grant that shows nothing is asked about once more rather than refused.
    /// The usual cause is an app whose earlier build had badging only, so the
    /// person granted the badge alone. Asking again shows no second prompt, so
    /// it costs nothing, and if the system widens the grant the reminder goes
    /// through. Whether iOS widens a badge-only grant without a prompt has NOT
    /// been checked on a device; the settings are read again after asking, so
    /// the answer is right either way.
    var stepForNotification: PermissionStep {
        switch self {
        case .notDetermined: return .ask
        case let .authorized(visible): return visible ? .allowed : .ask
        case .denied: return .denied
        }
    }

    /// Whether a notification scheduled now would be shown somewhere.
    var allowsNotification: Bool {
        self == .authorized(visible: true)
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

        // The page adapter makes the id before sending, so it knows the id
        // even when its call times out. A page that sent none, or an empty
        // one -- what the web adapter returns for "nothing scheduled" -- gets
        // one made here.
        var id = makeID()
        if let raw = params["id"], raw != .null {
            guard let given = raw.stringValue else { return .failure(ParamsFailure("id must be a string")) }
            if !given.isEmpty { id = given }
        }

        return .success(NotificationRequest(id: id, title: title, body: body, at: at, repeatsDaily: repeatsDaily))
    }

    /// The trigger to schedule with, decided at the moment of scheduling.
    ///
    /// `now` here is AFTER any prompt.
    ///
    /// A one-off is an interval from now, never a calendar moment. `at` is an
    /// instant, and an interval names an instant:
    ///
    /// - A calendar trigger keeps whole seconds only. For a reminder under a
    ///   second away it names a moment already past, which the system accepts
    ///   and never fires, while the page was told the reminder exists.
    /// - A calendar trigger with no time zone is floating: a person who flies
    ///   west sees it fire hours after the instant the page asked for.
    ///
    /// A one-off whose time passed while the person read the prompt fires in
    /// one second: they asked for it and allowed it. One second is also the
    /// floor, because the system refuses an interval of zero.
    ///
    /// A daily reminder uses the time of day only, in the device's current
    /// calendar and time zone, and starts at its next occurrence -- today, if
    /// that time has not passed yet -- even when `at` is a later date. iOS has
    /// no start date for a repeating trigger. "Every day at 9, local time" is
    /// the meaning, so it follows the person across time zones.
    func trigger(now: Date, calendar: Calendar) -> NotificationTrigger {
        if repeatsDaily {
            return .calendar(calendar.dateComponents([.hour, .minute, .second], from: at), repeats: true)
        }
        return .after(seconds: max(1, at.timeIntervalSince(now)))
    }
}

/// A reason params were rejected, carried as text for the reply.
public struct ParamsFailure: Error, Equatable, Sendable {
    public let message: String
    public init(_ message: String) { self.message = message }
}

/// How long the page waits for one `notifications.schedule` call.
///
/// The page sends it as `budgetMs`, the same number its own timer uses. After
/// that time the page has rejected the call with TIMEOUT, and a notification
/// scheduled then carries an id the page may never learn. So past the budget
/// the shell schedules nothing.
///
/// The page sends the number rather than the shell carrying a copy because
/// the two are released apart. A copy would have to match both the number and
/// which methods it applies to, and an installed app cannot be updated when
/// either changes on the page side. The budget is relative, not a deadline,
/// so the shell never compares the page's clock to its own.
public struct ScheduleBudget: Equatable, Sendable {
    public let duration: Duration

    /// What a page that sends no `budgetMs` waited: the page's interactive
    /// timeout when this field was added. Only for a page built before it.
    public static let unstated = ScheduleBudget(duration: .milliseconds(120_000))

    public init(duration: Duration) { self.duration = duration }

    /// Reads `budgetMs`. Absent is `unstated`; anything but a positive,
    /// finite number is a page bug.
    public static func parse(_ params: [String: JSONValue]) -> Result<ScheduleBudget, ParamsFailure> {
        guard let raw = params["budgetMs"], raw != .null else { return .success(.unstated) }
        guard let ms = raw.numberValue, ms.isFinite, ms > 0 else {
            return .failure(ParamsFailure("budgetMs must be a positive number of milliseconds"))
        }
        return .success(ScheduleBudget(duration: .milliseconds(ms)))
    }

    /// Whether the page is still waiting after `elapsed`, measured by the
    /// shell on a clock no change to the device time can move.
    ///
    /// The margin covers the reply's own trip back. It is two seconds, or a
    /// quarter of a short budget, so a small budget is not all margin.
    public func isStillAwaited(after elapsed: Duration) -> Bool {
        let margin = min(.seconds(2), duration / 4)
        return elapsed < duration - margin
    }
}
