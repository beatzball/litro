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
