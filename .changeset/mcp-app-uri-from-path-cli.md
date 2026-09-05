---
'@beatzball/litro': minor
---

`litro mcp-app build` derives each app's `ui://` address from its file path

**BREAKING for a project with app files in subfolders.** The output now mirrors
the source tree: `mcp-apps/weather/card.ts` writes
`dist/mcp-apps/weather/card.html`, where 0.15.0 wrote `weather-card.html`. The
recursive glob is already published, so this MOVES existing output. Anything
pinned to the flat path has to follow — a static mount, a `COPY` line, a path
written into a server config. Reading `manifest.json` and using its `html` and
`descriptor` entries needs no change; they stay relative to the output
directory. A project whose app files all sit flat in `mcp-apps/` is unaffected.

The reason for the move is that flattening let `weather/card.ts` and
`weather-card.ts` — two files with two DIFFERENT addresses — claim one output
file, so the build had to detect that clash and refuse. Mirroring makes it
unrepresentable instead of merely detected.

**The address itself.** The package name is the authority and the file path is
the path, so `mcp-apps/weather/card.ts` in a package named `playground` packs
as `ui://playground/weather/card`. Filesystem-as-routing is the convention
everywhere else in Litro, and an app declaring its own address was the odd one
out. An explicit `uri` in the config still wins.

One rule with no special cases: rename the package and every address moves
together, which is what an authority is for. The authority comes from the
package rather than the first folder because a `ui://` address needs a host AND
a path — with the first folder as authority, a file sitting flat in `mcp-apps/`
would give host `weather-card` and an empty path, a different shape from every
nested file. A scoped name contributes only its last part, and a name that
cannot be a uri host means every app in that project must set `uri` itself.

**Names that cannot become an address are refused — unless the app names one.**
For a DERIVED address, file and folder names may use letters, digits, `.`, `_`,
`~` and `-`; a space, `?`, `#`, `%` or a non-ASCII letter is rejected, because a
parser rewrites it and the descriptor would then name a resource under one
address while the host caches it under another. This also closes a silent
collision: `big card.ts` and `big%20card.ts` are two raw strings that resolve to
one address. An app that sets its own `uri` is exempt — the filename is only a
filename then. Only `.` and `..` are refused outright, since they would write
outside the output directory.

**Every problem is reported at once**, before a module is loaded or a byte is
written, instead of one failed build per mistake. `assertUniqueUris` compares
RFC 3986 equivalence — folding host case and percent-triplet case on top of
what `new URL()` does — and lists every clash rather than the first. An app
packing to `manifest` at the top level is refused, because the index would
overwrite its descriptor.

Dynamic segments are rejected for a derived address. `[slug]`, `[[opt]]` and
`[...all]` mean something in `pages/` and nothing here. `index.ts` is not the
folder root here either.

Also: an error thrown while loading an app file is reported with the file
named, instead of escaping the command as a raw stack.
