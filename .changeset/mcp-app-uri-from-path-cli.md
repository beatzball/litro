---
'@beatzball/litro': minor
---

`litro mcp-app build` derives each app's `ui://` address from its file path

The package name is the authority and the file path is the path, so
`mcp-apps/weather/card.ts` in a package named `playground` packs as
`ui://playground/weather/card`. Filesystem-as-routing is the convention
everywhere else in Litro, and an app declaring its own address was the odd one
out. An explicit `uri` in the config still wins, so nothing existing changes.

One rule with no special cases: rename the package and every address moves
together, which is what an authority is for. The authority comes from the
package rather than the first folder because a `ui://` address needs a host AND
a path — with the first folder as authority, a file sitting flat in `mcp-apps/`
would give host `weather-card` and an empty path, a different shape from every
nested file. A scoped name contributes only its last part.

Dynamic segments are rejected. `[slug]`, `[[opt]]` and `[...all]` mean
something in `pages/` and nothing here — a `ui://` resource is a static
template the host caches by address, so there is no request to fill a
parameter from. `index.ts` is not the folder root here either.

The uri and the output filename now come from one function, since the manifest
pairs them and deriving them apart would let them drift.

Also: an error thrown while loading an app file is now reported with the file
named, instead of escaping the command as a raw stack.
