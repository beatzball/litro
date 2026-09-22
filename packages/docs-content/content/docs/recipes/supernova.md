---
title: Supernova Recipe
description: The supernova recipe creates a product landing page in front of a starlight docs site, with an optional blog.
date: 2026-01-01
---

# Supernova Recipe

The `supernova` recipe is the `starlight` recipe with a product landing page in front of it. You get a page to sell the thing at `/`, the documentation site under `/docs`, and a blog unless you decline it.

It is a marketing page and a docs site in one project, sharing one title, one navigation and one deployment.

## What You Get

- **A landing page at `/`** — hero, install command, feature rows, numbered steps, key hints and a card grid, all built from web components that ship in the project.
- **A docs site under `/docs`** — the whole `starlight` recipe: sidebar, table of contents, prev/next navigation and syntax highlighting.
- **A blog at `/blog`** — listing, posts and tag pages. Decline it and every part of it is left out.

Output is static (SSG). There is no `--mode` flag to choose.

The recipe ships a Lit template only. FAST Element and Elena overlays are not written yet, so `--adapter fast` and `--adapter elena` give you the Lit landing page.

## Scaffold

```bash
pnpm create @beatzball/litro my-site
# choose: supernova
# then:   Include a blog?
```

The blog question is asked only when you pass neither flag. The default answer is yes.

To skip the question in a script or in CI:

```bash
# with the blog
npm create @beatzball/litro@latest my-site -- --recipe supernova --blog

# without the blog
npm create @beatzball/litro@latest my-site -- --recipe supernova --no-blog
```

`--no-blog` removes `content/blog/`, `pages/blog/`, the Blog entry in the site navigation, the Blog button on the landing page and the Blog card in its card grid.

## Structure

The recipe extends `starlight`. The starlight template is copied in first, then this recipe's own files are written on top. Everything below that is not marked comes from starlight.

```
my-site/
  content/
    docs/                        ← docs pages (from starlight)
      getting-started.md
      installation.md
      configuration.md
      guides-first-page.md
      guides-deploying.md
    blog/                        ← omitted with --no-blog
      welcome.md
      release-notes.md
  _data/
    metadata.js                  ← site title and description
  pages/
    index.ts                     ← the landing page (supernova)
    docs/[slug].ts               ← doc article
    blog/index.ts                ← omitted with --no-blog
    blog/[slug].ts               ← omitted with --no-blog
    blog/tags/[tag].ts           ← omitted with --no-blog
  src/
    components/
      litro-hero-nova.ts         ← supernova
      litro-install-command.ts   ← supernova
      litro-feature-row.ts       ← supernova
      litro-steps.ts             ← supernova
      litro-key-hints.ts         ← supernova
      litro-status-line.ts       ← supernova
      litro-state-badge.ts       ← supernova
      litro-term-window.ts       ← supernova
      litro-hero-video.ts        ← supernova
      litro-card.ts              ← shared with the docs half
      litro-card-grid.ts         ← shared with the docs half
      litro-footer.ts            ← shared with the docs half
      starlight-page.ts          ← the docs layout
      starlight-header.ts
      starlight-sidebar.ts
      starlight-toc.ts
      litro-aside.ts
      litro-badge.ts
      litro-tabs.ts
      litro-tab-item.ts
  server/
    starlight.config.js          ← title, nav, sidebar, edit URL
  public/
    styles/starlight.css         ← the --sl-* token layer
  e2e/index.spec.ts              ← supernova
  app.ts
  nitro.config.ts
  vite.config.ts
```

Only `pages/index.ts`, the nine `litro-*` components marked supernova, and the end-to-end spec are this recipe's own files. The docs half is the starlight recipe, unchanged.

## The Components

Every one of these is a plain Lit element in your project. Edit it, restyle it or delete it.

| Component | What it is |
|---|---|
| `litro-hero-nova` | The hero backdrop: a star going off over a star field, drawn entirely in CSS. |
| `litro-install-command` | One command with a `$` prompt and a copy button. |
| `litro-feature-row` | One "what it does" row: heading, text, optional command chips, optional picture. Rows alternate sides on a wide screen. |
| `litro-steps` | A numbered `<ol>` with a connector line drawn between the numbers. |
| `litro-key-hints` | Key and meaning pairs as a definition list, every key in a `<kbd>`. |
| `litro-status-line` | The status line fixed to the foot of the window: your project's name, then a cell per fact — a version, where the reader is, a link. Every cell has to be something the page can prove; it renders nothing at all when it has nothing to say. |
| `litro-state-badge` | One state — error, blocked, working, done or idle — drawn as a glyph and a color. The tabs and the terminal rows are made of these. |
| `litro-term-window` | A small terminal picture: either a list of state, age and name, or whatever you slot in, such as a shell transcript. |
| `litro-hero-video` | A short product recording with a poster and one play/pause button. |

### What is safe to delete

- **`litro-hero-video`** is the only component the page does not use. The video section ships commented out, so the file sits unused until you turn it on. Delete the file if you will never add a clip.
- **The status line.** Delete the `STATUS_CELLS` entries in `pages/index.ts` and the line renders nothing at all — which is what it should do with nothing true to say.
- **The key hints.** Delete the `KEY_HINTS` list and the section goes with it.
- **A row's picture.** A `HIGHLIGHTS` entry with no `figure` gets no terminal window and lays itself out across the full width.

The rest are ordinary elements. Remove a component's use from `pages/index.ts` and its import, and the file can go.

## Theming

The landing page defines one token block, at the top of `static styles` in `pages/index.ts`. The page and all of its components read those `--nova-*` tokens and define no colors of their own, so retheming the whole page is one edit.

Every `--nova-*` value is `var(--brand-…, fallback)`. Set a `--brand-*` property anywhere above the page — `:root` in `public/styles/starlight.css` is the usual place — and the page follows it. Leave it unset and the fallback applies.

```css
:root {
  --brand-accent: #ff5a1f;
  --brand-accent-2: #38bdf8;
  --brand-bg: #0b0b12;
}
```

The names a project can set:

| Group | Properties |
|---|---|
| Surfaces | `--brand-bg`, `--brand-surface`, `--brand-border` |
| Text | `--brand-text`, `--brand-text-dim` |
| Accent | `--brand-accent`, `--brand-accent-2` |
| States | `--brand-error`, `--brand-blocked`, `--brand-working`, `--brand-done`, `--brand-idle` |
| Layout | `--brand-measure`, `--brand-gutter`, `--brand-radius`, `--brand-font-mono` |

### The docs half keeps its own tokens

The documentation pages are themed by the `--sl-*` layer in `public/styles/starlight.css` — `--sl-color-bg`, `--sl-color-text`, `--sl-color-accent`, the gray scale, the type scale and the layout widths. Those are a different set and they follow the reader's light or dark choice.

Do not redefine an `--sl-*` token inside the landing page's token block. The docs pages read the same names.

The landing page is dark whichever mode the reader is in, the way a product page usually is. That is one line, `color-scheme: dark` on `:host`. To make the landing page follow the reader's choice instead, delete that line and point the surface and text tokens at the `--sl-*` names.

## The Hero Art

`litro-hero-nova` is drawn in CSS. There is no image file, no `<img>` and no `url()`, so the hero costs no extra request and it retints from the accent tokens like everything else.

Four stacked layers make the star — a wide falloff into the dark, a shockwave ring spreading outward, a hot inner glow and a small bright core. The star field behind them is one element holding a handful of tiny radial gradients.

Your logo goes in the `mark` slot. It is drawn faded and centered, behind the content and in front of the star:

```html
<litro-hero-nova>
  <svg slot="mark" viewBox="0 0 64 64" role="img" aria-label="">…</svg>
  <section class="hero shell">
    <h1>Say what your product does, in one line.</h1>
  </section>
</litro-hero-nova>
```

Leave the slot empty and the wash and the ground still work; the recipe ships it empty on purpose, because a placeholder shape cropped against the edge is only a smudge.

## The Video Section

The recipe ships **no clip**, so the video section is commented out in `pages/index.ts` rather than pointing at a file that is not there. `litro-hero-video` itself is scaffolded and ready.

To turn it on:

1. Put your recording and its poster frame in `public/demo/`.
2. Add the import to the top of `pages/index.ts`, next to the other component imports:

   ```ts
   import '../src/components/litro-hero-video.js';
   ```

3. Uncomment the markup in `render()`:

   ```html
   <litro-hero-video
     poster="/demo/poster.jpg"
     label="What the tool does, in 15 seconds"
     .sources="${[
       { src: '/demo/clip.webm', type: 'video/webm' },
       { src: '/demo/clip.mp4', type: 'video/mp4' },
     ]}"
   >
     <span slot="caption">A short caption.</span>
   </litro-hero-video>
   ```

`sources` is a property, not an attribute, so it is set with `.sources`. A plain attribute arrives as a string and the element shows the poster and nothing else. List the encodings you have and the browser takes the first it can play.

Nothing is fetched by the markup. There is no `autoplay` attribute and `preload` is `none`, so the clip is downloaded only when the script starts it.

## Without JavaScript

The whole page is prerendered, so all of the copy is readable with JavaScript turned off. What changes:

- **The copy button** on `litro-install-command` is hidden, because it could do nothing. The command is still rendered, still readable and still selectable by hand — the `$` prompt is marked `user-select: none`, so a selection takes the command and not the prompt.
- **The video's play button** is hidden for the same reason. The poster stays, and that is the whole picture.
- **The status line still reads.** It is text and hairlines, rendered by the server, so it needs no script at all.
- **Rows still alternate sides.** That is `:nth-of-type`, not a property.

## Less Motion

Under `prefers-reduced-motion: reduce`:

- The hero's shockwave ring stands still. Nothing else on the hero animates, so a reader who asks for less motion still sees the whole picture, held still.
- Every state badge shows its settled state from the first frame. The starting glyph is taken out of the layout rather than left invisible, so Find in page does not match text nobody can see. Nothing in the header or the status line moves at all.
- The video does not autostart. It stays on the poster, and pressing the button still plays it — a direct request is not motion the page decided to make.

## Accessibility of the Pictures

The tab row and every terminal window are pictures, and they are marked as pictures: one `role="img"` with a sentence you write, and everything inside hidden from assistive technology. A screen reader gets your sentence instead of a column of glyphs that mean nothing read aloud.

Write a real sentence in `TABS_LABEL` and in each `figure.label`. It is the only thing a reader who cannot see the picture gets.
