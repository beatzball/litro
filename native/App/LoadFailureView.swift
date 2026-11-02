//  The screen shown over the web view when the page does not load.
//
//  What to say, and whether to say anything at all, is decided by LoadFailure in
//  LitroShellKit, which is testable. This file is only the pixels and the one
//  button.

import UIKit
import LitroShellKit

@MainActor
final class LoadFailureView: UIView {
    /// Called when the reader taps Try again.
    private let retry: () -> Void
    private var button: UIButton!

    init(failure: LoadFailure, retry: @escaping () -> Void) {
        self.retry = retry
        super.init(frame: .zero)
        backgroundColor = .systemBackground
        build(failure)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("not from a storyboard") }

    /// Says the retry is under way.
    ///
    /// This screen stays up until the new page has painted, so without this the
    /// tap has no visible effect at all for as long as the load takes.
    func markRetrying() {
        button.isEnabled = false
        button.setTitle("Trying again", for: .normal)
    }

    private func build(_ failure: LoadFailure) {
        let summary = UILabel()
        summary.text = failure.summary
        summary.font = .preferredFont(forTextStyle: .headline)
        summary.adjustsFontForContentSizeCategory = true
        summary.numberOfLines = 0
        summary.textAlignment = .center

        let address = UILabel()
        address.text = failure.failingURL
        address.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        address.textColor = .secondaryLabel
        address.numberOfLines = 0
        address.textAlignment = .center
        // A failure with no URL leaves this label out of the stack entirely,
        // rather than in it as an empty gap.
        address.isHidden = failure.failingURL == nil

        let detail = UILabel()
        detail.text = failure.detail
        detail.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        detail.textColor = .tertiaryLabel
        detail.numberOfLines = 0
        detail.textAlignment = .center

        button = UIButton(configuration: .bordered())
        button.setTitle("Try again", for: .normal)
        button.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [summary, address, detail, button])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        let guide = safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: guide.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: guide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: guide.trailingAnchor, constant: -24),
        ])
    }

    @objc private func retryTapped() { retry() }
}
