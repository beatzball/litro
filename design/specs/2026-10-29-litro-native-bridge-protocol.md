# Litro native bridge protocol, version 1

Status: Accepted

Phase 3 of the native app shell (`design/specs/2026-10-25-litro-native-ios-shell.md`).
This is the wire format between a Litro page and the native shell that hosts it.

It is written before either side exists, on purpose. A format decided while one side is
being built describes that side's convenience, and the second implementer inherits it as
a fact.

## Where the rules live

Every rule here is pinned by a test in `packages/litro-native/src/__tests__/protocol.test.ts`,
against the constants and validators in `packages/litro-native/src/protocol.ts`. That
module is the single source of truth; this document explains it.

A rule stated here with no test is a rule neither implementer has to honor. When this
document changes, change the tests first.

## Transport

The page and the shell exchange JSON objects. Neither holds a reference to the other.

**Page to shell.** The shell registers a script message handler named `litroNative`. The
page posts one request object to it.

**Shell to page.** The shell evaluates JavaScript in the web view that hands one response
object to the global `__litroNative`.

**Detection.** The shell injects `__litroNative` at document start, before any page script
runs, carrying only `{ version }`. The page reads it synchronously to learn that a shell
is present at all. It carries no capability data: what the shell can do is the handshake's
answer, and holding it in two places lets the two drift apart across an app update.

Both names are exported from `protocol.ts` rather than written into a transport, so the
Swift side has one place to copy from.

## Envelope

JSON-RPC 2.0 shaped. The repo already speaks that dialect in the MCP Apps bridge, so the
conventions carry over and the error semantics are specified rather than invented.

```jsonc
// request
{ "jsonrpc": "2.0", "id": "7", "method": "haptics.impact", "params": { "style": "light" } }

// success
{ "jsonrpc": "2.0", "id": "7", "result": null }

// failure
{ "jsonrpc": "2.0", "id": "7", "error": { "code": -32000, "message": "denied" } }
```

Three deliberate narrowings:

- **Every request carries an `id`.** The page never sends a notification. A call whose
  failure is invisible is a call that is hard to debug on a device.
- **`params` is an object or absent, never positional.** A positional argument list is a
  silent breakage when an argument is inserted.
- **No batching.** One message, one call. A batch cannot be validated by the same
  predicate, and nothing here needs it.

A reply carries **exactly one** of `result` or `error`. Both is ambiguous about whether
the work happened; neither says nothing at all. Both are rejected.

## Version

An integer, because `PlatformInfo.bridgeVersion` is a number and comparing versions must
never involve parsing.

Version 1 is defined by this document.

**The version is bumped only when the wire format changes in a way an older peer cannot
read.** Adding a capability does not bump it: the handshake already reports which
capabilities exist, so a shell that gains one is readable by an unchanged page.

**A shell newer than the page is accepted.** An installed app updates on the user's
schedule and may run ahead of the deployed page; rejecting it would break working apps the
moment a page deploys. The page sends only the methods it knows, and a newer shell must
still answer them — that is what bumping the version is for.

**A shell below `MIN_SUPPORTED_SHELL_VERSION` is treated as no shell at all.** The page
falls back to the web bridge. A degraded app beats a broken one, and a months-old build in
the wild cannot be updated on demand.

## Handshake

The page sends `handshake` once, before any other call. The shell answers:

```jsonc
{
  "version": 1,
  "os": "ios",
  "appVersion": "1.2.0",   // optional
  "osVersion": "19.0",     // optional
  "capabilities": ["haptics", "badging"]
}
```

`capabilities` is what this build compiled in. A shell that compiled in nothing is legal
and reports `[]`.

The handshake's answer populates `PlatformInfo`, including its `supports` list.

## Capabilities are gated by the page, not reported as errors

This is the rule that shapes everything else.

The contract in `types.ts` says a capability call **never throws for a missing platform
feature**. Every capability is always safe to call; a capability that is absent simply does
nothing, and an app reads `supports` to decide whether to offer a feature at all.

So: **when the handshake omits a capability, the page answers the call itself** with that
capability's documented empty behavior, and sends nothing over the wire.

There is deliberately **no error code for "this capability is not available here"**. A
protocol that can report one invites a shell that returns it, and a page that surfaces it
as a rejection — which breaks the contract's promise. The absence is enforced by a test.

`isCapabilityAvailable(method, capabilities)` is the page's check. `capabilityFor(method)`
is the mapping; `share` and `canShare` are gated together, since one answers for the other.

## Methods

One flat namespace, matching the `NativeBridge` surface. Flat rather than nested, because
a method name is compared as a string on the Swift side and a switch over flat constants
is the hardest thing to get subtly wrong.

| method | capability | params | result |
|---|---|---|---|
| `handshake` | none | — | `HandshakeResult` |
| `haptics.impact` | `haptics` | `{ style }` | `null` |
| `haptics.notify` | `haptics` | `{ type }` | `null` |
| `haptics.selection` | `haptics` | — | `null` |
| `notifications.schedule` | `notifications` | `LocalNotification` | the id, a string |
| `notifications.cancel` | `notifications` | `{ id }` | `null` |
| `badging.set` | `badging` | `{ count }` | `null` |
| `badging.clear` | `badging` | — | `null` |
| `secureStorage.get` | `secureStorage` | `{ key }` | the value, or `null` |
| `secureStorage.set` | `secureStorage` | `{ key, value }` | `null` |
| `secureStorage.remove` | `secureStorage` | `{ key }` | `null` |
| `canShare` | `share` | `SharePayload` | a boolean |
| `share` | `share` | `SharePayload` | `null` |
| `requestReview` | `review` | — | `null` |

`notifications.schedule` returning an empty string means nothing was scheduled. Callers
that store the id treat an empty one as "no reminder set".

## Errors

The three reserved JSON-RPC codes keep their specified meanings. Every code of our own
sits in `-32000` to `-32099`, the range the specification sets aside for implementations.

| code | name | meaning |
|---|---|---|
| `-32700` | `PARSE_ERROR` | the shell could not parse the message as JSON |
| `-32600` | `INVALID_REQUEST` | valid JSON, not a valid request for this version |
| `-32601` | `METHOD_NOT_FOUND` | a method this shell does not know |
| `-32602` | `INVALID_PARAMS` | method known, `params` do not satisfy it |
| `-32603` | `INTERNAL_ERROR` | the shell tried and failed; the caller may retry |
| `-32000` | `PERMISSION_DENIED` | the user declined a prompt. Not a fault, not retryable |
| `-32001` | `TIMEOUT` | raised by the **page**, never sent on the wire |
| `-32002` | `VERSION_UNSUPPORTED` | the shell speaks a version the page cannot read |

## Timeouts

A dropped message must never leave a promise pending for the life of the page.

| budget | value | applies to |
|---|---|---|
| handshake | 2s | `handshake` |
| default | 10s | every call that does not wait on a person |
| interactive | 120s | `share`, `requestReview` |

The handshake is shortest because startup queues behind it, and a shell that cannot answer
that fast is treated as absent. The default is shorter than the MCP Apps bridge's 30
seconds because every call here is a local device operation with no network work behind it.
`share` and `requestReview` open something a person reads, so a long wait there is not a
failure. `canShare` is **not** interactive: it opens nothing, and a user-sized budget would
hide a dropped message for two minutes.

## What this phase does not decide

- **Id generation.** The transport owns it. Ids need only be unique within one page
  session, so `protocol.ts` takes an id rather than making one, which keeps it pure and
  lets a test assert on an exact message.
- **Queueing and concurrency.** How many calls may be outstanding, and what happens to
  calls made before the handshake resolves, belong with the transport in Phase 5.
- **Origin checks.** Which origins the web view may load is per-app shell configuration,
  described in the parent spec, not a property of the message format.

## Risks

- **A protocol with no implementations is a guess.** It is validated against the contract
  and a fake shell, not against WKWebView. Phase 4 builds the shell and one capability
  against it; expect version 1 to need a correction, and prefer correcting it then over
  shipping version 2 later.
- **The capability-gating rule lives on the page.** A shell could still return an error for
  a capability it omitted. Nothing on the wire prevents that, so Phase 4's shell must be
  reviewed for it directly.

## What must be checked

- Every rule above has a test in `protocol.test.ts`, and the suite was mutation-checked:
  allowing a reply with both `result` and `error`, inverting the handshake timeout, moving
  a custom code out of the reserved range, adding a capability error code, and rejecting a
  newer shell were each introduced on purpose and each failed the suite.
- `protocol.ts` touches no global, so importing it during a server render is safe.
