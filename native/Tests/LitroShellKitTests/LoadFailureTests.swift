//  The rules for the screen shown when a navigation fails, and above all the
//  one failure that must never reach it.

import XCTest
@testable import LitroShellKit

private let someURL = URL(string: "http://app.example.test:5173/")!

private func error(
    _ domain: String,
    _ code: Int,
    description: String = "something went wrong",
    failingURL: String? = nil
) -> NSError {
    var info: [String: Any] = [NSLocalizedDescriptionKey: description]
    if let failingURL { info[NSURLErrorFailingURLStringErrorKey] = failingURL }
    return NSError(domain: domain, code: code, userInfo: info)
}

final class LoadFailureVisibilityTests: XCTestCase {
    /// The origin allowlist refuses an outside origin by cancelling the
    /// navigation, and WebKit reports that refusal as an error. A failure screen
    /// here would cover the page the reader was already on and make the
    /// allowlist working look like the shell broken.
    func testACanceledNavigationIsNotShown() {
        let failure = LoadFailure(error: error(NSURLErrorDomain, NSURLErrorCancelled), url: someURL)
        XCTAssertNil(failure)
    }

    /// The same refusal, as WebKit's legacy domain reports it.
    func testAnInterruptedFrameLoadIsNotShown() {
        let failure = LoadFailure(error: error("WebKitErrorDomain", 102), url: someURL)
        XCTAssertNil(failure)
    }

    /// Canceled is special because it is deliberate, not because it is in
    /// WebKit's domain. A real WebKit failure still gets a screen.
    func testAnotherWebKitErrorIsShown() {
        let failure = LoadFailure(error: error("WebKitErrorDomain", 204), url: someURL)
        XCTAssertNotNil(failure)
    }

    func testAnUnreachableServerIsShown() {
        let failure = LoadFailure(error: error(NSURLErrorDomain, NSURLErrorCannotConnectToHost),
                                  url: someURL)
        XCTAssertNotNil(failure)
    }
}

final class LoadFailureTextTests: XCTestCase {
    /// The codes for an unreachable host all lead the reader to the same next
    /// move, so they share one headline.
    func testTheUnreachableCodesShareOneSummary() {
        let codes = [
            NSURLErrorCannotConnectToHost,
            NSURLErrorCannotFindHost,
            NSURLErrorTimedOut,
            NSURLErrorNetworkConnectionLost,
            NSURLErrorNotConnectedToInternet,
            NSURLErrorDNSLookupFailed,
        ]
        for code in codes {
            let failure = LoadFailure(error: error(NSURLErrorDomain, code), url: someURL)
            XCTAssertEqual(failure?.summary, "Could not reach the server.",
                           "NSURLErrorDomain \(code)")
        }
    }

    func testAnInsecureConnectionSaysSo() {
        let failure = LoadFailure(
            error: error(NSURLErrorDomain,
                         NSURLErrorAppTransportSecurityRequiresSecureConnection),
            url: someURL
        )
        XCTAssertEqual(failure?.summary, "The connection was refused as insecure.")
    }

    /// A code with no family of its own still gets a screen, with a headline
    /// that claims nothing about the cause.
    func testAnUnknownCodeGetsTheNeutralSummary() {
        let failure = LoadFailure(error: error(NSURLErrorDomain, -12345), url: someURL)
        XCTAssertEqual(failure?.summary, "The page did not load.")
    }

    /// The domain and code are on screen because they are what a search engine
    /// and a bug report need, and the reader cannot get them from a log.
    func testTheDetailCarriesTheErrorsOwnWordsAndItsNumbers() {
        let failure = LoadFailure(
            error: error(NSURLErrorDomain, NSURLErrorTimedOut, description: "The request timed out."),
            url: someURL
        )
        XCTAssertEqual(failure?.detail, "The request timed out.\nNSURLErrorDomain -1001")
    }

    func testTheNavigationURLIsShownWhenTheErrorCarriesNone() {
        let failure = LoadFailure(error: error(NSURLErrorDomain, NSURLErrorTimedOut), url: someURL)
        XCTAssertEqual(failure?.failingURL, "http://app.example.test:5173/")
    }

    /// A redirect means the address that failed is not the one the navigation
    /// started from, so the error's own URL wins.
    func testTheErrorsFailingURLWinsOverTheNavigationURL() {
        let failure = LoadFailure(
            error: error(NSURLErrorDomain, NSURLErrorTimedOut,
                         failingURL: "http://redirected.example.test/elsewhere"),
            url: someURL
        )
        XCTAssertEqual(failure?.failingURL, "http://redirected.example.test/elsewhere")
    }

    /// A failure with no URL anywhere is still worth a screen. Hiding it would
    /// put the shell back on the blank view this whole file exists to prevent.
    func testAFailureWithNoURLAtAllIsStillShown() {
        let failure = LoadFailure(error: error(NSURLErrorDomain, NSURLErrorTimedOut), url: nil)
        XCTAssertNotNil(failure)
        XCTAssertNil(failure?.failingURL)
    }
}
