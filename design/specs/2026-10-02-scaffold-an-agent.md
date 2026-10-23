# Design: scaffold an agent

Status: Accepted

Issue: https://github.com/beatzball/litro/issues/216

---

## 1. What it is

`create-litro` learns to produce an agent, so that the AI half of Litro arrives
the way the web half already does — from one command, working, with nothing to
read first.

Concretely: a `fullstack` project that answers a question, calls a tool, and
paints a server-rendered web component in the browser, on a machine with no API
key and no network.

Litro's web half is one command. Its AI half is a checklist. Agents, tools,
`ui()`, the MCP Apps packager and an MCP server over stdio and HTTP are all
built, published and documented — and reachable only by hand. The docs say so:
"The package is not scaffolded by `create-litro` yet, so wire it by hand."

That asymmetry is not only inconvenient. The landing page was repositioned
around the AI half, and the one sentence every headline wanted — *an agent is a
command away* — could not be written, because it was not true. This is the work
that makes it true.

## 2. What exists today, and what does not

Each line was verified in this repository on 2026-10-02.

| Claim | Verified how | Result |
|---|---|---|
| No recipe contains an agent | `find packages/create-litro/recipes -type d -name agents` | nothing |
| No recipe mentions the agent layer | `grep -rln "litro-agent\|defineAgent\|defineTool" packages/create-litro/recipes/` | nothing |
| There are four recipes | `ls packages/create-litro/recipes` | `11ty-blog`, `fullstack`, `starlight`, `supernova` |
| Only one recipe has an option today | `recipes/supernova/recipe.config.ts` | `{ key: 'blog', type: 'confirm', default: true }` |
| An option can only SUBTRACT | `applyRecipeOptions` in `src/recipe-options.ts` | it runs after every template layer is on disk, and the one implementation calls `removeBlog` |
| The agent runtime is shipped | `packages/litro-agent/package.json` | version 0.7.0, 14 export subpaths |
| `litro mcp serve` is shipped | `packages/framework/src/cli/mcp-serve.ts` | the CLI subcommand exists |
| A scaffolded app can run an agent | the walk-through in section 3 | yes, in a production build |
| A scaffolded app can serve MCP | the walk-through in section 3 | yes, after one install |

The gap is entirely in `create-litro`. Nothing in the agent layer needs to change
for this spec, which is why this is a scaffolding design and not a runtime one.

## 3. The walk-through: wiring an agent by hand

This is the strongest evidence the spec carries, because it is the thing a reader
of the docs cannot see. It was run on 2026-10-02 against packed tarballs, not
workspace symlinks (TEST-005) — the path a real user is on.

```
scaffold   fullstack, Lit, SSR, from the packed @beatzball/create-litro tarball
install    pnpm install --ignore-workspace, against the packed tarballs
wire       by hand, following the Setup section of the agents guide
build      litro build  (and litro generate, for the static result in 3.2)
drive      POST /__litro/agent/demo/<session>, with a seroval body
```

**What the walk-through did NOT do, stated up front** so nothing downstream
reads as measured when it was reasoned:

- **No browser.** The turn was driven by POST against the production server. No
  `litro dev`, no page, no click.
- **No chat page.** The spike wrote four files and none of them is a page, so
  `pages/agent.ts` — the piece section 5 calls not optional — is the one v1
  piece with no spike evidence behind it. `playground/pages/agent.ts` does run,
  but over a workspace symlink, which is the case TEST-005 exists to distrust.
  Section 14 carries this as the gap it is.
- **No client-side measurement.** Section 3.4 measures `dist/server` only. The
  cost of `@beatzball/litro-agent/client` in a client bundle is unmeasured.

### 3.0 Reproducing it

The spike project is not kept in the repository. What it was:

| | |
|---|---|
| packages, packed with `pnpm pack` | `@beatzball/litro` 0.17.2, `@beatzball/litro-router` 0.3.1, `@beatzball/litro-agent` 0.7.0, `@beatzball/create-litro` 0.15.1 |
| scaffolded with | the unpacked `create-litro` tarball, `--recipe fullstack --adapter lit --mode ssr` |
| installed with | `pnpm install --ignore-workspace`, `pnpm.overrides` pointing every Litro package at its tarball |
| zod | 4.6.5 |
| Node / pnpm | 24.7.0 / 10.28.0 |
| size command | `du -sk dist/server` |

### 3.1 What the hand wiring actually is

**Four new files**, none of which the guide supplies as a copyable whole:

| File | What it is | Lines |
|---|---|---|
| `agents/demo/agent.ts` | `defineAgent` plus a provider | 7 first, then 28 |
| `agents/demo/instructions.md` | the system prompt | 2 |
| `agents/demo/tools/get-weather.ts` | `defineTool` plus a `ui()` return | 35 |
| `src/components/weather-card.ts` | the component `ui()` renders | 20 |

**`agent.ts` was written twice, and which one is which matters**, because
sections 3.2 and 3.3 report opposite outcomes from the same filename:

- **First, 7 lines**, copied from the guide: `defineAgent` plus
  `openaiCompatible`. This is the one that fails in section 3.2.
- **Then 28 lines**, after that failure: the scripted provider with an env
  switch to a live one, shortened from `playground/agents/demo/agent.ts` (86
  lines; the `slowly` delay branch was dropped). This is the one that produces
  the successful turn in section 3.3, and the shape decision 5 adopts.

The walk-through named its tool `get-weather`, following the guide's own example.
Every quotation of a measured run below keeps that name, because that is what was
run. **The tool the scaffolder generates is `example-weather`** — decision 7.

**Nine edits across three files that already exist:**

| File | Edits | Count |
|---|---|---|
| `nitro.config.ts` | import the plugin; a POST handler entry; a GET handler entry; call the plugin in `build:before`; a `routeRules` entry | 5 |
| `package.json` | `#litro/agent-manifest`; `#litro/agent-config`; the dependency | 3 |
| `.gitignore` | `.litro/` | 1 |

The guide gets all of this right. The cost is not that it is wrong; it is that
**there are thirteen places to be right** — four new files and nine edits — five
of the edits inside a build configuration, and nothing checks the result until a
turn either runs or does not.

### 3.2 Three things the guide does not warn about, found by doing it

**The first run fails with a raw `TypeError`.** The guide's `defineAgent`
example is `openaiCompatible({ baseURL: process.env.LLM_URL!, model: 'qwen3' })`.
With no `LLM_URL` set — which is every new project — the first turn returns, over
the session stream, to the browser:

```json
{"err":{"name":"TypeError","message":"Failed to parse URL from undefined/chat/completions","status":500}}
```

A raw internal message, status 500, reaching the client. That is correct behavior
per AGENT-007 (only the stack is stripped in production), and it is a terrible
first experience. It is the whole of decision 5.

**The endpoint cannot be driven with plain JSON.** A POST of
`{"text":"..."}` is answered with 400 `Malformed agent request body`. The body is
a seroval JSON AST, not a plain object — correct, since the same codec carries
Server Actions values, and documented in the client, but it means `curl` is not
how anyone checks their work. Without a page that talks to the agent, a freshly
wired project has no way to see the thing it just built.

**The agent is silently dead in a static build.** `litro generate` on the same
project exits 0, logs `[litro] Registered 1 agent`, and emits a `dist/static/`
holding `index.html`, `blog/`, `_litro/` and `nitro.json` — no agent endpoint.
No warning anywhere. The build's own log says the opposite of what shipped.

**This is a bug in the framework, not a fact to design around, and it is now
filed as [issue 228](https://github.com/beatzball/litro/issues/228).** The spec
routes around it — decision 1.3 keeps the option off `ssg` recipes, and decision
1.5 handles the `--mode ssg` path — but routing around a silent exit-0 failure is
not fixing it, and it must not survive only as a justification for a recipe
choice. Nothing in this spec's phases fixes it; issue 228 owns it.

### 3.3 What the hand wiring produces, once it is right

A production build, served, driven with a correct body, returns the full turn —
`message`, `text-delta`, `tool-call`, `ui`, `text-delta`, `message`, `turn-end` —
and the `ui` event carries real Declarative Shadow DOM:

```html
<weather-card><template shadowroot="open" shadowrootmode="open"><style>
    :host { display: block; border: 1px solid #ccc; border-radius: 8px; padding: 1rem; }
  </style><div><h3>Lisbon</h3><p class="temp">21&deg;C</p><p>sunny</p></div></template></weather-card>
```

The component registered, `@lit-labs/ssr` expanded it, and the card's text is in
the first byte. That is the capability this spec exists to put one command away.

### 3.4 What it costs, measured

Five builds of the same project, `du -sk dist/server`, conditions in section 3.0:

| What the project has | `dist/server` | Delta on the row above |
|---|---|---|
| `fullstack`, no agent at all | 2096 KB | — |
| the agent wiring, with `agents/` deleted | 2200 KB | +104 KB |
| an agent and a `ui()` tool, hand-rolled schema | 2216 KB | +16 KB |
| the same, with a `zod/mini` schema | 3320 KB | +1104 KB |
| the same, with a full `zod` schema | 3388 KB | +68 KB |

Two facts fall out, and both are load-bearing later:

- **The whole `agents/` directory costs 16 KB** over the inert wiring — agent,
  tool, component and the `ui()` call together. The `ui()` renderer is already in
  a `fullstack` server graph, because the recipe server-renders its pages with it,
  so returning a component adds a call site rather than a dependency.

  **This is an upper bound on `ui()`, not a measurement of it.** No
  plain-object-tool build was made, so "`ui()` costs 16 KB" would be a claim the
  table cannot support; what the table supports is that **everything the agent
  adds, `ui()` included, fits in 16 KB.** That is enough for decision 3 and the
  spec claims no more. Building a sixth variant with a plain-object tool would
  pin it exactly, and is not worth a build to split 16 KB.
- **The schema library is the expensive choice.** Full zod traces 1172 KB into
  the server output — nine tenths of the whole cost of scaffolding an agent.
  Section 9.1 reports what happened when that was attacked.

Installed sizes, for the same reason: `@beatzball/litro-agent` is a 408 KB
tarball and 2.5 MB installed; `@modelcontextprotocol/sdk` is 6.0 MB installed;
zod is 8.0 MB installed.

## 4. Decision 1 — an option on `fullstack`, and only on `fullstack`

### 4.1 An option, not a recipe of its own

There is a precedent either way, which is why the issue leaves it open.
`supernova` is a recipe that `extends` another, and it also carries an option.
Both were read end to end before choosing.

**Decided: an option on an existing recipe.**

```ts
options: [
  { key: 'agent', prompt: 'Include an agent?', type: 'confirm', default: true },
],
```

A recipe of its own cannot work here. An agent needs five changes *inside*
`nitro.config.ts`, and the layer system copies whole trees with later layers
winning — so a recipe, or any layer, that wants different config ships a second
complete copy of that file, to be kept in step with the base's by hand, forever.
This repository has already paid that bill twice and written both down: the
supernova template re-ships `pages/index.ts`, and `--for-repo` writes its own
`starlight.config.js`, where the scaffolding check records that "every navigation
fix has to be made twice". A silent drift is worse than a loud assertion.

Rejected:

- **A recipe of its own (`agent`, or `fullstack-agent` extending `fullstack`).**
  Two copies of `nitro.config.ts` to keep in step. It also spends the one
  `extends` level the scaffolder allows, which `supernova` has already spent on
  `starlight` — so the same idea could never reach the docs recipes. And it makes
  the headline `--recipe agent` rather than the bare create command.

### 4.1.1 The option ADDS the agent; it does not remove it

The direction matters more than it looks, and getting it wrong breaks a live
recipe variant. The first draft of this spec had the agent in the shared
`template/` with a `removeAgent()` for `--no-agent`, mirroring `removeBlog`.
**That design is broken, and `fullstack` is the recipe that breaks it.**

`fullstack` is two layers. `template-elena/` carries its own complete
`nitro.config.ts`, `package.json` and `pages/index.ts`, and the layer loop in
`scaffold.ts` copies it **last**, so the overlay's copies win. Put the agent
wiring in the base template and scaffold with `--adapter elena` and you get: the
base layer's `agents/` and `pages/agent.ts` on disk, the overlay's config with no
agent wiring, and the overlay's `package.json` with no `imports` keys. A
`removeAgent()` that asserts its anchors exist — which is the entire reason to
prefer removal — then **fails at scaffold time on a variant that works today.**

And the obvious repair, adding the wiring to the Elena overlay so the anchors are
there, is exactly the second complete copy that 4.1 just rejected. The two
options are a crash and a drift.

**Decided: invert it. The option is additive.**

| | |
|---|---|
| `recipes/fullstack/options/agent/` | a new option-keyed layer, copied only when the answer is yes. It holds the six new files of section 5 — and **only files no other layer holds** |
| `addAgent(projectDir)` | the twelve in-file edits of section 5, each anchored and each asserting its target exists |
| `--no-agent` | the absence of both. Nothing to undo |

Three things this buys, and the first is the one that decides it:

1. **Elena cannot break, because nothing on Elena's path changes.** The option is
   unavailable for Elena (decision 1.4), so the layer is never copied and
   `addAgent` never runs. An Elena scaffold is byte-identical to today's.
2. **No layer precedence to reason about.** `addAgent` patches the
   `nitro.config.ts` that is actually on disk, whichever layer wrote it. A
   missing anchor is a genuine fault in either case, so asserting is correct
   unconditionally — where a remover had to ask "did an overlay legitimately
   remove this, or did the template reshape?" and cannot tell.
3. **Zero overwrite, so zero drift.** The layer contains no file any other layer
   contains. The objection that killed a layer in 4.1 was about `nitro.config.ts`;
   this layer does not contain it, because the edits are a code step instead.

This does **not** reopen 4.1. It is still an option on `fullstack`, prompted the
same way, with the same default. What changed is the direction of its effect.

**Rejected: the agent in `template/` with `removeAgent()`.** It crashes
`fullstack:elena`, as above. Even setting Elena aside, the undo list ran to seven
anchored edits across five files, against `addAgent`'s equivalent additions —
same work, but every removal also has to be correct about what each layer left
behind.

**Rejected: the agent in `template/`, with `removeAgent()` tolerant of missing
anchors.** It makes the Elena case pass by making every case silent. A tolerant
remover cannot distinguish "the overlay never had this" from "the template moved
and the anchor no longer matches", which is the failure `blog.ts` was written
against.

### 4.1.2 What has to change in `create-litro` for this to work

Three changes, all small and declarative. Named because "the default depends on
the adapter" is **not expressible today** and a plan must not assume it is.

1. **An option-keyed layer in the copy loop.** `scaffold()` resolves layers as
   base `template/`, base `template-<adapter>/`, own `template/`, own
   `template-<adapter>/`. It gains, last: `options/<key>/` for each option whose
   resolved answer is truthy. About ten lines.

   **Not named `template-agent/`.** The loop already probes
   `template-<adapter>`, so a directory called `template-agent` reads as an
   adapter named "agent" — a trap for the next person. `options/<key>/` cannot be
   mistaken for one and extends to a second option without a new convention.

2. **`RecipeOption` gains an optional `adapters?: LitroAdapter[]`.** Omitted
   means every adapter the recipe declares. Present, it is the subset the option
   can be answered yes for. This mirrors `LitroRecipe.adapters`, whose own
   comment says support is "DECLARED, NEVER INFERRED" — inferring it from which
   directories exist is the bug that field was added for.

3. **`resolveRecipeOptions` takes the chosen adapter.** Its signature is
   `(recipe, flags, prompts)` today and the adapter is already resolved in
   `index.ts` before options are asked, so this is a parameter, not a redesign.
   With it: an option whose `adapters` excludes the chosen one is not prompted,
   resolves to `false`, and refuses an explicit flag.

`applyRecipeOptions` keeps its shape; `addAgent` joins `removeBlog` as a second
branch. A plan should land item 2 and item 3 together, since item 2 is inert
without item 3.

### 4.2 Default true

**Decided: `default: true`.** The point of the work is that
`pnpm create @beatzball/litro my-app`, with every default accepted, reaches an
agent. A default of `false` turns the sentence into *an agent is a command and a
flag away*, which is a smaller claim and not the one the landing page wants.

**What the default actually costs, with decision 6's zod in it.** The first draft
priced this at "a 2.5 MB development dependency and 120 KB of server output",
which was the pre-zod number and is roughly ten times off:

| | |
|---|---|
| server output | **+1292 KB** (2096 KB to 3388 KB), of which zod is 1172 KB |
| on disk | `@beatzball/litro-agent` 2.5 MB plus zod 8.0 MB |
| in a client bundle | the chat page's import of `@beatzball/litro-agent/client` — **unmeasured**, section 3.4 measures the server only |

That is a real cost and it is worth stating at full size rather than at the
flattering one. It does not change the decision: both are server-side or
on-disk, no visitor downloads either, and a project that wants neither answers
`n`, passes `--no-agent`, or deletes `agents/` — measured in section 13 to leave
a working build. But a reader deciding whether to accept the default is owed the
1292 KB, not the 120 KB.

### 4.3 Which recipes offer it: one

| Recipe | Offer the option? | Why |
|---|---|---|
| `fullstack` | **yes** | `mode: 'both'`, defaults to a server build, and already ships `server/api/` and Server Actions. An agent is a POST endpoint; this is the only recipe whose shape is a server. |
| `starlight` | **no** | `mode: 'ssg'`. Measured: an agent in a static build exits 0, logs that it registered, and emits no endpoint. The option would scaffold something that cannot run, silently. |
| `supernova` | **no** | `mode: 'ssg'`, same as above. Also `adapters: ['lit']` and `extends: 'starlight'`, so it is the most constrained recipe in the set and the least suited to gaining a second one. |
| `11ty-blog` | **no** | `mode: 'both'`, so it *could*. But it is a blog: nothing on it wants a tool, and a second recipe doubles the scaffolding-check matrix for no story a reader would recognize. |

A docs site that wants an agent is not blocked by this. It is a one-line change
to a recipe's config once `mode: 'ssg'` is no longer the shape of the site. And
`litro mcp serve` should work on a static project regardless, because it loads
project source through Vite and never touches the build — that is what the CLI's
own source says it does, and **it was not measured on a static project**; every
row of the section 7 table came from the server-mode spike. Treat it as read, not
as run.

### 4.4 Lit only, inside a recipe that also reaches Elena

`fullstack` declares `adapters: ['lit', 'elena']`. `ui()` throws on Elena —
`ui(): the "elena" renderer is deferred past v0.` — and will not be built
(issue 219, which also deprecates the adapter). A scaffolded Elena agent whose
one tool returns a component would therefore throw on its first tool call.

**Decided: the option declares `adapters: ['lit']`. With `--adapter elena` it is
not prompted and resolves to `false`; an explicit `--agent` is refused before
anything is written.** The refusal names the adapter and the issue, in the style
of `assertAdapterSupported`, which already refuses an adapter a recipe does not
declare and does it before the target directory exists.

Because the option is additive (4.1.1), resolving to `false` means **nothing is
written and nothing is undone**: the `options/agent/` layer is not copied and
`addAgent` does not run. The existing `fullstack:elena` scaffold is unchanged,
byte for byte. That is the property that makes this safe, and it is the reason
the direction of the option had to be settled before this decision could be.

Rejected: **scaffolding an Elena agent with a plain-object tool instead of a
`ui()` one.** It would make the one scaffolded example of Litro's most
distinctive capability conditional on an adapter that is being removed, and it
would add a second tool file to maintain for an adapter with no future.

Rejected: **dropping `elena` from `fullstack`'s `adapters`.** It would make the
option's gate unnecessary, and it would delete a live scaffolding variant that
has its own end-to-end suite. Elena is deprecated, not removed; v1 is where it
goes (issue 219), and that is not this spec's call to make early.

FAST needs nothing here: it is not on `fullstack` at all, so there is no FAST
agent to write in v1. If FAST reaches `fullstack`, the layer gains a FAST
sibling — a string template with kebab-case attributes, per the authoring rule on
the agents page. (`fullstack` declares `['lit', 'elena']`; FAST reaches
`starlight` only, which the Known Gaps page records.)

### 4.5 `--mode ssg` is refused too, for the same reason

`fullstack` is `mode: 'both'`, so the scaffolder asks "Deployment mode" and
accepts `--mode ssg`. A user who picks it would get the agent by default and then
build the silent failure of section 3.2 — the one now filed as issue 228. Elena
got a rule; this path had none, which was a hole.

**Decided: the agent option and `--mode ssg` are mutually exclusive, handled
exactly like the adapter gate.** With `ssg` chosen the option is not prompted and
resolves to `false`; an explicit `--agent --mode ssg` is refused before anything
is written, naming issue 228 so the reader learns the real reason.

Two things make this the right shape rather than a warning:

- A warning at create time is read once and then lives in scrollback. The failure
  arrives later, from a browser, as a 404.
- The mode answer does not bind the build. `fullstack` interpolates `{{mode}}`
  nowhere — verified, it has no `litro.recipe.json` — so a scaffolded project can
  run `litro build` or `litro generate` whatever it answered. **So the refusal
  does not prevent the failure; it only stops the scaffolder from writing the
  combination on purpose.** Closing it properly is issue 228's job, which is
  precisely why that issue exists and why this spec does not pretend to fix it.

This is the mechanism gap worth naming for a plan: a mode-gated option needs the
same plumbing as an adapter-gated one — `resolveRecipeOptions` has to see the
resolved mode as well as the adapter. Both are known in `index.ts` before options
are asked, so it is a second parameter, not a second design.

## 5. Decision 2 — what it produces, named exactly

In a `fullstack` + Lit project called `my-app`, answering yes.

**Six new files**, all from `recipes/fullstack/options/agent/` (4.1.1), none of
which any other layer also holds:

```
my-app/
  agents/
    demo/
      agent.ts                  defineAgent; the scripted provider, with an env switch
      instructions.md           the system prompt, inlined at build time
      tools/
        example-weather.ts      defineTool; returns ui(<weather-card>)
  pages/
    agent.ts                    the chat page, route /agent
  src/components/
    weather-card.ts             the component ui() renders
  AGENT.md                      what was scaffolded, and the four things to know
```

The tool is `example-weather`, not `get-weather`. Decision 7 is the reason: a
tool's name is global to an MCP host, and a name that says "example" both
collides less and tells a reader it is scaffolding to replace.

**`AGENT.md` is a real file, and it exists because four places in this spec
needed somewhere to put a sentence.** The first draft sent them all to "the
generated project" and two to "the generated README" — and there is no README:
`find packages/create-litro/recipes -iname 'README*'` prints nothing, and
`create-litro` writes one only under `--for-repo`. Rather than add a README to a
recipe that has never had one, the agent's own layer carries its own page, which
keeps it inside the thing the option adds and removes. It holds exactly four
things, each of which is a finding from this spec:

1. **MCP is one install away** — `pnpm add -D @modelcontextprotocol/sdk`, then
   `litro mcp serve` (section 7.1).
2. **A static build drops the agent endpoint** — issue 228, with the symptom, so
   a reader who runs `litro generate` later is not debugging a 404 blind.
3. **Tool names are global to an MCP host** — so the first rename is informed
   (decision 7).
4. **How to reach a real model, completely** — every variable, not a gesture
   (section 8), and that deleting `agents/` is the safe way to turn it all off.

The name is `AGENT.md`, singular, deliberately: `AGENTS.md` is the convention for
instructions *to* a coding agent, `--for-repo` already writes one, and two files
one letter apart in one directory is a trap.

And these edits to files the recipe already ships, applied by `addAgent`:

| File | Change | Edits |
|---|---|---|
| `nitro.config.ts` | `import agentsPlugin from '@beatzball/litro-agent/plugin'`; two static handler entries for `/__litro/agent/:agent/:session` (POST and GET); `await agentsPlugin(nitro)` in `build:before`, after the actions plugin; a `no-store` rule for `/__litro/agent/**` | 5 |
| `package.json` | `imports` gains `#litro/agent-manifest` and `#litro/agent-config`; `dependencies` gains **both `@beatzball/litro-agent` and `zod`** | 4 |
| `.gitignore` | `.litro/` — session logs are conversation data | 1 |
| `pages/index.ts` | one `<litro-link href="/agent">` beside the existing Blog link | 1 |
| `e2e/index.spec.ts` | one test that drives a turn on `/agent` | 1 |

**Twelve edits across five files, plus six new files.** The counts are in the
table so a plan copies them from one place.

**`zod` is a dependency of the generated project, and that is easy to miss.**
Decision 6 makes the tool `import { z } from 'zod'`, and nothing else supplies
it: `@beatzball/litro-agent`'s own dependencies are `@beatzball/litro`,
`fast-glob`, `h3`, `parse5` and `pathe` — no schema library, deliberately, because
any Standard Schema vendor works. The playground carries zod in its own
`package.json` for the same reason. An implementer who adds only
`@beatzball/litro-agent` ships a tool whose import does not resolve under pnpm's
strict layout, and the failure is at build time in a freshly created project.

It goes in `dependencies`, not `devDependencies`: the tool runs on the server at
run time.

`server/stubs/` is already ignored by the recipe's `gitignore`, and its comment
already anticipates this: "the scanners also emit litro-content.js, action-*.ts
and agent-*.ts". No change needed there.

**The chat page is not optional.** Section 3.2 is the argument: without it a
scaffolded agent cannot be seen at all, because the endpoint takes a seroval body
and a browser is the only client that speaks it. `playground/pages/agent.ts` is
122 lines and is the shape to copy — a log, an input, a `#ui-slot`, and
`hydrateUIResult` for the `ui` event.

**What it does NOT produce in v1:** no `mcp-apps/` directory, no `app:` field on
the tool, no `@modelcontextprotocol/sdk`, no `agents/_config.ts`. Decision 4 and
section 7.1 say why — and the SDK's absence is a default, not a limit: it is a
`devDependency` one install away, and the generated project says the command.

## 6. Decision 3 — yes, a `ui()` tool with a real component

This is the decision the issue calls the one that matters most, and the
measurement in section 3.4 settles it rather than taste.

**Decided: ship the `ui()` tool and its component.**

- **It costs at most 16 KB, and probably much less.** Bare agent wiring with no
  `agents/` is 2200 KB of server output; the agent, its tool, the component and
  the `ui()` call together are 2216 KB. So **16 KB is the ceiling on everything
  the agent adds**, `ui()` included — not a measurement of `ui()` alone, because
  no plain-object-tool build was made (section 3.4 is explicit about this). The
  ceiling is enough: the `@lit-labs/ssr` renderer is already in a `fullstack`
  server graph because the recipe server-renders its pages with it, so `ui()`
  adds a call site and not a dependency. The "more to generate" worry is one
  20-line component.
- **Without it the scaffold is indistinguishable.** A tool that returns JSON is a
  tool every framework scaffolds. The reason to use Litro is the sentence on the
  agents page — the model reasons over `data`, the human sees a component,
  neither channel leaks into the other — and a scaffold that does not demonstrate
  it demonstrates nothing worth the install.
- **It teaches the two rules that are easy to get wrong.** The generated tool
  carries `void WeatherCard;` with the comment that explains it (AGENT-003: a
  bare side-effect import is tree-shaken from the server bundle and the element
  is never defined), and it binds through typed properties rather than raw
  markup. Both are rules a reader meets as a bug otherwise.
- **The Elena problem is a refusal, not a compromise.** Decision 1.4.

Rejected: **a minimal tool returning a plain object, with `ui()` as a later
phase.** It saves at most 16 KB and one file, and it removes the only reason the
feature
is interesting. "Minimal" would be the right instinct if `ui()` were expensive;
it is not.

Rejected: **shipping the packed `ui://` document in v1 as well.** That is the MCP
host's view of the same component, and it is a different cost. Decision 4.

## 7. Decision 4 — `litro mcp serve` in the scaffolded project

Measured, in the hand-wired project, in four states.

| State of the project | `litro mcp serve` |
|---|---|
| as hand-wired: a tool with no `app:` field, no SDK installed | **fails**, cleanly: `@modelcontextprotocol/sdk is not installed in this project. pnpm add -D @modelcontextprotocol/sdk` |
| the SDK installed, still no `app:` field | **works.** `tools/list` returns the tool with its schema; `tools/call` returns `content` and `structuredContent`; `resources/list` is empty |
| `app: 'weather-card'` added, nothing packed | **fails at startup**: `tool "get-weather" names the app "weather-card", but there is no <project>/dist/mcp-apps/manifest.json. Run \`litro mcp-app build\` first` |
| `mcp-apps/weather-card.ts` added and packed | **works.** `_meta.ui.resourceUri` is `ui://my-app/weather-card`, and the resource is listed with `mimeType: text/html;profile=mcp-app` |

Driven with the SDK's own client over stdio, which is the host the repository
does not write (AGENT-012).

So the question "does it work with no further steps" has a precise answer: **one
step, and only if the scaffolded tool names no app.**

**Decided for v1: the scaffolded tool names no app, and the SDK is not
installed.** `litro mcp serve` then needs one documented command, and nothing in
the project is broken before it is run.

### 7.1 What the SDK actually costs, stated precisely

This has to be exact, because "6 MB in every project" reads worse than the truth
and could leave a reader thinking a scaffolded project cannot serve MCP at all.
It can. Three facts:

- **It is a `devDependency`.** `@modelcontextprotocol/sdk` never ships to
  production, never enters a client bundle, and no visitor to a Litro site
  downloads a byte of it. The 6.0 MB is a figure on a developer's disk.
- **It is already an optional peer dependency** of `@beatzball/litro-agent`, and
  that is the correct shape: the package declares the version it works against,
  and only a project that serves MCP resolves it.
- **A project that wants MCP runs one install.** `pnpm add -D
  @modelcontextprotocol/sdk`, and `litro mcp serve` works — measured, in a
  scaffolded app, in the table above.

So the question was never whether the SDK is needed eventually. It is whether
**every new project pays that install on day one for something most of them will
not use.** It should not. That is the whole of this decision, and it is a default,
not a limitation.

### 7.2 Three pieces go together; the SDK is a fourth and separate one

The first draft called the MCP half "all-or-nothing" and said "any three of the
four produce a broken project". **Its own table refutes that**, and the softened
claim is the accurate one.

**Three pieces are genuinely inseparable** — `app:` on the tool, the
`mcp-apps/` source, and a pack step:

- `app:` without `mcp-apps/` → startup failure out of the box (row three,
  measured).
- `mcp-apps/` and `app:` without packing → the same failure until someone builds.

(Packing at create time is not a fourth combination, it is the reason the pack
step cannot be one: nothing in `create-litro` runs a bundler, and it would need
the project's dependencies installed first.)

**The SDK is separable, and row two proves it.** With the SDK installed and no
`app:` field, the server works: tools list, tools call, `resources/list` empty.
So the SDK is left out of v1 on **install cost alone** — section 7.1 — which is a
sufficient reason and the only one. Saying it is part of an indivisible bundle
would be tidier and false.

**What phase 2 ships, stated without overclaiming:**
`mcp-apps/weather-card.ts`, the `app:` field, `@modelcontextprotocol/sdk` as a
`devDependency`, and `litro mcp-app build` folded into the project's `build`
script.

Two corrections to how the first draft described it:

- It said phase 2 "does not add a capability v1 lacked". **It does.** By rows two
  and four, `resources/list` goes from empty to carrying the `ui://` document —
  which is the component rendered inside a host, and that is a capability, not a
  convenience. What is true is narrower: **v1 can already serve tools over MCP**,
  one install away.
- It said phase 2 "takes the count to zero". **Not quite**: a fresh clone that
  has not built still meets the measured startup message. Phase 2 removes the
  install step; the build step remains and is the acceptable residue.

Until then the generated project must say the one command out loud, somewhere a
reader meets it — a comment in the tool file and item 1 of the generated
`AGENT.md` (section 5). A capability that is one documented install away is not a
gap; a capability nobody is told about is.

Rejected: **a `--mcp` flag in v1.** It is a second option, a second removal path
and two more scaffolding-check variants, for an audience of one. Phase 2 can make
it the default, or add the flag then, with the measured first-run behavior in
hand.

## 8. Decision 5 — the scripted provider, with an environment switch

A new project has no API key. Measured, in section 3.2: the guide's own
`openaiCompatible` example with no `LLM_URL` set fails on the first turn with a
raw `TypeError` and a 500, streamed to the browser.

**Decided: the scripted provider is the default, and a live one needs no code
change — only environment variables.** This is what
`playground/agents/demo/agent.ts` already does, in 86 lines; the generated file
is a shortened version, with that file's `slowly` delay branch dropped and its
tool name changed to `example-weather`. The whole of it:

```ts
import { defineAgent } from '@beatzball/litro-agent';
import { scriptedProvider } from '@beatzball/litro-agent/providers/scripted';
import { openaiCompatible } from '@beatzball/litro-agent/providers/openai-compatible';

// A new project has no API key, so the default provider is the scripted one
// below: the agent answers, calls its tool and renders a card with no network
// and no key.
//
// TO USE A REAL MODEL, set these in your environment — no code change needed:
//   LLM_URL         the base URL, e.g. https://api.openai.com/v1
//   LLM_MODEL       optional; defaults to gpt-4o-mini
//   OPENAI_API_KEY  the key. Omit it for a keyless local runtime
//                   (Ollama, LM Studio, vLLM), which needs no auth header.
// For Anthropic instead, swap this import for
// '@beatzball/litro-agent/providers/anthropic', call anthropic({ model }), and
// set ANTHROPIC_API_KEY.
const live = process.env.LLM_URL
  ? openaiCompatible({ baseURL: process.env.LLM_URL, model: process.env.LLM_MODEL ?? 'gpt-4o-mini' })
  : null;

const demo = scriptedProvider((req) => {
  const last = req.messages[req.messages.length - 1];
  const text = String(last?.content ?? '');
  if (last?.role === 'tool') {
    return [{ type: 'text-delta', text: 'Here is the weather card.' }, { type: 'done' }];
  }
  if (last?.role === 'user' && /weather/i.test(text)) {
    return [
      { type: 'text-delta', text: 'Checking the weather' },
      { type: 'tool-call', id: 'call_1', name: 'example-weather', input: { city: 'Lisbon' } },
      { type: 'done' },
    ];
  }
  return [{ type: 'text-delta', text: 'How can I help?' }, { type: 'done' }];
});

export default defineAgent({ model: live ?? demo, instructions: './instructions.md' });
```

Three things the first draft left for the reader to discover, each of which would
have stopped them:

- **`OPENAI_API_KEY` was never named.** `providers/openai-compatible.ts` reads it,
  and the auth header is only sent when a key resolves — which is why a local
  runtime needs none. "Set LLM_URL" alone is not the path to a hosted model.
- **The snippet stopped at `const live = ... : null`** and never showed the
  scripted branch or the `defineAgent` line, so it was not copyable.
- **Anthropic is shipped and reachable**, and getting there is an import swap. One
  sentence, in the file, beats a reader concluding it is not supported.

So "two lines away" was wrong in both directions: reaching a hosted model is
**zero lines of code and two or three environment variables**, and reaching the
other shipped provider is a small edit the file now names.

**Whether `litro dev` loads a `.env` file is not something this spec can assert.**
The `litro` CLI has no loader of its own; Nitro may provide one. An implementer
must check before `AGENT.md` tells anyone to put these in a `.env` rather than in
their shell.

What happens on first run, measured end to end in a production build: the user
asks about the weather, the agent narrates, calls `get-weather` — the spike's
name for what the scaffold calls `example-weather` — and a server-rendered
`<weather-card>` reading `Lisbon / 21°C / sunny` arrives on the session stream.
No key, no network, no configuration.

**What the scripted provider is for**, stated plainly in the generated file so it
is not mistaken for a toy: it is the deterministic stand-in that makes the demo
run with no secret, and it is what the project's own end-to-end test asserts
against — so a fresh clone's test suite is green in CI with no secrets
configured. It branches on the shape of the request, not on a turn counter, for
the reason the playground's comment records: the counter is per provider
instance, which is effectively process-global.

Rejected:

- **`anthropic` or `openai-compatible` as the default.** The measured failure
  above. It also picks a vendor for the user in a file they did not write.
- **Prompting for an API key at create time.** A scaffolder must not collect a
  secret, and the agents page's rule is explicit: put API keys in the
  environment, never in the config file. A key typed at a prompt has to be
  written somewhere.
- **No provider at all, with a `TODO`.** The scaffold would not run, which is the
  state this spec exists to end.

**One thing the generated file must also say, because a default that ships is a
default that deploys.** A `fullstack` project is deployable from the first
commit, and a deployed project with the scripted provider untouched answers every
weather question with Lisbon, 21°C, sunny, forever, with no error and no warning.
That is the right default for a first run and the wrong one for a site with
users, so the comment says so in a line: this provider is for development and
tests; set `LLM_URL` before you deploy, or delete `agents/`.

## 9. Decision 6 — the schema library in the scaffolded tool

Not in the issue, but it cannot be avoided: the tool needs an `input` schema, and
which kind it is decides what a model and an MCP host are told about it.

Measured in the scaffolded project, through `tools/list`:

| The tool's `input` | Published `inputSchema` | Server output |
|---|---|---|
| a hand-rolled Standard Schema | `{ "type": "object" }` | 2216 KB |
| `zod/mini`, as written | `{ "type": "object" }` | 3320 KB |
| `z.object({ city: z.string().trim().min(1).max(80).describe(...) })` | full: `properties.city` with `type`, `minLength`, `maxLength`, `description`, and `required: ["city"]` | 3388 KB |

**Decided: zod.** A scaffold is an example before it is a feature, and the
hand-rolled form teaches the shape that tells a host nothing — the exact gap the
MCP server design named as "the honest first thing to fix" in this repository's
own demo tool. The 1172 KB is a server-side dependency on a project that has
already chosen to run a server, and no client ever downloads it.

Rejected: **a hand-rolled Standard Schema**, as the agents page's example writes
it. It adds no dependency and it is the pattern this repo spent a phase moving
away from. The scaffolded example would model the weaker path.

### 9.1 The follow-up was tried. `zod/mini` is not the lever.

The 1172 KB is accepted, not endorsed — it is nine tenths of the whole cost of
scaffolding an agent for roughly six functions (`object`, `string`, `trim`,
`min`, `max`, `describe`). The obvious candidate was `zod/mini`, the
tree-shakable subset that ships inside the same package (verified: zod 4.6.5's
export map carries `./mini`, `./v4/mini` and `./v4-mini`).

**It was built and measured, not reasoned about.** Two independent results, and
each one alone is disqualifying.

**Result 1 — it publishes nothing useful.** Run through the real
`toolInputJSONSchema`, on zod 4.6.5:

| Schema | `~standard.validate` | `~standard.jsonSchema` | Published |
|---|---|---|---|
| `zod/mini` | `function` | `undefined` | `{"type":"object"}` |
| `zod` | `function` | `{input, output}` | the full typed schema |

`zod/mini` validates and does not convert, so it publishes exactly the
permissive shape zod was chosen to avoid. The conversion is not unavailable —
`zod/mini` does export `toJSONSchema` — and hand-attaching it works:

```ts
schema['~standard'].jsonSchema = { input: () => zm.toJSONSchema(schema) };
// → {"type":"object","properties":{"city":{"type":"string","minLength":1,"maxLength":80}},...}
```

But note what is missing from that output: **no `description`.** `zod/mini`'s
`.check()` chain has no `.describe()`, so the one thing the description was
carrying — the argument contract for a model — is gone. And four lines of glue in
a scaffolded tool defeats "a scaffold is an example first", which is the whole of
decision 6.

**Result 2 — and this is the one that closes it. The saving is 68 KB of 1172 KB,
under 6%.** With the glue attached and the project built: `dist/server` is
3320 KB against 3388 KB. The traced `zod` directory goes from 1172 KB to
1104 KB.

**Because tree-shaking never applies.** Nitro traces `zod` as an external and
copies the package directory; it is not bundled, so a narrower import graph buys
almost nothing. `zod/mini` is a solution to a bundling problem, and this is not
one.

**So the follow-up is answered: no, on this version.** The lever, if anyone wants
the 1172 KB back, is Nitro's externals handling — `externals: { inline: [...] }`
or trace configuration — not a library swap. That is a different piece of work,
on a different package, and nobody has asked for it. Recorded here so it is not
re-attempted from the same wrong end.

## 10. What a new user sees and does

**The target, after v1.** Steps 1, 2 and 5 were executed in the walk-through;
steps 3 and 4 were not. Marked per step, because the first draft claimed all five
were run and that is not what section 3 describes.

| | Step | Evidence |
|---|---|---|
| 1 | `pnpm create @beatzball/litro my-app` — accept the defaults | **run**, from the packed tarball |
| 2 | `cd my-app && pnpm install` | **run**, `--ignore-workspace` against the tarballs |
| 3 | `pnpm dev` | **not run.** The spike built and served a production bundle instead |
| 4 | open `/agent`, type *what is the weather in lisbon?* | **not run.** No chat page was written and no browser was opened |
| 5 | the agent narrates, calls the tool, a server-rendered card appears | **run**, as a POST to the session endpoint: the full event sequence and the card's DSD are quoted in section 3.3 |

**What that means for the plan.** The agent, the tool, `ui()` and the turn are
measured end to end. The two unmeasured steps are both the chat page — the
browser path, under `litro dev`, with `@beatzball/litro-agent/client` in a client
bundle built from a tarball install. That is the one v1 piece carrying no spike
evidence, and section 14 names it as the gap rather than burying it.

Three commands and one sentence typed into a page. No key, no network, nothing
read first.

**Today, for the same result:** four files written from the guide and nine edits
across three existing files, five of them inside a build configuration — thirteen
places to be right — and the first run fails with a raw `TypeError` unless the
reader also knows to swap the provider the guide's example names.

**On v1, to reach a model in an MCP host** — two more steps, both in the
generated `AGENT.md`:

6. `pnpm add -D @modelcontextprotocol/sdk`
7. one entry in the host's configuration naming `litro mcp serve --project`

**No build step on v1.** The first draft listed one here, and that was wrong:
the v1 tool names no app, so nothing has to be packed, and `litro mcp serve`
loads project source through Vite and never touches the build. An implementer
copying that list into the tool's comment would have told users to run a build
they do not need.

**After phase 2** step 6 goes away, because the SDK is already a `devDependency`
— but a build step appears, because the tool then names a packed app. So the
count stays at two for a fresh clone; what changes is that the second thing is
`pnpm build`, which a project runs anyway, instead of an install. Step 7 remains
and always will: no script can edit somebody's host configuration.

**The shape of the result: v1 is five steps, and MCP adds two.** The question
worth asking of any scaffold is whether the path to a working result is short
enough to follow without a guide. v1 is three commands and a sentence typed into
a page; the count grows only at the MCP boundary, and only by an install and a
host entry — which is why that half is a phase of its own rather than a gap.

## 11. What this interacts with

**`--for-repo`: nothing, and that was checked rather than assumed.**
`--for-repo` refuses any recipe not in `starlight`'s lineage, and the agent
option is on `fullstack` alone, so the two can never both apply. The flag
machinery already refuses the combination earlier than that: `assertFlagsApply`
throws for a flag the chosen recipe has no option for, and its reason is the one
that matters here — ignoring an unknown flag silently would let a CI job ask for
something it did not get. `--agent` needs one line in `FLAG_SPELLING` so the
message reads `--agent / --no-agent` rather than `--agent`.

One thing worth stating because somebody will ask: `--for-repo` writes an
`AGENTS.md` at the site root, and an agent lives in `agents/`. Those coexist —
verified on a case-insensitive filesystem, where they are two different names.
(`agents/` and `Agents/` would collide there, but nothing writes the second.)

**`--no-blog`-style removal: there is none, and that is the point.** Decision
4.1.1 inverts the option, so `applyRecipeOptions` gains an `addAgent` branch
beside `removeBlog` rather than a `removeAgent` one. `--no-agent` copies no layer
and runs no step; there is nothing to undo and nothing to assert about what a
layer left behind.

What `addAgent(projectDir)` applies, every edit anchored and asserting its target
exists, in the style `blog.ts` established:

| Edit | If the anchor is missing |
|---|---|
| the five `nitro.config.ts` changes | throw, naming the file and the anchor |
| the two `imports` keys and the two dependencies in `package.json` | throw |
| the `.litro/` rule in `.gitignore` | append; no anchor needed |
| the `/agent` link in `pages/index.ts`, beside the Blog link | throw |
| the agent test in `e2e/index.spec.ts` | throw |

**Every one of them throws, and that is simpler than the removal design could
be.** A remover had to decide, per edit, whether a missing anchor meant "an
overlay legitimately removed this" or "the template was reshaped" — and it cannot
tell the two apart. An adder never faces the question: it runs only on the
adapter and mode where the base template is known to be on disk, so a missing
anchor is always a genuine fault.

One precision, because the first draft got it wrong by analogy:
`dropBlogRoutesFromSpec` is **not** simply tolerant. It returns early when the
spec file is absent and **throws** when `PRERENDERED_ROUTES` is absent. The
agent's `e2e/index.spec.ts` edit copies that exact pair — tolerate a missing
file, throw on a present file with no anchor — and the spec says so rather than
leaving an implementer to read the wrong half.

The rule `blog.ts` carries still applies, inverted: **Nitro's prerenderer crawls
the links it finds.** Here the risk is adding a `/agent` link in a project where
the page was not written — which cannot happen under 4.1.1, since the link and
the page come from the same answer. It is named because it is the failure a
future refactor would reintroduce by splitting them.

**Why the wiring is not left in place unconditionally**, which was considered:
measurement shows it is inert — a build with the wiring and no `agents/` exits 0
and the route answers a clean 404 `Unknown agent: demo`. Tempting, because it
would remove the config edits entirely. Rejected because the wiring imports
`@beatzball/litro-agent/plugin`, so the dependency must stay too, and a project
that answered "no" would carry 2.5 MB on disk and 104 KB of server output it was
promised it would not.

That measurement is still useful, and `AGENT.md` says so: **deleting `agents/` is
a safe way to turn the agent off later** — the build stays green and the endpoint
answers a clean 404 rather than breaking.

## 12. The smallest useful first version

**v1: the `agent` option on `fullstack`, Lit only, default true — an agent, one
`ui()` tool, a chat page, and a turn that works with no key.**

- `recipes/fullstack/options/agent/` holding the six new files of section 5
- `addAgent()` applying the twelve edits of section 5; the Elena gate (1.4) and
  the `ssg` gate (1.5)
- the three `create-litro` changes of section 4.1.2 — the option-keyed layer, the
  `adapters` field on `RecipeOption`, and the adapter and mode reaching
  `resolveRecipeOptions`
- `zod` and `@beatzball/litro-agent` in the generated `dependencies`
- two new variants in `scripts/verify-scaffolded-apps.mjs`, and one new test in
  the template's own `e2e/index.spec.ts`
- `AGENT.md`, carrying the four things of section 5

**No `app:` field, no `mcp-apps/`, no SDK in the dependency list.** The chat path
is where `ui()` is already visible, and it needs no SDK, no packed document and
no host. MCP is one documented install away, not absent.

### Phases after it

Each ships alone.

1. **v1, as above.** `@beatzball/create-litro` changeset.
2. **The MCP half, the three inseparable pieces plus the SDK** (decision 4 and
   section 7.2): `mcp-apps/weather-card.ts`, `app: 'weather-card'` on the tool,
   `litro mcp-app build` folded into the project's `build` script, and
   `@modelcontextprotocol/sdk` as a `devDependency`. Plus a host-configuration
   snippet in `AGENT.md`. It removes the install step, adds a build step, and
   **does add a capability** — the `ui://` document in a host (section 7.2).
   `@beatzball/create-litro` changeset.
3. **An add path for an existing project.** `create-litro` refuses a directory
   that already exists, so there is no way to give an agent to a project someone
   already has — the only path is to scaffold a new one and move files.
   `@beatzball/litro` changeset if it lands as `litro add agent`; otherwise
   `@beatzball/create-litro`.
4. **Docs.** The agents page's Setup section rewritten so scaffolding is the first
   path and the hand wiring is the second; the Known Gaps entries for "does not
   scaffold an agent" and the agent row of the recipe table removed; the sequence
   of section 10 on Getting Started.

   **No changeset.** Phase 4 touches `packages/docs-content/` and the docs sites,
   and every docs package is on the changesets ignore list. The first draft said
   each phase carries one `@beatzball/create-litro` changeset, which would have
   made this phase name an ignored package or invent a change it did not make.

### Which phase closes issue 216

**Phase 4 closes it. v1 does not, and the spec should not pretend otherwise.**

The issue's "done when" has three lines, and v1 satisfies one and a half:

| "Done when" | v1 |
|---|---|
| a new project reaches a working agent and a model-callable tool without reading the agents guide | **yes** |
| `verify-scaffolded-apps.mjs` covers the new variant | **yes**, two variants (section 14) |
| the agents guide's "wire it by hand" section becomes the manual alternative, not the only path | **no** — that is a docs change, and it is phase 4 |

So phases 1 and 4 together close the issue, and phases 2 and 3 are beyond it.

**Phase 3 is not required by the issue.** The first draft claimed the third
"done when" line "really requires" an add path. Reading it again: the line is
literally about the guide's framing, which phase 4 does, and the issue says
nothing about existing projects. Phase 3 is a good idea that this issue did not
ask for, so it should be its own issue rather than a reason to hold 216 open.
The first draft also called it "the largest piece of the four" with no sizing
behind it; it is unsized, and that is all that can honestly be said.

## 13. What could go wrong

Every row marked *measured* was run on 2026-10-02, in the scaffolded project.

| Case | What happens | What the design must do |
|---|---|---|
| **An agent in a static build** | *measured:* `litro generate` exits 0, logs `Registered 1 agent`, emits no endpoint, warns nothing | **three things, because there are three ways in.** Keep the option off `ssg` recipes (1.3); refuse `--agent --mode ssg` (1.5); and for a project that later runs `litro generate` anyway, say so in `AGENT.md`. The underlying bug is [issue 228](https://github.com/beatzball/litro/issues/228) and no phase here fixes it |
| **`agents/` deleted, wiring left behind** | *measured:* build exits 0; the route answers `{"name":"AgentError","message":"Unknown agent: demo","status":404}` | nothing to fix. `AGENT.md` documents it as the supported way to turn the agent off |
| **A provider that needs a key** | *measured:* raw `TypeError`, status 500, on the session stream to the browser | the scripted default (decision 5). A live provider is opt-in through the environment, and section 8 names every variable. It is the *provider* that needs the key, not the tool — the tool has no network call at all |
| **The scripted provider reaches production** | not measured; it follows from the default | a deployed project with the default untouched answers every weather question `Lisbon / 21°C / sunny`, with no error. Decision 5 puts a line in the generated file: development and tests only, set `LLM_URL` before deploying, or delete `agents/` |
| **`zod` missing from the generated `package.json`** | the tool's `import { z } from 'zod'` does not resolve under pnpm; a fresh project fails at build | section 5 adds it to `dependencies` explicitly. `@beatzball/litro-agent` ships no schema library, deliberately |
| **`app:` with nothing packed** | *measured:* clear startup failure naming `litro mcp-app build` | why `app:`, `mcp-apps/` and the pack step ship together or not at all (section 7.2) |
| **No MCP SDK** | *measured:* clear startup failure naming the install | acceptable as one documented step in v1 |
| **Elena** | `ui()` throws: `ui(): the "elena" renderer is deferred past v0.` | refuse `--agent` with `--adapter elena` before writing anything (decision 1.4) |
| **A tool name collides inside a host** | not measured here, but recorded already: two servers registering `get-weather` made a host pick one silently, with no way to tell which answered | **settled by decision 7:** the generated tool is `example-weather`, and names are never prefixed. The collision is real and it is the host's to resolve |
| **Scaffolding into an existing project** | `create-litro` refuses an existing directory outright, before anything is written | correct today, and the reason phase 3 exists. v1 must not pretend to be an add path |
| **`--mode ssg` with the agent** | the silent static failure above, reached through the recipe's own prompt | refused before anything is written (decision 1.5) |
| **`.litro/` not ignored** | session logs are conversation data | the `.gitignore` edit is part of v1, not a docs note |
| **A name collision on disk** | `agents/` beside `AGENTS.md` is fine — *verified* on a case-insensitive filesystem | nothing |
| **A reshaped template silently half-adding the agent** | this is what `blog.ts` was written against, inverted | every `addAgent()` edit asserts its anchor and throws (section 11), and the scaffolding check builds both answers |
| **An Elena scaffold hitting the agent path** | the first draft's `removeAgent()` would have thrown here, breaking a live variant | the option is additive and gated, so Elena's scaffold is unchanged byte for byte (4.1.1, 4.4) |

## 14. How each phase is verified

The rule this repository already paid for (TEST-005): a check that claims to test
what a user gets packs the tarballs and reads rendered output, because the
workspace symlink hides packaging faults and a green build hides a dropped value.

**v1, in CI, in `scripts/verify-scaffolded-apps.mjs`** — two new variants beside
the nine that exist:

- `fullstack:lit:agent` (`--agent`): the build registers one agent; the built
  server contains the `/__litro/agent/` route;
  `agents/demo/tools/example-weather.ts` and `AGENT.md` are on disk; **both
  `@beatzball/litro-agent` and `zod` are in `package.json`**; the rendered home
  page links `/agent`.
- `fullstack:lit:no-agent` (`--no-agent`): no `agents/`, no `pages/agent.ts`, no
  `AGENT.md`, **neither `@beatzball/litro-agent` nor `zod`** in `package.json`,
  no `/agent` anywhere in the rendered home page — the prerender-crawl trap of
  section 11 — and the build still green.

**The `zod` assertion is not padding.** It is the one finding in this spec that
would otherwise reach a user as a build failure in a brand-new project, and the
`no-agent` half catches the mirror mistake of leaving zod behind.

**The existing `fullstack:elena` variant is the third thing this must prove**,
and it needs no new variant: it already exists, and under 4.1.1 it must come out
byte-identical to today's. A plan should diff it against the current output once,
because "unchanged" is the entire safety argument for the Elena gate.

**v1, in the generated project's own `e2e/index.spec.ts`:** one test that opens
`/agent`, waits for `litro-outlet[data-litro-settled]` before touching anything
(TEST-001), asks about the weather, and asserts that the card's text — not the
element, the text — reaches the page. The scripted provider is what makes this
deterministic with no secret.

### 14.1 The scaffolding check does not start a server, and the claim is split

**Decided: `verify-scaffolded-apps.mjs` stays a build-and-read check.** Teaching
it to boot a server and drive a turn is new machinery in a script that is
deliberately dependency-free, and the script's own reason for existing is
narrower than that: it exists because a build can exit 0 and emit a dead site.

So the claim is split, and both halves are written down so nobody later reads
one as the other:

| What proves it | What it proves |
|---|---|
| `verify-scaffolded-apps.mjs`, in CI | the app **builds** from packed tarballs and the agent wiring is **present** — the route in the server bundle, the files on disk, the dependency in `package.json`, no dead `/agent` link after `--no-agent` |
| the generated project's own Playwright suite | a **turn runs**: the page, the tool call, the card's text |

**The weakness, stated plainly: nothing in this repository's CI runs a generated
project's own suite.** So "a scaffolded turn works" is checked by the template's
test only when someone runs it, and in CI the strongest standing claim is "it
builds and the wiring is there". That is a real hole and it is the honest price
of not putting a server into the check. If it ever needs closing, the cheaper
route is a single Node assertion against the built server — a POST with a seroval
body, as section 3.2 describes — rather than a Playwright run inside a scaffold.

**Phase 2:** the SDK's own in-memory or stdio client against the scaffolded
project, asserting `tools/list` carries `_meta.ui.resourceUri`, `resources/list`
carries the packed document, and `tools/call` returns `structuredContent`. Then
once, by hand, in a desktop host over stdio — the transport a person actually
starts with and the one no script here can drive (AGENT-012).

**Phase 3:** the add path run against each of the four recipes and a project with
an agent already in it, which is the case that has no right answer yet.

**Phase 4:** the docs build, `litro docs check` passes, and
`node scripts/check-doc-refs.mjs` still passes with the Known Gaps entries
removed.

## 15. Decision 7, and where the other four live

The first draft carried five open questions. All five are settled. **Four of them
are settled in the sections that already argue them**, and repeating them here
gave one decision two numbers, and a later section cited both of them for one
thing. So this section holds the one decision with no home of its own, and
points at the rest:

| Settled | Where it is argued |
|---|---|
| v1 ships no MCP half; the SDK is one install away | **decision 4** — sections 7, 7.1, 7.2 |
| zod, and the `zod/mini` follow-up | **decision 6** — sections 9, 9.1 |
| the scaffolding check does not start a server | **section 14.1** |
| no docs-recipe agent for now | **decision 1.3**, and the note below |
| the generated tool's name | **decision 7**, below |

**On the docs-recipe question**, one thing from section 1.3 is worth repeating
because it is the part that keeps the idea alive: `litro mcp serve` should work on
a static project, since it loads project source through Vite and never touches
the build. An agent that exists only for an MCP host, on a statically hosted docs
site, is therefore coherent — the tools answer a host over stdio while the site
is files on a CDN. **That was read from the CLI's source, not measured**; no
static project appears in the section 7 table. Nobody has asked for it, so it is
not built, but a future reader starts from here rather than from scratch.

### Decision 7 — the generated tool is `example-weather`, and names are never prefixed

Two parts, and they are independent.

**No prefixing.** `design/specs/2026-09-24-mcp-server.md` ruled against it
deliberately, and that ruling stands. A prefix would make a tool's MCP name
differ from the name the same tool has in the chat loop, and the specification
says a client aggregating tools from several servers **SHOULD** disambiguate —
that is the client's job, not the server's.

**The generated tool is named `example-weather`.** The collision is real: tool
names are global to a host, and two servers both registering `get-weather` made a
host pick one silently with no way to tell which had answered. Every scaffolded
project shipping the same generic name guarantees that bug the moment somebody
configures two of them.

`example-weather` reduces it without touching the naming rule, and it does a
second job: the name tells a reader this is scaffolding to replace, not a tool to
build on. `AGENT.md` says the rule out loud too — a tool name is global to a
host — so the first rename is informed rather than accidental.

Rejected: **naming the tool from the project** (`my-app-weather`). It is a prefix
by another spelling, so it reopens a decision already made, and it makes the
scaffolded example model the thing the naming rule forbids.

**Where the collision was recorded**, since this spec cites it twice: the MCP
server design's phase 4 notes it, from a desktop-host check in which the
hand-written rig and `litro mcp serve` both registered `get-weather` and the host
silently served one of them. It is a naming rule a user has to know, not a bug in
either server. This spec takes it as reported and did not re-run it.
