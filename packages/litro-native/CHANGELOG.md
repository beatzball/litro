# @beatzball/litro-native

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
