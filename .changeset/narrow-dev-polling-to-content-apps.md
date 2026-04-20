---
"@beatzball/litro": patch
---

Narrow dev-mode content polling to apps that use the content layer. The `<script>` that polls `/_litro/_litro-version.json` is now only injected when the content plugin is active (signaled via `LITRO_HAS_CONTENT=true`), eliminating 404 noise in dev for apps without Markdown content. Polling interval relaxed from 300ms to 2.5s. Internally, `ShellOptions.devMode` is renamed to `ShellOptions.contentDevPolling`; external consumers of `buildShell()` should update the option name.
