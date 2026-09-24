# create-litro

## 0.12.0

### Minor Changes

- a398c22: Refuse an adapter the chosen recipe cannot produce.

  `--recipe supernova --adapter fast` used to exit 0 with a mixed app. Supernova
  extends starlight, so starlight's FAST overlay set `LITRO_ADAPTER = 'fast'` and
  swapped the docs pages over, and supernova's own template then put its Lit
  landing page and its nine Lit components back on top. Nothing said so.

  Each recipe now declares the adapters it really supports in its config —
  `fullstack` lit and elena, `11ty-blog` lit, `starlight` lit, fast and elena,
  `supernova` lit. Support is declared, never read off the `template-<adapter>/`
  directories on disk, because a recipe that extends another inherits its base's
  overlays. Asking for anything else exits non-zero, names the recipe, the
  adapter and what the recipe does support, and writes nothing at all. The
  interactive prompt offers only the adapters the chosen recipe supports, and
  skips the question when there is one.

- bada4f1: Give a scaffolded docs site a page at `/docs`.

  The starlight recipe shipped only `pages/docs/[slug].ts`, so `/docs` was a 404.
  A reader who typed the obvious path, or trimmed a URL back one segment from
  `/docs/getting-started`, landed on nothing — and a static host that will not
  list a directory turns that into a 403, which reads as "forbidden" rather than
  "no such page". Supernova inherited the same hole.

  Every adapter variant of the recipe now ships `pages/docs/index.ts`, a landing
  page that lists each sidebar group and each entry under it, with the entry's
  frontmatter `description` where the content file has one. It is a real
  prerendered page, not a redirect, so any static host serves it and it works
  with no client JavaScript. The site navigation's Docs entry points at `/docs`,
  which is also what lets the prerender crawler reach the page — in the recipe
  template and in the config `--for-repo` writes for itself, which is a separate
  copy.

  A sidebar group whose `items` array is empty is dropped rather than rendered as
  a heading over an empty list.

### Patch Changes

- c69b421: Scaffold an absolute project path where it was asked for.

  `create-litro /tmp/demo/my-app` wrote a whole `./tmp/demo/my-app` tree inside
  the current directory and printed the usual success block. The target was built
  with `join(process.cwd(), projectName)`, and `join` concatenates an absolute
  second argument rather than replacing the first.

  The path is now resolved once and used everywhere: for the target directory,
  for the "directory already exists" refusal, and for the path printed back, so
  `cd <path>` is a command that works. A relative path behaves exactly as before.

  `{{projectName}}` — which becomes `package.json`'s `name` and the site title —
  is now the last segment of the path alone, because neither can hold a path.

  A quoted leading `~` expands to the home directory instead of creating a
  directory literally called `~`. A `~someone` form is refused rather than
  guessed at, as is a path with no last segment to name the project after.

  `--for-repo` now refuses a site outside the repository it names. The path from
  the repo root down to the site is published — it becomes the starlight config's
  `editUrlBase`, which is an "Edit this page" link on GitHub, and it heads the
  generated `AGENTS.md`. A site beside the repository produced `..` in both, and
  an edit link with `..` in it does not resolve. The refusal names both paths and
  runs before anything is written.

- 8aafdf0: starlight: docs and blog pages no longer open in light mode on a dark system

  The head script set `data-theme` before the first paint, from the reader's
  stored choice or, when there was none, from `prefers-color-scheme`. That part
  was right. `starlight-header` then resolved the theme a SECOND time in its
  first update and wrote the answer back — with a bare `?? 'light'` fallback and
  no look at the system. It answered a moment later and overwrote a correct value,
  so on a dark system every page carrying the header flipped to light right after
  it loaded. All three adapter overlays had it.

  The header now READS `data-theme` instead of deciding it, and stops when it is
  taken off the page. The head script stays the one decider: it guards every
  `localStorage` read, because storage throws rather than returning null when site
  data is blocked, and it follows a later system change while — and only while —
  the reader has stored no choice of their own.

  The stylesheet gains an `@media (prefers-color-scheme: dark)` branch guarded by
  `:not([data-theme="light"])`, so a dark system gets a dark page with JavaScript
  turned off, and an explicit light choice still wins when scripts are running.
  Both themes now declare a `color-scheme`, so form controls and scrollbars follow
  too.

  `litro-hero-nova` also gains two optional tokens, `--nova-mark-size` and
  `--nova-mark-size-narrow`, for how wide the mark is drawn. A site whose mark
  should hold the whole right of the pane sets them in the same block it sets its
  colors in; the recipe's defaults are unchanged.

  The guard around that read is a browser check, not a `document` check.
  `typeof document === 'undefined'` is not the same question:
  `@microsoft/fast-ssr` runs `connectedCallback` on the server against a document
  shim that defines `document` and leaves `documentElement` undefined, so the
  first version of this fix reached
  `document.documentElement.getAttribute('data-theme')` during SSR and threw.
  Every page in a FAST starlight site served a stream that stopped at the header.
  All three overlays now guard on `document.documentElement` itself and keep
  `matchMedia` off the server path.

- 8aafdf0: supernova: the hero gets a default mark, and your own logo still replaces it
- 8aafdf0: supernova: a redesigned hero, and the fixes the landing page needed once a real site used it

  Found while rebuilding litro's own docs home pages on this recipe — the first
  project to use it in anger.

  **The hero is redesigned.** It drew a shockwave ring, a hot inner glow and a
  bright core around the same point as the `mark` slot, and laid a centered stack
  of copy over the top. The logo sat in the middle of a target, and nothing in the
  composition led the eye anywhere.

  `litro-hero-nova` is now one screen-high pane: a deep tinted ground, one wide
  soft wash of accent light, and the `mark` slot drawn very large and cropped
  against the pane's right edge, so a project's logo reads as atmosphere rather
  than as a badge floating in the middle. With no mark slotted nothing is painted
  at all — an empty hero is a finished hero, with no ghost shape. Its slots and
  its tag are unchanged, so no page has to change; it reads one new optional
  token, `--nova-hero-min`, for the pane's height. Nothing animates, so its
  `prefers-reduced-motion` rule and its keyframes are deleted rather than left as
  dead CSS.

  **The landing page is left-aligned on a column**, and its headline is set in the
  same mono face as the status bar, the badges and the command — so the page
  speaks in one voice. The sans is kept for prose.

  **`litro-install-command` is a slab, not a chip.** It fills the column it is
  given, the copy control is a labeled panel of its own flush to the right edge,
  and a new optional `note` slot carries one line of small print underneath. Slot
  nothing and the line is not there.

  - `litro-status-bar` styled its navigation with `::slotted(a)`, so a page that
    handed the bar anything else — a routing link element, or a button that opens
    a search dialog — got an unstyled control beside the styled links. The rule
    now matches on the slot name, `::slotted([slot='nav'])`, and resets a
    button's own font, background and border.
  - `litro-status-bar` let the name segment shrink to nothing on a phone, which
    left an empty arrow where the project's name should be. Below 30rem the name
    segment is dropped and the mark carries the home link on its own.
  - The landing page's shadow root never repeated the global `box-sizing` reset,
    so every full-width section was its width PLUS its gutters and a phone
    scrolled sideways by exactly one gutter.

  - `litro-status-bar` sized and colored its navigation with `::slotted(a)`, so a
    page that handed the bar anything else — a routing link element, or a button
    that opens a search dialog — got an unstyled control beside the styled links.
    The rule now matches on the slot name, `::slotted([slot='nav'])`, and resets
    a button's own font, background and border.
  - `litro-status-bar` let the name segment shrink to nothing on a phone, which
    left an empty arrow where the project's name should be. Below 30rem the name
    segment is dropped and the mark carries the home link on its own.
  - `litro-install-command` had no `box-sizing` on its box and no `min-width: 0`
    on the command, so a long command pushed the box wider than the space it was
    given and a phone scrolled sideways. The command now scrolls inside the slab,
    which is what its `overflow-x` was always meant to do.

  **A scrolling box a keyboard can reach.** Both boxes that scroll sideways on a
  narrow screen — the install command and the terminal window — are tab stops
  now, with a name to hear on the way in and a focus-visible ring. A region that
  scrolls and cannot be focused is unreachable without a pointer; axe-core reports
  it as `scrollable-region-focusable`, and it shipped on every page a scaffolded
  site put the install command on. `litro-install-command` takes a new optional
  `commandLabel` for that name, which defaults to "Install command".

  **`litro-term-window` fits on a phone.** Its host had no `min-width: 0`, so as a
  grid item its smallest size was the widest transcript line plus its padding. A
  wide transcript pushed its column past the screen and the landing page scrolled
  sideways at 320px, the width WCAG 1.4.10 measures reflow at. The window shrinks
  now and the transcript scrolls inside it. The recipe's own "Get running" grid
  asks for `minmax(0, 1fr)` rather than a bare `1fr` for the same reason.

- 8aafdf0: supernova: one header on every page, and the terminal line moves to the foot

  The landing page carried a terminal bar of its own at the top, so a reader met
  two different headers on one site — the risk section 13 of the recipe's spec
  named. It now carries the SAME `starlight-header` the docs pages do, and the
  terminal character moves to where a status line belongs: a fixed line at the
  foot of the window.

  `litro-status-bar` is replaced by `litro-status-line`, a new tag. It is not a
  second layout mode on the old component: every property the bar had was about
  being a header — a home link, a tab row, a navigation slot — and none of them
  survive the move. What the line does instead is state facts:

  - on a landing page, whatever the project can prove about itself;
  - on a docs or blog page, where the reader is, and the link that edits it.

  **Every cell must be true.** The bar's tab row showed tasks settling from
  working to done on a page that had no tasks, which is a drawing in the most
  credible place on a page. The line has no tabs and no states it cannot know,
  and with no cells at all it renders nothing rather than an empty bar.

  `starlight-header` gains `--sl-font-brand`, the face its wordmark and links are
  set in. It falls back to the body sans, so a site that never sets it looks
  exactly as it did; supernova sets it to the mono, which is the whole of the
  difference between its header and the docs pages' one. The header's navigation
  also scrolls rather than overflowing below 48rem — on the docs pages it was
  hidden behind the hamburger and this never showed, but a landing page has no
  sidebar and keeps its links.

- 8aafdf0: supernova: the cards stop floating, and the landing page gains six sections

  **The feature block is panes, not cards.** `litro-pane` and `litro-pane-grid`
  replace the card kit on the landing page: square corners, no shadow, and a
  hairline that two neighbors SHARE rather than each carrying their own. The grid
  is six columns, so a row is two halves or three thirds and seven items fill
  three rows with no orphan. Both of the sites this page is measured against do
  exactly this, and neither uses a card kit.

  The emoji are gone. A pane carries a state glyph, which says something true —
  `[+]` ships, `[~]` is still moving — and an `icon` slot for a REAL mark where a
  project has one. A scaffolded site has no mark that means anything yet, so it
  says it in words and no placeholder icon is drawn.

  **Six more sections**, each one block with a comment above it saying what it is
  for and that deleting it is fine: a logo wall, a capability block, what the
  project is built on, a stats row, an ecosystem list, deploy targets, and a real
  footer with link columns in place of the one-line credit.

  **Placeholders are honestly empty.** The logo wall's slots read "Your logo",
  the stats are dashes, and nothing invents a company, a download count or a
  quote. A scaffolded site never claims proof it does not have.

  `litro-site-footer` is new. Pass it no columns and only the fine print is
  drawn, which is where this started.

  `removeBlog` now also unpicks a `/blog` link from the landing page's footer
  columns. Nitro's prerenderer crawls the links it finds, so one left behind made
  `--no-blog` prerender a blog whose pages had just been deleted.

- 8aafdf0: supernova: the landing page follows the theme, and a status cell's words no longer touch

  **Light mode did nothing on the landing page.** The page hard-coded a dark
  palette and `color-scheme: dark`, so the toggle had nothing to act on: a reader
  switching to light watched the docs pages change and the landing page stay
  dark. The palette now lives in `public/styles/starlight.css` as `--brand-*`
  values, in the same light and dark blocks the `--sl-*` tokens use — so the
  landing page follows the toggle, the system preference, and the
  `prefers-color-scheme` block that carries both with JavaScript turned off. The
  page's token block is unchanged in shape: every line is still
  `var(--brand-…, <fallback>)`.

  **The accent is one value again.** `--brand-accent` reads `--sl-color-accent`
  rather than repeating a hex, so the landing page and the docs pages cannot
  drift. Two more accents are derived from it rather than typed: one dark enough
  to carry white text on it, for the status line's mode segment and the primary
  button, and one dark enough to read as small text on a light page.

  **A linked status cell lost its word spacing.** The gap that separates a glyph
  from a word lives on `.cell`, and a cell that links somewhere has one child —
  an anchor — so everything inside it had no gap and the line read
  "built withlitro". The anchor is the flex row now.

  The hero's mark also reads `--nova-mark-opacity`, because the value that is
  right on a near-black ground is nearly invisible on an off-white one.

- 8aafdf0: supernova: the showcase takes pictures, and a capability block opens with a claim

  The recipe's ecosystem section becomes a showcase: each row is a starting
  point and the picture slots show the shape it gives you. They ship EMPTY, as
  dashed frames that say "Your screenshot", exactly like the logo wall — a
  project fills them with real sites or deletes the list.

  A row never claims which recipe a particular site runs. That distinction is
  the point: a site's look and a site's recipe are different facts, and writing
  the section this way means it stays true when either one changes.

  Links inside a paragraph are underlined now, not only colored. A link told
  apart by color alone fails for a reader who cannot see the color, and
  axe-core reports it.

## 0.11.1

### Patch Changes

- 67a3eec: Document the supernova recipe in the package README: a `supernova` section
  covering what it generates and the components it ships, the `--blog` /
  `--no-blog` flags in the usage examples, and a note that the recipe ships a Lit
  template only.

## 0.11.0

### Minor Changes

- 251387f: Add `<litro-hero-video>` to the supernova recipe: a poster, a play/pause
  button and a caption slot for a short product recording.

  Nothing is fetched by the markup itself — there is no `autoplay` attribute and
  `preload` is `none` — so a reader who asked for less motion, or who has
  JavaScript off, downloads no video and gets the poster. When motion is welcome
  the script starts the clip, which does fetch it; that is the behavior the page
  wants, and it is the only path that costs a download. It starts once: the copy
  of the element the router replaces on a first load no longer asks for the clip
  as well.

  The button names the action it performs rather than the state the video is in,
  and it follows the video — including when the clip cannot be played at all.
  When every `<source>` fails, Chromium leaves `play()` pending for good and
  `paused` false, so the button reads the element's own signals instead of the
  promise and goes back to "Play".

  With no `sources` there is a poster and no button, which is the state a freshly
  scaffolded site is really in: no media ships with the recipe. The recipe's
  landing page carries the section commented out, with the import line and the
  `.sources` property the markup needs.

- 7385d44: The supernova landing page gets its terminal parts: `litro-state-badge`, `litro-status-bar` and `litro-term-window`, scaffolded into the new site's `src/components/` like the five before them.

  The status bar replaces the docs header on the landing page. It shows the project's mark and name as one link home, a row of tabs each carrying a state badge, and the site's navigation — taken from `server/starlight.config.js`, the same place the docs header reads, so both halves of the site name the site the same way and link to the same pages. Declining the blog therefore takes the Blog link out of the bar too, because the entry is gone from the navigation.

  A badge draws one of five states as a glyph and a color, and the glyph set is a property, so a project can use its own text. It can settle from one state to another; that animation is CSS, so it runs with JavaScript turned off, and `prefers-reduced-motion` shows the settled state from the first frame instead. The terminal window draws either rows of state, age and name or a transcript you slot in, and it renders as one `role="img"` with the sentence you give it, so a screen reader hears one description rather than a column of glyphs.

  All three render on the server and bring no dependency, no image and no font. The landing page now puts a terminal window in two of its feature rows, and carries a commented-out placeholder where the video section arrives next.

### Patch Changes

- 5f51638: Two fixes to the supernova recipe's `litro-status-bar`.

  The tab row is a div of spans rather than an `ol` of `li` elements. It still carries one `role="img"` and the same sentence, and every tab inside it is still hidden from assistive tech, so nothing is announced differently — but ARIA in HTML does not allow `role="img"` on a list, and axe-core reported `aria-allowed-role` on the prerendered page. A row of fake tabs is a picture, not a list of anything a reader can act on.

  The site name is also shortened with an ellipsis when it does not fit. The bar is one line high, so a long name has always been cut on a narrow screen; it now reads as a cut instead of ending mid-letter.

## 0.10.0

### Minor Changes

- a829c55: A recipe can now build on another recipe, and can ask its own questions.

  - `extends` on a recipe config copies a base recipe's templates in first:
    base `template/`, base `template-<adapter>/`, then the recipe's own
    `template/` and `template-<adapter>/`. Later layers overwrite earlier ones.
    One level only — a deeper chain, an unknown base, or a recipe that extends
    itself is refused with a message naming both recipes.
  - The scaffolded `litro.recipe.json` now names the recipe the user chose rather
    than the template the file came from, and records the resolved recipe options
    under `options`.
  - Blog removal moved into one shared function. `--for-repo` without
    `--with-blog` behaves exactly as before; a recipe that offers a `blog` option
    gets the same removal, minus the repository link there is nothing to point at.
  - `--blog` and `--no-blog` answer a recipe's blog question without a prompt,
    for scripts and CI. A flag for a question the chosen recipe does not ask is
    an error rather than a silently ignored argument.
  - `--for-repo` now accepts any recipe that is, or extends, `starlight`.

- 9e1be1e: supernova: the landing page is now built from five components of its own, and themed from one token block.

  `litro-install-command`, `litro-feature-row`, `litro-steps`, `litro-key-hints` and `litro-hero-nova` are scaffolded into the new site's `src/components/`, where the user owns and edits them. They bring no dependency, no image, no font and no video, and they all render on the server, so the page still reads with JavaScript turned off. The copy button is the one part that needs it: when a browser refuses the clipboard it selects the command instead and says "Selected" rather than "Copied", and announces which of the two happened.

  The hero art is drawn in CSS — an exploding star over a star field, with a `mark` slot for the project's own logo and a pulse that stops under `prefers-reduced-motion`.

  Every color now comes from one token block on the landing page's host, grouped into surfaces, text, accent, states and layout. The components define no colors of their own, so editing that block rethemes the whole page. A comment there lists the `--sl-*` tokens the docs half owns, so neither set is redefined by accident.

- 06c5bc7: Add the `supernova` recipe: the starlight docs site with a product landing page in front of it.

  `supernova` extends `starlight`, so its own template holds one file — the landing page. The docs half, the blog and the shared components are copied in from starlight and are never committed twice. Scaffold it with `--recipe supernova`, and answer its `blog` question with `--blog` or `--no-blog`.

  The landing page is built only from components the starlight template already ships (`starlight-header`, `litro-card-grid`, `litro-card`, `litro-footer`). Every string on it is a placeholder a user replaces, and the whole page renders on the server, so it reads with JavaScript off.

  Declining the blog now also drops the Blog entry from `server/starlight.config.js`. The header renders that navigation on every page, so leaving the entry behind put a dead link across the whole site, not only on the landing page.

## 0.9.0

### Minor Changes

- eb70043: Add a "Created using Litro" credit line to every scaffolded site.

  A new `<litro-footer>` component ships in all three recipes and all three
  adapters — Lit, FAST and Elena — and names the recipe the project came from:
  "Created using Litro, starlight recipe", linking to litro.dev. It is a quiet
  line at the bottom of the page and a comment above it says how to remove it.

  The starlight recipe places it in the shared `starlight-page` layout, so docs,
  blog and tag pages all get it from one place, plus the splash page which does
  not use that layout. The fullstack and 11ty-blog recipes have no shared layout,
  so each page places it directly.

  Scaffolding now interpolates `{{recipe}}`, which is what lets one component
  file name the recipe it was scaffolded into.

  FAST needs a property binding rather than a plain attribute at the usage site:
  fast-ssr does not map attributes onto properties, so `recipe="starlight"`
  server-renders the credit without the recipe name. Measured, not assumed.

  `scripts/verify-scaffolded-apps.mjs` now asserts the credit survives to
  rendered output for all six variants, reading the prerendered HTML where the
  recipe prerenders and the server bundle where it does not. That check is what
  caught the FAST problem, which compiled and built cleanly.

## 0.8.0

### Minor Changes

- 7ddd33b: Add `--for-repo`, which turns a scaffolded starlight site into a specific
  project's documentation site.

  ```sh
  npm create @beatzball/litro@latest -- site \
    --recipe starlight --for-repo . --site-url https://example.dev
  ```

  It reads the repository's name, description, remote and default branch, then
  writes `_data/metadata.js`, `server/starlight.config.js` (title, nav with a
  GitHub link, and "Edit this page" links pointing at the right branch and
  subdirectory), a `Dockerfile` + `nginx.conf` deploy, and an `AGENTS.md` that
  tells any coding agent how to add a page correctly.

  The sample blog is removed by default (`--with-blog` keeps it) — including the
  landing page's link to it and the blog routes in the generated e2e spec, so a
  new site has no dead link and its own test suite passes.

  It does **not** write your documentation. Turning a README into good pages is a
  judgement call, so it leaves one honest placeholder page and points the agent
  at `AGENTS.md`.

  Every lookup degrades rather than failing: with no git remote it falls back to
  the directory name, sets `editUrlBase: null`, omits the GitHub nav entry, and
  prints what you still need to fill in. Works offline and without `gh`.

  Other flags: `--site-url <url>`, `--deploy <docker|none>`, `--with-blog`.

  `packageManager` is now pinned in the scaffolded `package.json` to the pnpm
  that ran the scaffold, so the Docker build uses the same pnpm that produced
  the lockfile instead of whatever corepack resolves as newest.

## 0.7.3

### Patch Changes

- cec1777: Scaffolded apps now actually get a `.gitignore`.

  npm strips `.gitignore` from every published tarball — it is on npm's own
  exclusion list with no way to opt out via `files`. The recipe templates stored
  the file under its final name, so it shipped fine from a local build and
  silently vanished for anyone installing from the registry. Every app created
  with `npm create @beatzball/litro` arrived with **no ignore rules at all**, so
  its first `git add` swept in `node_modules/`, `dist/`, the generated stubs, and
  any `.env`.

  The templates now store it as `gitignore` and the scaffolder renames it on
  copy. `.gitkeep` and `.11tydata.json` are unaffected — npm's exclusion list is
  specific, not "all dotfiles".

  The `scaffolded-apps` CI guard now scaffolds from the **packed tarball** rather
  than the local build, and asserts the resulting app has a `.gitignore` covering
  `node_modules/`, `dist/` and `server/stubs/`. Running the local build was why
  this class of bug was invisible: a tarball is not the source directory with a
  different name.

## 0.7.2

### Patch Changes

- 83c8d5a: Scaffolded apps no longer list `'source'` in `resolve.conditions`. An installed
  package's TypeScript is never transpiled by Vite, so resolving to source emitted
  raw decorators and produced a client bundle no browser could parse — a blank
  page from a build that reported success. Templates now consume the packages'
  compiled output.

  Affected the `fullstack`, `11ty-blog`, and `starlight` recipes on the `lit` and
  `fast` adapters, on Vite 8. The `elena` adapter was unaffected.

- 7c93db8: Two fixes to what a scaffolded app ships:

  **Generated stubs are no longer committable.** The templates ignored
  `server/stubs/page-manifest.ts` (and the fullstack action stubs) by name, but
  the scanners also emit `litro-content.js` and `agent-*.ts`, and several of
  those embed the absolute filesystem path of the machine that built them. A new
  app would commit a local path on its first `git add`. The whole
  `server/stubs/` directory is now ignored, so a newly added scanner cannot
  silently start leaking one. `server/plugins/litro-actions.ts` is unaffected —
  it lives outside `stubs/` and stays tracked, as intended.

  **End-to-end tests no longer run against whatever else owns port 3000.** The
  generated `playwright.config.ts` hardcoded port 3000 with
  `reuseExistingServer`. If any unrelated app was already listening there,
  `litro dev` moved to the next free port while Playwright ran the entire suite
  against the stranger and reported confusing 404s. The config now uses port
  4321 (override with `LITRO_E2E_PORT`), passes `--port` to `litro dev`, and
  never reuses an existing server.

## 0.7.1

### Patch Changes

- e576f80: Bump `nitropack` from `^2.13.1` to `^2.13.4` in scaffolded recipe templates, resolving Medium-severity advisories GHSA-5w89-w975-hf9q and GHSA-9phm-9p8f-hw5m.
- 16d2705: Recipe templates' `server/middleware/vite-dev.ts` now builds its dev Vite server from `litroViteDevConfig()` (and pre-warms the client entry via `warmupLitroViteServer()`), so scaffolded apps get the live-source dev entry fix for issue 97 instead of serving a stale pre-built bundle.

## 0.7.0

### Minor Changes

- 7602471: The fullstack template ships with Server Actions pre-wired: actions plugin and endpoint handler in `nitro.config.ts`, `no-store` route rule, `#litro/action-manifest` import mapping, `litroActionsPlugin()` in `vite.config.ts`, form enhancer in `app.ts`, and a demo `greet` action with a progressive-enhancement form on the home page.

## 0.6.0

### Minor Changes

- 1f4d669: Scaffolded projects now use Vite 8 (was Vite 5). All recipe templates (fullstack, 11ty-blog, starlight) across the Lit, FAST, and Elena adapters pin `vite` to `^8`. New projects require Node `^20.19.0 || >=22.12.0`.

### Patch Changes

- 658550d: Fix port mismatch and stale references in scaffolder output and recipe templates: post-scaffold success message, recipe playwright configs, and recipe content all said `localhost:3030` while the default Litro dev server listens on `3000`.
- fe81671: npm metadata and scaffolder docs: rewrite the package description and keywords to mention all three adapters (Lit / FAST / Elena), and fix the README's Deno scaffold command (`deno init --npm @beatzball/litro my-app` — the older `deno create npm:…` form was removed in Deno 2.x).

## 0.5.2

### Patch Changes

- 08cf41c: Add dev:portless and preview:portless scripts to recipe templates

## 0.5.1

### Patch Changes

- 97baa72: Update Elena template dependencies to @elenajs/core 1.0.0 and @elenajs/ssr 1.0.0-alpha.10

## 0.5.0

### Minor Changes

- d459a96: Add `--adapter` flag for selecting framework adapter (lit/fast)
- 8c081a8: Add `--adapter elena` option with fullstack recipe template for Elena (light DOM web components).
- b66734f: Add Elena framework adapter template for the starlight recipe
- 44196c4: Add per-adapter template overlay support and FAST Element starlight recipe template

## 0.4.2

### Patch Changes

- 035912e: feat: starlight recipe uses `skipLinks` array API with `DEFAULT_SKIP_LINKS`

## 0.4.1

### Patch Changes

- 619ec3c: feat(seo): inject seoHead and seoTitle from pageData into HTML shell

  Pages can now return `seoHead` (a string of meta/JSON-LD tags) and `seoTitle` from `definePageData()`. The framework extracts these at request time and injects them into the actual `<head>` element of the HTML response — not buried in the `__litro_data__` JSON blob.

  Also bumps the `h3` dependency to `>=1.15.6` to patch CVE GHSA-22cc-p3c6-wpvm.

  Also improves npm discoverability: updated descriptions and keywords for all three packages, and rewrote the framework README with a Hello World example, comparison table, and SEO section.

## 0.4.0

### Minor Changes

- 1cd1e7f: Add syntax highlighting to the starlight recipe. Code blocks in Markdown docs are now automatically highlighted at SSG build time using `highlight.js` with the fire palette theme (dark background, orange keywords, sky-blue strings, amber numbers). The `DocPage` component includes `static override styles` with all `.hljs-*` token rules so highlighting works correctly inside the Lit shadow DOM.
- 1a84fad: Add responsive hamburger menu to the starlight recipe. A hamburger button appears to the left of the site logo on screens ≤72rem where the sidebar is hidden. Clicking it opens/closes the sidebar as a fixed drawer overlay with a backdrop. The nav auto-closes on route change.

## 0.3.0

### Minor Changes

- 2456382: Add official documentation site and starlight recipe improvements

  **`@beatzball/litro`**

  - Add `LITRO_BASE_PATH` env var support in `create-page-handler.ts` — prefixes the `/_litro/app.js` script URL for sub-path deployments (e.g. GitHub Pages project sites at `owner.github.io/repo/`)
  - Fix Lit hydration mismatch on SSR'd pages: `LitroPage.connectedCallback()` now peeks at the `__litro_data__` script tag to set `serverData` before Lit's first render, without consuming the tag
  - Fix layout shift on navigation: `LitroOutlet.firstUpdated()` no longer eagerly clears SSR children — the router's atomic swap handles it

  **`@beatzball/litro-router`**

  - Atomic DOM swap in `_resolve()`: new element is appended hidden alongside old SSR content, waits for `updateComplete` + `requestAnimationFrame`, then old content is removed and new element revealed — eliminates blank flash and layout shift during navigation
  - `_lastPathname` guard prevents re-render on hash-only `popstate` events (TOC / fragment link clicks)

  **`@beatzball/create-litro`**

  - Starlight recipe: rename `sl-card`, `sl-card-grid`, `sl-badge`, `sl-tabs`, `sl-tab-item`, `sl-aside` → `litro-card`, `litro-card-grid`, `litro-badge`, `litro-tabs`, `litro-tab-item`, `litro-aside` to avoid collision with Shoelace's registered custom element names
  - Starlight recipe: integrate Shoelace (`@shoelace-style/shoelace`) — tree-shaken component imports in `app.ts`, icon assets at `/shoelace/assets/`, theme CSS at `/shoelace/themes/`; `sl-button` and `sl-icon-button` now available in all scaffolded starlight sites
  - Starlight recipe: `litro-card` improvements — equal-height cards via flex column, icon + title rendered inline side-by-side, new `iconSrc` prop for image-based icons
  - Starlight recipe: sticky header via `:host { position: sticky }` (works correctly across shadow DOM boundary); sticky TOC matching sidebar behaviour
  - Starlight recipe: theme script falls back to `prefers-color-scheme` when no localStorage preference is set
  - Add `docs/` workspace (`@beatzball/litro-docs`) — official Litro documentation site built on the starlight recipe, deployed to GitHub Pages via `.github/workflows/docs.yml`

## 0.2.1

### Patch Changes

- 338e2c7: Add Playwright e2e setup to all recipe templates. Each scaffolded project now includes `playwright.config.ts` and `e2e/index.spec.ts` with 3 starter tests, and `@playwright/test` in `devDependencies`.

## 0.2.0

### Minor Changes

- 78fdaf6: Add `starlight` recipe — Astro Starlight-inspired docs + blog site scaffolded as Lit web components with full SSG support.

  `npm create @beatzball/litro my-docs -- --recipe starlight` scaffolds a static docs + blog site with:

  - **Layout components**: `<starlight-page>`, `<starlight-header>`, `<starlight-sidebar>`, `<starlight-toc>`
  - **UI components**: `<sl-card>`, `<sl-card-grid>`, `<sl-badge>`, `<sl-aside>`, `<sl-tabs>`, `<sl-tab-item>`
  - **Pages**: `/` (splash), `/docs/:slug`, `/blog`, `/blog/:slug`, `/blog/tags/:tag` — all SSG-prerendered
  - **`--sl-*` CSS token layer** with dark/light mode toggle and no flash of unstyled content
  - **`server/starlight.config.js`** — site title, nav links, sidebar groups
  - SSG-only (no `--mode` flag needed)

## 0.1.4

### Patch Changes

- 76d3bc7: fix: client-side navigation links do not work on first load

  `<litro-link>` clicks were silently no-ops in scaffolded apps because of
  three compounding bugs.

  ***

  **Bug 1 — Empty route table on init** (`LitroOutlet`, `app.ts`)

  `app.ts` set `outlet.routes` inside a `DOMContentLoaded` callback (a
  macrotask). By that point Lit's first-update microtask had already fired,
  so `firstUpdated()` ran with `routes = []` and the router was initialised
  with no routes.

  _Fix — `LitroOutlet`_: Replace `@property({ type: Array }) routes` with a
  plain getter/setter. The setter calls `router.setRoutes()` directly when
  the router is already initialised, without going through Lit's render cycle
  (which would crash with "ChildPart has no parentNode" because
  `firstUpdated()` removes Lit's internal marker nodes to give the router
  ownership of the outlet's subtree).

  _Fix — `app.ts`_ (fullstack recipe template + playground): Set
  `outlet.routes` synchronously after imports rather than inside a
  `DOMContentLoaded` callback. Module scripts are deferred by the browser;
  by the time they execute the DOM is fully parsed and `<litro-outlet>` is
  present.

  ***

  **Bug 2 — Click handler never attached on SSR'd pages** (`LitroLink`)

  `@lit-labs/ssr` adds `defer-hydration` to custom elements inside shadow
  DOM. `@lit-labs/ssr-client` patches `LitElement.prototype.connectedCallback`
  to block Lit's update cycle when this attribute is present. A `@click`
  binding on the shadow `<a>` is a Lit binding — it is never attached until
  `defer-hydration` is removed, which only happens when the parent component
  hydrates. For page components that are never hydrated client-side (because
  the router replaces the SSR content before they load), `<litro-link>`
  elements inside them never receive a click handler.

  This is why the playground appeared to work: its home page has no
  `<litro-link>` elements. The fullstack generator template does, so clicks
  on the SSR'd page were silently ignored.

  _Fix_: Move the click handler from a `@click` binding on the shadow `<a>`
  to the HOST element via `addEventListener('click', ...)` registered in
  `connectedCallback()` (before `super.connectedCallback()`). The host
  listener runs in `LitroLink`'s own `connectedCallback` override, which
  executes before the `@lit-labs/ssr-client` patch checks for
  `defer-hydration`. This ensures the handler is active immediately after the
  element connects to the DOM, even for SSR'd elements on first load.

  The shadow `<a>` is kept without a `@click` binding — it exists for
  progressive enhancement (no-JS navigation) and accessibility (cursor,
  focus, keyboard navigation).

  ***

  **Bug 3 — `_resolve()` race condition** (`LitroRouter`)

  `setRoutes()` calls `_resolve()` immediately for the current URL. If the
  user clicks a link before that initial `_resolve()` completes (e.g. while
  the page action's dynamic import is in flight), a second `_resolve()` call
  starts concurrently. If the first call (for `/`) completes after the second
  (for `/blog`), it overwrites the blog page with the home page.

  _Fix_: Add a `_resolveToken` monotonic counter. Each `_resolve()` call
  captures its own token at the start and checks it after every `await`. If
  the token has advanced, a newer navigation superseded this one and the call
  returns without touching the DOM.

  ***

  **Bug 4 — `@property()` decorators silently dropped by esbuild TC39 transform** (`LitroLink`)

  esbuild 0.21+ uses the TC39 Stage 3 decorator transform. In that mode,
  Lit's `@property()` decorator only handles `accessor` fields; applied to a
  plain field (`href = ''`) it is silently not applied. As a result `href`,
  `target`, and `rel` were absent from `observedAttributes`, so
  `attributeChangedCallback` was never called during element upgrade, leaving
  `this.href = ''` forever regardless of what the HTML attribute said.

  _Fix_: Replace the three `@property()` field decorators with a
  `static override properties = { href, target, rel }` declaration. Lit reads
  this static field at class-finalization time via `finalize()`, which runs
  before the element is defined in `customElements`, ensuring the properties
  are correctly registered in `observedAttributes`.

  ***

  Adds a new `LitroOutlet.test.ts` test file (6 tests) covering the
  synchronous and late-assignment code paths, the setter guard, SSR child
  clearing, and the `LitroRouter` constructor call.

  Updates `LitroLink.test.ts` (12 tests) to dispatch real `MouseEvent`s on
  the host element (exercising the `addEventListener` path) rather than
  calling the private handler directly by name.

  ***

  **Template fix — `@state() declare serverData` incompatible with jiti/SSG**

  The fullstack recipe template used `@state() declare serverData: T | null` to
  narrow the `serverData: unknown` type inherited from `LitroPage`. The `declare`
  modifier emits no runtime code, but jiti's oxc-transform (used in SSG mode to
  load page files) throws "Fields with the 'declare' modifier cannot be
  initialized here" under TC39 Stage 3 decorator mode.

  _Fix_: Remove `@state() declare serverData` from both page templates. Use a
  local type cast in `render()` instead: `const data = this.serverData as T | null`.
  The property is already reactive (declared as `@state() serverData = null` in
  `LitroPage`). Updated `LitroPage.ts` JSDoc and `DECISIONS.md` to document this
  pattern and warn against `declare` fields in subclasses.

## 0.1.3

### Patch Changes

- bfd8f9a: Fix fullstack recipe: add `base: '/_litro/'` to `vite.config.ts` and extend `LitroPage` in `[slug].ts`

  Without `base: '/_litro/'`, Vite's compiled modulepreload URL resolver emits paths like `/assets/chunk.js` instead of `/_litro/assets/chunk.js`. These requests hit the Nitro catch-all page handler and return HTML, causing a MIME type error that leaves dynamic routes (e.g. `/blog/hello-world`) stuck on "Loading…".

  Also fixes `pages/blog/[slug].ts` to extend `LitroPage` (not `LitElement`) and implement `fetchData()`, so client-side SPA navigation to different slugs correctly updates `serverData`.

## 0.1.2

### Patch Changes

- 19f4909: Fix recipe templates using unscoped `litro/runtime/...` imports instead of `@beatzball/litro/runtime/...`, and bump `nitropack` devDependency to `^2.13.1`.

## 0.1.1

### Patch Changes

- 6a8da0e: Update all README references to use `@beatzball` scoped package names following the rename in v0.1.0. Fixes install commands, `pnpm --filter` flags, `npm create` commands, and import paths.

## 0.1.0

### Minor Changes

- 618a9b8: Rename all packages to `@beatzball` scope. The unscoped `litro` package was blocked by npm's name-similarity protection (too close to `lit`, `listr`, etc.). All three packages are now published under the `@beatzball` org scope:

  - `litro` → `@beatzball/litro`
  - `litro-router` → `@beatzball/litro-router`
  - `create-litro` → `@beatzball/create-litro`

  The previously published unscoped `litro-router@0.0.2` and `create-litro@0.0.2` are deprecated on npm with a redirect notice.

## 0.0.2

### Patch Changes

- 4552934: Add `license`, `repository`, and `publishConfig` fields to all published packages; configure Changesets for automated version management, per-package changelogs, and npm publishing via GitHub Actions.
