//  A JSON value, spelled out.
//
//  `WKScriptMessage.body` arrives as `Any`, holding whatever JavaScriptCore
//  handed over. Carrying `Any` any further would make the dispatcher untestable
//  and unsendable, so the transport converts once, here, at the edge.

import Foundation

/// One JSON value.
public enum JSONValue: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])
}

public extension JSONValue {
    /// Converts a value that came out of JavaScriptCore.
    ///
    /// Returns `nil` for anything that is not JSON, such as a `Date` or a class
    /// instance. A message carrying one is not a valid request, and the caller
    /// answers `INVALID_REQUEST` rather than guessing what was meant.
    ///
    /// `NSNumber` is the awkward case: JavaScriptCore boxes both `true` and `1`
    /// as `NSNumber`, so a bool must be recognized by its ObjC type encoding
    /// before the numeric branch, or `true` silently becomes `1`.
    init?(any value: Any) {
        switch value {
        case is NSNull:
            self = .null
        case let n as NSNumber:
            if CFGetTypeID(n) == CFBooleanGetTypeID() {
                self = .bool(n.boolValue)
            } else {
                self = .number(n.doubleValue)
            }
        case let s as String:
            self = .string(s)
        case let a as [Any]:
            var out: [JSONValue] = []
            out.reserveCapacity(a.count)
            for element in a {
                guard let converted = JSONValue(any: element) else { return nil }
                out.append(converted)
            }
            self = .array(out)
        case let d as [String: Any]:
            var out: [String: JSONValue] = [:]
            for (key, element) in d {
                guard let converted = JSONValue(any: element) else { return nil }
                out[key] = converted
            }
            self = .object(out)
        default:
            return nil
        }
    }

    /// The object's entries, or `nil` when this is not an object.
    var objectValue: [String: JSONValue]? {
        if case let .object(d) = self { return d }
        return nil
    }

    /// The string, or `nil` when this is not a string.
    var stringValue: String? {
        if case let .string(s) = self { return s }
        return nil
    }

    /// The number, or `nil` when this is not a number.
    var numberValue: Double? {
        if case let .number(n) = self { return n }
        return nil
    }

    /// The number as an `Int`, or `nil` when this is not a whole number.
    ///
    /// JavaScript has one number type, so an integer parameter arrives as a
    /// `Double`. A fractional value is a caller mistake, not something to round.
    var intValue: Int? {
        guard case let .number(n) = self, n.rounded() == n, n.isFinite else { return nil }
        return Int(n)
    }

    /// The bool, or `nil` when this is not a bool.
    var boolValue: Bool? {
        if case let .bool(b) = self { return b }
        return nil
    }
}

public extension JSONValue {
    /// This value as compact JSON text.
    ///
    /// Written by hand rather than through `JSONSerialization` for two reasons:
    /// a top-level scalar is legal JSON here but not to that API, and object keys
    /// must come out sorted so a test can assert on an exact string.
    var jsonText: String {
        switch self {
        case .null:
            return "null"
        case let .bool(b):
            return b ? "true" : "false"
        case let .number(n):
            if n.rounded() == n, n.isFinite, abs(n) < 1e15 {
                return String(Int(n))
            }
            return String(n)
        case let .string(s):
            return Self.quote(s)
        case let .array(a):
            return "[" + a.map(\.jsonText).joined(separator: ",") + "]"
        case let .object(d):
            let pairs = d.keys.sorted().map { "\(Self.quote($0)):\(d[$0]!.jsonText)" }
            return "{" + pairs.joined(separator: ",") + "}"
        }
    }

    /// Quotes a string as a JSON string literal that is also safe JavaScript source.
    ///
    /// U+2028 and U+2029 are legal inside a JSON string and illegal inside a
    /// JavaScript line, so a reply containing one would be valid JSON that fails
    /// to evaluate in the web view. They are escaped here, where every reply
    /// passes, rather than in the transport.
    static func quote(_ s: String) -> String {
        var out = "\""
        for scalar in s.unicodeScalars {
            switch scalar {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            case "\u{2028}": out += "\\u2028"
            case "\u{2029}": out += "\\u2029"
            default:
                if scalar.value < 0x20 {
                    out += String(format: "\\u%04x", scalar.value)
                } else {
                    out.unicodeScalars.append(scalar)
                }
            }
        }
        return out + "\""
    }
}
