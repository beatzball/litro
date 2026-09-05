---
'@beatzball/litro': minor
---

`litro mcp-app build` derives each app's `ui://` address from its file path

`mcp-apps/weather/card.ts` packs as `ui://weather/card`, the way
`pages/blog/index.ts` serves `/blog`. Filesystem-as-routing is the convention
everywhere else in Litro, and an app declaring its own address was the odd one
out. An explicit `uri` in the config still wins, so nothing existing changes.

A `ui://` address needs a host and a path, so one segment is not enough on its
own: for a file sitting flat in `mcp-apps/`, the package name fills the first
segment, and a package with no usable name gets an error naming both ways out.

Dynamic segments are rejected. `[slug]`, `[[opt]]` and `[...all]` mean
something in `pages/` and nothing here — a `ui://` resource is a static
template the host caches by address, so there is no request to fill a
parameter from.

The uri and the output filename now come from one function, since the manifest
pairs them and deriving them apart would let them drift.

Also: an error thrown while loading an app file is now reported with the file
named, instead of escaping the command as a raw stack.
