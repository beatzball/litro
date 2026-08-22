---
'@beatzball/create-litro': patch
---

Two fixes to what a scaffolded app ships:

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
