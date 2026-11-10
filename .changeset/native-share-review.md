---
'@beatzball/litro-native': patch
---

Share and review now reach the native shell.

- `share` resolves a relative `url` against the page before sending it to the
  shell, as a browser's own share does. The shell accepts only an absolute
  `http` or `https` link.
- `requestReview` now uses the ten-second budget rather than the two-minute one.
  The shell answers it at once and never learns whether a prompt appeared, so a
  long budget only delayed noticing a dropped message.
- The documentation now says what each promise means: `share` resolving means
  the sheet closed, not that anything was shared, and `requestReview` resolving
  means the request was passed on, not that a prompt was shown.
