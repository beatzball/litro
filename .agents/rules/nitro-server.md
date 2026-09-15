# Nitro server rules

Nitro reads some configuration before any `build:before` hook runs. Server
Actions and page data both cross a trust or parsing boundary.

### NITRO-001 — Framework RPC routes are static `handlers` entries

The Server Actions route (`/__litro/action/:id`) and the agent route
(`/__litro/agent/:agent/:session`) are declared in the app's `nitro.config.ts`
`handlers` array. Do not push them into `nitro.options.handlers` from a hook.

**Why:** the dev server reads handler config before `build:before` fires. A
route added in that hook never reaches `litro dev`.

**Check:** `playground/nitro.config.ts` declares both routes and explains why. A
404 on the endpoint in dev only means the route was added dynamically.

### NITRO-002 — `server/plugins/litro-actions.ts` is committed

Apps that use Server Actions track `server/plugins/litro-actions.ts` in git.
Its content is the same as the source the actions plugin generates.

**Why:** Nitro scans `server/plugins/` when `createNitro` runs, before
`build:before`. If the file is generated in that hook, a fresh checkout boots
without it, and `actionUrl()` on server exports is never stamped.

**Check:** `git ls-files | grep server/plugins/litro-actions.ts` lists
`playground`, `playground-elena` and the fullstack recipe template. The comment
at the top of `packages/framework/src/plugins/actions.ts` describes it.

### NITRO-003 — Generated files inside the source dir use content-compared writes

Code that writes a generated file inside Nitro's watched source directory writes
only when the content changed.

**Why:** every write triggers a Nitro dev reload, and the reload regenerates the
file. An unconditional write reloads `litro dev` forever.

**Check:** `writeIfChanged` in `packages/framework/src/plugins/pages.ts` and
`writeStub` in `packages/framework/src/plugins/actions.ts`. A dev server that
reloads with no edits means an unconditional write.

### NITRO-004 — Server Actions use seroval JSON mode only

Serialize action values with `toJSON`/`fromJSON` (and the `toCrossJSON` pair for
streams). Never use seroval's `serialize`/`deserialize`.

**Why:** the server deserializes input sent by any client. The
`serialize`/`deserialize` pair builds and evaluates JavaScript, so hostile input
would become code execution.

**Check:** the import in `packages/framework/src/actions/serialize.ts`. Any other
seroval function in `packages/framework/src/actions/` is the bug.

### NITRO-005 — The action id hash is a frozen wire contract

Do not change how `hashActionId` builds an id: the first 12 hex characters of
`sha256(relPath + '#' + exportName)`, where `relPath` is root-relative, uses
POSIX separators and has no extension.

**Why:** client stubs and server handlers are built separately and must compute
the same id. A change breaks every deployed client that still holds the old ids.

**Check:** the inline snapshot `63b4b61acbab` in
`packages/framework/src/actions/__tests__/hash.test.ts` fails if it changes.

### NITRO-006 — Page data must never close its own `<script>` tag

Server-only fields that hold HTML (`seoHead`, `seoTitle`, `bodyScript`) are
removed before page data is serialized into `__litro_data__`. The shell also
escapes every `</script` in the JSON.

**Why:** the data sits inside `<script type="application/json">`. A `</script>`
inside it, for example from a JSON-LD block, ends the element early. The rest of
the JSON shows as page text and `getServerData()` returns null.

**Check:** the destructuring in `packages/framework/src/runtime/create-page-handler.ts`
and the `replace` in `packages/framework/src/runtime/shell.ts`. Do not remove
either. Do not add per-field stripping for other fields; the escape covers them.

### NITRO-007 — The dev Vite watcher ignores `.nitro` and `.litro`

`litroViteDevConfig()` keeps `server.watch.ignored` set to
`['**/.nitro/**', '**/.litro/**']`.

**Why:** Nitro rewrites `.nitro/types/tsconfig.json` on every dev reload. Vite
treats a change to a tracked tsconfig as a reason to clear its cache and force a
full browser reload. Pages then reload in the middle of tests.

**Check:** `packages/framework/src/runtime/vite-dev.ts`. Random full reloads in
`litro dev` point here first.

### NITRO-008 — The dev process guard ignores both `ECONNRESET` and `EPIPE`

The `uncaughtException` guard that `litro dev` installs returns early for both
error codes.

**Why:** a browser that aborts a stream mid-response raises `EPIPE`. That is
routine with live-source dev. Without the guard the dev server exits, and every
later e2e test fails with `ERR_EMPTY_RESPONSE` and then `ECONNREFUSED`.

**Check:** `packages/framework/src/cli/index.ts`. A run of connection-refused
failures after one test means the server died, not that the specs are wrong.
