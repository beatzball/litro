---
'@beatzball/create-litro': minor
---

Add `<litro-hero-video>` to the supernova recipe: a poster, a play/pause
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
