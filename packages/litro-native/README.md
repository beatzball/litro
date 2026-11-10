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

The web path is complete. The page side of the native shell is here too: inside
the Litro iOS shell, each call goes to the shell for every capability that
shell's build compiled in, and takes its web behavior for the rest. The shell
itself, in `native/` in this repository, implements all six modules: haptics,
badging, notifications, secure storage, share and review.

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
check the platform first and keep the web build signed out.

When `isNative` is true, a `secureStorage` write reaches the keychain or goes
nowhere. It never falls back to browser storage, even on a shell build that
left the keychain module out: there it reads `null` and writes nothing. A page
inside the shell whose handshake failed gets the web bridge, which IS browser
storage, but there `isNative` is false. So gate on `isNative` and nothing else.

Inside the shell the keychain is one store per origin, as browser storage is.
An app whose shell allows several origins gets a separate store for each, and
a page on one never sees another's values.


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
  different thing, and does reject. So does a bad argument, the same way on
  every platform: an empty `secureStorage` key, or a key or value that is not
  well-formed text, rejects with `INVALID_PARAMS`.
- **`supports(name)` says whether the call does anything.** Use it to decide
  whether a feature belongs in the interface at all.

On the web the list is built from the APIs the browser actually exposes, so it
differs between two browsers, and between two visits to the same browser.

## When a call rejects

A rejection from inside the native shell is a `NativeBridgeError`. Its `code` is
one of `ERROR_CODES`, so you can tell a person saying no from a fault:

```ts
import { notifications, NativeBridgeError } from '@beatzball/litro-native';

try {
  await notifications.schedule({ title: 'Stand up', at: Date.now() + 60_000 });
} catch (err) {
  if (err instanceof NativeBridgeError && err.isPermissionDenied) {
    // The user declined. Do not ask again on every tap.
  }
}
```

`isTimeout` is true when the shell did not answer in time. Every call has a
budget, so no promise is ever left pending: ten seconds for most calls, two
minutes for the calls that can wait on a person -- the share sheet, and the
badging and notification calls, which can show the notification permission
prompt. `requestReview` is a ten-second call: the shell answers it at once, and
never learns whether a prompt appeared.

A timed-out `notifications.schedule` may still have scheduled the reminder,
right at the end of the wait. Its error carries the id in `err.data.id`. Cancel
it, or pass it as `id` when you retry, so the retry replaces the reminder
instead of adding a second one. Pass your own `id` from the start and you
always know it.

iOS keeps at most 64 pending notifications per app and silently drops the
rest, so past that a returned id may never fire.

## Server rendering

Nothing native is imported or touched while a module here is evaluated. The
bridge resolves on the first call, in the browser only, so a server render gets
the web answer and never throws. If you add to this package, keep it that way: a
browser global read at module scope breaks the server render, builds cleanly and
fails silently.

## Use it in a component

`@beatzball/litro-native/lit` exports a controller that reads the platform when
the host connects and asks for one re-render when the answer lands.

```ts
import { LitElement, html } from 'lit';
import { NativeController } from '@beatzball/litro-native/lit';
import { haptics } from '@beatzball/litro-native/haptics';

class TapButton extends LitElement {
  private native = new NativeController(this);

  render() {
    if (!this.native.supports('haptics')) return null;
    return html`<button @click=${() => haptics.impact('light')}>Tap</button>`;
  }
}
```

`supports()` is false until the answer arrives, not true-by-default. So a
control that needs a capability is absent during the server render and absent on
the first client frame, instead of appearing and then vanishing. `platform` is
null over the same window, and holds the full {@link PlatformInfo} after.

A read that fails is not cached. The next time the host connects, the controller
tries again, because one failed chunk load should not hide every native
capability for the life of the page.

**This subpath does not import Lit.** The host type is declared structurally, so
a `LitElement` satisfies it with no cast, and the package depends on no Lit major
version — or on Lit at all. Any component base class with `addController` and
`requestUpdate` works the same way.

## License

Apache-2.0
