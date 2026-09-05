---
'@beatzball/litro': minor
---

`litro mcp-app build` derives each app's `ui://` address from its file path

The package name is the authority and the file path is the path, so
`mcp-apps/weather/card.ts` in a package named `playground` packs as
`ui://playground/weather/card`. Filesystem-as-routing is the convention
everywhere else in Litro, and an app declaring its own address was the odd one
out. An explicit `uri` in the config still wins.

One rule with no special cases: rename the package and every address moves
together, which is what an authority is for. The authority comes from the
package rather than the first folder because a `ui://` address needs a host AND
a path — with the first folder as authority, a file sitting flat in `mcp-apps/`
would give host `weather-card` and an empty path, a different shape from every
nested file. A scoped name contributes only its last part, and a name that
cannot be a uri host means every app in that project must set `uri` itself.

**The output now mirrors the source tree.** `mcp-apps/weather/card.ts` writes
`dist/mcp-apps/weather/card.html`, not `weather-card.html`. The old flattening
let `weather/card.ts` and `weather-card.ts` — two files with two DIFFERENT
addresses — claim one output file, so the build had to detect the clash and
refuse; mirroring makes it unrepresentable. `manifest.json` paths stay relative
to the output directory, so a server reading the manifest needs no change.
Nested app files are new in this release, so no existing output moves.

**Names that cannot become an address are refused.** File and folder names may
use letters, digits, `.`, `_`, `~` and `-`. A space, `?`, `#`, `%` or a
non-ASCII letter is rejected: a parser rewrites it, so the descriptor would
name a resource under one address while the host caches it under another. This
also closes a silent collision — `big card.ts` and `big%20card.ts` are two raw
strings that resolve to one address, which neither the output check nor the uri
check could see. Dot segments (`.`, `..`) are refused for the same reason.

**Every problem is reported at once**, before a module is loaded or a byte is
written, instead of one failed build per mistake. `assertUniqueUris` now
compares what a parser resolves an address to, not the raw text, and lists
every clash rather than the first.

Dynamic segments are rejected. `[slug]`, `[[opt]]` and `[...all]` mean
something in `pages/` and nothing here. `index.ts` is not the folder root here
either.

Also: an error thrown while loading an app file is reported with the file
named, instead of escaping the command as a raw stack.
