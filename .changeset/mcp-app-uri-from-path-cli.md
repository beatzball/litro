---
'@beatzball/litro': minor
---

`litro mcp-app build` derives each app's `ui://` address from its file path

The package name is the authority and the file path is the path, so
`mcp-apps/weather/card.ts` in a package named `playground` packs as
`ui://playground/weather/card`. Filesystem-as-routing is the convention
everywhere else in Litro, and an app declaring its own address was the odd one
out. An explicit `uri` in the config still wins.

The output mirrors the source tree to match, so `mcp-apps/weather/card.ts`
writes `dist/mcp-apps/weather/card.html` — 0.15.0 flattened that to
`weather-card.html`, which let it collide with a real `weather-card.ts`. If you
already had app files in subfolders, their output paths move; `manifest.json`
entries stay relative to the output directory, so reading those needs no change.

One rule with no special cases: rename the package and every address moves
together, which is what an authority is for. The authority comes from the
package rather than the first folder because a `ui://` address needs a host AND
a path — with the first folder as authority, a file sitting flat in `mcp-apps/`
would give host `weather-card` and an empty path, a different shape from every
nested file. A scoped name contributes only its last part, and a name that
cannot be a uri host means every app in that project must set `uri` itself.

**Names that cannot become an address are refused — unless the app names one.**
For a DERIVED address, file and folder names may use letters, digits, `.`, `_`,
`~` and `-`; a space, `%` or a non-ASCII letter is rejected, because a parser
rewrites it and the descriptor would then name a resource under one address
while the host caches it under another. This also closes a silent collision:
`big card.ts` and `big%20card.ts` are two raw strings that resolve to one
address. An app that sets its own `uri` is exempt — the filename is only a
filename then.

Five refusals are NOT exemptible, because an address cannot answer them: a `.`
or `..` segment, which does not survive path normalisation and, with a leading
`..`, writes outside the output directory; a backslash, which the glob's
absolute form rewrites into `/` so the loader looks for a file that is not
there; a `#` or `?`, which the module loader reads as url syntax and then
reports the file as missing; a C0 control character or Unicode line separator,
which has no printable form and would appear as itself in the manifest, the
descriptor and every error message (U+007F is allowed: the line is drawn at the
C0 range and DEL sits just outside it); and an app packing to `manifest` at the
top level, where the index would overwrite its own descriptor
(matched by Unicode case folding, since `Manifest.json` and `manifeſt.json` are
both the same file as `manifest.json` on macOS and Windows).

**Problems are reported at once** where they can be, before a module is loaded
or a byte is written, instead of one failed build per mistake. The exception is
a character that only breaks a DERIVED address: whether it matters depends on
whether the app declares its own `uri`, which is not known until the file
loads. `assertUniqueUris` compares RFC 3986 equivalence — folding host case and
percent-triplet case on top of what `new URL()` does — and lists every clash
rather than the first.

Dynamic segments are rejected for a derived address, and exempt alongside an
explicit one. `[slug]`, `[[opt]]` and `[...all]` mean something in `pages/` and
nothing here. `index.ts` is not the folder root here either.

Also: an error thrown while loading an app file is reported with the file
named, instead of escaping the command as a raw stack.
