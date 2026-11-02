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
    LitroShellKit/           per-app configuration and the origin policy
  App/                       UIKit and WebKit: the host, the transport, the modules
  Apps/
    demo/app.json            one app, as plain data
  Support/
    Shell.xcconfig           build settings shared by every app
    Info.plist               reads the per-app values as build settings
  scripts/
    select-app.sh            copies one app's folder into the build
    serve-test-page.sh       serves the bridge test page
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

It runs every unattended method on load and leaves the two that need a person —
the badge permission prompt and the share sheet — on buttons.

## Adding an app

Make a folder under `Apps/` with an `app.json`:

```json
{
  "name": "Litro Demo",
  "bundleIdentifier": "dev.litro.shell.demo",
  "startURL": "https://app.example.com/",
  "allowedOrigins": ["https://app.example.com"],
  "capabilities": ["haptics", "badging"]
}
```

`capabilities` is the whole mechanism. A module left out is never constructed,
so it is absent from the handshake, and the page degrades that one capability on
its own. Two apps can therefore want opposite things and share every line of
this code.

`allowedOrigins` is compared as whole origins — scheme, host and port — not as
string prefixes. A prefix match would let `https://app.example.com.attacker.test`
through an allowlist naming `https://app.example.com`.

## The rule that shapes the bridge

A capability call never fails because a platform feature is missing. If the
shell did not compile a module in, the call is answered with that capability's
documented empty behavior — the same answer the web adapter gives — and never
with an error. There is deliberately no error code meaning "not available here".

The page is supposed to gate these calls and never send them. The shell holds
the promise anyway, because the page may be an old deploy that cannot be fixed.

## What is not here yet

Phase 4 built the host, the handshake, and two modules: haptics and badging. The
other four — notifications, secure storage, share and review — arrive in Phase 5
with `adapters/shell.ts` on the page side. Until then they are not compiled in,
so the handshake omits them and every call for one is answered empty.
