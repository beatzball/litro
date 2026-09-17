# Design: a `landing` recipe

Status: Draft

Issue: https://github.com/beatzball/litro/issues/172

---

## 1. What it is

A new create-litro recipe. It gives a product site in one scaffold:

- a landing page at `/`, built from web components,
- the starlight recipe's docs site under `/docs`.

It is modeled on the landing page of roost (https://github.com/beatzball/roost, live at https://roosting.dev). That site was scaffolded from the starlight recipe, and then a custom landing page replaced the recipe's home page.

## 2. Decisions already made

- **Shape:** landing page plus docs, in one recipe. Not a landing page on its own.
- **Adapters:** Lit first. FAST and Elena come later, as their own work.
- **Content:** neutral product copy and a placeholder brand. The terminal-style parts ship as optional components that a user can keep or delete.

## 3. What the roost page is made of

One page file, `site/pages/index.ts` in the roost repo: about 500 lines of markup and data, and about 830 lines of CSS, in one Lit element with shadow DOM styles.

Sections, top to bottom:

1. **Status bar** — a sticky bar drawn like a terminal status line. A logo, a row of fake agent tabs whose state glyphs settle one by one, and the main navigation.
2. **Hero** — a heading, a short lede, an install command with a copy button, and a requirements line. A faded logo and a CSS star field sit behind it.
3. **Recording** — a looping video with a poster, a play/pause button and a caption.
4. **What it does** — feature rows. Each has a heading, a paragraph, command chips and a small terminal picture.
5. **Get running** — numbered install steps next to a list of key bindings.
6. **Three-up cards** — "same commands, whoever is typing".
7. **Two-up list** — supported agents, with a count derived from the list.
8. **Closing** — a big heading, a second copy of the install command, and a link to the docs.
9. **Footer** — links, a credit line, and a large wordmark that bleeds off the bottom edge.

Most sections render from module-level data lists (steps, key hints, cards, agents). The copy around them is hand-written.

What already works well, and must carry over:

- **Motion is CSS only.** The status bar's glyphs settle with CSS animations, so they work with JavaScript off.
- **Reduced motion is respected.** Animations stop, and the video does not start playing.
- **The video loads nothing up front.** No `autoplay`, `preload="none"`, and playback starts from script only when motion is allowed.
- **The copy button degrades.** When the clipboard API is refused, it selects the text and says "Selected", not "Copied". The label change is announced.
- **Accessibility is already done.** Decorative terminal pictures are `role="img"` with a sentence-long label, their parts are hidden from assistive tech, `<kbd>` marks real keys, and focus rings are visible, including a fix for a clipped link shape.

## 4. What must change for a recipe

1. **Colors are fixed hex values.** Every color is a literal. A user cannot retheme the page without editing the stylesheet. They become `var(--token, fallback)` custom properties, set in one place.
2. **Feature row pictures are functions.** Each feature row stores its picture as a function that returns a template. That works in Lit, but it cannot be shared with FAST or Elena. It becomes a named slot.
3. **The copy is roost's.** Headings, claims, glyphs, the logo, the wordmark and the video are all roost's. They become neutral placeholders.
4. **One file does everything.** The page becomes a thin layout of components.
5. **The media is heavy.** The roost clip is about 880 KB across two formats and a poster. The recipe needs a much smaller placeholder, or none.

## 5. Build on the starlight recipe, do not copy it

The scaffolder already layers templates. It copies a recipe's `template/`, then copies `template-<adapter>/` on top for a non-Lit adapter.

The same idea removes the biggest maintenance risk. Add an optional `extends` field to the recipe config:

```ts
const recipe: LitroRecipe = {
  name: 'landing',
  displayName: 'Landing page + docs',
  description: 'A product landing page and a docs site, built from web components',
  mode: 'ssg',
  contentLayer: 'content',
  extends: 'starlight',
};
```

Scaffold order for a recipe that extends another:

1. the base recipe's `template/`,
2. the base recipe's `template-<adapter>/`, if any,
3. this recipe's `template/`,
4. this recipe's `template-<adapter>/`, if any.

So `recipes/landing/template/` holds only what differs: the landing page, its components, its styles and its placeholder assets. The docs half is never copied into the repo twice, so it cannot drift.

Knock-on changes:

- **`litro.recipe.json`** in the scaffolded app names the recipe the user chose (`landing`), not the base.
- **`--for-repo`** today refuses any recipe but `starlight`. It should accept any recipe that is, or extends, `starlight`. `--with-blog` keeps working the same way.
- **One level only.** A recipe may extend a recipe that does not itself extend another. The scaffolder rejects deeper chains with a clear message.

Rejected alternative: a full copy of the starlight template in `recipes/landing/`, kept in step by a CI check. It works, but every starlight fix then needs a second edit, and the check only reports drift after the fact.

## 6. Components

All tags use the `litro-` prefix, like the starlight recipe's components. All live in the scaffolded app's `src/components/`, so a user owns and edits them.

### Generic

| Tag | What it does | Replaces on the roost page |
|---|---|---|
| `litro-install-command` | Shows a command with a prompt and a copy button. Copies with the clipboard API; falls back to selecting the text. Announces "Copied" or "Selected". | The two install boxes and their copy logic |
| `litro-feature-row` | A heading, a text slot, command chips, and a `figure` slot for a picture. Rows alternate sides on wide screens. | The feature rows and their picture functions |
| `litro-steps` | A numbered list with a connector line between steps. | The install steps |
| `litro-key-hints` | Key and meaning pairs, as a definition list with `<kbd>`. | The key bindings list |
| `litro-hero-video` | A poster, sources, a play/pause button, and a caption slot. Loads nothing up front; plays only when motion is allowed. | The recording section |

Card rows reuse the starlight recipe's existing `litro-card-grid` and `litro-card`. If they need a column count, that becomes a property on `litro-card-grid`, not a new component.

### Optional terminal parts

| Tag | What it does |
|---|---|
| `litro-status-bar` | The sticky top bar in terminal status-line style: a home link, a row of tabs, and a navigation slot. |
| `litro-state-badge` | One state glyph with a color, and an optional CSS-only settle animation from one state to another. The glyph set is a property, so any project can use its own. |
| `litro-term-window` | A small terminal picture: either rows of state, age and name, or a slotted shell transcript. Takes the `role="img"` label as a property. |

These are used by the landing page as shipped, but nothing else depends on them. Deleting them and their usages leaves a working page.

### Not components

The star field and the footer wordmark stay as plain CSS in the page. They are decoration with no behavior.

## 7. Theming

One token block, on the page's host, with fallbacks:

- surfaces: background, raised pane, border
- text: body, dim
- accent: primary, secondary
- states: error, blocked, working, done, idle
- layout: measure (max content width), gutter

Components read the tokens with `var(--token, fallback)`. They never define colors of their own. A user themes the whole landing page by editing that one block.

The roost page forces `color-scheme: dark`, while its docs keep a light/dark toggle. The recipe keeps that split: the landing page is dark by default, and a comment next to the token block shows how to change it.

## 8. Content

Placeholder copy that reads like a real product page, not lorem ipsum. Each section says what it is for, in a sentence the user replaces. For example, the hero heading reads "Say what your product does, in one line."

Data-driven sections keep their data at the top of the page file, as the roost page does, so the copy is edited in one place.

Placeholder brand: a simple generated logo and wordmark with no trademark. Placeholder media: a short, small clip and poster, or no clip at all with the section commented out. See open questions.

## 9. Phases

Each phase ships on its own and leaves every recipe working.

1. **`extends`, and a bare `landing` recipe.** Add `extends` to the recipe type and the scaffolder, with unit tests for the copy order and the one-level limit. Add `recipes/landing/` whose template holds a neutral landing page built only from components that already exist. Update `--for-repo`. Add `landing` to the scaffold tests and to the scaffolded-apps CI check.
2. **Generic components and theming.** `litro-install-command`, `litro-feature-row`, `litro-steps`, `litro-key-hints`, the token block, and card rows through `litro-card-grid`.
3. **Terminal parts.** `litro-status-bar`, `litro-state-badge`, `litro-term-window`.
4. **Video.** `litro-hero-video` and the placeholder media decision.
5. **Docs.** A recipe page in the docs site, and the recipe in the recipe list and the create-litro README.
6. **Later: FAST and Elena.** `template-fast/` and `template-elena/` overlays for the landing page and its components only; the docs half comes from the starlight overlays. Elena renders light DOM with no hydration, so its components need a separate design for styling and for the copy button.

Every phase that changes create-litro carries a create-litro changeset.

## 10. What must be checked

Per phase, in CI:

- **Scaffold unit tests:** the new recipe scaffolds, the file list is right, and `extends` copies in the documented order.
- **Scaffolded apps:** `landing:lit` is built from the packed tarballs, the same way users get it.
- **E2E, in the recipe template's `e2e/`:**
  - `/` renders its page component, and every prerendered route returns 200;
  - with reduced motion, the video stays paused and the status bar renders already settled;
  - with motion allowed, the video plays;
  - the copy button says "Copied" when the clipboard is allowed and "Selected" when it is refused;
  - the page is readable with JavaScript off: all copy and commands are in the server HTML.

By hand, once per phase:

- keyboard only: every link and button is reachable, with a visible focus ring;
- a screen reader reads each terminal picture as one sentence;
- narrow screen: no sideways scroll.

## 11. Open questions

1. **Recipe name.** `landing` is plain. Other candidates: `product`, `launch`.
2. **Blog.** Extending starlight brings its blog pages. Keep them, as starlight does, or remove them in the landing template? Recommendation: keep them, and let `--for-repo --with-blog` decide as it does today.
3. **Placeholder media.** Ship a tiny clip and poster, or ship the video section commented out with no media? Recommendation: no media, section commented out, because a placeholder video is weight nobody keeps.
4. **Dev playground.** Add a `playground-landing/` like `playground-starlight/`, or test only through the recipe template's e2e and the scaffolded-apps check? Recommendation: add the playground, since the other recipes have one and it makes component work faster.
5. **Upstream back to roost.** Once the components exist, roost's landing page could be rebuilt on them. That is roost's decision and is out of scope here.

## 12. Risks

- **`extends` touches the scaffolder every recipe uses.** The copy order must be tested for all existing recipes, not only the new one.
- **Overlay order bugs.** A landing adapter overlay copied before the starlight one would be silently overwritten. The unit test must assert the final content of a file that both layers provide.
- **Shadow DOM styles do not reach slotted content.** A picture passed into `litro-feature-row`'s `figure` slot is styled by the page, not the component. The component docs must say so.
- **Two looks in one site.** The landing page has its own dark header (the status bar); the docs keep the starlight header and a light/dark toggle. A visitor moving between them must still recognize one site, so the logo, name and main links must match in both headers.
