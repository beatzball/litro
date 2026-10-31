//  The envelope: what a request must look like, and what a reply looks like.
//
//  JSON-RPC 2.0 shaped, with three narrowings the protocol document states:
//  every request carries an `id`, `params` is an object or absent and never
//  positional, and there is no batching.

import Foundation

/// A call from the page to the shell.
public struct BridgeRequest: Equatable, Sendable {
    public let id: String
    public let method: BridgeMethod
    public let params: [String: JSONValue]

    public init(id: String, method: BridgeMethod, params: [String: JSONValue] = [:]) {
        self.id = id
        self.method = method
        self.params = params
    }
}

/// Why a message could not be turned into a request.
///
/// Carried as a case rather than a code so the caller cannot answer with a code
/// the protocol does not define for this situation.
///
/// Both cases carry the id when the message had a usable one. That matters more
/// than it looks: a page call sits on a promise until its timeout, so a reply it
/// can match is the difference between an immediate error and a ten-second
/// hang. The id is therefore read before anything else is validated.
public enum RequestParseFailure: Error, Equatable, Sendable {
    /// The message is not an object, `jsonrpc` is wrong, `method` is missing or
    /// not a string, or `params` is present and not an object.
    ///
    /// `id` is `nil` only when the message had no usable id to answer.
    case invalidRequest(id: String?)
    /// The envelope is valid but names a method this shell does not know.
    case methodNotFound(id: String)

    public var code: ErrorCode {
        switch self {
        case .invalidRequest: return .invalidRequest
        case .methodNotFound: return .methodNotFound
        }
    }

    /// The id to answer, or `nil` when there is nowhere to send a reply.
    public var id: String? {
        switch self {
        case let .invalidRequest(id): return id
        case let .methodNotFound(id): return id
        }
    }
}

public extension BridgeRequest {
    /// Reads a request out of a decoded message.
    ///
    /// The checks mirror `isBridgeRequest` in protocol.ts, in the same order, so
    /// that a message one side accepts the other does not reject.
    static func parse(_ value: JSONValue) -> Result<BridgeRequest, RequestParseFailure> {
        guard let message = value.objectValue else { return .failure(.invalidRequest(id: nil)) }

        // The id comes first, before anything is judged. Every later rejection
        // can then be addressed back to the call that is waiting on it.
        guard let id = message["id"]?.stringValue, !id.isEmpty else {
            return .failure(.invalidRequest(id: nil))
        }
        guard message["jsonrpc"]?.stringValue == "2.0" else { return .failure(.invalidRequest(id: id)) }
        guard let methodName = message["method"]?.stringValue else {
            return .failure(.invalidRequest(id: id))
        }

        // `params` present but not an object is a malformed envelope, not an
        // unknown method, so it is checked before the method name is resolved.
        var params: [String: JSONValue] = [:]
        if let raw = message["params"], raw != .null {
            guard let object = raw.objectValue else { return .failure(.invalidRequest(id: id)) }
            params = object
        }

        guard let method = BridgeMethod(rawValue: methodName) else {
            return .failure(.methodNotFound(id: id))
        }
        return .success(BridgeRequest(id: id, method: method, params: params))
    }
}

/// A reply from the shell to the page.
public enum BridgeResponse: Equatable, Sendable {
    case success(id: String, result: JSONValue)
    case failure(id: String, code: ErrorCode, message: String)

    /// The reply as compact JSON text.
    ///
    /// Exactly one of `result` and `error` is present, always. Both is ambiguous
    /// about whether the work happened, and neither says nothing at all; the
    /// shape of this enum is what makes either impossible to emit.
    public var jsonText: String {
        switch self {
        case let .success(id, result):
            return JSONValue.object([
                "jsonrpc": .string("2.0"),
                "id": .string(id),
                "result": result,
            ]).jsonText
        case let .failure(id, code, message):
            return JSONValue.object([
                "jsonrpc": .string("2.0"),
                "id": .string(id),
                "error": .object([
                    "code": .number(Double(code.rawValue)),
                    "message": .string(message),
                ]),
            ]).jsonText
        }
    }

    /// The JavaScript the shell evaluates in the web view to deliver this reply.
    ///
    /// Built here so every reply takes the same path and no caller can invent a
    /// different one. The optional chain matters: a page that navigated away
    /// between the call and the reply has no global left, and a plain property
    /// access would throw inside the web view for no benefit.
    public var deliveryScript: String {
        "window.\(globalName)?.receive?.(\(jsonText))"
    }
}
