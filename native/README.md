# The Litro native shell

One Xcode project. Every Litro app that wants a store presence is built from it,
and adding the next one is a folder of plain data rather than a new project.

This is Part B of `design/specs/2026-10-25-litro-native-ios-shell.md`. Part A is
`packages/litro-native`, the package an app actually imports. App code never
reaches the bridge directly: it imports `@beatzball/litro-native` and nothing
else, which is what lets this whole directory be rewritten without touching an
app.

## What is here

```
native/
  Package.swift              the testable halves, as a Swift package
  Sources/
    LitroBridge/             the wire protocol: envelope, dispatch, handshake
    LitroShellKit/           per-app configuration, origin policy, failure text
  App/                       UIKit and WebKit: the scene, the host, the transport,
                             the modules
  Apps/
    demo/app.json            the development app, as plain data
    qdoku/                   a store app: app.json and its icon
  Support/
    Shell.xcconfig           build settings shared by every app
    Info.plist               reads the per-app values as build settings
  scripts/
    select-app.sh            copies one app's folder into the build
    serve-test-page.sh       serves the bridge test page, --lan for a device
    check-release-config.sh  refuses a Release build of a dev configuration
    bridge-test-page.html    exercises every method against a running shell
  LitroShell.xcodeproj       hand-written, no generator needed
```

The split between `Sources/` and `App/` is the important line. Everything in
`Sources/` is pure Foundation, so `swift test` runs it on any Mac with no
simulator; everything that needs UIKit or WebKit is in `App/`, which only the
Xcode project compiles. That is what lets the dispatcher — every decision the
bridge makes — have real tests.

## Build and run

```sh
native/scripts/select-app.sh demo     # choose which app to build
open native/LitroShell.xcodeproj      # then press Run
```

Or from a terminal:

```sh
xcodebuild build \
  -project native/LitroShell.xcodeproj \
  -scheme LitroShell \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO
```

`select-app.sh` is not optional. It copies the chosen app's `app.json` into the
build and writes `Build/App.xcconfig`, which carries the product name and the
bundle identifier. A build with no app selected stops with
`could not find included file '../Build/App.xcconfig'`.

## Test

```sh
swift test --package-path native                 # the protocol and the config
node scripts/check-bridge-parity.mjs             # the Swift and TypeScript halves agree
node scripts/check-bridge-parity.mjs --self-test # and that check still fires
```

To exercise a running shell by hand, serve the test page on the port the demo
app's `startURL` names and launch the app:

```sh
native/scripts/serve-test-page.sh     # http://localhost:5173
```

It runs every unattended method on load and leaves the ones that need a person
on buttons: the permission prompt that badging and notifications share, a
notification firing, how a share sheet closes, the review prompt, and a
keychain value surviving a force-quit. Whether a share sheet appears needs
nobody, so the unattended run checks it last and leaves the sheet up.

Each line the page prints is also requested from the serving script as
`/__log?<line>`, so the terminal running `serve-test-page.sh` holds the whole
report even while the share sheet covers the page.

Two servers start, not one. The second, one port up, is the outside origin the
allowlist check navigates to. That check needs a destination that is reachable
and not allowed: an unreachable one fails its own navigation, leaves the page
in place, and reports success whether or not the allowlist runs. Never put the
second port in an `allowedOrigins` — being refused is its entire job.

On a real device, `localhost` is the device, so the default server is
unreachable from it. Pass `--lan` instead, which binds every interface and
prints the `startURL` and `allowedOrigins` to put in the app's `app.json`:

```sh
native/scripts/serve-test-page.sh 5173 --lan
```

The shell loads that plain `http` address because `Info.plist` sets
`NSAllowsLocalNetworking`, which covers private network addresses only. A device
and a Mac on different networks produce the shell's load failure screen naming
the address it could not reach, which is the fastest way to notice.

## Adding an app

Make a folder under `Apps/` with an `app.json`, and an icon if it will ship.
`Apps/qdoku/` is the real example:

```
Apps/qdoku/
  app.json
  Assets.xcassets/
    Contents.json
    AppIcon.appiconset/
      Contents.json      one 1024x1024 universal image
      icon-1024.png      square, opaque, no alpha channel
```

```json
{
  "name": "Qdoku",
  "bundleIdentifier": "com.qdoku.app",
  "startURL": "https://qdoku.com/",
  "allowedOrigins": ["https://qdoku.com"],
  "version": "1.0.0",
  "build": "1",
  "capabilities": ["haptics", "share", "review"]
}
```

`capabilities` is the whole mechanism. A module left out is never constructed,
so it is absent from the handshake, and the page degrades that one capability on
its own. Two apps can therefore want opposite things and share every line of
this code. Turn on only what the page calls: a capability the page never uses
does nothing a reviewer can see.

`allowedOrigins` is compared as whole origins — scheme, host and port — not as
string prefixes. A prefix match would let `https://app.example.com.attacker.test`
through an allowlist naming `https://app.example.com`.

`version` and `build` are per app and required. They become
`CFBundleShortVersionString` and `CFBundleVersion`: one to three whole numbers
each. TestFlight refuses an upload whose build number it has seen, so raise
`build` for every upload and commit it, which keeps the number that shipped in
the history. One build can override either from the command line, because a
command-line setting outranks the xcconfig:

```sh
xcodebuild archive ... MARKETING_VERSION=1.0.1 CURRENT_PROJECT_VERSION=8
```

The two values also ride inside the `app.json` that ships in the bundle, and
after an override they disagree with `Info.plist`. Nothing reads them there --
the shell's configuration has no field for either -- so `Info.plist` is the
one to trust.

`version` must be text and `build` text or a whole number. Any other JSON type
is refused, because `plutil` would otherwise convert it silently: `[99]` became
build 1.

The icon is the asset catalog's `AppIcon` set. `select-app.sh` checks it down
to the pixels -- exactly one image, named in `Contents.json`, present, 1024 by
1024, with no alpha channel -- and refuses the selection otherwise. Each of
those shapes once built and shipped with no usable icon. It then copies the
catalog into `Build/Resources/` and sets `ASSETCATALOG_COMPILER_APPICON_NAME`,
and Xcode compiles it from there: the built app carries `Assets.car` and
`CFBundleIconName = AppIcon`.

An app folder with no icon set still selects and builds for Debug. A Release
build of it is refused by the release guard, which can only see whether the set
is there; the pixels were checked at selection.

`select-app.sh` also refuses a bundle identifier App Store Connect would refuse,
an empty `name`, and a `startURL` whose origin is not in `allowedOrigins`.
Capability names are not checked there: that would be a third copy of the
protocol's list (NATIVE-008). A typo in one fails at launch, on the startup
failure screen.

Only `app.json` and `Assets.xcassets` reach the bundle. Anything else in the
folder -- a README, a source image -- is listed as `not shipped` and left out.

`select-app.sh --self-test` checks these rules against throwaway folders.

## Shipping an app to the App Store

Two things decide whether an app built from this shell is accepted, and neither
is about the shell's code.

**It must not ship a development configuration.** The demo app starts at
`http://localhost:5173/`, which is correct for development and useless anywhere
else: on a device, `localhost` is the device. An app submitted that way reaches
nothing, and the reviewer sees the load failure screen rather than the app.

A Release build refuses to proceed when the start URL is a loopback address, a
private network address, a `.local` name, or plain `http`. That check is a build
phase and runs before anything compiles:

```sh
native/scripts/check-release-config.sh --self-test   # the rules it enforces
```

**It must do something a browser cannot.** App Store guideline 4.2 rejects an
app that is only a web view, and the test a reviewer applies is whether the
whole app could be had by typing the URL into Safari. `capabilities` is the
answer to that, and it is why the bridge exists at all — but an empty list is
legal, and an app with an empty list is exactly the app that gets rejected.
A Release build warns about it rather than failing, because that call is a
judgment and not this project's to make.

Reported in the build as warnings and errors, so they appear in Xcode's issue
navigator rather than only in a log nobody opens.

### What is already handled

Recorded so it is not investigated twice:

- Running the web app's JavaScript inside `WKWebView` is explicitly permitted.
  The restriction on downloading executable code carves out code run by WebKit,
  as long as it does not change what the app says it does.
- The bridge is compiled into the binary. The shell downloads no code.
- One app, one binary. The rules for containers that host many third-party
  mini apps do not apply.
- The export-compliance question is answered in `Support/Info.plist`:
  `ITSAppUsesNonExemptEncryption` is false, because the shell uses only the
  system HTTPS stack. Without it App Store Connect asks on every upload.
- There is no third-party SDK, and no required-reason API: the shell uses no
  `UserDefaults`, no `FileManager`, no uptime or disk-space calls. So there is
  no privacy manifest obligation to satisfy.

## The rule that shapes the bridge

A capability call never fails because a platform feature is missing. If the
shell did not compile a module in, the call is answered with that capability's
documented empty behavior — the same answer the web adapter gives — and never
with an error. There is deliberately no error code meaning "not available here".

The page is supposed to gate these calls and never send them. The shell holds
the promise anyway, because the page may be an old deploy that cannot be fixed.

## The modules

All six modules are here: haptics, badging, notifications, secure storage,
share and review. The page side, `packages/litro-native/src/adapters/shell.ts`,
speaks the protocol to this shell. Phase 6, a second app and CI, is next.

Things about the modules that are easy to trip on:

- **The notification permission prompt is shown once.** Badging and
  notifications both need it, and whichever asks first decides for both. So
  both ask for the same set, `PermissionScope`: the badge alone for an app
  without notifications, and badge, alerts and sound for one with them.
- **Secure storage is per origin.** Each origin in `allowedOrigins` has its
  own keychain store, under the service
  `<bundleIdentifier>.secureStorage.<scheme>://<host>:<port>`, and never sees
  another's values. The origin is the one checked for the frame the message
  arrived on.
- **The page sends its own budget for a schedule call.** The shell schedules
  nothing once `budgetMs` has passed on its own monotonic clock, and keeps no
  copy of the page's timeouts. iOS keeps at most 64 pending notifications per
  app and drops the rest without an error.
- **`share` resolving does not mean anything was shared.** It means the sheet
  closed. A cancel answers the same as a share; a failed target, or a sheet
  that could not be shown, is an error. The page waits with no timeout,
  because a message written in a target such as Mail can take minutes, and
  the shell answers every other way the sheet can end.
- **Never judge the share sheet from the line after `present`.** An animated
  present is not on screen yet there, and the first version answered "could
  not be shown" to every share that way. `ShareSheetRun` in `Sources/` decides
  presentation, under `swift test`; `App/` only reports what UIKit says.
- **`requestReview` is answered at once and says nothing.** The system decides
  whether a prompt appears, never shows one in a TestFlight build, and does not
  tell the app. A development build shows it every time, which proves nothing.
- **A keychain value outlives the app.** iOS keeps keychain items when an app is
  deleted, so a reinstall can find a token from before. An app that must start
  signed out after a reinstall has to handle that itself.
