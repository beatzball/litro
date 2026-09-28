---
title: Known Gaps
description: What Litro does not do yet — the missing capabilities, what each one costs you, and the workaround where one exists.
date: 2026-09-27
---

# Known Gaps

This page lists what Litro **does not** do. It is written for someone deciding
whether Litro fits a project, so each entry says what you would reasonably
expect, what you get instead, and what the workaround costs.

Nothing here carries a date or a promise. "Not built" means not built.

Two kinds of limitation live in two places, on purpose:

- **Authoring rules** — things you meet while writing a component, an action or
  an OG template, where the fix is local to the code in front of you. Those stay
  on the feature's own page, and this page links to them.
- **Missing capability** — a thing Litro has no answer for. Those live here.

---

## Starting a project

### `create-litro` does not scaffold an agent

Every recipe scaffolds pages, a server and a build. **None of them scaffolds an
agent.** `pnpm create @beatzball/litro` gives you the web half of Litro only.

Wiring the AI half is a hand edit of **three files, six to nine changes**,
reproduced in full under [Agents → Setup](/docs/agents#setup): two static route
handlers and a `build:before` hook in `nitro.config.ts`, an `imports` block in
`package.json`, two `.gitignore` entries, and two more handler entries if you
also want the MCP HTTP route.

**Workaround:** follow the setup section exactly. It is tested — `playground/`
carries the same wiring. The cost is that the three-command story in
[Getting Started](/docs/getting-started) does not reach an agent, and an
upgrade that changes the wiring is a manual migration.

Tracked in [issue 216](https://github.com/beatzball/litro/issues/216).

### `fullstack` plus Elena writes a dead Server Actions file

`--recipe fullstack --adapter elena` scaffolds `actions/demo.server.ts` and then
leaves it **unwired and uncalled**. The Elena overlay replaces `nitro.config.ts`
and `vite.config.ts` with versions that contain no action plugin, and replaces
`pages/index.ts` with a page that never calls the action. Nothing warns you.

The Lit build of the same recipe wires Server Actions correctly. Elena is the
only adapter where the file is scaffolded without the plumbing that runs it.

**Workaround:** delete `actions/demo.server.ts`, or add the action plugin to
both config files yourself by copying the Lit template's versions. This will not
be wired up — the Elena adapter is
[deprecated](#elena-is-deprecated-and-is-removed-in-v1).

### No recipe scaffolds a sitemap, OG images or an agent

| | fullstack | starlight | supernova | 11ty-blog |
|---|---|---|---|---|
| Agent | no | no | no | no |
| Server Actions | Lit only | no | no | no |
| OG images | no | no | no | no |
| Sitemap route | no | no | no | no |

Each is documented and each works, but you add it by hand to a scaffolded app.

### `supernova` is Lit-only

The supernova recipe declares `lit` and no other adapter. Asking for
`--adapter fast` or `--adapter elena` with it writes nothing and exits non-zero,
which is deliberate — a silent Lit landing page on a FAST-configured app was the
older and worse behavior.

`fullstack` reaches Lit and Elena. `starlight` reaches all three. `11ty-blog` is
Lit-only. **FAST reaches one recipe of four; Elena reaches two.**

Tracked in [issue 172](https://github.com/beatzball/litro/issues/172).

---

## Choosing an adapter

Each adapter page carries its own authoring rules —
[Lit](/docs/adapters/lit#limitations),
[FAST](/docs/adapters/fast#limitations) and
[Elena](/docs/adapters/elena#limitations). This section is the part those pages
cannot tell you: **what you give up by choosing one over another.**

### Elena is deprecated, and is removed in v1

**This is not a gap waiting to be filled. It is an adapter being retired.** The
`create-litro` prompt no longer offers Elena. `--adapter elena` still works, the
adapter still ships, both recipe overlays and both end-to-end suites still run,
and a project that already uses it keeps building until Litro v1 — at which
point the adapter and the `./adapter/elena` export path are removed.

The reason is the list below, and the first item is the whole of it: **`ui()`
throws on Elena**, so the one thing Litro leads with — an agent tool that returns
a server-rendered component — cannot reach the adapter at all. Everything an
Elena project needs is documented and stays documented; nothing here gets fixed.

**If you are choosing today:** pick [Lit](/docs/adapters/lit) or
[FAST](/docs/adapters/fast). **If you already run Elena:** you have until v1, and
[switching adapters](/docs/adapters/switching) is the path.

Elena renders light DOM with no Shadow DOM and no hydration step. That is the
point of it — the smallest document of the three, and no framework JavaScript
needed to see content. These are the consequences, and the reason the adapter is
being retired rather than finished.

- **No hydration at all.** `getHeadScripts()` returns an empty string. A
  component whose behavior needs a framework-driven re-render after load does
  not get one; you write the event handlers yourself. Lit and FAST both
  hydrate.
- **`ui()` throws on Elena**, so **no agent tool can return a component**. This
  is the single largest cost: picking Elena for its light-DOM speed removes
  Litro's most distinctive AI capability. The error is
  `ui(): the "elena" renderer is deferred past v0.`
  An Elena renderer will not be built
  ([issue 219](https://github.com/beatzball/litro/issues/219)).
- **MCP Apps does not support Elena**, for the same reason — a `ui://` document
  is packed from a rendered component. This will not be added
  ([issue 219](https://github.com/beatzball/litro/issues/219)).
- **Server-side rendering is string rewriting, not a renderer.** The adapter
  matches custom-element tags with a regular expression and expands them by
  replacement. Four things follow that a renderer would not do:
  - **Nesting stops at depth 10.** Past that, tags are left unexpanded in the
    output.
  - **Attributes only, never properties.** A nested custom element cannot
    receive an object, an array or a function from its parent during SSR. On
    Lit that is `.prop=${obj}` and it works.
  - **An unregistered tag is left as raw markup** with no warning and no error.
  - **A render that throws produces empty output, not a failure.** The adapter
    catches, warns to the console and returns nothing, so a page can
    server-render a blank region and still exit 0.
- **`<litro-link>` renders its text only.** A link wrapping markup — an icon, a
  `<strong>` — loses that markup, because `<slot>` has no meaning without
  Shadow DOM.

All of the above is in `packages/framework/src/adapter/elena/index.ts` and
`packages/framework/src/adapter/elena/runtime/LitroLink.ts`.

**Workaround:** move to Lit or FAST. Until v1, Elena is fine for content-shaped
pages and nothing else — anything that needs hydration, property binding or an
agent UI has to be on another adapter, and
[switching adapters](/docs/adapters/switching) is a per-project choice, not a
per-page one.

### FAST reaches the fewest recipes

FAST server-renders and hydrates like Lit, and `ui()` supports it. Its cost is
reach: one recipe of four scaffolds it, so a FAST project on any other recipe
starts from a Lit template you convert by hand. Its authoring rules — the jiti
decorator trap and the external-packages rule — are on the
[FAST adapter page](/docs/adapters/fast#limitations).

---

## Building an agent

An agent's own security and operational notes are on the
[Agents page](/docs/agents#security). What follows is capability Litro does not
have.

### There is no skills concept

**Litro has agents and tools. It has no skills.** `skills` is a reserved
configuration key that throws if you set it:

```
defineAgent: "skills" is deferred past v0 — see the design spec's deferral list.
```

The design is fully specified and **none of it is built**. A skill would be a
standard Agent Skill folder, resolved by name across three scope levels —
global `skills/`, shared `agents/_shared/skills/`, and local
`agents/<name>/skills/` — with local-first precedence, bundled by
`defineAgentPreset` and distributable over npm, including a design-system
skillset backed by a custom elements manifest.

What v0 actually ships is the reserved `skills` and `extends` configuration
keys, plus the `_`-prefix scanner exclusion, so the hierarchy can land later
without a breaking change. No directory named `skills` exists anywhere in the
repository.

**What this costs you:** there is no way to package, share or install an agent
capability. Every agent's knowledge is retyped into its own `instructions.md`.
Nothing is reusable across two agents in the same project, and nothing is
publishable.

**There is no workaround** beyond copying `instructions.md` between agents and
accepting that the copies drift.

`extends`, `mcp` and `subagents` are reserved and throw the same way.

### An agent cannot use another server's tools

Litro serves tools outward and consumes nothing inward. There is no MCP
**client** — an agent that needs a GitHub, database or filesystem MCP server
cannot reach one. Its tools are the files in its own `tools/` directory and
nothing else.

**Workaround:** call the external service directly from inside a tool's
`execute`. You lose the host's tool discovery, its schemas and its permission
model, and you write the transport yourself.

Tracked in [issue 158](https://github.com/beatzball/litro/issues/158).

### No subagents, no scheduled runs, no eval suites

- **No delegation.** One agent, one loop, one model. An agent cannot hand work
  to another agent.
- **No scheduled runs.** An agent answers a request. Nothing runs it on a timer.
- **No eval suites.** There is no way to score an agent's behavior against a
  fixture set, so **a change to a prompt cannot be regression-tested**. Your
  tests cover the tools; nothing covers the agent's judgment.

### An uncaught error's message reaches the client in production

Error payloads strip `stack` outside dev, but `name` and `message` are always
sent. An uncaught throw that is not an `AgentError` puts its raw message in
front of the user, in production.

**Workaround:** wrap anything user-facing in `AgentError` with a message you
chose. Do not rely on production hiding a raw throw.

---

## Serving tools to an MCP host

Both transports ship — `litro mcp serve` over stdio, and a Nitro route for
Streamable HTTP. Both answer `tools/list`, `tools/call`, `resources/list` and
`resources/read` from one server object, so what one cannot do, neither can.

### A long tool call reports nothing until it finishes

There are **no progress notifications**. A tool that takes 40 seconds shows the
host nothing at all — no partial output, no percentage, no sign it is alive. The
only bound is the per-call timeout, which defaults to 30 seconds, so **a slow
tool looks like a failure rather than a wait**.

**Workaround:** raise `--timeout` and keep tools short. There is no way to
stream progress to the host.

### A tool describes its input, not its output

There is no `outputSchema`. A host cannot describe or validate what a tool
returns, and a model cannot see the shape of a result before calling. A tool
that returns the wrong shape is caught by nobody.

### Every tool looks equally safe

There are no tool annotations, so a host cannot tell a read-only tool from a
destructive one and cannot decide on its own whether a call needs confirmation.

**Workaround:** say so in the tool's `description`, and rely on the host asking
about every call or none.

### Lists are never paginated

`tools/list` and `resources/list` always answer in a single page. A project with
many tools cannot page through them.

### One static token for every caller

A deployed HTTP route is protected by **one shared secret**. There is no OAuth,
no per-user token, no scope, no revocation, no expiry and no
`WWW-Authenticate` challenge. **Rotating the secret means redeploying.**

**Workaround:** put the route behind your own gateway if you need per-user
authorization.

### Tool names are global to a host

Two servers exposing `get-weather` is ambiguous: the host picks one and the
reader cannot tell which answered. This is a naming rule you have to know, not a
bug in either server — it caught a real person during testing. Name tools for
their project.

### One agent per server

Tool names are unique inside an agent, not across a project. A project with two
agents is **two entries in the host's configuration**, not one.

### No way to check a deployed route

The gates and the protocol can be verified locally by the playground's probe
rig, but that is a test fixture, not a shipped command. **After you deploy, you
cannot ask Litro whether your route's gates are correct.**

Tracked in [issue 212](https://github.com/beatzball/litro/issues/212).

### The protocol revision trails the specification

The current specification revision is 2026-07-28. The SDK Litro builds on still
reports `2025-11-25`, which is what both transports negotiate. A newer client
falls back to the legacy path and **interoperability holds today** — but it
holds by fallback, so a host that stops offering the fallback stops working.
This is blocked on the SDK, not on Litro.

### A `ui://` view cannot ask the model anything

`sampling/createMessage` is not implemented, so a view cannot ask the model a
question of its own. Nor can it register its own tools with the host. A view can
only call back tools the server already published.

Tracked in [issue 162](https://github.com/beatzball/litro/issues/162).

The host CSP is worth knowing about: the default allows inline script, but a
host **may** restrict further, and one that does breaks every inline-script MCP
App — not only Litro's.

---

## Building pages

### Server Actions are POST-only, and uploads are buffered in memory

Server Actions ship typed RPC, form mode and streaming. They carry a dozen
authoring rules that matter once you are writing one — the filename marker,
`export *` being a build error, a module outside the project root resolving to a
silent 404, and a best-effort guard on non-function exports. Those stay with the
feature: **[Server Actions → Limitations](/docs/server-actions#limitations)**.

Two of them change a design decision rather than a line of code, so they are
named here too:

- **There is no GET action and no cache-semantic variant.** Every action is a
  POST, so an action's result is never cached by anything in front of it.
- **Form uploads have no size limit and no streaming multipart.** Form mode
  accepts whatever h3 buffers into memory. A large upload is a memory
  problem, not a rejected request.

One more is a dev-versus-production difference worth knowing before you build
on it: `ctx.event` is `undefined` for in-process server-rendered calls **on the
dev server**, because Nitro's async context is missing in the dev worker.
Production has it. Code that reads `ctx.event` from `definePageData` works in
production and breaks in dev, which is the wrong way round.

### OG image templates are flexbox-only

The OG image generator uses Satori, which supports flexbox and nothing else. No
grid, no `position: absolute`, no `text-overflow: ellipsis`, and every `<div>`
with children needs an explicit `display`. Truncate strings yourself. Details
are on the [OG images page](/docs/og-images#satori-css-limitations).

---

## Shipping a site

### Litro writes two deployment presets, not ten

Litro deploys anywhere [Nitro](https://nitro.unjs.io) deploys, and Nitro
documents many targets. Be precise about what that means:

- **Litro itself writes two presets** — `static` for SSG and `node-server` for
  SSR. Everything else is Nitro pass-through, which you configure yourself.
- **Two deployment guides exist**: [GitHub Pages](/docs/deployment/github-pages)
  and [Coolify](/docs/deployment/coolify).
- **The end-to-end suite exercises `node-server` and `static` only.** Cloudflare,
  Vercel, Netlify, Deno Deploy, AWS Lambda and Azure are real Nitro presets that
  **Litro has never run**.

They are expected to work, because the work is Nitro's. But if you are choosing
Litro *because* of a specific edge target, you are the first to try it.

### There is no sitemap

The framework ships no sitemap builder and **no recipe scaffolds a sitemap
route**. Every site owner writes one by hand. The docs site you are reading
derives its own, but that code lives in the docs site, not in the framework.

Tracked in [issue 214](https://github.com/beatzball/litro/issues/214).

### The standalone router cannot intercept ordinary links

Used on its own, `@beatzball/litro-router` has no `interceptLinks()`. There is
no way to tell it "handle every `<a href>` on the page". You replace each link
with `<litro-link>` yourself.

Inside a Litro app this rarely bites, because `<litro-link>` is there. It bites
when you adopt the router alone in an existing site.

Tracked in [issue 213](https://github.com/beatzball/litro/issues/213).

---

## Where the rest of the limitations live

Anything that is an authoring rule stays with its feature. These are the
complete lists:

| Feature | Its limitations |
|---|---|
| Server Actions | [12 authoring rules](/docs/server-actions#limitations) |
| Lit adapter | [Shadow DOM, decorators, SSR safety](/docs/adapters/lit#limitations) |
| FAST adapter | [jiti decorators, external packages, `:innerHTML`](/docs/adapters/fast#limitations) |
| Elena adapter (deprecated) | [Lowercase props, escaping, SSR registry](/docs/adapters/elena#limitations) |
| OG images | [Satori CSS](/docs/og-images#satori-css-limitations) |
| Agents | [Security notes](/docs/agents#security) |
| MCP Apps | [Packaging and CSP notes](/docs/mcp-apps#security-notes) |

## Reporting a gap

If you hit something that is not on this page, open an issue at
[github.com/beatzball/litro/issues](https://github.com/beatzball/litro/issues).
An open issue is how a gap gets a link here.
