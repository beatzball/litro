//  Whether the built app declares App-Bound Domains, which decides one setting
//  of its web view (NATIVE-021).

import Foundation

public enum AppBoundDomains {
    /// The Info.plist key WebKit reads.
    public static let infoPlistKey = "WKAppBoundDomains"

    /// Whether `info` declares at least one App-Bound domain.
    ///
    /// The shell sets `limitsNavigationsToAppBoundDomains` to exactly this. The
    /// two go together or not at all. Measured on the iOS 26.5 simulator, the
    /// key without the flag refuses every script the shell runs in the page --
    /// the marker, the replies, everything -- even on a domain the key lists,
    /// so the bridge goes dark with no error the page can see. The flag without
    /// the key would limit navigation to a list that does not exist.
    ///
    /// Read from the built Info.plist rather than from app.json, because the
    /// Info.plist is what WebKit reads. Nothing can then make the two disagree.
    public static func declared(in info: [String: Any]?) -> Bool {
        guard let domains = info?[infoPlistKey] as? [String] else { return false }
        return !domains.isEmpty
    }
}
