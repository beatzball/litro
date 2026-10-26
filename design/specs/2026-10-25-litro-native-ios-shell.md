# Native app shell for Litro PWAs

Status: Draft

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
