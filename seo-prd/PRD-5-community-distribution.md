# PRD-5: Community & Content Distribution

**Priority:** P2
**Effort:** Ongoing — each distribution cycle is 1–2 hours per post
**Phase:** 3 (after PRD-1 is deployed and at least 3 blog posts are live)
**Dependencies:** PRD-1 deployed (for correct indexing signals); PRD-3 Posts 1–3 published

---

## Problem

SEO without distribution is slow. Google's ranking algorithm weighs backlinks and engagement
signals. A technically perfect site with zero inbound links will still rank poorly for
competitive queries.

The web components and JavaScript framework communities are active and reachable — Litro
needs to meet them where they are. The Lit community in particular is a pre-qualified
audience: they already use Lit, they already believe in web components, and they are
actively looking for a batteries-included framework around it.

---

## Goals

1. Each blog post reaches its target developer audience within 48 hours of publication.
2. Litro earns at least 5 organic backlinks from non-trivial developer sites within 90 days.
3. GitHub repository reaches 100 stars within 90 days.
4. Litro is listed in the Lit ecosystem, awesome-lit, and awesome-web-components — all
   of which are actively maintained lists that developers browse.

---

## Distribution Channels (in priority order)

### 1. Lit Ecosystem — Week 1, Before Anything Else

The Lit community is the most receptive possible first audience. These developers are
already sold on web components; Litro just needs to show them there's a batteries-included
framework for it.

**Actions (do these in Phase 1, not Phase 3):**

- Post in Lit Discord `#showcase` channel — short description, link to litro.dev, mention
  that it uses `@lit-labs/ssr` with DSD
- Open a PR to add `@beatzball/litro` to the `awesome-lit` GitHub list (if it exists and
  accepts framework entries)
- Open a PR to add `@beatzball/litro` to `awesome-web-components` GitHub list
- If the Lit team maintains a "built with Lit" page or showcase, submit Litro there

These cost 30 minutes and reach exactly the right audience. Do this before any Reddit or
HN activity.

---

### 2. Dev.to — Starting Phase 3

Dev.to has an active web components and Lit community. The canonical URL mechanism means
cross-posting does NOT create duplicate content penalties — the original litro.dev URL
remains the indexed version.

**How to cross-post:**
1. Create a `beatzball` organization on Dev.to
2. For each post: publish the full content with `canonical_url: https://litro.dev/blog/<slug>`
   set in the Dev.to editor
3. Wait 24 hours after publishing on litro.dev before cross-posting (gives Google time to
   index the canonical URL first)
4. Respond to every comment within 24 hours

**Post-to-tag mapping:**

| Post | Dev.to Tags |
|------|------------|
| Shadow DOM SEO | `#webcomponents #seo #javascript` |
| Why We Built Litro | `#webcomponents #javascript #showdev` |
| File-Based Routing | `#nextjs #webcomponents #javascript` |
| Streaming SSR | `#webcomponents #performance #ssr` |
| Blog Tutorial | `#tutorial #webcomponents #ssg` |
| Nitro Adapters | `#javascript #devops #webcomponents` |
| LitroRouter | `#webcomponents #javascript #opensource` |
| Performance | `#performance #javascript #nextjs` |

---

### 3. Reddit — Starting Phase 3

**Target subreddits:**

| Subreddit | Audience | Post Types |
|-----------|----------|------------|
| r/webdev | General web devs | Framework introduction, tutorials |
| r/javascript | JS developers | Technical explainers, architecture posts |
| r/webcomponents | Web component enthusiasts | All posts |
| r/reactjs | React developers | "From React to Lit" post only — approach carefully |

**Rules:**
- Space out posts across subreddits — never the same content to multiple subreddits
  simultaneously
- Title the Reddit post differently from the blog post (Reddit rewards curiosity gaps)
- Include a brief TL;DR in the post body; link is insufficient
- r/reactjs: lead with "I built a thing" not "React is bad." The community is defensive
  about comparisons. The post about migrating from React should acknowledge React's
  strengths, not attack them.
- Respond to every comment within the first 4 hours (Reddit algorithm rewards early
  engagement)

**Initial high-priority post:** After 3 posts are live, post a "Show Reddit: I built a
fullstack framework combining Lit web components and Nitro" introduction to r/webdev.
Lead with the "why" — the standards longevity argument — and link to the homepage. This
is a brand introduction, not a content post.

**Best posting time:** Tuesday–Thursday, 9am–12pm EST.

---

### 4. Hacker News — Phase 3, after Show Reddit succeeds

HN front-page appearances generate hundreds of high-authority backlinks. It is also the
community most likely to engage substantively with the "why we built this" architectural
argument.

**Show HN post** — the primary HN play:

```
Show HN: Litro – fullstack web framework built on Lit web components and Nitro

We built Litro because we wanted Next.js-style file-based routing and SSR but with native
web components (Lit) instead of React.

It uses the same Nitro server as Nuxt.js, so all deployment adapters (Vercel, Cloudflare
Workers, AWS Lambda, etc.) work out of the box. For SSR, it uses @lit-labs/ssr with
Declarative Shadow DOM — the same technique that makes React SSR SEO-friendly, but for
standards-based components.

Would love feedback on the DX and any questions about the architecture.

[link to litro.dev]
```

**When to post:** After 5+ blog posts are live and the docs are solid. HN rewards substance.
Post on a weekday, 9–10am EST.

**Other HN activity:**
- Comment on existing threads about web components, Next.js alternatives, or Nitro with
  a genuine contribution and a mention of Litro where relevant. Not link-dropping — only
  where Litro is directly applicable.
- Submit the "Why We Built Litro" post as an article link (not Show HN) after it's published.

---

### 5. Twitter / X — Phase 3 only, low priority

Useful for distribution once content exists. Not worth investing time in before Phase 3.

Follow and engage with:
- `@buildWithLit` (Lit team)
- `@pi0` (Nitro/Nuxt author — Litro is built on his work; engaging here is authentic)
- Web components community accounts

**Content types:**
- Code snippets: comparison "Next.js vs Litro side by side" screenshots
- Announcements of new blog posts
- Facts about DSD / architecture

No engagement-bait. Developer Twitter rewards technical depth.

---

### 6. Newsletter Outreach — Phase 3, opportunistic

Reach out only when you have something genuinely newsletter-worthy (a post with strong
Dev.to engagement is a credible signal). Do not mass-email.

| Newsletter | Audience | What to Submit |
|-----------|----------|---------------|
| JavaScript Weekly | General JS devs | Blog post or Show HN link |
| Web Components Weekly | WC enthusiasts | Framework announcement |
| Bytes.dev | Frontend devs | Comparison post or tutorial |
| This Week in Lit | Lit ecosystem | Direct submission to Lit team |
| UnJS Discord | Nitro/UnJS users | `#showcase` — Litro is a Nitro consumer |

The UnJS/Nitro Discord is particularly valuable because Litro is a legitimate Nitro
consumer. Posting in `#showcase` is not self-promotion — it's relevant to the community.

---

### 7. Earned Backlinks — Ongoing, No Outreach Needed

The following links can be earned without asking anyone:

1. **awesome-lit GitHub list** — open a PR to add `@beatzball/litro` (do this in Phase 1)
2. **awesome-web-components GitHub list** — same, open a PR
3. **Lit's "built with Lit" showcase** (if it exists) — submit directly
4. **Nitro's ecosystem list** — submit as a Nitro-based framework
5. **"Alternatives to Next.js/Nuxt.js" articles** — search for existing articles once
   Litro has 100+ GitHub stars; reaching out before that will be ignored

Do NOT chase roundup articles before the framework has enough traction to be taken
seriously. A rejection at this stage closes the door for later. Wait.

---

## Roundup Outreach — Explicitly Deferred

The original recommendation to pitch Litro for "alternatives to Next.js" roundup articles
is deferred until:
- GitHub stars ≥ 200
- npm weekly downloads showing consistent growth
- At least 2 positive HN/Reddit threads on record

Authors of "best alternatives to Next.js" articles need social proof before they will
include an unknown project. Pitching too early wastes the contact and may result in a
permanent no.

---

## Google Search Console Setup

This is a prerequisite for all distribution measurement. Do this in Phase 1.

1. Add `litro.dev` as a property in Google Search Console
2. Verify via DNS TXT record (preferred) or HTML file in `/docs/public/`
3. Submit `https://litro.dev/sitemap.xml`
4. Use URL Inspection to manually request indexing for the homepage and any high-priority
   new pages immediately after they go live
5. Check the Coverage report weekly for the first month for crawl errors

---

## Timing Summary

```
Phase 1 (now):
  - Google Search Console setup
  - Lit Discord #showcase post
  - awesome-lit and awesome-web-components PRs
  - UnJS/Nitro Discord #showcase

Phase 3 (after 3+ blog posts live):
  - Dev.to cross-posts for Posts 1–3
  - r/webdev introduction post
  - Dev.to cross-posts for Posts 4–5 as they publish

Phase 3 (after Show Reddit traction):
  - Hacker News Show HN submission
  - JavaScript Weekly / Web Components Weekly outreach

Ongoing (per post):
  - Dev.to cross-post (24h after litro.dev publish)
  - Relevant subreddit post
  - Twitter announcement
```

---

## Metrics to Track

| Metric | Tool | Frequency |
|--------|------|-----------|
| Organic impressions | Google Search Console | Weekly |
| CTR by page | Google Search Console | Weekly |
| Indexed page count | Google Search Console | Weekly |
| GitHub stars | GitHub | Weekly |
| npm weekly downloads | npmtrends.com | Monthly |
| Dev.to views + reactions | Dev.to dashboard | Per post |
| Reddit upvotes / comments | Reddit | Per post |
| Referring domains (backlinks) | Google Search Console | Monthly |

---

## Acceptance Criteria

- [ ] Google Search Console set up and sitemap submitted (Phase 1)
- [ ] Lit Discord `#showcase` post published (Phase 1)
- [ ] PR opened to `awesome-lit` (Phase 1)
- [ ] PR opened to `awesome-web-components` (Phase 1)
- [ ] Dev.to organization created for beatzball (Phase 3)
- [ ] Posts 1–3 cross-posted to Dev.to with canonical URLs (Phase 3)
- [ ] Introduction post published to r/webdev (Phase 3)
- [ ] Show HN submitted (Phase 3, after 5+ posts live)
- [ ] Roundup outreach deferred until GitHub stars ≥ 200
