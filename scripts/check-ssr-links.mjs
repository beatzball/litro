#!/usr/bin/env node
/**
 * Does the server send a link a browser can follow?
 *
 * Issue 198: `<litro-link>` builds its `<a href>` in `render()`. If the
 * element is not in the SERVER's custom element registry, Lit SSR prints a
 * bare `<litro-link href="/docs/introduction">` with no shadow root. The href
 * is then an attribute on a custom element, not a link, so with JavaScript
 * off the text is unclickable. Nothing reports it: the build exits 0 and the
 * page looks right the moment the client bundle lands.
 *
 * WHY THIS CANNOT BE A UNIT TEST OR A GREP
 *
 * The failure is a bundling one. `litro dev` serves live source and never
 * runs Rollup, so it always looks correct (BUILD-007). A unit test on the
 * adapter's `manifestPreamble()` proves the import is written, not that
 * Rollup kept it — and Rollup deleting exactly this kind of import is the
 * whole bug (BUILD-002). Only a production build, served and read back,
 * answers the question.
 *
 * WHY THIS LIVES IN CI
 *
 * A single side-effect import in one page file used to hold the whole site
 * up: the server is one bundle, so importing the element once registered it
 * for every page. Delete that one line and all 100-odd links on the site go
 * dead together, silently. The framework now registers the element itself,
 * and this check is what keeps it registered.
 *
 * Usage:
 *   node scripts/check-ssr-links.mjs [--app docs-ssr] [--port 4173] [paths...]
 *
 * Exits non-zero, and names the paths, when a page serves a `<litro-link>`
 * with no anchor inside it.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);

function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
}

const app = flag('app', 'docs-ssr');
const port = Number(flag('port', '4173'));
const paths = args.length ? args : ['/', '/docs', '/blog'];

const entry = resolve(join(app, 'dist', 'server', 'server', 'index.mjs'));
if (!existsSync(entry)) {
  console.error(`check-ssr-links: no server build at ${app}/dist/server/server/index.mjs`);
  console.error(`Build it first: pnpm --filter @beatzball/litro-docs-ssr build`);
  process.exit(1);
}

/**
 * Count `<litro-link>` host tags and how many of them carry a shadow root.
 *
 * `<template shadowrootmode>` is what Lit SSR emits for a registered
 * element, and the anchor is inside it. Matching the opening host tag
 * followed by that template is what tells a rendered element apart from a
 * bare one.
 *
 * The `__litro_data__` blob is removed first. Page data is serialized into
 * it, and a docs page about the element quotes `<litro-link>` in its prose.
 * Those are JSON strings, not elements, and counting them reported eight
 * dead links on a page that had none.
 */
function countLinks(html) {
  const body = html.replace(
    /<script type="application\/json" id="__litro_data__">[\s\S]*?<\/script>/g,
    '',
  );
  const hosts = body.match(/<litro-link[\s>]/g) ?? [];
  const rendered =
    body.match(/<litro-link(?:[^>]*)?>\s*<template[^>]*shadowrootmode/g) ?? [];
  return { hosts: hosts.length, rendered: rendered.length };
}

// The server runs with the app directory as its cwd. `docs-ssr`'s home page
// reads the framework's package.json through a path relative to the process
// cwd, so starting it from the repo root makes that fetcher throw, the page
// handler falls back to the client-only shell, and the page then has no
// <litro-link> in it at all — a pass for the wrong reason.
const server = spawn(process.execPath, [entry], {
  cwd: resolve(app),
  env: { ...process.env, PORT: String(port), NITRO_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const base = `http://127.0.0.1:${port}`;

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base + '/', { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`server did not start on ${base}\n${serverLog}`);
}

let failures = 0;
try {
  await waitForServer();

  for (const path of paths) {
    const res = await fetch(base + path);
    const html = await res.text();
    const { hosts, rendered } = countLinks(html);

    if (hosts === 0) {
      console.log(`  ${path} — no <litro-link> on this page, nothing to check`);
      continue;
    }
    if (rendered < hosts) {
      failures++;
      console.error(
        `  ${path} — FAIL: ${hosts - rendered} of ${hosts} <litro-link> elements have no shadow root, ` +
          `so they serve no <a href>. The element is not registered on the server.`,
      );
    } else {
      console.log(`  ${path} — ok: ${rendered}/${hosts} <litro-link> carry a server-rendered anchor`);
    }
  }
} finally {
  server.kill('SIGTERM');
}

if (failures) {
  console.error(
    `\ncheck-ssr-links: ${failures} path(s) serve a dead <litro-link>.\n` +
      `The adapter registers the element from manifestPreamble() — see\n` +
      `packages/framework/src/adapter/lit/index.ts and .agents/rules/build-bundling.md.`,
  );
  process.exit(1);
}
console.log(`check-ssr-links: every <litro-link> on ${paths.length} path(s) serves a real anchor`);
