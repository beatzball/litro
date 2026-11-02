//  Local notifications: the system calls, and nothing else.
//
//  Every decision -- what is valid, which trigger, whether the page is still
//  waiting after a slow prompt, which permissions to ask for -- is made in
//  Sources/LitroBridge/Notifications.swift, where it has tests. This file asks
//  the system and hands it what it was given.

import UIKit
import UserNotifications
import LitroBridge

extension PermissionScope {
    /// The system's spelling of this scope.
    var authorizationOptions: UNAuthorizationOptions {
        var options: UNAuthorizationOptions = []
        if contains(.badge) { options.insert(.badge) }
        if contains(.alert) { options.insert(.alert) }
        if contains(.sound) { options.insert(.sound) }
        return options
    }
}

/// The native notifications path.
///
/// Holds no `UNUserNotificationCenter` and passes no system object across an
/// isolation boundary: every system call is in a nonisolated static helper
/// that fetches the shared center itself and takes only `Sendable` values.
/// The center, its settings and its requests are not `Sendable` on every SDK,
/// and that failure appears only on CI's older one (NATIVE-011).
@MainActor
final class NotificationsModule: NotificationsHost {
    private let scope: PermissionScope

    /// `scope` must be the same set the badge module asks for. iOS shows the
    /// permission prompt once, and the first request decides for both.
    init(scope: PermissionScope) {
        self.scope = scope
        // Without a delegate, iOS does not show a notification at all while
        // the app is in front, which reads as "the reminder never fired".
        UNUserNotificationCenter.current().delegate = NotificationPresenter.shared
    }

    func authorization() async -> NotificationAuthorization {
        await Self.readAuthorization()
    }

    func requestPermission() async {
        await Self.request(scope.authorizationOptions)
    }

    func schedule(_ request: NotificationRequest, trigger: NotificationTrigger) async throws {
        try await Self.add(request, trigger)
    }

    func cancel(id: String) async {
        Self.remove(id)
    }

    /// Reads the two values a decision needs inside the callback, so only an
    /// enum crosses back.
    private nonisolated static func readAuthorization() async -> NotificationAuthorization {
        await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                let value: NotificationAuthorization
                switch settings.authorizationStatus {
                case .notDetermined:
                    value = .notDetermined
                case .authorized, .provisional, .ephemeral:
                    // Visible anywhere, not banners alone. A person who turned
                    // banners off but kept the Lock Screen or Notification
                    // Center still sees the reminder, and refusing it would
                    // call that a declined permission. What `alertSetting`
                    // reads with only banners off has NOT been checked on a
                    // device; reading all three is right whichever it is.
                    value = .authorized(visible: settings.alertSetting == .enabled
                                        || settings.lockScreenSetting == .enabled
                                        || settings.notificationCenterSetting == .enabled)
                case .denied:
                    value = .denied
                @unknown default:
                    // A status this build does not know is treated as "not
                    // allowed". Guessing the other way promises a reminder
                    // that never appears.
                    value = .denied
                }
                continuation.resume(returning: value)
            }
        }
    }

    /// The answer is not returned: the dispatcher reads the settings again,
    /// because a yes can still be a grant that shows nothing.
    private nonisolated static func request(_ options: UNAuthorizationOptions) async {
        _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: options)
    }

    /// Builds the system request here, from `Sendable` values, rather than on
    /// the main actor and sending it across.
    private nonisolated static func add(_ request: NotificationRequest, _ trigger: NotificationTrigger) async throws {
        let content = UNMutableNotificationContent()
        content.title = request.title
        if let body = request.body { content.body = body }
        content.sound = .default

        let systemTrigger: UNNotificationTrigger
        switch trigger {
        case let .after(seconds):
            systemTrigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        case let .calendar(components, repeats):
            systemTrigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: repeats)
        }
        try await UNUserNotificationCenter.current()
            .add(UNNotificationRequest(identifier: request.id, content: content, trigger: systemTrigger))
    }

    private nonisolated static func remove(_ id: String) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [id])
        center.removeDeliveredNotifications(withIdentifiers: [id])
    }
}

/// Shows a notification that arrives while the app is in front.
///
/// The async form of the delegate method, not the completion-handler form: a
/// hand-written completion signature that only nearly matches compiles, warns
/// once, and is never called (NATIVE-010).
final class NotificationPresenter: NSObject, UNUserNotificationCenterDelegate, Sendable {
    /// Held here because the center holds its delegate weakly.
    static let shared = NotificationPresenter()

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
}
