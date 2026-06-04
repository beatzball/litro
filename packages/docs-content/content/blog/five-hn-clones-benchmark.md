---
title: "Web Components vs Next.js and Nuxt: A Real-App Benchmark"
description: "We built the same Hacker News clone five times — Lit, FAST Element, Elena, Next.js 14, and Nuxt 3 — fed them through the same benchmark pipeline, and published the results. What we learned about web components, hydration-data cost, and the tradeoffs nobody advertises."
date: 2026-04-20
tags:
  - benchmarks
  - adapters
  - web-components
  - ssg
---

# Web Components vs Next.js and Nuxt: A Real-App Benchmark

We built the same Hacker News clone five times — once each with Litro's three framework adapters (Lit, FAST Element, Elena), once with Next.js 14, and once with Nuxt 3 — and fed all five through the same benchmark pipeline. Same routes, same fixture data, same CSS, all statically generated.

The short version: **web components are competitive.** Litro builds the app in ~1.5–1.7 seconds across all three adapters; Next.js takes ~5 seconds for the same output. On `/story/[id]` — a realistic content page with a comment tree — gzipped page weight lands at 11 KB for Elena, 11.5 KB for FAST, 15 KB for Lit, and 16 KB for Next.js. Nuxt comes in lightest on the homepage (4.8 KB vs Litro's ~8–9 KB), but that's because Nuxt ships ~160 bytes of hydration metadata while Litro and Next.js inline the full server data (~14 KB and ~25 KB respectively). Different tradeoff, not a different tier.

What the numbers don't show, and what this post is really about: the three Litro columns are the same app, swapped at one config line. That's the adapter system working — and it's the part of the story we think is worth more than any single benchmark row.

Full numbers, methodology, and the parts where web components *don't* win are below. Benchmark source and results are public at [/benchmarks](/benchmarks).

## Why We Did This

Most framework benchmarks measure hello-world. A single route, no data fetching, no dynamic segments. They're easy to run but tell you almost nothing about how a framework behaves when you ask it to render a real app.

We'd already published a [minimal-app benchmark](/benchmarks) covering Litro, Next.js, and Nuxt — boot time, bundle size, a single static route. The numbers looked good for Litro, but we didn't trust them. A framework's character shows up when you ask it to render 100 routes with nested dynamic segments, serialize server data for hydration, and ship the output to a static host.

So we picked Hacker News. It's a canonical example (the [HNPWA project](https://hnpwa.com/) exists for this reason), the data model is well-known, and it exercises the parts of a framework that matter: list pages with links, dynamic route segments (`/story/[id]`, `/user/[id]`), nested data (comment trees), and user-facing content (timestamps, author bylines, score).

## The Setup

Five apps, same shape:

- **5 routes:** `/`, `/ask`, `/show`, `/story/[id]`, `/user/[id]`
- **Fixture-based data:** top 30 stories from each of top/ask/show, comments 2 levels deep, users for each story author. Captured once from the real HN Firebase API, stored as JSON.
- **Mock H3 API:** local server on port 4100 serving the fixtures. The apps hit the mock during benchmark runs via the `HN_API_BASE` env var, and the real HN API during development.
- **SSG only:** every route prerendered to static HTML. No server required at runtime.
- **Identical CSS:** `hn-shared/hn.css` — orange header, story list, comment tree. Copied into each app's `public/` directory so layout is pixel-identical.

The three Litro apps use the framework's three adapters. The only meaningful difference between them is which component library authors the pages. The Next.js app uses Next 14 with RSC and `output: 'export'`. The Nuxt app uses Nuxt 3 with `nuxi generate`.

All five are in `benchmarks/apps/hn-*` in the [repo](https://github.com/beatzball/litro).

## The Numbers

All runs on the same machine, same Node.js version, median of three runs. Full JSON at [`benchmarks/results/latest.json`](https://github.com/beatzball/litro/blob/main/benchmarks/results/latest.json).

### Build time (median ms)

| Framework     | Time   |
|---------------|--------|
| litro-elena   | 1523   |
| litro-lit     | 1526   |
| litro-fast    | 1709   |
| nuxt          | 2465   |
| nextjs        | 5233   |

Litro's three adapters build the same 79 story pages + 10 user pages + 3 list pages (92 total routes) in just over a second. Next.js takes nearly four times longer for the same output. Most of the gap is Next.js's RSC compilation step and the extra toolchain layers (SWC, `generateStaticParams` evaluation, static export pipeline). Nuxt sits in the middle — faster than Next.js, slower than Litro, because Nitro's prerender runs per-route but Nuxt compiles Vue SFCs and resolves auto-imports on top of it.

### Output size (total bytes in the static directory)

| Framework     | Size     |
|---------------|----------|
| nuxt          | 1.41 MB  |
| litro-elena   | 1.84 MB  |
| litro-fast    | 2.10 MB  |
| litro-lit     | 2.39 MB  |
| nextjs        | 4.27 MB  |

Next.js ships noticeably more on disk — primarily the React runtime and per-route RSC payloads. Nuxt's light output comes from Vue's smaller runtime and the hydration strategy discussed below.

### Page weight: `/story/47760529` (gzipped transfer size)

This is the interesting one — a story detail page with 40+ nested comments. It's the page a reader actually lands on from a link.

| Framework     | Gzipped  | Raw       |
|---------------|----------|-----------|
| litro-elena   | 11.0 KB  | 48.8 KB   |
| litro-fast    | 11.5 KB  | 52.5 KB   |
| litro-lit     | 15.1 KB  | 62.5 KB   |
| nextjs        | 16.2 KB  | 63.6 KB   |
| nuxt          | 9.9 KB   | 29.3 KB   |

Elena is lightest because it uses light DOM rendering — no Declarative Shadow DOM wrappers, no per-component `<style>` blocks duplicated across the tree. FAST is close behind. Lit is heavier because every component emits a DSD `<template>` with scoped styles. Next.js sits slightly above Lit because RSC inlines the full rendered tree plus a ~25 KB RSC payload. Nuxt wins — mostly — for reasons we'll get to.

### Page weight: `/` (homepage, 30 stories)

| Framework     | Gzipped  |
|---------------|----------|
| nuxt          | 4.8 KB   |
| nextjs        | 6.2 KB   |
| litro-elena   | 8.1 KB   |
| litro-fast    | 8.6 KB   |
| litro-lit     | 9.0 KB   |

Here the order reshuffles. Next.js pulls ahead of Litro on list pages, and Nuxt pulls ahead of everyone.

## Where Nuxt Wins, and Why

Nuxt's numbers look like a runaway win. The homepage is 4.8 KB gzipped — nearly half of Litro's lightest adapter. The story page is 9.9 KB vs Litro's 11 KB. If you stopped reading at the first table, you'd conclude Nuxt is flatly better.

The mechanism is hydration data. Every statically-generated page in Litro embeds its full server data as a JSON `<script>` tag:

```html
<script type="application/json" id="__litro_data__">
{"story":{...},"comments":[...]}
</script>
```

Next.js does the same, with larger payloads because RSC serializes more verbosely. Nuxt does *not*. `nuxi generate` defaults to `payloadExtraction: true` which splits page payloads into separate `.json` files fetched on client navigation — the initial HTML only carries a ~160-byte metadata stub referencing the external payload.

This is a real tradeoff, not a free win. If you click a link, Nuxt pays a network round-trip for the payload file; Litro and Next.js have the data already. If you land on the page from a deep link and never navigate, Nuxt wins flatly. If you browse several pages, the initial savings invert once you've paid for a second payload.

Which behavior is "better" depends on how users reach your site. For SEO landing pages where most visits are one-and-done, Nuxt's strategy is correct. For an app where users click around, inlined data is usually correct. Neither approach is wrong; we'd just rather the reader know which one they're getting.

## Where Next.js Wins

Same honesty in the other direction: **Next.js beats Litro on list pages.**

On `/ask` and `/show`, Next.js ships 4.6 KB and 5.4 KB gzipped respectively. Litro's Lit adapter ships 15.4 KB and 18.9 KB for the same routes. That's a 3× gap, not a rounding error.

The cause is what each framework serializes. Litro embeds the full story list — title, URL, score, author, timestamp, comment count — for all 30 stories in the JSON data script. Next.js RSC serializes the *rendered* list, which happens to dedupe structural repetition and omits fields the UI doesn't use. On a list-heavy page, RSC is more compact than naive JSON-of-raw-records.

We could shrink this on the Litro side — strip unused fields before serializing, or compute list data lazily on the client. We haven't, because honest benchmarks beat flattering ones. If you're building list-heavy SSG apps and bytes-over-wire is your top metric, Next.js is the right pick.

## Where Litro Wins

Three wins the numbers actually back up.

**Build time, by a wide margin.** Litro builds the HN clone in ~1.5 seconds across all three adapters. Nuxt lands at ~2.5. Next.js takes ~5.2. On a real SSG site — thousands of pages, a real content pipeline — a 3× gap compounds into minutes per CI run. Most of the credit goes to Vite versus webpack-plus-RSC; that toolchain choice is Litro's to keep, and it's why all three adapters land in the same tight build-time band.

**Smaller content pages on the wire.** On `/story/[id]` — article text plus a comment tree, the realistic content case — Elena ships 11 KB gzipped, FAST 11.5 KB, Lit 15 KB. Next.js ships 16.2 KB for the same page. The RSC payload carries its own weight; Litro's hydration JSON is smaller per-record on content-dense pages than the serialized tree. (The picture flips on list pages, as the previous section covered — so this is a "where" win, not a universal one.)

**Zero main-thread blocking, across every Litro adapter, on every route.** In the Lighthouse table above, all three Litro adapters recorded 0 ms of Total Blocking Time on every route we measured. Nuxt hit 143 ms on `/story/[id]` from synchronous payload hydration. Next.js also hits 0 ms, so this isn't a unique-to-Litro win against every competitor — but it is a clean data point that says: whatever cost Litro's DSD + module-loading strategy adds to FCP, it doesn't land as jank on the main thread once the page is interactive.

## The Adapter System, Briefly

Most readers won't have used Litro, so the three `litro-*` rows need context.

Litro is a web component meta-framework — think "Nuxt, but the components are web components." It wraps Nitro (the server that powers Nuxt), ships with a built-in router, and handles SSR / SSG / static prerendering.

The adapter system is how we support three component libraries without forking the framework. Each adapter provides a native implementation of the core primitives (Outlet, Link, Page, SSR renderer) and a small Vite/Nitro config. The router, page scanner, data layer, and build pipeline are adapter-agnostic.

In practice, this means you pick the adapter once. The simplest path is at scaffold time: `pnpm create @beatzball/litro --adapter <lit|fast|elena>` chooses the right recipe template. For non-default adapters, the scaffolded `nitro.config.ts` sets `process.env.LITRO_ADAPTER` on its first line so the framework picks up the right adapter at build time:

```ts
// nitro.config.ts (scaffolded for FAST or Elena)
process.env.LITRO_ADAPTER = 'fast';   // or 'elena'

import { defineNitroConfig } from 'nitropack/config';
// …rest of the config
```

The default Lit template omits this line because `lit` is the resolver's fallback. You can also set the env var in your shell (`LITRO_ADAPTER=fast pnpm dev`) without touching `nitro.config.ts`.

…and your pages are authored in Lit, FAST, or Elena. The app is the same app. Same routes, same data fetching, same deployment. If you have a team that prefers FAST for its Fluent UI integration, or a docs site where Elena's light DOM is the right call, you don't have to pick a different framework — you pick a different adapter.

The three Litro rows in the tables above are the same app running through three different adapters. They were written once and ported mechanically. The full [adapter docs](/docs/adapters/overview) walk through when each makes sense.

## What Surprised Us

A few findings that weren't on our bingo card going in:

**Elena is consistently lightest.** We expected Lit (DSD + shadow DOM) to lose slightly to Elena (light DOM) on page weight, and it does. What surprised us was the *consistency* — Elena wins every single route, not just shadow-DOM-heavy ones. Light DOM is a real byte-level optimization, not a styling preference.

**FAST Element `:innerHTML` doesn't evaluate during SSR.** FAST's SSR library doesn't run property bindings that write to DOM properties, so `:innerHTML` in templates produces empty `<div>` tags in prerendered output. We hit this on the comment tree (rendered from HTML strings returned by the HN API) and the story body. The workaround was an app-level post-build step that reads the `__litro_data__` payload from each static HTML file and fills the empty divs. It's documented in the [adapter docs](/docs/adapters/overview#where-workarounds-live), and we flagged it as an asterisk on the FAST numbers for one benchmark run before backporting the fix. A proper framework-level solution — a supplemental `unsafeHTML` directive for fast-ssr — is on our post-merge roadmap.

**Next.js build times stay long regardless of cache state.** We re-ran the benchmarks after a warm cache and Next.js still took ~5 seconds vs Litro's ~1.5. The gap isn't a cold-start artifact.

**Nuxt's payload extraction is invisible in naive benchmarks.** We initially reported Nuxt's page weight as the outright winner. It took a closer look at what was actually in the HTML to notice the 160-byte payload stub. Any "which framework is lightest" benchmark that doesn't account for deferred hydration data is probably measuring something other than what the user actually pays for.

**Next.js's Lighthouse 100s are partly a loading-strategy artifact.** Looking at the numbers on `/story/[id]`:

| Framework   | FCP    | LCP    | TBT    | Score |
|-------------|--------|--------|--------|-------|
| nextjs      | 754ms  | 1504ms | 0ms    | 100   |
| litro-elena | 1133ms | 1364ms | 0ms    | 100   |
| litro-fast  | 1295ms | 1521ms | 0ms    | 100   |
| litro-lit   | 1295ms | 1673ms | 0ms    | 88    |
| nuxt        | 1502ms | 1502ms | 143ms  | 77    |

Next.js emits every JS bundle as `<script async>`, so its ~450 KB of chunks (framework, main, webpack, page code) loads outside Lighthouse's measurement window. Litro emits `<script type="module" src="/_litro/app.js">` — ES modules are implicitly deferred, so the browser waits for module fetch-and-evaluate before firing paint events. That accounts for ~540ms of the FCP gap. Lit's shadow-DOM materialization adds another hundred or so milliseconds. Nuxt's 77 on this route is TBT-driven: client-side payload hydration runs synchronously for 143ms. Post-hydration, the in-browser experience is comparable across all five — but Lighthouse weights FCP/LCP/TBT heavily inside a narrow window, and loading strategy dominates what ends up in that window.

## Where Web Components Struggle

We're not here to pretend web components are the right answer for every app. A few places where the numbers tell a less flattering story — or where web components lose cleanly to mainstream frameworks:

**Hydration data is a real cost.** Litro and Next.js inline full server data for client hydration. On list-heavy pages, that's 10+ KB you don't pay for with Nuxt's extracted-payload strategy or with non-hydrated static sites. If your pages are content-heavy and users won't interact with client state, hydrated web components are the wrong tool; a pure-static generator (Astro, Eleventy) will beat all five apps in this benchmark.

**Third-party web component libraries often don't SSR.** Shoelace, for instance, can't be server-rendered without a DOM shim; its components render empty in the initial HTML and hydrate client-side. We hit this on Litro's own docs site and had to guard Shoelace CTAs behind `@media (scripting: none)` fallbacks. The React and Vue ecosystems have more mature SSR stories across third-party libraries.

**The debugging story is different.** React DevTools, Vue DevTools, and Nuxt DevKit are mature products. Web component debugging relies on browser-native inspectors (which are good but generic) and per-library tooling (which varies). If your team's productivity depends on rich framework DevTools, the web component ecosystem is still catching up.

**The ecosystem is younger.** The web component world doesn't yet have direct equivalents of TanStack Query, Shadcn UI, or `next-auth` — you'll often assemble primitives yourself or reach for framework-agnostic libraries. Litro fills the meta-framework layer (routing, SSR, data, build) that Next.js and Nuxt provide out of the box; the component-library layer is still an area where the ecosystem is growing.

If any of those tradeoffs is important for your team's workflow, Next.js and Nuxt are mature choices and likely the right fit. Litro is for teams who want the web component model specifically; we'd rather help you pick the right tool than oversell ours.

## What's Next

A few benchmark gaps we know about:

- **Per-request SSR numbers.** Currently the HN benchmark measures SSG only. Adding a request-time SSR pass (start the server, hit N routes, measure TTFB) is the obvious next step. This is where streaming DSD should show its value.
- **Cold-boot measurements on edge runtimes.** Cloudflare Workers / Netlify Edge cold boots are where framework-level overhead matters most. We have the Nitro presets wired up but haven't run comparative numbers yet.
- **A framework-level fix for the FAST `:innerHTML` gap.** Today each app using FAST has to write its own post-build step to fill raw-HTML bindings. We want to ship a small supplemental package that provides a proper `unsafeHTML`-style directive for fast-ssr, so every FAST project gets the behavior for free.
- **Real-app case studies.** The HN clone is synthetic. We want a write-up of a production Litro app — what broke, what didn't, what we'd do differently.

The [benchmark source](https://github.com/beatzball/litro/tree/main/benchmarks) is public. Run it yourself with `pnpm bench:hn`. If you disagree with the methodology — or find a case where Litro loses that isn't covered here — open an issue. We'd rather publish honest losses than polished wins.

## What to Read Next

- [Benchmarks — live numbers](/benchmarks)
- [Adapter system overview](/docs/adapters/overview)
- [Streaming SSR with Declarative Shadow DOM](/blog/streaming-ssr-dsd)
- [Litro goes framework-agnostic](/blog/framework-agnostic)
