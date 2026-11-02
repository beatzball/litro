#!/usr/bin/env node
/**
 * check-bridge-parity — holds the two halves of the native bridge protocol to
 * the same constants.
 *
 * The protocol is written once in TypeScript, at
 * packages/litro-native/src/protocol.ts, and mirrored in Swift at
 * native/Sources/LitroBridge/Protocol.swift. The mirror is not avoidable: the
 * shell is an installed app and cannot import TypeScript. So the method names,
 * the capability names, the error codes, the transport names and the version
 * number exist twice, and two copies drift.
 *
 * Drift here is the expensive kind. A method renamed on one side builds clean,
 * passes every test on both sides, and fails only on a device — and the device
 * holding the stale half may be an installed app that updates on the store's
 * schedule, not ours. The spec names version skew as the risk most easily
 * skipped and most expensive to add later.
 *
 * So this reads the real declarations out of both files and compares them. It
 * does not parse either language: it extracts the specific declarations by
 * shape, and fails loudly when a declaration it expects has moved, rather than
 * quietly checking nothing.
 *
 * Usage:
 *   node scripts/check-bridge-parity.mjs             compare the two files
 *   node scripts/check-bridge-parity.mjs --self-test prove the checks still fire
 *
 * Exit code 1 on any difference.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TS_PATH = 'packages/litro-native/src/protocol.ts';
const SWIFT_PATH = 'native/Sources/LitroBridge/Protocol.swift';

/* ── Reading the TypeScript side ──────────────────────────────────────── */

/**
 * Throws rather than returning nothing when a declaration cannot be found.
 *
 * A checker that silently finds no methods would compare an empty list against
 * an empty list and pass. Every extractor here fails loudly instead.
 */
function must(match, what, file) {
  if (!match) throw new Error(`${file}: could not find ${what}. The declaration moved; update this checker.`);
  return match;
}

function readTypeScript(source) {
  const file = TS_PATH;

  const version = Number(
    must(source.match(/export const BRIDGE_PROTOCOL_VERSION = (\d+);/), 'BRIDGE_PROTOCOL_VERSION', file)[1]
  );
  const handlerName = must(source.match(/export const HANDLER_NAME = '([^']+)';/), 'HANDLER_NAME', file)[1];
  const globalName = must(source.match(/export const GLOBAL_NAME = '([^']+)';/), 'GLOBAL_NAME', file)[1];

  const methodsBlock = must(source.match(/export const METHODS = \[([\s\S]*?)\] as const;/), 'METHODS', file)[1];
  const methods = [...methodsBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);

  const codesBlock = must(source.match(/export const ERROR_CODES = \{([\s\S]*?)\} as const;/), 'ERROR_CODES', file)[1];
  const errorCodes = Object.fromEntries(
    [...codesBlock.matchAll(/^\s*([A-Z_]+):\s*(-?\d+),/gm)].map((m) => [m[1], Number(m[2])])
  );

  // The capability names live in the private CAPABILITIES set, which is the
  // list the handshake validator actually enforces.
  const capsBlock = must(
    source.match(/const CAPABILITIES: ReadonlySet<string> = new Set<Capability>\(\[([\s\S]*?)\]\);/),
    'CAPABILITIES',
    file
  )[1];
  const capabilities = [...capsBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);

  return { version, handlerName, globalName, methods, errorCodes, capabilities };
}

/* ── Reading the Swift side ───────────────────────────────────────────── */

/** The cases of a Swift enum, as their raw values. */
function swiftEnumRawValues(source, name, file) {
  const block = must(
    source.match(new RegExp(`public enum ${name}: [^{]*\\{([\\s\\S]*?)\\n\\}`)),
    `enum ${name}`,
    file
  )[1];
  const values = [];
  for (const line of block.split('\n')) {
    // `case a, b, c` and `case a = "x"` are both legal, and both appear here.
    const match = line.match(/^\s*case\s+(.+?)\s*$/);
    if (!match) continue;
    for (const part of match[1].split(',')) {
      const withRaw = part.match(/^\s*\w+\s*=\s*"([^"]+)"\s*$/);
      const bare = part.match(/^\s*(\w+)\s*$/);
      if (withRaw) values.push(withRaw[1]);
      else if (bare) values.push(bare[1]);
    }
  }
  return values;
}

function readSwift(source) {
  const file = SWIFT_PATH;

  const version = Number(must(source.match(/public let bridgeProtocolVersion = (\d+)/), 'bridgeProtocolVersion', file)[1]);
  const handlerName = must(source.match(/public let handlerName = "([^"]+)"/), 'handlerName', file)[1];
  const globalName = must(source.match(/public let globalName = "([^"]+)"/), 'globalName', file)[1];

  const methods = swiftEnumRawValues(source, 'BridgeMethod', file);
  const capabilities = swiftEnumRawValues(source, 'Capability', file);

  const codesBlock = must(source.match(/public enum ErrorCode: Int[^{]*\{([\s\S]*?)\n\}/), 'enum ErrorCode', file)[1];
  const errorCodes = Object.fromEntries(
    [...codesBlock.matchAll(/^\s*case\s+(\w+)\s*=\s*(-?\d+)\s*$/gm)].map((m) => [m[1], Number(m[2])])
  );

  return { version, handlerName, globalName, methods, errorCodes, capabilities };
}

/* ── Comparing ────────────────────────────────────────────────────────── */

/**
 * The Swift name for a TypeScript error code key.
 *
 * The two languages spell the same constant differently by convention, so the
 * mapping is written out. A code added on one side with no partner here is
 * reported, which is what makes the list impossible to forget.
 */
const ERROR_CODE_NAMES = {
  PARSE_ERROR: 'parseError',
  INVALID_REQUEST: 'invalidRequest',
  METHOD_NOT_FOUND: 'methodNotFound',
  INVALID_PARAMS: 'invalidParams',
  INTERNAL_ERROR: 'internalError',
  PERMISSION_DENIED: 'permissionDenied',
  TIMEOUT: 'timeout',
  VERSION_UNSUPPORTED: 'versionUnsupported',
};

function compare(ts, swift) {
  const problems = [];
  const say = (what, a, b) => problems.push(`${what}\n    typescript: ${a}\n    swift     : ${b}`);

  if (ts.version !== swift.version) say('protocol version differs', ts.version, swift.version);
  if (ts.handlerName !== swift.handlerName) say('handler name differs', ts.handlerName, swift.handlerName);
  if (ts.globalName !== swift.globalName) say('global name differs', ts.globalName, swift.globalName);

  // Order matters for methods: both sides list them in protocol order, and a
  // reordering is a sign one side was edited without the other.
  if (ts.methods.join(',') !== swift.methods.join(',')) {
    say('method list differs', ts.methods.join(', '), swift.methods.join(', '));
  }

  const tsCaps = [...ts.capabilities].sort();
  const swiftCaps = [...swift.capabilities].sort();
  if (tsCaps.join(',') !== swiftCaps.join(',')) {
    say('capability list differs', tsCaps.join(', '), swiftCaps.join(', '));
  }

  for (const [tsName, value] of Object.entries(ts.errorCodes)) {
    const swiftName = ERROR_CODE_NAMES[tsName];
    if (!swiftName) {
      problems.push(`error code ${tsName} has no Swift name in this checker's table`);
      continue;
    }
    if (!(swiftName in swift.errorCodes)) {
      problems.push(`error code ${tsName} (${value}) is missing from Swift as ${swiftName}`);
      continue;
    }
    if (swift.errorCodes[swiftName] !== value) {
      say(`error code ${tsName} differs`, value, swift.errorCodes[swiftName]);
    }
  }
  for (const swiftName of Object.keys(swift.errorCodes)) {
    if (!Object.values(ERROR_CODE_NAMES).includes(swiftName)) {
      problems.push(`Swift error code ${swiftName} has no TypeScript partner`);
    }
  }

  return problems;
}

/* ── Self-test ────────────────────────────────────────────────────────── */

/**
 * Proves the comparison still fires.
 *
 * Each case breaks one thing in a copy of the real Swift source and expects a
 * complaint. A checker nobody has broken on purpose is a checker that may be
 * comparing nothing: the extractors return empty lists as readily as full ones
 * when a declaration moves, which is why `must` throws instead.
 */
function selfTest(tsSource, swiftSource) {
  const ts = readTypeScript(tsSource);
  const cases = [
    ['a changed protocol version', (s) => s.replace('bridgeProtocolVersion = 1', 'bridgeProtocolVersion = 2')],
    ['a changed handler name', (s) => s.replace('handlerName = "litroNative"', 'handlerName = "litroShell"')],
    ['a changed global name', (s) => s.replace('globalName = "__litroNative"', 'globalName = "__litro"')],
    ['a renamed method', (s) => s.replace('case hapticsImpact = "haptics.impact"', 'case hapticsImpact = "haptics.buzz"')],
    ['a dropped method', (s) => s.replace('    case requestReview = "requestReview"\n', '')],
    ['a reordered method list', (s) =>
      s.replace('    case handshake = "handshake"\n    case hapticsImpact = "haptics.impact"\n',
                '    case hapticsImpact = "haptics.impact"\n    case handshake = "handshake"\n')],
    ['a changed error code', (s) => s.replace('case permissionDenied = -32000', 'case permissionDenied = -32010')],
    ['a dropped capability', (s) => s.replace('    case review\n', '')],
    ['an added capability', (s) => s.replace('    case review\n', '    case review\n    case camera\n')],
  ];

  let failures = 0;
  for (const [what, mutate] of cases) {
    const mutated = mutate(swiftSource);
    if (mutated === swiftSource) {
      console.error(`  self-test BROKEN: ${what} changed nothing; the mutation no longer applies`);
      failures += 1;
      continue;
    }
    const problems = compare(ts, readSwift(mutated));
    if (problems.length === 0) {
      console.error(`  self-test FAILED: ${what} was not reported`);
      failures += 1;
    } else {
      console.log(`  caught ${what}`);
    }
  }

  // And the real pair must pass, or every case above would "catch" a problem
  // that was already there.
  const real = compare(ts, readSwift(swiftSource));
  if (real.length > 0) {
    console.error('  self-test FAILED: the real files already differ, so the cases above prove nothing');
    failures += 1;
  }
  return failures;
}

/* ── Main ─────────────────────────────────────────────────────────────── */

const tsSource = readFileSync(resolve(ROOT, TS_PATH), 'utf8');
const swiftSource = readFileSync(resolve(ROOT, SWIFT_PATH), 'utf8');

if (process.argv.includes('--self-test')) {
  console.log('check-bridge-parity: self-test');
  const failures = selfTest(tsSource, swiftSource);
  if (failures > 0) {
    console.error(`check-bridge-parity: self-test FAILED (${failures})`);
    process.exit(1);
  }
  console.log('check-bridge-parity: self-test OK');
  process.exit(0);
}

const ts = readTypeScript(tsSource);
const swift = readSwift(swiftSource);
const problems = compare(ts, swift);

if (problems.length > 0) {
  console.error('check-bridge-parity: the two halves of the protocol disagree\n');
  for (const problem of problems) console.error(`  ${problem}\n`);
  console.error(`  ${TS_PATH}`);
  console.error(`  ${SWIFT_PATH}`);
  process.exit(1);
}

console.log(
  `check-bridge-parity: OK - version ${ts.version}, ${ts.methods.length} methods, ` +
    `${ts.capabilities.length} capabilities, ${Object.keys(ts.errorCodes).length} error codes`
);
