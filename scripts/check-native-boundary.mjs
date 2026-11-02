#!/usr/bin/env node
/**
 * check-native-boundary — keeps the bridge transport inside one file.
 *
 * App code imports `@beatzball/litro-native` and nothing else. No page,
 * component or store posts to the shell's message handler or reads the global
 * the shell injects. Exactly one file does:
 * packages/litro-native/src/adapters/shell.ts. That single rule is what lets
 * the native side be rewritten without touching an app, and the parent spec
 * (design/specs/2026-10-25-litro-native-ios-shell.md) asks for a check in CI
 * that holds it.
 *
 * A leak builds clean and works, which is why it needs a machine to notice. A
 * page that reaches `webkit.messageHandlers` directly skips the handshake,
 * the capability gating and the timeouts, and breaks the day the transport
 * changes — on an installed app that updates on the store's schedule.
 *
 * WHAT COUNTS AS REACHING THE TRANSPORT
 *
 * Any code file tracked by git that names one of these:
 *   - `messageHandlers`, the WebKit object the page posts through
 *   - the handler name or the global name, as a string literal
 *   - `HANDLER_NAME` or `GLOBAL_NAME`, the constants that hold them
 *
 * WHERE IT IS ALLOWED
 *
 *   - packages/litro-native/src/adapters/shell.ts   the one transport
 *   - packages/litro-native/src/protocol.ts         declares the names
 *   - packages/litro-native/src/__tests__/          the fake shell
 *   - native/                                       the other side of the bridge
 *   - the two bridge checkers in scripts/
 *
 * Prose is not scanned: a spec or a rule file may describe the transport.
 *
 * Usage:
 *   node scripts/check-native-boundary.mjs             check the tracked files
 *   node scripts/check-native-boundary.mjs --self-test prove the check still fires
 *
 * Exit code 1 on any leak.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRANSPORT = 'packages/litro-native/src/adapters/shell.ts';
const PROTOCOL = 'packages/litro-native/src/protocol.ts';

const CODE = /\.(?:[cm]?[jt]sx?|html?|vue|svelte|astro)$/;

const ALLOWED = [
  (f) => f === TRANSPORT,
  (f) => f === PROTOCOL,
  (f) => f.startsWith('packages/litro-native/src/__tests__/'),
  (f) => f.startsWith('native/'),
  (f) => f === 'scripts/check-bridge-parity.mjs',
  (f) => f === 'scripts/check-native-boundary.mjs',
];

/**
 * The names are read from protocol.ts rather than written here, so renaming
 * the handler cannot leave this check looking for the old one and passing.
 */
function transportNames(protocolSource) {
  const read = (name) => {
    const m = protocolSource.match(new RegExp(`export const ${name} = '([^']+)';`));
    if (!m) throw new Error(`${PROTOCOL}: could not find ${name}. The declaration moved; update this checker.`);
    return m[1];
  };
  return { handler: read('HANDLER_NAME'), global: read('GLOBAL_NAME') };
}

function patterns({ handler, global }) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [
    { what: 'messageHandlers', re: /\bmessageHandlers\b/ },
    { what: `the global name '${global}'`, re: new RegExp(esc(global)) },
    { what: `the handler name '${handler}'`, re: new RegExp(`['"\`]${esc(handler)}['"\`]|\\.${esc(handler)}\\b`) },
    { what: 'HANDLER_NAME or GLOBAL_NAME', re: /\b(?:HANDLER_NAME|GLOBAL_NAME)\b/ },
  ];
}

/**
 * Every leak in `files`, a list of `{ path, source }`.
 * Pure, so the self-test can drive it with no repository.
 */
export function findLeaks(files, names) {
  const rules = patterns(names);
  const leaks = [];
  for (const { path, source } of files) {
    if (!CODE.test(path)) continue;
    if (ALLOWED.some((ok) => ok(path))) continue;
    source.split('\n').forEach((line, i) => {
      for (const { what, re } of rules) {
        if (re.test(line)) leaks.push(`${path}:${i + 1}: names ${what}`);
      }
    });
  }
  return leaks;
}

/**
 * The transport file must itself reach the transport. If it stops matching,
 * the patterns no longer describe how the transport works, and a check whose
 * patterns match nothing passes everything.
 */
export function transportIsRecognized(source, names) {
  // It posts through `messageHandlers` and names the handler and global by
  // their constants. Those two are what it must still match.
  const [handlers, , , constants] = patterns(names);
  return [handlers, constants].every(({ re }) => source.split('\n').some((l) => re.test(l)));
}

function selfTest() {
  const names = { handler: 'litroNative', global: '__litroNative' };
  const page = (source, path = 'playground/pages/index.ts') => [{ path, source }];
  const cases = [
    ['a page posting directly', page('window.webkit.messageHandlers.litroNative.postMessage(m);'), true],
    ['a component reading the global', page('const v = window.__litroNative.version;', 'packages/x/src/a.js'), true],
    ['an import of the handler constant', page("import { HANDLER_NAME } from '@beatzball/litro-native/protocol';"), true],
    ['the handler name as a string', page("handlers['litroNative'].postMessage(m)"), true],
    ['an inline script in HTML', page('<script>webkit.messageHandlers.x</script>', 'docs/index.html'), true],
    ['the transport file itself', page('window.webkit.messageHandlers', TRANSPORT), false],
    ['the fake shell in a test', page('win.__litroNative = m', 'packages/litro-native/src/__tests__/a.test.ts'), false],
    ['the Swift side', page('let n = "litroNative"', 'native/scripts/bridge-test-page.html'), false],
    ['prose', page('Posts to window.webkit.messageHandlers.litroNative.', 'design/specs/a.md'), false],
    ['an ordinary page', page("import { haptics } from '@beatzball/litro-native';"), false],
    ['the package name, which contains the word', page("import x from '@beatzball/litro-native/haptics';"), false],
  ];
  let failed = 0;
  for (const [label, files, expectLeak] of cases) {
    const got = findLeaks(files, names).length > 0;
    if (got !== expectLeak) {
      failed++;
      console.error(`self-test FAILED: ${label}: expected ${expectLeak ? 'a leak' : 'no leak'}`);
    }
  }
  if (transportIsRecognized('const x = 1;', names)) {
    failed++;
    console.error('self-test FAILED: a transport naming nothing was recognized');
  }
  if (failed) process.exit(1);
  console.log(`check-native-boundary self-test: ${cases.length + 1} cases passed`);
}

function main() {
  const names = transportNames(readFileSync(resolve(ROOT, PROTOCOL), 'utf8'));
  const transport = readFileSync(resolve(ROOT, TRANSPORT), 'utf8');
  if (!transportIsRecognized(transport, names)) {
    console.error(`${TRANSPORT} no longer matches the patterns this check uses. Update the patterns; a check that matches nothing passes everything.`);
    process.exit(1);
  }
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = tracked
    .filter((path) => CODE.test(path))
    .map((path) => {
      try {
        return { path, source: readFileSync(resolve(ROOT, path), 'utf8') };
      } catch {
        return null; // tracked but deleted in the working tree
      }
    })
    .filter(Boolean);
  const leaks = findLeaks(files, names);
  if (leaks.length) {
    console.error(`Only ${TRANSPORT} may reach the bridge transport. Found:`);
    for (const l of leaks) console.error(`  ${l}`);
    console.error('App code imports @beatzball/litro-native and calls the facades.');
    process.exit(1);
  }
  console.log(`check-native-boundary: ${files.length} code files checked, transport confined to ${TRANSPORT}`);
}

if (process.argv.includes('--self-test')) selfTest();
else main();
