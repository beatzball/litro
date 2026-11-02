//  Haptics, the only thing in the shell that is felt rather than seen.

import UIKit
import LitroBridge

/// The native haptics path.
///
/// `prepare()` before each buzz is not a nicety: the Taptic Engine is powered
/// down between uses, and without it the first impact after an idle period
/// arrives late enough to feel disconnected from the tap that caused it.
@MainActor
final class HapticsModule: HapticsHost {
    func impact(_ style: HapticStyle) {
        let generator = UIImpactFeedbackGenerator(style: Self.feedbackStyle(for: style))
        generator.prepare()
        generator.impactOccurred()
    }

    func notify(_ type: HapticNotify) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(Self.feedbackType(for: type))
    }

    func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.prepare()
        generator.selectionChanged()
    }

    /// The mapping is exhaustive on purpose. A `default` here would turn a style
    /// added to the protocol into a silently wrong buzz instead of a build error.
    private static func feedbackStyle(for style: HapticStyle) -> UIImpactFeedbackGenerator.FeedbackStyle {
        switch style {
        case .light: return .light
        case .medium: return .medium
        case .heavy: return .heavy
        case .soft: return .soft
        case .rigid: return .rigid
        }
    }

    private static func feedbackType(for type: HapticNotify) -> UINotificationFeedbackGenerator.FeedbackType {
        switch type {
        case .success: return .success
        case .warning: return .warning
        case .error: return .error
        }
    }
}
