---
"@beatzball/create-litro": minor
---

supernova: the landing page is now built from five components of its own, and themed from one token block.

`litro-install-command`, `litro-feature-row`, `litro-steps`, `litro-key-hints` and `litro-hero-nova` are scaffolded into the new site's `src/components/`, where the user owns and edits them. They bring no dependency, no image, no font and no video, and they all render on the server, so the page still reads with JavaScript turned off. The copy button is the one part that needs it: when a browser refuses the clipboard it selects the command instead and says "Selected" rather than "Copied", and announces which of the two happened.

The hero art is drawn in CSS — an exploding star over a star field, with a `mark` slot for the project's own logo and a pulse that stops under `prefers-reduced-motion`.

Every color now comes from one token block on the landing page's host, grouped into surfaces, text, accent, states and layout. The components define no colors of their own, so editing that block rethemes the whole page. A comment there lists the `--sl-*` tokens the docs half owns, so neither set is redefined by accident.
