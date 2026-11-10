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
id when the message had a usable one: a non-empty string. Only a message without
one goes unanswered, and the transport logs that.

The same rule holds one layer up. `JSONValue(any:)` returns nil for the whole
body when any value inside it is not JSON -- a `Date` arrives as `NSDate` -- and
the transport used to drop the message right there, id and all. The transport
goes through `IncomingMessage(body:)`, which reads the id from the raw body when
the conversion fails, and the dispatcher answers `INVALID_REQUEST`. Never
convert the body and then look for the id.

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
runs in CI, and it has a `--self-test` that changes the sources in every way it
lists when it runs: to prove the comparison still fires, that a harmless reformatting loses
nothing, and that a shape the readers cannot consume stops the check. Change the protocol in both files in one
commit.

Mirror names, not policy. A number the shell needs from the page -- how long
the page waits for `notifications.schedule`, say -- is sent in that call's
params, never copied into Swift. A copy has to match both the number and which
methods it applies to, the parity check can only see the number, and an
installed app cannot be updated when the page changes either.

Error codes are compared in both directions, against both sets of
**declarations**. The reverse check once asked only whether the checker's own
name table had a partner for each Swift code, so deleting `PERMISSION_DENIED`
from `protocol.ts` still passed. The self-test now deletes a code on each side.

The readers are strict: every item in a declaration list must parse, or the
script throws. A reader that matched only the shapes it knew lost a declaration
silently -- the last TypeScript error code with no trailing comma, a second
code on the same line, a Swift case with a trailing comment -- and the loss
removed it from both the extracted set and the comparison, so the check
printed OK. Do not loosen a reader back to "match what you can".

The script compares constants only. It cannot see a difference in how the two
validators behave, such as one side accepting `"params": null`. That class is
held by the spec and by a test on each side over the same input.

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
  policy that stops being wired takes the page away to the second server's
  `ORIGIN POLICY FAILED` page. See NATIVE-016: the destination has to be
  reachable, and until it was, this check could not fail.

## NATIVE-011 — do not store an SDK type that is not `Sendable`

**Trap.** `BadgingModule` held a `UNUserNotificationCenter` as a property of a
`@MainActor` class. On SDKs where that type is not yet audited for concurrency,
handing it to its own nonisolated async methods fails with
`sending 'self.center' risks causing data races`. The current SDK marks the type
`Sendable`, so the mistake is invisible on a current Mac and fails on CI.

The same file had already failed once for a neighboring reason: awaiting
`notificationSettings()` returns `UNNotificationSettings`, also not `Sendable`
on those SDKs.

**Rule.** Reach for the shared instance inside a `nonisolated` helper rather than
storing it, so it stays a local that never crosses an isolation boundary. Where
a callback hands back a non-Sendable object, extract the one value you need
inside the callback and send that.

Do not reach for `@preconcurrency import` to silence this class of error. It
downgrades every Sendable complaint from that module, including the next real
one.

**Check.** The native CI job. A local build uses the newest SDK and will not
reproduce it.

## NATIVE-012 — a canceled navigation is not a load failure

**Trap.** The shell now shows a screen when a navigation fails, because a bare
`WKWebView` whose load fails shows an empty white view and reports the reason to
nobody. The obvious wiring is wrong: WebKit reports the origin allowlist's own
refusal through the same delegate method as a real failure. Returning `.cancel`
from `decidePolicyFor` produces `NSURLErrorCancelled` in `NSURLErrorDomain`, and
on some versions `WebKitErrorDomain` 102, `frame load interrupted`.

Shown, that covers the page the reader was already on with a failure screen
every time the allowlist does its job. The allowlist working then looks exactly
like the shell broken. The same code arrives when a second navigation replaces
one still in flight, which is also not a fault.

**Rule.** Build the screen's text through `LoadFailure(error:url:)` in
`LitroShellKit`, which returns nil for both of those. Never read an error in the
delegate and show it directly.

Two neighboring rules the same screen depends on:

- Take the screen down on `didFinish`, not on the retry tap. Removing it when
  tapped uncovers the empty web view and flashes the container's background
  before the new page paints. The retry's feedback is the button's own state.
- Retry by loading the configured start URL, not `webView.reload()`. A
  provisional navigation that failed left no page behind to reload.

**Check.** `swift test --filter LoadFailure`. The visibility tests assert nil
for both canceled spellings, and that a different `WebKitErrorDomain` code is
still shown, so the rule cannot be satisfied by hiding every WebKit error.

## NATIVE-013 — the window belongs to a scene, not to the app delegate

**Trap.** `AppDelegate` built a `UIWindow` from `UIScreen.main.bounds` and held
it. That is the shape every older UIKit example uses, it compiles, and it runs.
On an iOS 27 device UIKit logs a fault against it:

```
`UIScene` life cycle is now required when building with the latest SDKs.
Apps that don't adopt will fail to launch.
```

Built against the SDK that enforces it, the app is terminated on launch. Not
rejected at review -- terminated, before review happens.

**Rule.** The app delegate owns nothing UI-shaped. A `UIWindowSceneDelegate`
builds the window with `UIWindow(windowScene:)`, and `Support/Info.plist`
carries a `UIApplicationSceneManifest` naming that class.

Name the class `$(PRODUCT_MODULE_NAME).SceneDelegate` in the manifest, never
with a literal module prefix. The module name follows `PRODUCT_NAME`, which
`select-app.sh` writes per app, so a literal resolves for one app and silently
fails to load for the next. A scene delegate that fails to load is a black
window with no error anywhere.

**Check.** Launch on a simulator and confirm the page renders: a window that
appears at all proves the manifest named a class that loaded. Confirming the
fault itself is gone needs an iOS 27 device, because no simulator runtime
through iOS 26.5 emits that line -- a quiet simulator log proves nothing here.
## NATIVE-014 — a development start URL must not survive a Release build

**Trap.** The demo app starts at `http://localhost:5173/`, which is correct: a
Litro dev server runs there. On a device `localhost` is the device, so an app
submitted with that start URL reaches nothing and the reviewer sees the load
failure screen instead of the app. Nothing between "works on my Mac" and
"uploaded" would have caught it, because every step before the upload is a
Debug build where the address is right.

**Rule.** `native/scripts/check-release-config.sh` runs as the app target's
first build phase. Any build that is not Debug fails on a loopback or private
address, a `.local` name, or plain `http`, and warns when `capabilities` is
empty. Only Debug is skipped, because a future `Staging` or `AppStore`
configuration is exactly the kind of build that must not carry a dev address.

**Every URL in the configuration, not only `startURL`.** A reviewer found the
guard read the start URL alone, so a Release build passed with
`http://localhost:5173` and a LAN address still in `allowedOrigins`. That is
the entry that matters for safety rather than for a rejection: `Info.plist`
keeps `NSAllowsLocalNetworking` in Release, so plain http to a LAN address is
still permitted in the shipped app, and whatever host holds that address on the
user's current network would be served the bridge.

**Normalize before matching.** Hosts are case-insensitive and DNS treats a
trailing dot as the same name, and the authority ends at the first of `?`, `#`
or `/`. Every one of these passed the guard until a reviewer wrote them down:

    https://LOCALHOST/              case
    https://my-mac.local./          trailing dot
    https://localhost?x=1           the query stayed inside the host
    https://localhost?u=a@example.com   the "@" strip then moved the host
    https://2130706433/             an IPv4 address as one integer
    https://[::ffff:127.0.0.1]/     IPv4-mapped IPv6
    https://[FD00::1]/              case, in an IPv6 literal

Errors and warnings are split on purpose: an unreachable start URL is certainly
broken, and an app with no capabilities is only *likely* to be rejected under
guideline 4.2. A guard that fails a build over a judgment gets disabled.

Three things the wiring needs, each of which cost a build to learn:

- The script must be in the phase's `inputPaths`, not just invoked by it.
  `ENABLE_USER_SCRIPT_SANDBOXING` is on, so an undeclared read is denied and the
  phase fails with `deny(1) file-read-data` naming the script itself.
- Give the phase an `outputPaths` stamp rather than `alwaysOutOfDate = 1`.
  Without an output, Xcode prints a note about the phase running every time, on
  every build, which teaches everyone to ignore notes.
- `plutil -extract` on an array prints its **element count**, not its elements.
  Counting the lines of that output gives 1 whether the count is 0 or 20. That
  is exactly the bug the capability warning shipped with for one build.
- `plutil` reports a missing key on **stdout on some machines and stderr on
  others** -- stderr on a current Mac, stdout on the CI runner. Silencing one
  channel let the error text through as the value on the other, and the failure
  appeared only in CI. Check the shape of what came back rather than trusting
  the exit code and one redirect.

**Check.** `native/scripts/check-release-config.sh --self-test`, and the two CI
steps in the native job: one runs that self-test, the other attempts a Release
build of the demo app and requires it to fail with the guard's own words. The
second is what proves the guard is wired to the project rather than merely
present in the repository.

## NATIVE-015 — a message handler is not scoped to a frame

**Trap.** `markerScript` is injected with `forMainFrameOnly: true`, which reads
like the bridge is main-frame only. It is not.
`WKUserContentController.add(_:name:)` installs
`window.webkit.messageHandlers.<name>` in **every** frame, whatever its origin,
and `WKScriptMessage` was dispatched without looking at `frameInfo`.

The navigation allowlist does not cover this, and that is the part that is easy
to get wrong: it authorizes a frame's **request URL**, not the **security
origin** the frame ends up running as. An `<iframe sandbox="allow-scripts">` or
an `<iframe srcdoc>` loads from an allowed path and then runs with an **opaque
origin**, and it could call the bridge.

Proved with a headless `WKWebView` registering the handler the same way:

```
RECEIVED body={...} isMainFrame=false origin=://
SUBFRAME REACHED THE BRIDGE
```

**Rule.** `BridgeTransport.accepts(_:)` gates every message on two independent
things: `frameInfo.isMainFrame`, and `AppConfiguration.allowsBridgeOrigin` over
`frameInfo.securityOrigin`. An opaque origin has an empty scheme and host and is
refused by name rather than left to fail a comparison by luck.

Two gates, not one, on purpose. The origin test is what still holds if the
navigation allowlist is ever wired wrong -- which has happened here once
already, silently (NATIVE-010).

**Check.** `swift test` covers `allowsBridgeOrigin`, including the opaque
origin, an empty allowlist, a suffix host and a default port. The frame test
needs WebKit: re-run the probe above and confirm `REFUSED ...: subframe`.

## NATIVE-016 — a negative test needs a reachable destination

**Trap.** The origin-policy check navigated to `https://blocked.example.invalid/`
and reported success when the page had not moved after 1.5 seconds. `.invalid`
never resolves, so the navigation failed on its own and the page never moved --
**whether or not any allowlist existed**.

Run against a `WKWebView` with `navigationDelegate = nil`, which is the total
absence of the thing under test, it printed:

```
RESULT origin policy -> refused the outside origin
```

So the one check written for NATIVE-010's silent trap could not detect it, and
every report that cited that line as evidence was citing nothing.

**Rule.** A test that asserts something was *refused* must use a destination
that would otherwise *succeed*. `serve-test-page.sh` runs a second server one
port up for exactly this: same host, reachable, different origin. Never add that
port to an `allowedOrigins`; being refused is its whole purpose.

When the destination cannot be reached, the check reports `SKIPPED` and says
where it looked. A check that could not run is not a check that passed.

**Check.** Three probes, all with the real page:

- allowlist wired -> stays, `origin policy -> refused the outside origin`
- no navigation delegate at all -> lands on the second server's
  `ORIGIN POLICY FAILED` page
- nothing on the second port -> `origin policy -> SKIPPED, nothing answers at ...`

The middle one is the test of the test. If it ever passes again, the check has
gone back to proving nothing.

## NATIVE-017 — the local-networking keys are Debug only

**Trap.** `Info.plist` carried `NSAllowsLocalNetworking` in every configuration,
with a comment saying it costs a shipped app nothing because it only relaxes
App Transport Security for private addresses. The reasoning was sound and the
conclusion was wrong: Apple lists that key among the ATS keys that **require a
written justification at App Store review**. A shipped Litro app starts at a
public `https` URL and never touches the local network, so the key buys a
reviewer question on every submission from every app built on this shell, in
exchange for nothing the app uses.

`NSLocalNetworkUsageDescription` was missing entirely, which is the other half.
Without it, iOS 18 and later may never show the local network prompt, and the
connection fails with no explanation anywhere -- a black screen for thirty
seconds and nothing in any log the developer will think to read.

**Rule.** Both keys live behind `#if LITRO_DEBUG_NETWORKING` in
`Support/Info.plist`. `Shell.xcconfig` sets `INFOPLIST_PREPROCESS = YES` and
defines that symbol with `INFOPLIST_PREPROCESSOR_DEFINITIONS[config=Debug]`, so
Debug gets both and nothing else does.

The preprocessor, not a build phase that rewrites the built plist. A phase
would have to declare a file the build already produces as its own output,
which risks "multiple commands produce" and a fight with
`ENABLE_USER_SCRIPT_SANDBOXING`. `INFOPLIST_PREPROCESS` is a first-class build
setting with neither problem.

The plist runs through the C preprocessor, so `//` inside it is a hazard. The
`DOCTYPE` line contains `-//Apple//DTD` and a URL, and survives -- confirmed by
`plutil -lint` on the built Release plist, not assumed. Check that again before
adding any line with `//` in it.

An apostrophe is the same hazard. "app's" in a comment there produced
`warning: missing terminating ' character`, because the preprocessor reads a
lone `'` as an unclosed character literal. Write comments in that file without
apostrophes.

**Check.** The CI step `Keep the local-networking keys out of a release build`
asserts **both** directions: Debug carries both keys, Release carries neither.
One without the other would still pass if the flag stopped working in a single
direction.

## NATIVE-018 — a start URL its own allowlist refuses is a white screen

**Trap.** Nothing checked that `startURL` is covered by `allowedOrigins`. When
it is not, the origin policy cancels the first navigation, a cancel is
deliberately not a load failure (NATIVE-012), and the app opens to an empty
white view that explains nothing. A retry tap on the same path left the failure
screen stuck on "Trying again".

The plausible way in is a typo: an entry with no scheme, such as
`"app.example.com"`, has no `URL.host`, so `Origin(string:)` drops it without a
word and the list is shorter than it reads.

**Rule.** `AppConfiguration.load` calls `validate()`, which throws
`unusableOrigin` for an entry that is not a scheme and a host, and
`startURLNotAllowed` for a start URL the list does not cover. The error reaches
the startup failure screen, which prints it. Two messages, because the two
faults send the reader to different lines. The check is in `load`, not in the
decoder, so tests can still build a configuration with an empty list.

**Check.** `swift test --package-path native --filter AppConfigurationValidationTests`.

## NATIVE-019 — an icon is checked at selection; the guard may only stat it

**Trap.** There was no asset catalog anywhere, so the first real app would have
reached App Store Connect with no icon and been refused at upload, after every
build and check had passed.

The first fix was not enough, and the way it fell short is the trap. The
release guard and `select-app.sh` both decided "has an icon" from the presence
of `AppIcon.appiconset/Contents.json`. A review built two shapes for a device
in Release and both succeeded: a `Contents.json` naming an image that is not
there (one warning, then no `Assets.car` and no `CFBundleIconName` -- and, in
derived data shared with another app, that app's compiled icon in this one's
bundle), and a 1024 image with an alpha channel, which App Store Connect
refuses. The self-test's own icon fixture was `{}`, which is exactly the shape
that passed everything.

**Rule.** The pixels are checked in `select-app.sh`, which runs outside the build
sandbox: exactly one image, named in `Contents.json`, present, 1024 by 1024,
`hasAlpha: no`, each read with `plutil` and `sips`. A failure refuses the
selection, so the message arrives before any archive. Each rejecting shape has
a self-test fixture that is a real PNG, and the fixture checks the reason as
well as the refusal, because two checks can refuse the same file.

The release guard keeps only an existence check (`[ -f ]`, a stat, which the
sandbox allows), so a Release build of an app with no icon set is still
refused. It cannot read the image: an undeclared read is denied by
`ENABLE_USER_SCRIPT_SANDBOXING`, and declaring the set as an input fails the
demo, which has none, with "build input file cannot be found".

The catalog lives in the app's folder. `select-app.sh` copies it into
`Build/Resources/`, the synchronized group the app target already compiles, and
writes `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`. Xcode runs `actool` on it
from there; that was measured: the built app holds `Assets.car` and its
Info.plist names `CFBundleIconName = AppIcon`.

**Check.** `native/scripts/select-app.sh --self-test` and
`native/scripts/check-release-config.sh --self-test`, and the CI step that
builds qdoku for Release and asserts `CFBundleIconName` and `Assets.car`.
