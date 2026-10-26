---
"@beatzball/litro-native": minor
---

Add `@beatzball/litro-native/lit`, a controller that lets a component render a
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
