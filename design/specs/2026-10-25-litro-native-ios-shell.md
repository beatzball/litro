# Native app shell for Litro PWAs

Status: Draft

## The problem

A Litro app ships as a progressive web app. That is enough to install it to a home
screen, and not enough for anything else. Three gaps matter:

- **No store presence.** A web app cannot be listed, searched, rated or updated through
  an app store.
- **No real device capabilities.** Haptics are silent on iOS Safari. There is no local
  notification scheduler on the web, so a daily reminder cannot fire. There is no
  keychain, so a long-lived access token has nowhere safe to live.
- **Nowhere to put the fix.** Each Litro app that wants these things would otherwise grow
  its own native project, its own bridge and its own release pipeline.

Two apps want this now, and more will. They must not each solve it.

## What must be built

Two parts, and one rule that joins them.

**The rule: app code imports `@beatzball/litro-native` and nothing else.** No page, no
component and no store ever imports the native shell's own SDK. Every native detail is
absorbed by one adapter file. This is what makes the shell replaceable later.

### Part A — `@beatzball/litro-native`

A new package in this monorepo. Published, so apps outside it can use it.

**`types.ts` — the contract.** A `NativeBridge` interface that we own. It is written for
what Litro apps need, not copied from whatever the shell happens to expose.

```ts
export type HapticStyle = 'light' | 'medium' | 'heavy' | 'soft' | 'rigid';
export type HapticNotify = 'success' | 'warning' | 'error';
export type OS = 'ios' | 'android' | 'web';

export interface PlatformInfo {
  isNative: boolean;
  os: OS;
  appVersion?: string;
  osVersion?: string;
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
  share(p: SharePayload): Promise<void>;
  requestReview(): Promise<void>;
}
```

**`bridge.ts` — lazy resolution.** One bridge, resolved on the first call, in the browser
only, with the promise cached. It reads no native global at module scope. When `window`
is undefined it returns the web bridge without probing anything, so the server render
pass cannot throw. When the shell is absent, the dynamic import of its SDK fails and the
resolution falls through to the web bridge.

**`adapters/shell.ts` — the only native-aware file.** It implements `NativeBridge` over
the shell's SDK and flattens any namespace differences, so no caller has to know them.
Where the shell offers a narrower API than the interface, this file degrades inside
itself: for example, `notify` and `selection` map onto `impact` if that is all the shell
has.

**`adapters/web.ts` — honest degradation.** Haptics use the Vibration API, which Android
browsers honor and iOS Safari ignores. The badge uses the Web Badging API. Sharing uses
the platform share sheet when present. Local notifications are a documented no-op,
because the web has no true local scheduler, and pretending otherwise would hide a
missing feature behind a silent success.

**Facades.** One short module per capability, each a thin wrapper that resolves the
bridge and calls through. Calling code reads as `haptics.impact('light')` with no
branching and no await of a setup step.

**Lit integration.** A `ReactiveController` that reads the platform on `hostConnected`
and requests one update when the answer arrives. A component can then render a
native-only control without any module-scope native access.

**Package surface.** Subpath exports per capability, so an app that only wants haptics
does not pull the rest. `lit` is an optional peer dependency, so the facades work under
any web-component flavor and only the Lit subpath needs Lit. The shell SDK is an
**optional** dependency, so a web-only install and a web-only CI build do not need it
present at all.

### Part B — the shared native shell

One repository, one Xcode project, every app built from it.

The shell starts as a trimmed fork of an existing MIT-licensed open-source iOS web-view
shell. Keep the bridge core and six capability modules: haptics, local notifications,
badging, secure storage, share and app review. Cut the rest — biometrics, camera,
microphone, location, health data and print. Each one cut is a permission prompt not
asked for and a review question not raised.

Each app is one folder holding a configuration file and an asset catalog. A script copies
the chosen app's folder into the Xcode project's resources before the build. CI builds
every app from one matrix over that script. Adding the next Litro app is a new folder,
not a new project.

The per-app configuration names the app, its bundle identifier, its start URL, the
origins the web view may load, and which capability modules are on. Two apps therefore
differ only by data: one may want local notifications and no keychain, the other the
reverse.

## Options considered

**One native project per app.** Rejected. Two apps today means two bridges, two release
pipelines and two sets of the same bug. The cost grows with every app.

**App code calls the shell SDK directly.** Rejected. It is less code on day one and it
welds every app to one vendor. It also breaks the server render pass, because the SDK is
imported at module scope.

**A cross-platform app framework instead of a web view.** Rejected for now. It replaces
the web app rather than wrapping it, so the app stops being one codebase. The adapter
layer in Part A keeps this open as a later swap.

**Separate Xcode targets instead of copying a config in.** A real alternative, kept in
reserve. Targets put everything in the project and need no script. Copying a folder in
keeps the project file small and the per-app difference reviewable as plain data. Start
with the copy; move to targets if the project file starts to carry per-app logic anyway.

## Recommendation

Build both parts, in the order below, with Part A first and usable on the web before any
native work starts.

## Phases

1. **Package skeleton.** `@beatzball/litro-native` with the interface, the lazy bridge
   and the web adapter only. No shell. Every capability works or degrades on the web.
   This phase is shippable by itself: it already improves Android web haptics and the
   web badge.
2. **Lit integration.** The controller and the subpath exports. A playground page that
   renders a native-only control and proves it stays hidden on the web.
3. **Shell fork.** The trimmed project, one app's configuration, a local build that loads
   that app and answers a bridge call.
4. **Shell adapter.** `adapters/shell.ts`, wired to the real SDK, with the fallbacks for
   any capability the shell does not offer directly.
5. **Second app and CI.** A second configuration folder, the selection script, and the
   build matrix. The second app is the test that the shape generalizes.
6. **Store submission.** One app first, end to end, before the second is submitted.

## Risks

- **The shell is a small upstream project.** It is open source under a permissive
  license, with one principal maintainer. If it stops moving, the fork is ours to carry.
  The adapter layer exists for exactly this: a replacement bridge is one new file in
  Part A and no change in any app.
- **Module evaluation order.** If any native global is read at module scope, the server
  render pass breaks, and this class of bug builds clean and fails silently. Treat it the
  way rule BUILD-009 treats the hydration entry: assert the emitted behavior, not the
  intent.
- **Secure storage is not secure on the web.** The web adapter can only use browser
  storage, which is not a keychain. An app that persists a long-lived token must gate
  that write on the native platform, or keep its web build signed out. This must be
  documented at the call site, not only in the adapter.
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
- The package builds and its tests pass with the shell SDK **not installed**.
- Each capability has one test for the native path and one for the web fallback,
  including the documented no-op for local notifications.
- An app that imports only one capability does not pull the others into its client
  bundle.
- No file outside `adapters/shell.ts` references the shell SDK. A CI grep is enough.
- The selection script fails loudly on an unknown app name, and leaves no file from a
  previous app behind.
- Two apps built from the same commit differ only by name, identifier, icon and enabled
  modules.
