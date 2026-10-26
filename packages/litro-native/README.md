# `@beatzball/litro-native`

Native device capabilities for a web app, with an honest fallback for each one.

```ts
import { haptics } from '@beatzball/litro-native/haptics';

haptics.impact('light');
```

That one call is a device buzz inside the native app, a vibrate in an Android
browser, and nothing at all in iOS Safari, which has no Vibration API. Your code
does not branch, and no call throws because a platform feature is missing.

A call can still reject when the platform itself refuses one: sharing outside a
user gesture, or a storage write with no room left. Those are real failures and
you get to see them.

Zero dependencies. Safe to import in a page that renders on the server.

## Status

Phase 1: the web path. The interface, the bridge and the web fallbacks are here
and useful on their own. The native host is not built yet, so every capability
currently takes its web behavior.

**Not published yet.** This package is in the repository and not on the
registry. The release pipeline authenticates per package, and that cannot be set
up for a package that does not exist on the registry, so the first publish is a
one-time manual step that has to happen before the automated one can.

## Install

```sh
pnpm add @beatzball/litro-native
```

## The capabilities

| Import | What it does | On the web |
|---|---|---|
| `haptics` | `impact`, `notify`, `selection` | Vibration API; silent in iOS Safari |
| `badging` | sets or clears the app icon badge | Web Badging API, once installed |
| `share`, `canShare` | opens the platform share sheet | Web Share API |
| `secureStorage` | `get`, `set`, `remove` | browser storage — **not** a keychain |
| `notifications` | schedules a local reminder | nothing; see below |
| `requestReview` | asks for a store review | nothing |
| `platform`, `supports` | what we are running on | reports the browser |

Each one also has its own subpath, so an app that wants haptics alone imports
only that facade. The bridge behind them is one small module, loaded lazily on
the first call, and it carries all six web implementations — so importing one
capability defers the others rather than dropping them.

### Namespace or function

The shape follows what the capability is, and it is worth knowing so you do not
reach for the wrong name:

- **Several actions, so a namespace:** `haptics`, `notifications`, `badging`,
  `secureStorage`.
- **One action, so a function:** `share`, `canShare`, `requestReview`.

There is no `review` object. `requestReview()` is the whole surface.

## Two things to read before you rely on it

**Local notifications need the native host.** A browser cannot run a timer for a
page that is closed, so `schedule` does nothing and returns an empty id. Do not
offer a reminder feature and hope. Ask first:

```ts
import { supports } from '@beatzball/litro-native/platform';

if (await supports('notifications')) {
  // Safe to show the reminder setting.
}
```

**Secure storage is not secure on the web.** The fallback is browser storage.
Any script on the origin can read it and it shows up in developer tools. For
anything that would matter if it leaked, such as a long-lived access token,
check the platform first and keep the web build signed out:

```ts
import { platform, secureStorage } from '@beatzball/litro-native';

if ((await platform()).isNative) {
  await secureStorage.set('token', token);
}
```

`set` rejects if the write itself fails, which is almost always a full quota.
Catch it if losing the value matters:

```ts
try {
  await secureStorage.set('draft', text);
} catch {
  // The old value is still there. Tell the user nothing was saved.
}
```

## `supports` versus "safe to call"

These are different questions, and the difference matters.

- **Every capability is always safe to call.** No call throws because of a
  missing platform feature. A platform that refuses the operation itself is a
  different thing, and does reject.
- **`supports(name)` says whether the call does anything.** Use it to decide
  whether a feature belongs in the interface at all.

On the web the list is built from the APIs the browser actually exposes, so it
differs between two browsers, and between two visits to the same browser.

## Server rendering

Nothing native is imported or touched while a module here is evaluated. The
bridge resolves on the first call, in the browser only, so a server render gets
the web answer and never throws. If you add to this package, keep it that way: a
browser global read at module scope breaks the server render, builds cleanly and
fails silently.

## License

Apache-2.0
