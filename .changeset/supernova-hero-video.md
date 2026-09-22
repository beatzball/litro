---
'@beatzball/create-litro': minor
---

Add `<litro-hero-video>` to the supernova recipe: a poster, a play/pause
button and a caption slot for a short product recording.

It downloads nothing up front — `preload="none"` and no autostart attribute —
so a reader who never presses play pays for no video at all. Playback starts
from script, and only when `prefers-reduced-motion` allows it; a press of the
button is honored either way. The button names the action it performs rather
than the state the video is in, and it follows the video, so a clip paused by
the native controls or by another script still leaves the right word on
screen. With no `sources` there is a poster and no button, which is the state
a freshly scaffolded site is really in: no media ships with the recipe.
