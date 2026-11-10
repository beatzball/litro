# @beatzball/litro-native

## 0.4.0

### Minor Changes

- 00cf549: Share and review now reach the native shell.

  - `share` resolves a relative `url` against the page before sending it to the
    shell, as a browser's own share does. The shell accepts only an absolute
    `http` or `https` link.
  - `share` no longer has a timeout in the native app. The person may write a
    message in a target such as Mail, which can take minutes, and a timeout
    reported a failure for a message that was then sent. The shell answers every
    other way the sheet can end, including a sheet that was never shown.
  - `requestReview` now uses the ten-second budget rather than the two-minute one.
    The shell answers it at once and never learns whether a prompt appeared, so a
    long budget only delayed noticing a dropped message.
  - The documentation now says what each promise means: `share` resolving means
    the sheet closed, not that anything was shared, a completed share is never
    reported as a failure, and `requestReview` resolving
    means the request was passed on, not that a prompt was shown.

## 0.3.0

### Minor Changes

- c3376f5: Talk to the Litro native shell. Inside the iOS shell, every capability the shell's build compiled in now goes to the shell over the bridge protocol, after a handshake, and every capability it left out takes its web behavior. A call made before the handshake answers waits for it. Every call has a timeout, so no promise is left pending.

  When `isNative` is true, a `secureStorage` write reaches the keychain or goes nowhere: the shell bridge never falls back to browser storage, even on a build without the keychain module. A page inside the shell whose handshake failed gets the web bridge and browser storage, with `isNative` false. So gate a token write on `isNative` and nothing else.

  `badging.set`, `badging.clear` and `notifications.schedule` now get the two-minute interactive timeout, because the first call can show a permission prompt that a person reads. A failed shell chunk no longer rejects calls on a plain web page.

  A rejection is now a `NativeBridgeError`, exported with `ERROR_CODES`, so an app can tell a declined permission (`isPermissionDenied`) or a timeout (`isTimeout`) from a fault.

### Patch Changes

- 9f39c55: `notifications.schedule` inside the native shell now sends the id and its own wait time with the call. When you pass no `id`, the page makes one, so a call that times out still tells you which reminder it may have scheduled: the error carries it as `err.data.id`, and you can cancel it or retry with it. The shell uses the wait time to schedule nothing after the page has stopped waiting.

  `secureStorage` rejects an empty key, or a key or value that is not well-formed text, with `INVALID_PARAMS`, on the web and in the shell alike. Before, the web accepted an empty key that the shell refused. Inside the shell the keychain is now one store per origin, as browser storage is.

## 0.2.0

### Minor Changes

- 6f82ac9: Add `@beatzball/litro-native/lit`, a controller that lets a component render a
  native-only control without reading a platform global while it renders.
  `NativeController` reads the platform when its host connects, holds the result,
  and asks for exactly one re-render when the answer arrives. Until then
  `platform` is null and `supports()` is false, which is the correct answer during
  a server render and on the first client frame, so a control that needs a
  capability is absent rather than appearing and then vanishing. A failed read is
  not cached: the next connect tries again.

  The subpath imports no Lit. Its host type is declared structurally, so a
  `LitElement` satisfies it with no cast and this package depends on no Lit major
  version.

## 0.1.1

### Patch Changes

- 1014094: Publish only what an app consumes. The tarball now carries `dist/`, the readme
  and the changelog, instead of also shipping the TypeScript sources, the two test
  files, the vitest config and a 15 kB TypeScript build cache. Installed size
  drops from 118 kB to 51 kB.

## 0.1.0

### Minor Changes

- Initial release: the web path. One interface over six native-leaning
  capabilities — haptics, local notifications, app badge, secure storage, share
  and review request — each with an honest web fallback and no dependencies.
  Server render safe: no platform global is read at module scope, so a page that
  imports this package still renders on the server. `platform()` reports what
  can actually run here, and `supports()` never claims a capability the web
  cannot deliver, so a caller can branch instead of guessing. The native host
  adapter lands in a later release; until then every call resolves against the
  web.
