# Native app shell for Litro PWAs

Status: Accepted. Phases 1-4 built.

## The problem

A Litro app ships as a progressive web app. That is enough to install it to a home
screen, and nothing more. Three gaps matter:

- **No store presence.** A web app cannot be listed, searched, rated or updated through
  an app store.
- **No real device capabilities.** Haptics are silent on iOS Safari. There is no local
  notification scheduler on the web, so a daily reminder cannot fire. There is no
  keychain, so a long-lived access token has nowhere safe to live.
- **Nowhere to put the fix.** Each Litro app that wants these things would otherwise grow
  its own native project, its own bridge and its own release pipeline.

Two apps want this now, and more will. They must not each solve it.

## What we own

**We build and own the native shell outright.** There is no third-party native
dependency, at build time or at run time. No package to bump, no upstream to wait on, no
other project's roadmap in ours.

We may copy permissively licensed open-source code as a **starting point** for the
fiddliest part, the message channel between the web view and the native side. That is a
head start on a week of work, not a dependency: once copied it is our code, in our
repository, under our tests. The spec does not plan around anyone else's release
schedule, because after that first copy there is nothing to release but ours.

The same holds on the web side. The app-facing package is our own, so an app imports one
of our packages and nothing else.

## The bar

A shell is easy to make and easy to make badly. Owning one is only worth it if it is
clearly better than a thin web-view wrapper. Six things define that, and each is a
requirement, not an aspiration.

1. **One project, many apps.** A per-app folder of plain configuration and assets, and a
   build matrix over those folders. Adding the next Litro app is a new folder, not a new
   project, and never a second copy of the bridge.
2. **One call that works in three places.** `haptics.impact('light')` is a device buzz in
   the native app, a vibrate in an Android browser, and a silent no-op in iOS Safari,
   with no branch at the call site. Every capability has a defined web behavior, even
   when that behavior is to do nothing.
3. **Safe on the server.** Litro renders on the server. Nothing native may be imported or
   probed at module scope, so the server pass always resolves the web path. This is
   asserted, not assumed.
4. **A versioned bridge protocol with a handshake.** An installed native app updates on
   the store's schedule; the web app it loads updates on ours. The two will drift. The
   web side must ask the shell what it supports and degrade per capability when the
   answer is "not in this build", so a new web deploy can never brick an old installed
   app.
5. **A narrow, intentional capability set.** Six modules, chosen because our apps use
   them. No module that asks for a permission we do not need, because every extra
   permission is a prompt the user sees and a question the store asks.
6. **Both paths tested, and the boundary enforced.** Every capability has a native-path
   test and a web-fallback test. A check in CI fails the build if native details leak
   out of the one file allowed to hold them.

Item 4 is the one most easily skipped and the most expensive to add later.

## What must be built

Two parts, and one rule that joins them.

**The rule: app code imports `@beatzball/litro-native` and nothing else.** No page, no
component and no store reaches the bridge directly. Every native detail is absorbed by
one adapter file. This is what lets the native layer be rewritten without touching an
app.

### Part A — `@beatzball/litro-native`

A new package in this monorepo. Published, so apps outside it can use it.

**`types.ts` — the contract.** A `NativeBridge` interface written for what Litro apps
need.

```ts
export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
export type HapticNotify = 'success' | 'warning' | 'error';
export type OS = 'ios' | 'android' | 'web';

export type Capability =
  | 'haptics'
  | 'notifications'
  | 'badging'
  | 'secureStorage'
  | 'share'
  | 'review';

export interface PlatformInfo {
  isNative: boolean;
  /**
   * Which platform this is, as far as capabilities are concerned. `'ios'`
   * means the host; a page in iOS Safari reports `'web'`, because it has none
   * of the native capabilities. So this answers "what can run here", not
   * "which operating system is this".
   */
  os: OS;
  appVersion?: string;
  osVersion?: string;
  /** Bridge protocol version the shell speaks; absent on the web. */
  bridgeVersion?: number;
  /**
   * The capabilities that do something real here, from the handshake.
   *
   * This is not the same as "safe to call". Every capability is always safe to
   * call and never throws for a missing platform feature. A capability absent
   * from this list is one whose call does nothing, so an app reads this to
   * decide whether to offer a feature at all. On the web the list is built from
   * the browser APIs actually present, so local notifications and a review
   * request are never in it.
   */
  supports: readonly Capability[];
}

export interface LocalNotification {
  id?: string;
  title: string;
  body?: string;
  /** Epoch milliseconds. */
  at: number;
  repeat?: 'daily' | 'none';
}

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

export interface NativeBridge {
  readonly id: 'shell' | 'web';
  platform(): Promise<PlatformInfo>;
  haptics: {
    impact(style: HapticStyle): Promise<void>;
    notify(type: HapticNotify): Promise<void>;
    selection(): Promise<void>;
  };
  notifications: {
    schedule(n: LocalNotification): Promise<string>;
    cancel(id: string): Promise<void>;
  };
  badging: {
    set(count: number): Promise<void>;
    clear(): Promise<void>;
  };
  secureStorage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    remove(key: string): Promise<void>;
  };
  /**
   * Whether this payload can be shared here. On the contract rather than read
   * off the browser, so that `canShare` and `share` cannot answer for two
   * different places once a host exists.
   */
  canShare(p: SharePayload): Promise<boolean>;
  share(p: SharePayload): Promise<void>;
  requestReview(): Promise<void>;
}
```

**`bridge.ts` — lazy resolution and the handshake.** One bridge, resolved on the first
call, in the browser only, with the promise cached. It reads no native global at module
scope. When `window` is undefined it returns the web bridge without probing anything, so
the server render pass cannot throw. In the browser it asks the shell for its protocol
version and capability list; no shell, or a version we cannot speak, resolves the web
bridge instead.

**`adapters/shell.ts` — the only native-aware file.** It implements `NativeBridge` over
our bridge protocol and is the single place that knows how a message reaches the native
side. Where the handshake says a capability is missing from the installed build, this
file falls back to the web behavior for that one capability rather than failing the call.

**`adapters/web.ts` — honest degradation.** Haptics use the Vibration API, which Android
browsers honor and iOS Safari ignores. The badge uses the Web Badging API. Sharing uses
the platform share sheet when present. Local notifications are a documented no-op,
because the web has no true local scheduler, and pretending otherwise would hide a
missing feature behind a silent success.

**Facades.** One short module per capability, each a thin wrapper that resolves the
bridge and calls through. Calling code reads as `haptics.impact('light')` with no
branching and no awaiting of a setup step.

The shape of a facade follows what the capability is. A capability with several
actions is a namespace object: `haptics`, `notifications`, `badging`,
`secureStorage`. A capability that is a single action is a plain function:
`share`, `canShare`, `requestReview`. Both kinds are exported from the package
root and from the capability's own subpath. The rule is worth writing down because it is
otherwise guessed wrongly: a reader given only this spec expected a `review`
namespace, which does not exist.

**Lit integration.** A `ReactiveController` that reads the platform on `hostConnected`
and requests one update when the answer arrives. A component can then render a
native-only control without any module-scope native access.

Amended after building it: the controller declares the host type **structurally**
rather than importing `ReactiveControllerHost` from Lit, so the subpath imports
no Lit at all. A `LitElement` satisfies the type with no cast, and the package is
tied to no Lit major version. `supports()` must return false, not true, while the
answer is outstanding: a control that defaults to shown appears during the server
render and then vanishes on the first client frame. A failed read must not be
cached, for the same reason the bridge cache is not — one failed chunk load would
otherwise hide every native capability for the life of the page.

**Package surface.** Subpath exports per capability, so an app that only wants haptics
does not pull the rest. Amended after building it: `lit` is not a dependency of any
kind, not even an optional peer one. The Lit subpath needs only the two host members
it calls, so the facades work under any web-component flavor and nothing in the
package resolves Lit. **There is no third-party
runtime dependency**: the shell adapter speaks our own protocol, so a web-only install
and a web-only CI build pull in no native code at all.

### Part B — the native shell

One repository, one Xcode project, every app built from it.

The shell hosts a web view, implements the bridge protocol, and provides six capability
modules: haptics, local notifications, badging, secure storage, share and app review.
Nothing else. No biometrics, camera, microphone, location, health data or print. Each one
left out is a permission not requested and a review question not raised.

Each app is one folder holding a configuration file and an asset catalog. A script copies
the chosen app's folder into the Xcode project's resources before the build. CI builds
every app from one matrix over that script.

The per-app configuration names the app, its bundle identifier, its start URL, the
origins the web view may load, and which capability modules are on. Two apps therefore
differ only by data: one may want local notifications and no keychain, the other the
reverse.

The shell declares its bridge protocol version in the handshake. When a capability is
compiled out for an app, the handshake omits it, and the web side degrades that one
capability on its own.

## Options considered

**One native project per app.** Rejected. Two apps today means two bridges, two release
pipelines and two copies of the same bug. The cost grows with every app.

**App code talks to the bridge directly.** Rejected. It is less code on day one and welds
every app to one native design. It also breaks the server render pass, because the
transport would be reached at module scope.

**Depend on a third-party native shell as a package.** Rejected, and this is the change
from the first draft of this spec. A shell is a few thousand lines that we must
understand anyway to debug a store rejection, and taking it as a dependency buys a
version to bump in exchange for someone else's priorities. Copying a starting point and
owning the result costs little more and removes the dependency.

**A cross-platform app framework instead of a web view.** Rejected for now. It replaces
the web app rather than wrapping it, so the app stops being one codebase. The adapter
layer in Part A keeps this open as a later swap.

**Separate Xcode targets instead of copying a config in.** A real alternative, kept in
reserve. Targets put everything in the project and need no script. Copying a folder keeps
the project file small and the per-app difference reviewable as plain data. Start with the
copy; move to targets if the project file starts to carry per-app logic anyway.

## Recommendation

Build both parts, in the order below, with Part A first and useful on the web before any
native work starts.

## Phases

1. **Package skeleton.** `@beatzball/litro-native` with the interface, the lazy bridge
   and the web adapter only. Every capability works or degrades on the web. This phase
   ships by itself: it already improves Android web haptics and the web badge.
2. **Lit integration.** The controller and the subpath exports. A playground page that
   renders a native-only control and proves it stays hidden on the web.
3. **Bridge protocol.** The message format, the version number and the handshake, written
   down as a document and as tests, before either side implements it.
4. **Shell, first app.** The web-view host, the handshake and two capability modules.
   A local build that loads one app and answers a bridge call.
5. **Remaining modules and the shell adapter.** The other four modules, and
   `adapters/shell.ts` wired to the real protocol with the per-capability degradation.
6. **Second app and CI.** A second configuration folder, the selection script, and the
   build matrix. The second app is the test that the shape generalizes.
7. **Store submission.** One app first, end to end, before the second is submitted.

## Phase 4, as built

The host, the handshake and two modules — haptics and badging — are in `native/`.
Seven decisions were made while building it that the plan above did not settle.

**The shell lives in this repository, not its own.** The first instinct was a
separate repo: this one is public, and each real app's name, identifier and icons
belong to that app rather than to the framework. The argument that beat it is
that the protocol exists twice on purpose — once in TypeScript, once in Swift,
because an installed app cannot import TypeScript — and a parity check across two
repositories is the kind that gets skipped. One repository means one commit
changes both halves and `scripts/check-bridge-parity.mjs` can fail CI when they
disagree. Phase 4 has one throwaway demo app and no real app assets to protect,
so the cost of the choice is deferred rather than paid now. If a real app's
assets ever need to be private, move only its `Apps/` folder out.

**No project generator.** `LitroShell.xcodeproj` is hand-written and committed.
A generator is a build-time dependency, which the bar above forbids, and a
checkout that cannot be built without first installing a tool is not a checkout.
The project stays small because every source folder is a synchronized folder
group and every per-app value comes from a generated xcconfig.

**The dispatcher is async and main-actor bound.** Setting a badge needs the
notification permission, and asking for it is a prompt. A synchronous signature
could only be honored by answering before the system had, which would report
success for a badge that never appeared. Phase 5's four remaining modules are all
async too, so this is the shape they fit into rather than a rewrite they force.

**A malformed request that carries an id is answered.** Validating the envelope
before reading the id meant a bad message could not be replied to at all, and the
page waited out its whole timeout for a reply the shell had already decided not
to send. The id is now read first. Only a message with no usable id goes
unanswered. Found by a test, which is the point of writing them before the device.

**The shell holds the capability promise too.** The risk list below asked for
Phase 4's shell to be reviewed for returning an error on a capability it omitted.
It does not: an absent module is answered with that capability's documented empty
behavior, the same value the web adapter gives, and its params are not validated
either. The page is still supposed to gate the call, but the page may be an old
deploy nobody can fix. Pinned by `AbsentCapabilityTests`.

**Origins are compared whole, never as prefixes.** Scheme, host and port
together, with an explicit default port treated as the default. A prefix match
would let `https://app.example.test.attacker.invalid` through an allowlist naming
`https://app.example.test`.

**App Transport Security allows local networking only.** A Litro app in
development runs on a plain-http dev server, which iOS blocks by default. The
Info.plist sets `NSAllowsLocalNetworking`, not `NSAllowsArbitraryLoads`: the
narrow key permits http to localhost and the local network and changes nothing
for a public host.

### What was verified, and how

- 72 Swift tests over the protocol, the dispatcher and the origin policy, run by
  `swift test` with no simulator.
- The app built for the simulator, launched, and answered every unattended method
  against a real `WKWebView`: the handshake with the build's own version numbers,
  all three haptics, both parameter rejections, an unknown method, and `share`
  with its module absent returning `result null` rather than an error.
- `scripts/check-bridge-parity.mjs`, whose self-test breaks the Swift source nine
  ways and expects a complaint each time.
- On hardware: Xcode 26.6 installs and launches on a device running iOS 27.2, so
  the one-major-version gap between the tool and the phone is not a blocker.

### Not yet done

The badge permission prompt and the share sheet both need a person, so they sit
on buttons in `native/scripts/bridge-test-page.html` rather than in the automatic
run. Haptics cannot be felt in a simulator at all. Both are physical-device
checks, and neither is covered by anything above.

## Phase 5, as built

Phase 5 landed in three pull requests: the page-side shell adapter first, then
notifications with secure storage, then share with review.

### The shell adapter

`packages/litro-native/src/adapters/shell.ts` implements `NativeBridge` over the
protocol, and `bridge.ts` now resolves it in a browser. The protocol work left
id generation, queueing and concurrency to this file on purpose. Seven decisions
were made here that nothing above settled.

**Ids are a random prefix per connection, then a counter.** Module state is
not enough: a full document load re-evaluates the module, so a counter restarts
at 1, and the shell evaluates each reply in whatever document is current when
it finishes. The next document of the same app has the same global and its own
receiver, so a late reply for document A's call would settle document B's call
with the same number. `allowedOrigins` is a list, so B can be a different origin
from A. The prefix is drawn from `crypto.getRandomValues` inside `connectShell`,
never at module scope. It also keeps two bundled copies of this package from
sharing ids. It does not stop the second copy from replacing the first one's
receiver; that is still open.

This was a review finding against the first version of this pull request,
which used one module-level counter and claimed it was unique for the page
session. It was unique only for one evaluation of the module.

**Calls are concurrent, with no cap.** Replies are matched by id and may arrive
in any order. Every call already has its own timeout, which is what bounds the
pending set. A cap would add a failure mode the contract has no way to express.

**A call made before the handshake resolves waits, without a queue.** Every
facade awaits `getBridge()`, and that promise settles only after the handshake
answers or times out. No call is ever sent to a shell whose capabilities are not
yet known, and there is no buffer to get wrong.

**A missing capability takes its web behavior, except secure storage.** Where
the handshake leaves a capability out, the call never reaches the wire and the
web adapter answers it, so a share sheet the web view itself offers still works.
Secure storage is the exception. When the shell bridge is in use, `isNative`
is true, and checking `isNative` is the documented way to keep a token out of
browser storage. A build without the keychain module that quietly wrote to
browser storage would pass that check and leak the token. So there `get`
answers `null`, the writes do nothing, and `supports` leaves `secureStorage`
out. This does not cover a page inside the shell whose handshake failed: that
page gets the web bridge, browser storage and `isNative` false. Gating on
`isNative`, and nothing else, is safe in both cases.

**An unknown capability name is dropped, not fatal.** `isHandshakeResult`
rejects a name it does not know, which is right for the format. But adding a
capability does not bump the version, so a newer shell may report one, and
rejecting the whole handshake would send every older page to the web bridge.
The adapter filters the names it knows before validating.

**Params cross as plain JSON.** Each call's params take a round trip through
JSON before they are posted. A `Date` becomes its string and an `undefined`
field is dropped. Without this, one non-JSON value nested in the params loses
the whole message on the native side, id included, and the call waits out its
timeout (issue 279, item 1, is the same bug seen from the shell).

**A malformed reply that names a call fails it now.** The page-side twin of
NATIVE-003: the id is read before the reply is judged, so a bad reply rejects its
call at once instead of at the timeout. Only a reply with no id the page is
waiting on is dropped.

Two smaller choices. Both adapters load in parallel in a browser, so a plain web
page pays no extra round trip to learn there is no shell; on the server the
shell adapter is never loaded. If the shell chunk fails to load, the waiting
calls get the web bridge and that answer is not cached: `bridge.ts` may not look
for a shell itself, so it cannot tell a plain page from a shell, and the next
call retries.

**Calls that can raise a permission prompt get the interactive budget.**
`badging.set`, `badging.clear` and `notifications.schedule` joined `share` and
`requestReview` in `INTERACTIVE_METHODS`. A review found that a ten-second budget
failed a call while the person was still reading the prompt, and the shell then
did the work anyway. The Swift side has no timeouts, so nothing mirrors this. And a rejection carries a `NativeBridgeError`,
exported with `ERROR_CODES`, so an app can tell a declined permission from a
fault without matching a message.

**The boundary check exists now.** `scripts/check-native-boundary.mjs` fails CI
when a tracked code file outside the shell adapter, the protocol, its tests or
`native/` names `messageHandlers`, the handler or global name, or the constants
that hold them. It reads the names from `protocol.ts`, and it refuses to pass if
the adapter itself stops matching its patterns, since a check that matches
nothing passes everything.

### Notifications and secure storage

The second pull request. Every decision is in `Sources/`, with tests;
`App/Capabilities/NotificationsModule.swift` and `SecureStorageModule.swift`
only call the system. These are the decisions nothing above settled. A review
of the first version changed several of them; each says what it replaced.

**One permission set for both prompting modules.** iOS shows the notification
permission prompt once, and the first request's options are what the user
grants. So `PermissionScope.forCapabilities` decides the set once, from the
app's configuration, and both modules ask for it: the badge alone without
notifications, badge, alerts and sound with them.

**A grant counts if the notification shows anywhere.** Banners, the Lock
Screen or Notification Center: any one is enough. A person who turned banners
off still sees the reminder, and refusing it would call that a declined
permission. A grant that shows nothing at all, such as a badge-only grant from
an earlier build, is asked about once more, which shows no second prompt, and
the settings are read again. It is refused only if they still show nothing,
and the message does not say the person declined. A stored denial is answered
at once. Not checked on a device: what `alertSetting` reads with only banners
off, and whether iOS widens a badge-only grant without a prompt. Reading all
three settings again after asking is right either way.

**The page sends its budget, and the page makes the id.** The first version
copied the page's two-minute interactive timeout into Swift and held the two
equal with the parity check. That checked the number but not which methods it
applies to: a page release that moved `notifications.schedule` to a shorter
budget would leave every installed shell waiting the old two minutes, with the
check still passing. Now the page sends `budgetMs` with each schedule call, the
same number its own timer uses, and the shell refuses to schedule once that
much has passed. It measures on a monotonic clock, so a change to the device
time cannot stretch or shrink the wait, and it keeps a margin of two seconds,
or a quarter of a short budget, for the reply's trip back. It is a relative
duration, not a deadline, so the shell never compares the page's clock with its
own. A page with no `budgetMs` gets two minutes, which is what pages before the
field waited. An older shell ignores the field.

The page also makes the id before sending when the caller gave none. A call
that ends in `TIMEOUT` may still have scheduled the reminder, and its
rejection carries the id in `data.id`, so the caller can cancel it, or retry
with it and replace rather than duplicate. The budget is still needed: a
cancel sent while the prompt is open runs first, finds nothing, and the
schedule lands after it.

The order in the dispatcher is: validate, then the permission, then check the
page still waits, then schedule. Validation is against the moment the call
arrived, so a bad call is rejected before anyone sees a prompt.

**A one-off is an interval, never a calendar moment.** The first version used a
calendar trigger, which keeps whole seconds only: a reminder under a second away
named a moment already past, which the system accepts and never fires, while
the page was told it existed. A calendar trigger with no time zone also moves
when the person changes time zone. `at` is an instant, and an interval from
now names an instant, so both go away. The interval is at least one second, so
a one-off whose time passed while the person read the prompt fires at once:
they asked for it and allowed it. A one-off already in the past when the call
arrived is a page bug and is rejected.

**A daily reminder repeats at the time of day of `at`,** in the device's
current calendar and time zone, starting at the next such time, which is today
if it has not passed. A date in the past is the ordinary way to say "every day
at 9", and a date in the future does not delay the start: iOS has no start date
for a repeating trigger.

**At most 64 are pending.** iOS keeps the 64 soonest pending notifications per
app and drops the rest without an error, so a 65th schedule returns an id for a
reminder that may never fire. Not checked on a device.

**Secure storage is per origin.** The first version kept one store per app, so
with two origins in `allowedOrigins` each page read, overwrote and removed the
other's secrets, while the web fallback was already per origin. Now the item's
service is `<bundleIdentifier>.secureStorage.<scheme>://<host>:<port>`. The
origin is the one the transport checked for the frame the message arrived on,
normalized once (lowercased scheme and host, the real port when WebKit reports
0), and carried to the dispatcher. It is never the web view's current URL and
never anything the page sends. Nothing had shipped, so no item needed moving.

**The keychain item is this device only, after first unlock, never
synchronized.** A generic password. Readable once the phone has been unlocked
after a restart, so a background task can read a token; never restored onto
another device from a backup, and never put in iCloud Keychain. An update sets
the accessibility too, so an item from an older build is moved to it. A write
is update-then-add, never delete-then-add, so a failed write leaves the old
value in place, as the contract promises.

**A keychain failure says whether to retry.** A status that refuses the input
(`errSecParam`, `errSecDataTooLarge`) is `INVALID_PARAMS`, because the same call
fails the same way every time. Any other status is `INTERNAL_ERROR`. An item that
is there but cannot be read is `INTERNAL_ERROR` too, never `null`, because an app
reads `null` as signed out. A message carries the status code and never the key
or the value, because the reply is evaluated in the page, where script can log
it. The keychain's real size limits have not been measured on a device.

**A bad key fails the same way everywhere.** An empty key, or a key or value
with a lone surrogate, is refused with `INVALID_PARAMS` by the page adapter on
every path: on the web, in a shell with the keychain, and in one without it. The
shell cannot see a lone surrogate, because the bridge turns it into U+FFFD
first, and two different keys would land on one item.

The page-side rule is unchanged and still true: when `isNative` is true, a
`secureStorage` write reaches this keychain or goes nowhere. Gate on `isNative`
and nothing else.

A keychain item outlives the app: iOS keeps it when the app is deleted, so a
reinstall can find a token from before. That is recorded in `native/README.md`
rather than worked around, because the usual workaround is a first-launch flag
in `UserDefaults`, which is a required-reason API with a privacy manifest
obligation.

### Share and review

The last two modules, which close Phase 5. Every decision is in
`native/Sources/LitroBridge/ShareAndReview.swift` and `Dispatcher.swift`, with
tests in `ShareAndReviewTests.swift`. `App/Capabilities/ShareModule.swift` and
`ReviewModule.swift` only present a sheet and ask the system.

**A share sheet closes four ways, and the page is told three things.**

| how it closed | the page is told |
|---|---|
| a target was picked and finished | `null` |
| closed without sharing, from the sheet or from the target's own screen | `null` |
| the picked target reported an error | `INTERNAL_ERROR` |
| the sheet never appeared | `INTERNAL_ERROR` |

`null` means "the sheet is closed". It never means "something was shared".
`share()` is `Promise<void>` and was already documented to resolve when the
person dismisses the sheet, and the web adapter swallows the browser's
`AbortError` the same way. So a cancel is not an error, and it is not reported
as a share either: neither answer claims one. The shell does tell completed from
dismissed internally (`ShareOutcome`), so if the contract ever wants to expose
it, only the mapping in `Dispatcher.swift` changes. Exposing it is a change to
the published API, and is left to the owner.

A target that failed, and a sheet that never appeared, are errors because the
person either tried and it did not work, or saw nothing. Both are retryable.

**A sheet that never appeared is answered at once.** UIKit refuses to present
while another presentation is in progress, logs it, and never calls the
completion handler, so the page would wait out its whole two-minute budget for a
sheet nobody saw. Two guards:

- The dispatcher refuses a second `share` while one sheet is open, before it
  reaches UIKit.
- After `present`, a sheet that has no presenting controller was refused, and
  is answered `notPresented` there and then (`ShareOutcome.afterPresenting`).

The sheet is presented from the topmost presented controller, so a popover the
page opened itself does not block it.

**The completion handler answers once.** It is not promised to run once, and a
continuation resumed twice stops the app. `SingleAnswer` keeps the first answer
and drops the rest.

**On an iPad the sheet is anchored to the middle of the view, with no arrow.** A
popover with no anchor stops the app. The page sends no element position, so
there is nothing better to point at. The shell is iPhone only today
(`TARGETED_DEVICE_FAMILY = 1`), so this is for the day it is not.

**What may be shared.** `title`, `text` and `url`, each an optional string, an
empty string counted as absent. At least one is required, or the call is
`INVALID_PARAMS`. `url` must be an absolute `http` or `https` URL: a share sheet
hands it to whatever the person picks, and nothing a Litro page shares is a
`javascript:` or `file:` URL. The title is offered as the subject line to
targets that have one, and is shared as the text only when there is neither text
nor a link, so the sheet is never empty.

A browser resolves a relative `url` against the page; the shell has no page to
resolve against. So the page adapter resolves it before sending
(`withAbsoluteURL` in `adapters/shell.ts`), and a URL it cannot resolve is sent
unchanged for the shell to refuse. This is the one page-side change share
needed.

**`canShare` is a question and never an error.** It answers `true` exactly when
`share` would accept the payload, and `false` for anything `share` would refuse,
including a wrong type, as the browser's own check does. It opens nothing.

**`requestReview` answers `null`, at once, and that means "passed on".** The
system rate-limits the prompt, shows it in a development build, never shows it
in a TestFlight build, and never tells the app whether it appeared. A page told
anything more would be told a guess. The shell asks the foreground window scene
with `AppStore.requestReview(in:)`; with no foreground scene there is nowhere to
show it, and the answer is the same `null`. Params are ignored.

**`requestReview` left the interactive budget.** It was in
`INTERACTIVE_METHODS` because it opens system UI. But the system call returns at
once without waiting for the prompt, so the shell's reply never waits on a
person. A two-minute budget there would only hide a dropped message for two
minutes, which is the same reason `canShare` is not interactive. `share` stays:
its reply waits for the person to close the sheet. The shell keeps no copy of
either list (NATIVE-008).

**An absent module answers with the documented empty behavior**, unchanged:
`canShare` is `false`, `share` and `requestReview` are `null`, and params are
not validated. `AbsentCapabilityTests` holds it.

**Every rejection carries the call's id** (NATIVE-003). A share whose target
failed, whose sheet never appeared, or whose params were bad, is answered on its
own id.

**Not verified yet, and needing a person on a device:** what iOS 27 reports when
a person picks a target and cancels inside it, whether the completion handler
ever fires twice on iOS 27, and the iPad anchor. The bridge test page has
buttons for all of them: `share text`, `share link`, `share twice` and
`request review`.

## Risks

- **All iOS upkeep is ours.** There is no upstream to absorb a yearly OS release, a new
  Xcode, a changed store policy or a deprecated API. This is the price of owning the
  shell and it is accepted, not mitigated. Keep the shell small enough that one person
  can read it in an afternoon, because that is what makes the upkeep affordable.
- **Version skew between a web deploy and an installed app.** The two update on different
  schedules and will drift. The handshake in the bar above is the mitigation. Without it,
  a web deploy can break every installed copy and the only fix is a store release.
- **Module evaluation order.** If any native global is read at module scope, the server
  render pass breaks, and this class of bug builds clean and fails silently. Treat it the
  way rule BUILD-009 treats the hydration entry: assert the emitted behavior, not the
  intent.
- **Secure storage is not secure on the web.** The web adapter can only use browser
  storage, which is not a keychain. An app that persists a long-lived token must gate
  that write on the native platform, or keep its web build signed out. This must be
  documented at the call site, not only in the adapter.
- **Copied code carries its license.** Any file seeded from open-source code keeps its
  notice and is recorded where we record third-party notices. Check this once, at the
  copy, not at submission.
- **Push notifications are out of scope here.** A web push subscription does not reach a
  native push service without a relay. That is a separate design.
- **Store review of a social app.** An app that shows content from other people must
  surface report, block and mute controls. This is a common rejection cause and belongs
  in the app, not the shell.
- **Game services are not in the shell.** Leaderboards should be served by the app's own
  backend, so the web build and the native build show the same thing.

## What must be checked

- A server render of a page that imports the package completes, and the bridge it
  resolves is the web one.
- The package has no third-party runtime dependency, and a web-only build pulls in no
  native code.
- Each capability has one test for the native path and one for the web fallback,
  including the documented no-op for local notifications.
- A shell that reports an older protocol version, or omits a capability from its
  handshake, degrades that one capability and leaves the rest working.
- An app that imports only one capability imports only that facade, and the
  others are deferred rather than dropped. The bridge is one module carrying
  every capability's web implementation, loaded lazily on the first call. Splitting
  it per capability would be worth doing only if that module grows large; say so
  in the README rather than claiming a split that is not there.
- No file outside `adapters/shell.ts` reaches the bridge transport. A check in CI is
  enough.
- The selection script fails loudly on an unknown app name, and leaves no file from a
  previous app behind.
- Two apps built from the same commit differ only by name, identifier, icon and enabled
  modules.
- Every file seeded from open-source code carries its license notice.
