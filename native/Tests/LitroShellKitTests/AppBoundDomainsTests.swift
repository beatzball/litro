import XCTest
@testable import LitroShellKit

final class AppBoundDomainsTests: XCTestCase {
    func testNoInfoDictionaryDeclaresNothing() {
        XCTAssertFalse(AppBoundDomains.declared(in: nil))
    }

    func testAnInfoDictionaryWithoutTheKeyDeclaresNothing() {
        XCTAssertFalse(AppBoundDomains.declared(in: ["CFBundleIdentifier": "dev.litro.shell.demo"]))
    }

    func testAnEmptyListDeclaresNothing() {
        XCTAssertFalse(AppBoundDomains.declared(in: [AppBoundDomains.infoPlistKey: [String]()]))
    }

    func testOneDomainIsDeclared() {
        XCTAssertTrue(AppBoundDomains.declared(in: [AppBoundDomains.infoPlistKey: ["qdoku.com"]]))
    }

    /// A key that is not a list of strings is not a list WebKit can read, so it
    /// must not turn the web view's limit on.
    func testAKeyThatIsNotAListDeclaresNothing() {
        XCTAssertFalse(AppBoundDomains.declared(in: [AppBoundDomains.infoPlistKey: "qdoku.com"]))
    }

    func testTheKeyIsTheOneWebKitReads() {
        XCTAssertEqual(AppBoundDomains.infoPlistKey, "WKAppBoundDomains")
    }
}
