---
'@beatzball/create-litro': minor
---

The supernova landing page gets its terminal parts: `litro-state-badge`, `litro-status-bar` and `litro-term-window`, scaffolded into the new site's `src/components/` like the five before them.

The status bar replaces the docs header on the landing page. It shows the project's mark and name as one link home, a row of tabs each carrying a state badge, and the site's navigation — taken from `server/starlight.config.js`, the same place the docs header reads, so both halves of the site name the site the same way and link to the same pages. Declining the blog therefore takes the Blog link out of the bar too, because the entry is gone from the navigation.

A badge draws one of five states as a glyph and a color, and the glyph set is a property, so a project can use its own text. It can settle from one state to another; that animation is CSS, so it runs with JavaScript turned off, and `prefers-reduced-motion` shows the settled state from the first frame instead. The terminal window draws either rows of state, age and name or a transcript you slot in, and it renders as one `role="img"` with the sentence you give it, so a screen reader hears one description rather than a column of glyphs.

All three render on the server and bring no dependency, no image and no font. The landing page now puts a terminal window in two of its feature rows, and carries a commented-out placeholder where the video section arrives next.
