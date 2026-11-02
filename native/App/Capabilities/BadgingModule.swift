//  The home screen badge.

import UIKit
import UserNotifications
import LitroBridge

/// The native badging path.
///
/// Setting a badge needs the notification permission, so the first call may put
/// a prompt in front of the user. The permission is asked for with `.badge`
/// alone: asking for alerts here would request something the app did not want
/// and raise a question at store review.
///
/// This type holds nothing. `UNUserNotificationCenter` is not `Sendable` in
/// every iOS SDK, so a stored `center` on a main-actor class cannot be handed to
/// the center's own async methods -- they are nonisolated, and the compiler
/// reports `sending 'self.center' risks causing data races` on the SDKs where
/// the type is still unaudited. Fetching the shared center inside each
/// nonisolated helper keeps it a local that never crosses an isolation boundary,
/// which compiles against every SDK rather than the newest one.
@MainActor
final class BadgingModule: BadgingHost {
    func set(count: Int) async -> Bool {
        guard await Self.isAuthorized() else { return false }
        do {
            try await Self.setBadgeCount(count)
            return true
        } catch {
            // The permission was granted and the system still refused. Reported
            // as a failure rather than swallowed, so the page does not show a
            // badge count the home screen does not have.
            return false
        }
    }

    private nonisolated static func setBadgeCount(_ count: Int) async throws {
        try await UNUserNotificationCenter.current().setBadgeCount(count)
    }

    /// Whether the app may show a badge, asking once if nobody has been asked.
    ///
    /// `.notDetermined` is the only state that prompts. A previous denial is
    /// answered from the stored setting rather than by asking again, because iOS
    /// does not show a second prompt and the call would appear to hang.
    private nonisolated static func isAuthorized() async -> Bool {
        switch await authorizationStatus() {
        case .authorized, .provisional, .ephemeral:
            return true
        case .denied:
            return false
        case .notDetermined:
            let granted = try? await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.badge])
            return granted ?? false
        @unknown default:
            // A status this build does not know is treated as "not allowed".
            // Guessing the other way would promise a badge that never appears.
            return false
        }
    }

    /// Reads only the status, never the settings object.
    ///
    /// `UNNotificationSettings` is not `Sendable` in every iOS SDK, so awaiting
    /// `notificationSettings()` fails to compile against some of them. The
    /// status is a plain enum, so extracting it inside the callback crosses the
    /// boundary with a value that is always safe to send.
    private nonisolated static func authorizationStatus() async -> UNAuthorizationStatus {
        await withCheckedContinuation { continuation in
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                continuation.resume(returning: settings.authorizationStatus)
            }
        }
    }
}
