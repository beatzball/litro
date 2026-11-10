//  The system share sheet: the UIKit facts and actions, and nothing else.
//
//  Every decision -- what a valid payload is, which items the sheet gets, what
//  each way the sheet closes means to the page, when a presentation counts as
//  refused, when an open sheet counts as gone, answering a callback once -- is
//  in Sources/LitroBridge/ShareAndReview.swift (`ShareSheetRun`), where a
//  scripted sheet drives it under `swift test`. This file reports what UIKit
//  says and does what the run asks.

import UIKit
import LitroBridge

/// The native share path.
@MainActor
final class ShareModule: ShareHost {
    func share(_ content: ShareContent) async -> ShareOutcome {
        await ShareSheetRun.run(ActivitySheet(content), sleep: { try? await Task.sleep(for: $0) })
    }
}

/// One `UIActivityViewController`, as `ShareSheetUI`.
@MainActor
private final class ActivitySheet: ShareSheetUI {
    private let sheet: UIActivityViewController
    private let presenter: UIViewController?

    init(_ content: ShareContent) {
        sheet = UIActivityViewController(activityItems: content.items.map(Self.activityItem),
                                         applicationActivities: nil)
        presenter = Self.topmostController()
    }

    func presenterFacts() -> (inWindow: Bool, transitioning: Bool) {
        (inWindow: presenter?.viewIfLoaded?.window != nil,
         transitioning: (presenter?.isBeingPresented ?? false) || (presenter?.isBeingDismissed ?? false))
    }

    func present(onPresented: @escaping @MainActor () -> Void,
                 onClosed: @escaping @MainActor (Bool, String?, Int?) -> Void) {
        let view = presenter?.view
        let anchor = ShareAnchor(width: Double(view?.bounds.width ?? 0), height: Double(view?.bounds.height ?? 0))
        // On an iPad the sheet is a popover, and a popover with no anchor stops
        // the app. On an iPhone there is no popover and these lines do nothing.
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: anchor.x, y: anchor.y, width: 0, height: 0)
        sheet.popoverPresentationController?.permittedArrowDirections = []

        sheet.completionWithItemsHandler = { _, completed, _, error in
            let nsError = error.map { $0 as NSError }
            MainActor.assumeIsolated {
                onClosed(completed, nsError?.domain, nsError?.code)
            }
        }
        presenter?.present(sheet, animated: true) {
            MainActor.assumeIsolated { onPresented() }
        }
    }

    var isOnScreen: Bool { sheet.presentingViewController != nil }

    /// The sheet is presented above whatever is on screen, so a popover the
    /// page itself opened -- a <select> on an iPad -- does not block it.
    private static func topmostController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }

    private static func activityItem(_ item: ShareItem) -> Any {
        switch item {
        case let .text(text): return text
        case let .url(url): return url
        case let .subject(subject): return ShareSubject(subject)
        }
    }
}

/// Offers the page's title as the subject line to targets that use one, such
/// as Mail, and shares nothing as an item of its own.
private final class ShareSubject: NSObject, UIActivityItemSource {
    private let subject: String

    init(_ subject: String) {
        self.subject = subject
    }

    func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any {
        subject
    }

    func activityViewController(_ controller: UIActivityViewController,
                                itemForActivityType activityType: UIActivity.ActivityType?) -> Any? {
        nil
    }

    func activityViewController(_ controller: UIActivityViewController,
                                subjectForActivityType activityType: UIActivity.ActivityType?) -> String {
        subject
    }
}
