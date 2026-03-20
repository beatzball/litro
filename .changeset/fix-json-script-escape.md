---
"@beatzball/litro": patch
---

fix(shell): escape `</script` in serverDataJson to prevent early script tag termination

When page data contains rendered HTML (e.g. a CHANGELOG entry that mentions `</script>` in a
code span), the HTML parser terminates the `<script type="application/json">` element early at
the first literal `</script` sequence. This corrupts the embedded JSON, causing `getServerData()`
to return null and the page to render with no server data.

Fixed by replacing `</script` with `<\/script` in the JSON string before embedding it in the
HTML shell. JSON parsers treat `\/` as `/`, so the data round-trips correctly.
