//  The in-app review prompt: asking, and nothing else.
//
//  What the page is told is decided in Sources/LitroBridge/Dispatcher.swift:
//  `null`, at once, which means "passed on" and never "shown". The system
//  rate-limits the prompt, never shows it in a TestFlight build, and does not
//  tell the app whether it appeared.

import UIKit
import StoreKit
import LitroBridge

/// The native review path.
@MainActor
final class ReviewModule: ReviewHost {
    func requestReview() {
        // The foreground scene, or none. With none -- the app was moving to the
        // background as the call arrived -- there is nowhere to show a prompt,
        // and the answer is the same `null`, because the page could not act on
        // the difference: the system may ignore the request either way.
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        scene.map { AppStore.requestReview(in: $0) }
    }
}
