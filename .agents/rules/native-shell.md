# Native shell rules

Traps already hit while building the iOS shell in `native/` and the bridge
protocol in `packages/litro-native/src/protocol.ts`. Read this before you touch
either side of the bridge.

The two sides are mirrors of one source of truth, and `scripts/check-bridge-parity.mjs`
is what keeps them honest. Run it after any protocol change.

## NATIVE-001 — `Method` collides with the Objective-C runtime

**Trap.** Naming the protocol's method enum `Method` compiles for a long time
and then fails with `'Method' is ambiguous for type lookup in this context`, far
from the declaration. Foundation re-exports the Objective-C runtime's own
`Method` typedef, and the clash only surfaces where the name is used as a type
in a generic position, such as `[Method: JSONValue]`.

**Rule.** The enum is `BridgeMethod`. Do not rename it to the obvious name, and
do not reach for a qualified `LitroBridge.Method` instead — that hides the clash
for the next reader rather than removing it.

**Check.** `swift build --package-path native`.

## NATIVE-002 — one app target is one module

**Trap.** Adding `Sources/LitroBridge` to the Xcode app target as a synchronized
folder group and then writing `import LitroBridge` in `App/` fails with
`unable to resolve module dependency`. Everything an app target compiles is one
module; there is nothing to import.

**Rule.** The app target links the local Swift package's products
(`XCLocalSwiftPackageReference` plus `XCSwiftPackageProductDependency`) and
compiles only `App/` and the generated `Build/Resources`. A source folder is in
exactly one of the two places, never both, or the link step reports duplicate
symbols.

**Check.** `xcodebuild build -project native/LitroShell.xcodeproj -scheme LitroShell -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO`.

## NATIVE-003 — read the id before judging the message

**Trap.** Validating `jsonrpc` before reading `id` means a malformed envelope
cannot be answered, because by the time it is rejected there is no id to address
the reply to. The page then waits out its entire timeout for a reply that the
shell already decided not to send. Found by a test, not on a device.

**Rule.** `BridgeRequest.parse` reads the id first. Every rejection carries the
id when the message had a usable one. Only a message with no id at all goes
unanswered, and the transport logs that.

**Check.** `swift test --package-path native --filter MalformedMessageTests`.

## NATIVE-004 — an absent capability is answered, never refused

**Trap.** The natural thing for a shell asked for a module it did not compile in
is to return an error. That breaks the contract in `types.ts`, which promises a
capability call never fails for a missing platform feature, and the protocol has
no error code for it on purpose.

**Rule.** A method whose capability is absent is answered with that capability's
documented empty behavior — the same value the web adapter returns. Params are
not validated for it either: rejecting a bad style on a build without haptics
makes the absence visible as a failure, which is the thing being prevented.

The page is supposed to gate the call and never send it. The shell holds the
promise anyway, because the page may be an old deploy nobody can fix.

**Check.** `swift test --package-path native --filter AbsentCapabilityTests`.

## NATIVE-005 — nothing builds until an app is selected

**Trap.** The Xcode project carries no per-app values at all. Without
`native/scripts/select-app.sh`, `Build/App.xcconfig` does not exist and the
build fails with `could not find included file '../Build/App.xcconfig'`.

**Rule.** That is deliberate, and the include in `Support/Shell.xcconfig` is the
hard `#include` rather than the optional `#include?` for exactly this reason. A
shell that quietly built with an empty bundle identifier would look like it
worked. Run the script; do not add a default.

**Check.** `native/scripts/select-app.sh demo`.

## NATIVE-006 — JavaScriptCore boxes `true` and `1` the same way

**Trap.** A value crossing from the web view arrives as `Any`. Both `true` and
`1` are `NSNumber`, so a `case let n as NSNumber` branch placed before the bool
branch turns `true` into the number 1 silently.

**Rule.** `JSONValue(any:)` checks `CFGetTypeID(n) == CFBooleanGetTypeID()`
before the numeric branch. Keep that order.

**Check.** `swift test --package-path native --filter JSONValueTests`.

## NATIVE-007 — two legal JSON characters are illegal JavaScript

**Trap.** A reply is delivered by evaluating JavaScript in the web view. U+2028
and U+2029 are legal inside a JSON string and illegal inside a JavaScript line,
so a reply containing one is valid JSON that fails to evaluate — and the page
sees a timeout rather than an error.

**Rule.** `JSONValue.quote` escapes both. Every reply goes through
`BridgeResponse.deliveryScript`, so no caller can build a delivery another way.

**Check.** `swift test --package-path native --filter testEscapesTheLineSeparators`.

## NATIVE-008 — the two halves of the protocol drift silently

**Trap.** The protocol is written in TypeScript and mirrored in Swift because an
installed app cannot import TypeScript. A method renamed on one side builds
clean, passes both suites, and fails only on a device — one that updates on the
App Store's schedule rather than ours.

**Rule.** `scripts/check-bridge-parity.mjs` compares the version, the transport
names, the method list in order, the capability list and every error code. It
runs in CI, and it has a `--self-test` that breaks the Swift source nine ways to
prove the comparison still fires. Change the protocol in both files in one
commit.

**Check.** `node scripts/check-bridge-parity.mjs && node scripts/check-bridge-parity.mjs --self-test`.

## NATIVE-009 — CI's Swift is older than yours, and it is the stricter one

**Trap.** Swift 6.2 and later infer main-actor isolation in places 6.1 does not.
Code that compiles on a current Mac can fail on the runner with
`main actor-isolated property ... can not be mutated from a nonisolated context`,
and nothing local reproduces it. On 2026-10-31 the local toolchain was Swift
6.3.3 and `macos-15` had Xcode 16.4 with Swift 6.1.2.

Two shapes caused it, both in tests:

- `override func setUp()`. `XCTestCase.setUp()` is declared nonisolated, so it
  cannot touch a main-actor property however the class is annotated.
- A stored property with an initializer, such as
  `private let dispatcher = BridgeDispatcher(...)`. That initializer runs in a
  nonisolated context under 6.1, and `BridgeDispatcher` is main-actor bound.

**Rule.** Build main-actor fixtures inside the test body, or in a `private func`
on the `@MainActor` class that each test calls. Never in `setUp`, never in a
stored property initializer. This also removes shared mutable state between
tests, so it is not a workaround.

**Check.** `swift test --package-path native` passing locally is not evidence
for this one. The native CI job is. Do not pin the runner to a newer Xcode to
make the error go away: the older compiler is the one telling the truth about
what the code requires.

## NATIVE-010 — a delegate method that "nearly matches" is never called

**Trap.** `WKNavigationDelegate`'s completion-handler method carries a
`@MainActor` attribute on its closure. Writing the signature by hand without it
produces a method that merely resembles the requirement. It compiles. It emits
one warning — `nearly matches optional requirement` — and WebKit never calls it.

The shell shipped that way for a day. The origin allowlist, the thing that stops
page content turning the app into a general-purpose browser with the app's
permissions, did not run at all. Every test passed, because every test loaded an
allowed origin: a block that never runs is indistinguishable from a block that
permits.

**Rule.** Implement the **async** form of an optional delegate method, not the
completion-handler form. There is no closure attribute to get wrong:

```swift
func webView(_ webView: WKWebView,
             decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy
```

Treat `nearly matches optional requirement` as an error wherever it appears. It
is never cosmetic.

**Check.** Two, and the first alone is not enough.

- The build emits no `nearly matches` warning. Read the whole build output; a
  grep narrowed to a guessed pattern is how this one survived.
- `native/scripts/bridge-test-page.html` attempts a navigation to an outside
  origin in its unattended run and reports `refused the outside origin`. A
  policy that stops being wired makes that line say `DID NOT BLOCK`, or takes
  the page away entirely.
