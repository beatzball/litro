# Design: scaffold an agent

Status: Draft

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
of the docs cannot see. Everything below was run on 2026-10-02 against packed
tarballs, not workspace symlinks (TEST-005) — the path a real user is on.

```
scaffold   fullstack, Lit, SSR, from the packed @beatzball/create-litro tarball
install    pnpm install --ignore-workspace, against the packed tarballs
wire       by hand, following the Setup section of the agents guide
build      litro build
drive      POST /__litro/agent/demo/<session>
```

### 3.1 What the hand wiring actually is

**Four new files**, none of which the guide supplies as a copyable whole:

| File | What it is | Lines |
|---|---|---|
| `agents/demo/agent.ts` | `defineAgent` plus a provider | 7 |
| `agents/demo/instructions.md` | the system prompt | 2 |
| `agents/demo/tools/get-weather.ts` | `defineTool` plus a `ui()` return | 35 |
| `src/components/weather-card.ts` | the component `ui()` renders | 20 |

**Eight edits across three files that already exist:**

| File | Edits |
|---|---|
| `nitro.config.ts` | import the plugin; a POST handler entry; a GET handler entry; call the plugin in `build:before`; a `routeRules` entry — five |
| `package.json` | `#litro/agent-manifest`; `#litro/agent-config`; the dependency — three |
| `.gitignore` | `.litro/` — one |

The guide gets all of this right. The cost is not that it is wrong; it is that
there are twelve places to be right, four of them in a build configuration, and
nothing checks the result until a turn either runs or does not.

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
with no agent endpoint in it. No warning anywhere. This decides which recipes may
offer the option (decision 1).

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

Four builds of the same project, `du -sk dist/server`:

| What the project has | `dist/server` | Delta |
|---|---|---|
| `fullstack`, no agent at all | 2096 KB | — |
| the agent wiring, with `agents/` deleted | 2200 KB | +104 KB |
| an agent and a `ui()` tool, hand-rolled schema | 2216 KB | +120 KB |
| the same, with a zod schema | 3388 KB | +1292 KB |

Two facts fall out, and both are load-bearing later:

- **`ui()` is nearly free.** The renderer is already in a `fullstack` server
  graph, because the recipe server-renders its pages with it. An agent that
  returns a component costs 16 KB more than one that returns a plain object.
- **The schema library is the expensive choice.** zod traces 1172 KB into the
  server output. That is nine tenths of the whole cost of scaffolding an agent.

Installed sizes, for the same reason: `@beatzball/litro-agent` is a 408 KB
tarball and 2.5 MB installed; `@modelcontextprotocol/sdk` is 6.0 MB installed;
zod is 8.0 MB installed.

## 4. Decision 1 — an option on `fullstack`, and only on `fullstack`

### 4.1 An option, not a recipe of its own

There is a precedent either way, which is why the issue leaves it open.
`supernova` is a recipe that `extends` another, and it also carries an option.
Both were read end to end before choosing.

**Recommendation: an option on an existing recipe.**

```ts
options: [
  { key: 'agent', prompt: 'Include an agent?', type: 'confirm', default: true },
],
```

The reason is the thing the measurement in section 3.4 made possible. A recipe of
its own, or an additive template layer, can only **overwrite** a file — the layer
system copies whole trees, later layers winning. An agent needs five changes
*inside* `nitro.config.ts`, so either route means shipping a second complete copy
of that file, which then has to be kept in step with the base's by hand, forever.
This repository has already paid that bill twice and written both down: the
supernova template re-ships `pages/index.ts`, and `--for-repo` writes its own
`starlight.config.js`, where the scaffolding check records that "every navigation
fix has to be made twice". A silent drift is worse than a loud assertion.

The option route has the opposite failure mode. Removal is an anchored edit that
asserts its target exists, exactly as `blog.ts` does, so a reshaped template
fails the scaffold instead of emitting a half-wired app.

Rejected:

- **A recipe of its own (`agent`, or `fullstack-agent` extending `fullstack`).**
  Two copies of `nitro.config.ts` to keep in step. It also spends the one
  `extends` level the scaffolder allows, which `supernova` has already spent on
  `starlight` — so the same idea could never reach the docs recipes. And it makes
  the headline `--recipe agent` rather than the bare create command.
- **A new additive layer keyed on an option (`template-agent/`).** Small to build
  — about ten lines in the layer loop in `scaffold.ts` — but it inherits the same
  overwrite-only limit, so it buys nothing an option does not, and it adds a
  third override axis to a system whose own types say "ONE LEVEL ONLY, because a
  three-deep override order is a thing nobody can hold in their head".

### 4.2 Default true

**Recommendation: `default: true`.** The point of the work is that
`pnpm create @beatzball/litro my-app`, with every default accepted, reaches an
agent. A default of `false` turns the sentence into *an agent is a command and a
flag away*, which is a smaller claim and not the one the landing page wants.

The cost is honest and small: a project that wants no AI carries a 2.5 MB
development dependency and 120 KB of server output until it answers `n`, or
passes `--no-agent`, or deletes `agents/`.

### 4.3 Which recipes offer it: one

| Recipe | Offer the option? | Why |
|---|---|---|
| `fullstack` | **yes** | `mode: 'both'`, defaults to a server build, and already ships `server/api/` and Server Actions. An agent is a POST endpoint; this is the only recipe whose shape is a server. |
| `starlight` | **no** | `mode: 'ssg'`. Measured: an agent in a static build exits 0, logs that it registered, and emits no endpoint. The option would scaffold something that cannot run, silently. |
| `supernova` | **no** | `mode: 'ssg'`, same as above. Also `adapters: ['lit']` and `extends: 'starlight'`, so it is the most constrained recipe in the set and the least suited to gaining a second one. |
| `11ty-blog` | **no** | `mode: 'both'`, so it *could*. But it is a blog: nothing on it wants a tool, and a second recipe doubles the scaffolding-check matrix for no story a reader would recognize. |

A docs site that wants an agent is not blocked by this. It is a one-line change
to a recipe's config once `mode: 'ssg'` is no longer the shape of the site, and
`litro mcp serve` works on a static project regardless — it loads project source
through Vite and never touches the build.

### 4.4 Lit only, inside a recipe that also reaches Elena

`fullstack` declares `adapters: ['lit', 'elena']`. `ui()` throws on Elena —
`ui(): the "elena" renderer is deferred past v0.` — and will not be built
(issue 219, which also deprecates the adapter). A scaffolded Elena agent whose
one tool returns a component would therefore throw on its first tool call.

**Recommendation: with `--adapter elena`, the agent option defaults to `false`
and is not prompted; an explicit `--agent` is refused before anything is
written.** The refusal names the adapter and the issue, in the style of
`assertAdapterSupported`, which already refuses an adapter a recipe does not
declare and does it before the target directory exists.

Rejected: **scaffolding an Elena agent with a plain-object tool instead of a
`ui()` one.** It would make the one scaffolded example of Litro's most
distinctive capability conditional on an adapter that is being removed, and it
would add a second tool file to maintain for an adapter with no future.

FAST needs nothing here: it is not on `fullstack` at all, so there is no FAST
agent to write in v1. When FAST reaches `fullstack` (issue 172), the tool's
template gains a FAST variant — a string template with kebab-case attributes, per
the authoring rule on the agents page.

## 5. Decision 2 — what it produces, named exactly

In a `fullstack` + Lit project called `my-app`, answering yes:

```
my-app/
  agents/
    demo/
      agent.ts                  defineAgent; the scripted provider, with an env switch
      instructions.md           the system prompt, inlined at build time
      tools/
        get-weather.ts          defineTool; returns ui(<weather-card>)
  pages/
    agent.ts                    the chat page, route /agent
  src/components/
    weather-card.ts             the component ui() renders
```

And these edits to files the recipe already ships:

| File | Change |
|---|---|
| `nitro.config.ts` | `import agentsPlugin from '@beatzball/litro-agent/plugin'`; two static handler entries for `/__litro/agent/:agent/:session` (POST and GET); `await agentsPlugin(nitro)` in `build:before`, after the actions plugin; a `no-store` rule for `/__litro/agent/**` |
| `package.json` | `imports` gains `#litro/agent-manifest` and `#litro/agent-config`; `dependencies` gains `@beatzball/litro-agent` |
| `.gitignore` | `.litro/` — session logs are conversation data |
| `pages/index.ts` | one `<litro-link href="/agent">` beside the existing Blog link |
| `e2e/index.spec.ts` | one test that drives a turn on `/agent` |

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
section 8 say why.

## 6. Decision 3 — yes, a `ui()` tool with a real component

This is the decision the issue calls the one that matters most, and the
measurement in section 3.4 settles it rather than taste.

**Recommendation: ship the `ui()` tool and its component.**

- **It costs 16 KB.** An agent whose tool returns a plain object is 2200 KB of
  server output; the same agent returning `ui(html\`<weather-card ...>\`)` is
  2216 KB. The `@lit-labs/ssr` renderer is already in a `fullstack` server graph
  because the recipe server-renders its pages with it, so `ui()` adds a call site
  and not a dependency. The "more to generate" worry is one 20-line component.
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
phase.** It saves 16 KB and one file, and it removes the only reason the feature
is interesting. "Minimal" would be the right instinct if `ui()` were expensive;
it is not.

Rejected: **shipping the packed `ui://` document in v1 as well.** That is the MCP
host's view of the same component, and it is a different cost. Decision 4.

## 7. Decision 4 — `litro mcp serve` in the scaffolded project

Measured, in the hand-wired project, in three states.

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

**Recommendation for v1: the scaffolded tool names no app, and the SDK is not
installed.** `litro mcp serve` then needs one documented command, and nothing in
the project is broken before it is run.

The reasoning is that the three pieces of the MCP half are all-or-nothing:

- Ship `app:` without `mcp-apps/` → startup failure out of the box.
- Ship `mcp-apps/` and `app:` without packing → startup failure until someone
  runs a build.
- Pack at create time → a scaffolder that runs a bundler, which nothing in
  `create-litro` does and which would need the project's dependencies installed
  first.
- Ship the SDK to make the one command unnecessary → 6.0 MB installed in every
  scaffolded project, for a feature most will not reach.

**Phase 2 ships all four together**: `mcp-apps/weather-card.ts`, the `app:`
field, `@modelcontextprotocol/sdk` as a `devDependency`, and
`litro mcp-app build` folded into the project's `build` script so a `pnpm build`
packs the document. A fresh clone that has not built still meets the measured
startup message, which names the command — that is the acceptable residue, and it
is why phase 2 is a phase rather than part of v1.

Rejected: **a `--mcp` flag in v1.** It is a second option, a second removal path
and two more scaffolding-check variants, for an audience of one. Phase 2 can make
it the default, or add the flag then, with the measured first-run behavior in
hand.

## 8. Decision 5 — the scripted provider, with a two-line switch

A new project has no API key. Measured, in section 3.2: the guide's own
`openaiCompatible` example with no `LLM_URL` set fails on the first turn with a
raw `TypeError` and a 500, streamed to the browser.

**Recommendation: the scripted provider is the default, and a live one is two
lines away.** This is what `playground/agents/demo/agent.ts` already does, and
the generated file is a shortened version of it:

```ts
// A new project has no API key, so the default provider is the scripted one:
// the agent answers, calls its tool and renders a card with no network and no
// key. Set LLM_URL (and LLM_MODEL) to point it at a real model instead.
const live = process.env.LLM_URL
  ? openaiCompatible({ baseURL: process.env.LLM_URL, model: process.env.LLM_MODEL ?? 'gpt-4o-mini' })
  : null;
```

What happens on first run, measured end to end in a production build: the user
asks about the weather, the agent narrates, calls `get-weather`, and a
server-rendered `<weather-card>` reading `Lisbon / 21°C / sunny` arrives on the
session stream. No key, no network, no configuration.

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

## 9. Decision 6 — the schema library in the scaffolded tool

Not in the issue, but it cannot be avoided: the tool needs an `input` schema, and
which kind it is decides what a model and an MCP host are told about it.

Measured in the scaffolded project, through `tools/list`:

| The tool's `input` | Published `inputSchema` | Server output |
|---|---|---|
| a hand-rolled Standard Schema | `{ "type": "object" }` | 2216 KB |
| `z.object({ city: z.string().trim().min(1).max(80).describe(...) })` | full: `properties.city` with `type`, `minLength`, `maxLength`, `description`, and `required: ["city"]` | 3388 KB |

**Recommendation: zod.** A scaffold is an example before it is a feature, and the
hand-rolled form teaches the shape that tells a host nothing — the exact gap the
MCP server design named as "the honest first thing to fix" in this repository's
own demo tool. The 1172 KB is a server-side dependency on a project that has
already chosen to run a server.

Rejected: **a hand-rolled Standard Schema**, as the agents page's example writes
it. It adds no dependency and it is the pattern this repo spent a phase moving
away from. If the 1.2 MB is judged too much, the honest alternative is the
hand-rolled form plus the argument spelled out in the `description`, which is
what the page already documents — but then the scaffolded example models the
weaker path.

This is a genuine fork and it is in the report.

## 10. What a new user sees and does

**The target, after v1.** Measured as achievable — every step below was executed
in the walk-through, with the hand wiring standing in for what the scaffolder
would write.

1. `pnpm create @beatzball/litro my-app` — accept the defaults
2. `cd my-app && pnpm install`
3. `pnpm dev`
4. open `/agent`, type *what is the weather in lisbon?*
5. the agent narrates, calls `get-weather`, and a server-rendered card appears

Three commands and one sentence typed into a page. No key, no network, nothing
read first.

**Today, for the same result:** four files written from the guide, eight edits
across three existing files, five of them inside a build configuration — and the
first run fails with a raw `TypeError` unless the reader also knows to swap the
provider the guide's example names.

**After phase 2, to reach a model in an MCP host:** `pnpm build`, then one entry
in the host's configuration naming `litro mcp serve` and `--project`. Two more
steps, one of which no script can take for anyone.

**That the sequence is five steps and not more is the finding.** The brief asks
whether more than a few steps is itself a result; v1 is three commands, and the
MCP half is where the count grows — which is the reason it is a phase of its own
rather than part of v1.

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

**`--no-blog`-style removal: a new `removeAgent()`, built the way `removeBlog`
is.** `applyRecipeOptions` is the single place that acts on an answer, and a new
branch for `agent === false` calls into a new `src/agent.ts`. What it must undo:

| Undo | Tolerant of absence? |
|---|---|
| delete `agents/` | no — assert it existed |
| delete `pages/agent.ts` and `src/components/weather-card.ts` | no |
| remove the `/agent` link from `pages/index.ts` | no |
| remove the agent test from `e2e/index.spec.ts` | yes, as `dropBlogRoutesFromSpec` is |
| remove the five `nitro.config.ts` changes | no — and each anchored, not a regex over the file |
| remove the two `imports` keys and the dependency from `package.json` | no |
| leave `.gitignore` alone | — a stray `.litro/` rule is harmless |

The rule `blog.ts` already carries applies here and is the one most likely to be
missed: **Nitro's prerenderer crawls the links it finds.** A `/agent` link left
in `pages/index.ts` after `--no-agent` makes a static build render a page that
was deleted, and the scaffolding check is what caught the same mistake for the
blog.

**The alternative that was considered and rejected:** leaving the
`nitro.config.ts` wiring in place on `--no-agent`, since measurement shows it is
inert — a build with the wiring and no `agents/` exits 0 and the route answers a
clean 404 `Unknown agent: demo`. It is tempting because it removes the riskiest
part of the removal. It is wrong because the wiring imports
`@beatzball/litro-agent/plugin`, so the dependency has to stay too, and a project
that answered "no" would carry 2.5 MB and 104 KB it was promised it would not.

That same measurement is useful elsewhere, though, and the generated project
should say so: **deleting `agents/` is a safe way to turn the agent off later.**

## 12. The smallest useful first version

**v1: the `agent` option on `fullstack`, Lit only, default true — an agent, one
`ui()` tool, a chat page, and a turn that works with no key.**

- `agents/demo/` with the scripted-provider agent, its instructions, and one
  `get-weather` tool returning `ui()`
- `src/components/weather-card.ts` and `pages/agent.ts`
- the twelve edits of section 5, written by the template rather than by hand
- `removeAgent()` for `--no-agent`, and the Elena refusal
- two new variants in `scripts/verify-scaffolded-apps.mjs`, and one new test in
  the template's own `e2e/index.spec.ts`

No MCP anything. The chat path is where `ui()` is already visible, and it needs
no SDK, no packed document and no host.

### Phases after it

Each ships alone, and each carries one `@beatzball/create-litro` changeset.

1. **v1, as above.**
2. **The MCP half, all four pieces together** (decision 4):
   `mcp-apps/weather-card.ts`, `app: 'weather-card'` on the tool,
   `@modelcontextprotocol/sdk` as a `devDependency`, and `litro mcp-app build`
   folded into the project's `build` script. Plus a host-configuration snippet in
   the generated project, naming `litro mcp serve --project`.
3. **An add path for an existing project.** `create-litro` refuses a directory
   that already exists, so there is no way to give an agent to a project someone
   already has — the only path is to scaffold a new one and move files. This is
   what the issue's "the wire-it-by-hand section becomes the manual alternative,
   not the only path" really requires, and it is the largest piece of the four. It
   would carry a `@beatzball/litro` changeset if it lands as `litro add agent`.
4. **Docs.** The agents page's Setup section rewritten so scaffolding is the first
   path and the hand wiring is the second; the Known Gaps entries for "does not
   scaffold an agent" and the agent row of the recipe table removed; the sequence
   of section 10 on Getting Started.

## 13. What could go wrong

Every row marked *measured* was run on 2026-10-02, in the scaffolded project.

| Case | What happens | What the design must do |
|---|---|---|
| **An agent in a static build** | *measured:* `litro generate` exits 0, logs `Registered 1 agent`, emits no endpoint, warns nothing | keep the option off `ssg` recipes (decision 1.3). If `fullstack` is built with `LITRO_MODE=static`, the agent is dead the same way — the generated project must say so where the user will read it |
| **`agents/` deleted, wiring left behind** | *measured:* build exits 0; the route answers `{"name":"AgentError","message":"Unknown agent: demo","status":404}` | nothing to fix. Document it as the supported way to turn the agent off |
| **A tool that needs a key** | *measured:* raw `TypeError`, status 500, on the session stream to the browser | the scripted default (decision 5). A live provider is opt-in through the environment |
| **`app:` with nothing packed** | *measured:* clear startup failure naming `litro mcp-app build` | why the MCP pieces ship together or not at all (decision 4) |
| **No MCP SDK** | *measured:* clear startup failure naming the install | acceptable as one documented step in v1 |
| **Elena** | `ui()` throws: `ui(): the "elena" renderer is deferred past v0.` | refuse `--agent` with `--adapter elena` before writing anything (decision 1.4) |
| **A tool name collides inside a host** | not measured here, but recorded already: two servers registering `get-weather` made a host pick one silently, with no way to tell which answered | every scaffolded project would ship `get-weather`. Either the generated tool is named from the project, or the generated host snippet names the server distinctly and the docs state the rule. This needs a ruling — see the report |
| **Scaffolding into an existing project** | `create-litro` refuses an existing directory outright, before anything is written | correct today, and the reason phase 3 exists. v1 must not pretend to be an add path |
| **`.litro/` not ignored** | session logs are conversation data | the `.gitignore` edit is part of v1, not a docs note |
| **A name collision on disk** | `agents/` beside `AGENTS.md` is fine — *verified* on a case-insensitive filesystem | nothing |
| **A reshaped template silently half-removing the agent** | this is what `blog.ts` was written against | every `removeAgent()` edit asserts its target, and the scaffolding check builds both answers |

## 14. How each phase is verified

The rule this repository already paid for (TEST-005): a check that claims to test
what a user gets packs the tarballs and reads rendered output, because the
workspace symlink hides packaging faults and a green build hides a dropped value.

**v1, in CI, in `scripts/verify-scaffolded-apps.mjs`** — two new variants beside
the nine that exist:

- `fullstack:lit:agent` (`--agent`): the build registers one agent; the built
  server contains the `/__litro/agent/` route; `agents/demo/tools/get-weather.ts`
  is on disk; `@beatzball/litro-agent` is in `package.json`; the rendered home
  page links `/agent`.
- `fullstack:lit:no-agent` (`--no-agent`): no `agents/`, no `pages/agent.ts`, no
  `@beatzball/litro-agent` in `package.json`, no `/agent` anywhere in the
  rendered home page — the prerender-crawl trap of section 11 — and the build
  still green.

**v1, in the generated project's own `e2e/index.spec.ts`:** one test that opens
`/agent`, waits for `litro-outlet[data-litro-settled]` before touching anything
(TEST-001), asks about the weather, and asserts that the card's text — not the
element, the text — reaches the page. The scripted provider is what makes this
deterministic with no secret.

**The open question this raises**, and it belongs in the report: the scaffolding
check builds apps and never starts one. Asserting that a *turn* works, rather
than that the route compiled, means teaching it to run a server. That is new
machinery in a script that is deliberately dependency-free. The alternative is to
split the claim — the check proves the app builds and the wiring is present, and
the template's own Playwright suite proves a turn runs — which is weaker, because
nothing in this repository's CI would run the template's suite.

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

## 15. Open questions

These could not be settled by reading or by the walk-through.

1. **Whether v1 includes the MCP half.** The spec says no, and names the 6.0 MB
   SDK and the "needs a build first" failure as the reasons. The counter-argument
   is real: the packed `ui://` document in an MCP host is the single most
   striking thing Litro does, and a phase 2 may be a long way off. A ruling,
   not a spike.
2. **zod or a hand-rolled schema in the generated tool.** zod publishes a real
   `inputSchema` and costs 1172 KB of server output; the hand-rolled form costs
   nothing and publishes `{ type: 'object' }`. Section 9 recommends zod.
3. **Whether the generated tool keeps a generic name.** `get-weather` is global
   to an MCP host, and every scaffolded project would ship it. Naming it from the
   project is kinder to anyone running two; keeping it generic matches the
   playground and every example in the docs.
4. **Whether `verify-scaffolded-apps.mjs` learns to start a server.** Section 14.
   Without it, nothing in CI proves a scaffolded turn runs.
5. **Whether a docs recipe should ever offer an agent.** Decision 1.3 says no
   because `mode: 'ssg'` makes the endpoint unreachable — but `litro mcp serve`
   works on a static project, because it loads source through Vite and never
   touches the build. An agent that exists only for an MCP host, on a static
   site, is coherent and nobody has asked for it.
