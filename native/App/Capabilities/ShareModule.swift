//  The system share sheet: presenting it, and nothing else.
//
//  Every decision -- what a valid payload is, what each way the sheet closes
//  means to the page, refusing a second sheet, where it is anchored on an iPad,
//  answering a callback once -- is in Sources/LitroBridge/ShareAndReview.swift,
//  where it has tests. This file builds the sheet and reports how it closed.

import UIKit
import LitroBridge

/// The native share path.
@MainActor
final class ShareModule: ShareHost {
    func share(_ content: ShareContent) async -> ShareOutcome {
        let items: [Any] = [ShareSubject(content.subject)] + [content.text as Any?, content.url as Any?].compactMap { $0 }
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)

        // The sheet is presented above whatever is on screen, so a popover the
        // page itself opened -- a <select> on an iPad -- does not block it.
        let presenter = Self.topmostController()
        let view = presenter?.view
        let anchor = ShareAnchor(width: Double(view?.bounds.width ?? 0), height: Double(view?.bounds.height ?? 0))
        // On an iPad the sheet is a popover, and a popover with no anchor stops
        // the app. On an iPhone there is no popover and these lines do nothing.
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: anchor.x, y: anchor.y, width: 0, height: 0)
        sheet.popoverPresentationController?.permittedArrowDirections = []

        return await withCheckedContinuation { continuation in
            let once = SingleAnswer<ShareOutcome> { continuation.resume(returning: $0) }
            sheet.completionWithItemsHandler = { _, completed, _, error in
                MainActor.assumeIsolated {
                    once.answer(ShareOutcome(completed: completed, failed: error != nil))
                }
            }
            presenter?.present(sheet, animated: true)
            ShareOutcome.afterPresenting(isOnScreen: sheet.presentingViewController != nil).map(once.answer)
        }
    }

    /// The controller on top of the foreground window, walking up through
    /// anything already presented.
    private static func topmostController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }
}

/// Offers the page's title as the subject line to targets that use one, such
/// as Mail, and shares nothing as an item of its own.
private final class ShareSubject: NSObject, UIActivityItemSource {
    private let subject: String?

    init(_ subject: String?) {
        self.subject = subject
    }

    func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any {
        ""
    }

    func activityViewController(_ controller: UIActivityViewController,
                                itemForActivityType activityType: UIActivity.ActivityType?) -> Any? {
        nil
    }

    func activityViewController(_ controller: UIActivityViewController,
                                subjectForActivityType activityType: UIActivity.ActivityType?) -> String {
        subject ?? ""
    }
}
