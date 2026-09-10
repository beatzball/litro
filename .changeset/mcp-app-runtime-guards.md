---
'@beatzball/litro-agent': minor
---

`runtime` and `apply` are parsed at build time, and a replaced fill step says so

Both are browser source as a STRING, so nothing type-checks them, nothing
lints them, and a typo is invisible until the document is inside a host —
where a `SyntaxError` kills the whole script tag and the view never fills, with
no error anyone sees and a build that reported success.

`buildMcpAppDocument` now compiles both with `node:vm` and refuses source that
does not parse. It is a PARSE, NOT AN EXECUTION: no author code runs at build
time. `apply` is wrapped in parentheses first, since it is inlined as the
right-hand side of an assignment and has to be an expression.

It cannot tell you the code is correct, and it cannot tell you the code is
safe. `runtime` and `apply` are trusted author code by design.

Separately, a `runtime` that assigns `window.litroMcpApply` now prints a
warning. That assignment REPLACES the bridge's default fill step — the one
that refuses `innerHTML`, `srcdoc` and `on*` in a tool result — and because
`runtime` is inlined before the bridge, it does so without the app ever
declaring an `apply`. A custom `apply` makes the same choice but declares
itself by existing; this route did not. A warning rather than an error,
because replacing the fill step is a legitimate thing to want.
