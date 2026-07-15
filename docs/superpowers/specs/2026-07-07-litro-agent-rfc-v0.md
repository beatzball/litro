# `@litro/agent` — design spec (v0) [SOURCE RFC — authored outside this repo]

> NOTE: This is the source RFC pasted verbatim on 2026-07-07. Where it disagrees
> with the corrected design spec that follows from design review, the corrected
> spec wins (same treatment as the Server Actions RFC; see
> 2026-07-03-server-actions-rpc-design.md section 3).

> An open, standards-first agent layer for Litro apps. Filesystem-first like the rest of Litro, deploy-anywhere via your existing Nitro adapters, no proprietary runtime. Its one distinctive capability: **tools that return server-rendered web components** — the same design-system elements your pages already use, streamed as Declarative Shadow DOM and hydrated on the client.

This is a proposal. Standards-facing pieces (Lit SSR, MCP, OpenTelemetry, the Agent Skills `SKILL.md` shape) use their real APIs; the `@litro/agent` surface is invented here and open to change.

---

## 0. Naming

**Package: `@litro/agent`. Directory: `agents/`.** "Agent" is the field-wide standard — it's the shared vocabulary of MCP, A2A, and the Agent Skills format, not any one vendor's coinage. Singular package name (a capability you add), plural directory (parallel to `pages/`). If a marketing identity is wanted later, that's a codename layered *over* this path, not a replacement for it — the import path stays boring and greppable.

### Vocabulary choices (and why)

Deliberately chosen so the surface reads as Litro's own, not a re-skin of anyone else's:

| Term | Means | Why this word |
|---|---|---|
| **surface** | where an agent is reached (web UI, HTTP, chat app) | broader than "channel" — a Litro surface can *render components*, not just exchange messages |
| **session log** | the durable record of a run | describes the mechanism (an append-only log), implementation-neutral |
| **UI result** | a tool output that is a rendered component | names the thing that makes this framework different |
| **provider** | the model adapter | swappable; covers hosted and local models |
| `agents/`, `tools/`, `skills/`, `mcp/`, `subagents/` | filesystem slots | each names exactly what it holds; `mcp/` names the open standard directly |

---

## 1. Principles

1. **Filesystem-first.** A file's path is its identity, same as Litro routing. No central registry.
2. **No proprietary runtime.** Every dependency is an open standard or a self-hostable interface. Deploy targets are whatever your Nitro preset supports.
3. **One stream, two payloads.** Durable session events and streamed component HTML travel the same abstraction (see §8) — this is the architectural keystone, not a bolt-on.
4. **Pick-your-component-lib carries through.** Lit / FAST / Elena selection flows into the UI tool layer, behind one `UIResult` contract.
5. **The model reasons over data, humans see components.** A UI tool returns both; neither leaks into the other's channel.

---

## 2. Directory layout

Agents reuse the components your pages already render.

```text
my-litro-app/
├── litro.config.ts
├── components/                     # existing design system (Lit/FAST/Elena)
│   └── weather-card.ts             #   defines <weather-card>
├── pages/                          # existing routes  →  URLs
│   └── index.litro
└── agents/                         # NEW           →  agent endpoints
    └── concierge/
        ├── agent.ts                # composition root: model, tools, skills, access
        ├── instructions.md         # always-on system prompt
        ├── skills/
        │   └── plan-trip/
        │       └── SKILL.md        # lazily-loaded playbook (Agent Skills frontmatter)
        ├── tools/
        │   └── get-weather.ts      # returns a server-rendered <weather-card>
        ├── mcp/
        │   └── linear.ts           # MCP server connection
        ├── surfaces/
        │   └── web.ts              # web surface that hydrates components
        └── subagents/
            └── researcher.ts
```

Discovery is filesystem-first; `agents/concierge/` is reachable at `POST /_litro/agents/concierge/:sessionId`. The `:sessionId` segment addresses a durable session so clients can reconnect to in-flight work (§8).

---

## 3. `litro.config.ts`

One plugin. Durability and deploy target are explicit, self-hostable choices.

```ts
import { defineConfig } from "litro";
import { agents } from "@litro/agent/plugin";
import { sqliteSessionStore } from "@litro/agent/sessions/sqlite";

export default defineConfig({
  components: "lit",                          // flows into the UI tool layer
  plugins: [
    agents({
      dir: "agents",
      sessions: sqliteSessionStore({ path: ".litro/sessions.db" }), // or postgres/redis-streams adapter
      telemetry: { otel: true },             // OpenTelemetry exporter; off unless configured
    }),
  ],
  nitro: { preset: "node-server" },          // cloudflare | deno | bun | docker | ...
});
```

No hosted service is implied by any line here. The SQLite store is the default because it runs on a laptop or a homelab box with zero infra; swap the adapter for Postgres or a Redis-streams backend in production.

---

## 4. The agent: composition root

Skills are composed as **explicit typed imports**, not magic-scanned. That keeps dependencies honest, lets a skill come from an npm package, and makes cross-agent reuse trivial — while the `skills/` folder remains the conventional home for local ones.

```ts
// agents/concierge/agent.ts
import { defineAgent } from "@litro/agent";
import { openaiCompatible } from "@litro/agent/providers/openai-compatible";
import { replyToIssue } from "./tools/get-weather.ts";
import planTrip from "./skills/plan-trip/SKILL.md" with { type: "skill" };

// Co-located access control. Runs before the session starts.
export const access = defineAccess((event) => {
  if (!event.context.user) throw new Response("Unauthorized", { status: 401 });
});

export default defineAgent({
  // Provider-prefixed string resolved by a pluggable adapter — hosted or local.
  model: openaiCompatible({ baseURL: process.env.LLM_URL, model: "qwen3" }), // e.g. local MLX
  instructions: "./instructions.md",
  tools: [replyToIssue],
  skills: [planTrip],
});
```

```markdown
<!-- agents/concierge/instructions.md -->
# Identity
You are a travel concierge for the signed-in user.
Prefer showing results as components over describing them in prose.
When a tool returns UI, summarize it in one short sentence — the component shows the detail.
```

---

## 5. The differentiator: tools that return components

A UI tool fetches data, then returns **both** a server-rendered component (for humans on UI-capable surfaces) **and** the underlying data (what the model observes, and what a text-only surface falls back to).

```ts
// agents/concierge/tools/get-weather.ts
import { defineTool } from "@litro/agent/tools";
import { ui } from "@litro/agent/ui";
import { html } from "lit";
import { z } from "zod";
import "../../../components/weather-card.js";   // registers <weather-card> on the server

export default defineTool({
  description: "Get current weather for a city and show it as a card.",
  inputSchema: z.object({ city: z.string() }),
  async execute({ city }) {
    const res = await fetch(`${process.env.WEATHER_API}/current?city=${city}`);
    const data = await res.json();

    return ui(
      html`<weather-card .city=${city} .current=${data.current}></weather-card>`,
      {
        data,                                    // <- the MODEL observes this
        hydrate: {
          modules: ["/components/weather-card.js"],
          props: { city, current: data.current },
        },
      }
    );
  },
});
```

**The model never sees raw HTML.** Its observation is `data`; the HTML is a side-channel to the surface. This keeps token cost down and stops the model hallucinating about markup.

### The `ui()` helper (real Lit SSR)

```ts
// @litro/agent/ui  (Lit implementation of the UIResult contract)
import { render } from "@lit-labs/ssr";
import { collectResult } from "@lit-labs/ssr/lib/render-result.js";
import type { TemplateResult } from "lit";

export interface UIResult {
  type: "ui";
  html: string;                       // DSD-serialized, ready to inject
  data?: unknown;                     // structured payload for model + text surfaces
  hydrate?: {
    modules: string[];                // client entries that define the custom elements
    props?: Record<string, unknown>;  // rich props re-bound after hydration
  };
}

export async function ui(
  template: TemplateResult,
  opts: { data?: unknown; hydrate?: UIResult["hydrate"] } = {}
): Promise<UIResult> {
  const html = await collectResult(render(template));   // RenderResult -> string
  return { type: "ui", html, data: opts.data, hydrate: opts.hydrate };
}
```

`render()` returns a `RenderResult` (a sync iterable that may contain Promises); `collectResult()` awaits and joins it to a DSD string. The `UIResult` interface is library-agnostic on purpose — a FAST or Elena implementation provides the same shape via its own SSR path (§10, caveat 6).

### Client hydration (in the web surface)

SSR emits **attributes** for serializable values; rich props are re-applied after hydrate via the descriptor.

```ts
// client entry loaded by surfaces/web.ts
import "@lit-labs/ssr-client/lit-element-hydrate-support.js"; // MUST precede `lit`

export async function hydrateUIResult(host: HTMLElement, r: UIResult) {
  host.innerHTML = r.html;                                   // DSD attaches shadow roots
  if (!r.hydrate) return;
  await Promise.all(r.hydrate.modules.map((m) => import(m))); // upgrade elements
  if (r.hydrate.props) Object.assign(host.firstElementChild as any, r.hydrate.props);
}
```

---

## 6. MCP and surfaces (thin, conventional)

```ts
// agents/concierge/mcp/linear.ts — Model Context Protocol, the open tool-interop standard
import { defineMcp } from "@litro/agent/mcp";

export default defineMcp({
  url: "https://mcp.linear.app/sse",
  description: "Linear: issues, projects, cycles.",
  auth: { kind: "oauth", provider: "linear" },   // resolved by your middleware
});
```

```ts
// agents/concierge/surfaces/web.ts
import { webSurface } from "@litro/agent/surfaces/web";
export default webSurface({ hydrate: true });     // streams UIResults to the browser
```

```markdown
<!-- agents/concierge/skills/plan-trip/SKILL.md -->
---
description: Plan a multi-stop trip when the user is vague about dates or budget.
---
Gather constraints first (dates, budget, party size), then propose an itinerary.
Render each stop with <itinerary-card>; never dump a wall of text.
```

The `description` frontmatter drives relevance-based loading, matching the Agent Skills convention so a skill folder is portable to any runtime that reads the same shape.

---

## 7. Skill sharing & distribution

The `SKILL.md` *format* is a settled open standard (frontmatter `name` + `description`, markdown body, optional `scripts/`/`references/`/`assets/`, progressive disclosure). The *sharing mechanics* around it are not standardized — so Litro conforms on the format and layers four levels of reuse on top, from same-repo to published-to-the-world.

### Layer 0 — standard folder on disk, typed import in code

The open question from §4 (magic-scan vs typed import) resolves as *both, at different layers*:

- **On disk**, a skill is a spec-conformant Agent Skill folder — nothing Litro-specific.
- **In code**, `import planTrip from "./skills/plan-trip/SKILL.md" with { type: "skill" }` is only composition sugar that reads that folder.

The payoff is portability in both directions: a Litro skill runs unchanged in any skills-compatible runtime (Claude Code, Codex, Gemini CLI…), and a skill authored elsewhere drops into a Litro agent without translation. Litro never owns or extends the format.

### Layer 1 — scope hierarchy (global / shared / local)

Reuse *inside a project* is a three-level scope with local-first precedence, mapped onto the filesystem:

```text
my-litro-app/
├── skills/                         # GLOBAL — every agent sees these
│   └── design-system/              #   (see the skillset below)
└── agents/
    ├── _shared/
    │   └── skills/
    │       └── house-style/         # SHARED — a group of agents
    ├── concierge/
    │   └── skills/
    │       └── plan-trip/           # LOCAL — this agent only
    └── researcher/
        └── skills/
```

Resolution is by skill `name`: **local overrides shared overrides global**. Only global skills load *implicitly* (the design-system skill is why — you want exactly one, everywhere); shared and local skills are still composed by explicit import, so every capability an agent has is either app-global or traceable to a line in its `agent.ts`. That hybrid answers "how doctrinaire": implicit only where you provably want a singleton, explicit everywhere else.

### Layer 2 — presets (share a bundle, not just a skill)

When several agents should share a whole posture — model, instructions, tools, skills, MCP — bundle it once and extend:

```ts
// agents/_shared/concierge-base.ts
import { defineAgentPreset } from "@litro/agent";
import { openaiCompatible } from "@litro/agent/providers/openai-compatible";
import designSystem from "../../skills/design-system/SKILL.md" with { type: "skill" };

export const conciergeBase = defineAgentPreset({
  model: openaiCompatible({ baseURL: process.env.LLM_URL, model: "qwen3" }),
  skills: [designSystem],
  tools: [/* shared tools */],
});
```

```ts
// agents/concierge/agent.ts
import { defineAgent } from "@litro/agent";
import { conciergeBase } from "../_shared/concierge-base.ts";
import planTrip from "./skills/plan-trip/SKILL.md" with { type: "skill" };

export default defineAgent({
  extends: conciergeBase,             // inherit the bundle
  skills: [planTrip],                 // add local specialization
});
```

### Layer 3 — distribution (npm + skill registries)

Because a skill is a standard folder, it travels two ways with no extra machinery:

- **As an npm package** (e.g. `@charm-ux/skills-design-system`) — versioned, changelogged, imported across repos like any dependency.
- **Through cross-tool skill registries** — the same folder is installable by non-Litro agents, and third-party skills install into yours.

Either way a shared skill gets what a shared library gets: an owner, a version, and a changelog.

### The Litro payoff — a CEM-backed design-system skillset

A *skillset* is related skills that share assets so their outputs stay coherent. Litro's highest-value one bundles the design system:

```text
skills/design-system/
├── SKILL.md            # "Render results with the design system's components."
├── references/
│   └── catalog.md      # human-readable component usage
└── assets/
    └── elements.json   # the Custom Elements Manifest (CEM) projection
```

Placed at global scope, this single skill teaches *every* agent which components exist and how to compose them — the `<weather-card>` in §5 is reliable because the shared skill declares it takes a `.current` prop. It is the connective tissue between skill-sharing and the generative-UI differentiator: the CEM you already project for Charm UX becomes the one asset that keeps every agent's rendered output consistent with the design system, versioned and shipped alongside it.

---

## 8. Durability: one stream, two payloads (the keystone)

A session is an **append-only log of events** — messages, tool calls, approvals, and *render chunks*. The store is an interface:

```ts
export interface SessionStore {
  append(sessionId: string, event: SessionEvent): Promise<void>;
  read(sessionId: string, fromSeq?: number): AsyncIterable<SessionEvent>;
}
```

The insight that makes this Litro's rather than a generic copy: **Lit SSR already produces a stream.** `RenderResultReadable` from `@lit-labs/ssr/lib/render-result-readable.js` emits component HTML incrementally. So a streamed `UIResult` is just another event type in the same log:

- A component that's half-rendered when the process dies is **resumable** — replay the log, continue the render.
- A client that drops mid-stream **reconnects** by reading from its last sequence number; it never restarts.
- One mechanism serves both "the agent is thinking" progress events and "the card is painting" render chunks.

Default store is SQLite (laptop/homelab-friendly); Postgres and Redis-streams adapters cover production. None of them is a hosted product.

---

## 9. Observability (OpenTelemetry, the actual standard)

Emit OpenTelemetry spans for sessions, tool calls, model calls, and render steps using the GenAI semantic conventions. Because it's plain OTel, it exports to any compatible backend (your own collector, Grafana/Tempo, Sentry, Braintrust) with no framework-specific agent. This is the part of "industry standards" that's concrete and settled today, so it ships in v0 rather than being deferred.

---

## 10. Honest caveats

- **Lit SSR is Labs/experimental.** Stable enough to build on, officially pre-release. Pin versions.
- **`@lit/context` does not SSR** cleanly. UI-tool components take data via props/attributes, not context.
- **Shadow DOM only** for Lit SSR; light-DOM-only patterns use the light-DOM SSR path your adapters already pick.
- **Do fetching in `execute`, not in render.** Async-in-component-render is limited; pass results in as props (as shown).
- **Security.** Never `unsafeHTML()` model- or user-supplied strings into a template; bind through typed props so the lib escapes them.
- **FAST/Elena parity is design work, not free.** The `ui()` shown is Lit-specific. Build `UIResult` as the contract with per-lib implementations from day one, or it silently becomes Lit-shaped.

---

## 11. What to prototype first (thin vertical slice)

Prove the load-bearing claim before building breadth:

1. **One agent, one UI tool, web surface.** `get-weather` → `<weather-card>`: tool returns `UIResult`, browser injects DSD, element upgrades, props re-bind. No flash, no re-fetch → the thesis holds.
2. **Data/UI separation.** Confirm the model's observation is `data`, and a text-only surface renders a sensible fallback from the same tool.
3. **Stream + resume.** Stream a `UIResult` via the session log; kill the process mid-render; confirm replay-and-resume and client reconnect from last sequence.
4. **Second component lib.** Implement the `UIResult` contract for FAST or Elena to prove the abstraction isn't secretly Lit-shaped.

Defer subagents, scheduled runs, and eval suites until 1–3 are solid — they're table stakes once the differentiator and the stream keystone are proven.
