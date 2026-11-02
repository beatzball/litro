#!/usr/bin/env node
/**
 * check-bridge-parity — holds the two halves of the native bridge protocol to
 * the same constants.
 *
 * The protocol is written once in TypeScript, at
 * packages/litro-native/src/protocol.ts, and mirrored in Swift at
 * native/Sources/LitroBridge/Protocol.swift. The mirror is not avoidable: the
 * shell is an installed app and cannot import TypeScript. So the method names,
 * the capability names, the error codes, the transport names, the version
 * number and the interactive timeout exist twice, and two copies drift.
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

/**
 * Drops comments so a declaration list can be read item by item.
 *
 * Good enough for these blocks, which hold no string containing `//` or `/*`.
 * The strict readers below are the backstop: anything this leaves behind that
 * is not a declaration makes them throw.
 */
function stripComments(block) {
  return block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/**
 * Reads a comma-separated declaration list strictly: every item must match
 * `pattern`, or this throws.
 *
 * Strict on purpose. The first version matched the declarations it recognized
 * and skipped the rest, so a shape it did not expect -- the last entry with no
 * trailing comma, two entries on one line -- vanished from BOTH the extracted
 * set and the comparison, and the check printed OK. Consuming every item and
 * failing on the first one it cannot read means a new shape stops the check
 * loudly, the way `must` does for a moved declaration.
 */
function readList(block, pattern, what, file) {
  const items = stripComments(block)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return items.map((item) => {
    const match = item.match(pattern);
    if (!match) throw new Error(`${file}: could not read "${item}" in ${what}. Update this checker.`);
    return match;
  });
}

function readTypeScript(source) {
  const file = TS_PATH;

  const version = Number(
    must(source.match(/export const BRIDGE_PROTOCOL_VERSION = (\d+);/), 'BRIDGE_PROTOCOL_VERSION', file)[1]
  );
  const handlerName = must(source.match(/export const HANDLER_NAME = '([^']+)';/), 'HANDLER_NAME', file)[1];
  const globalName = must(source.match(/export const GLOBAL_NAME = '([^']+)';/), 'GLOBAL_NAME', file)[1];

  // A string literal in either quote style. Only the value is kept.
  const QUOTED = /^(?:'([^']*)'|"([^"]*)")$/;
  const unquote = (m) => m[1] ?? m[2];

  const methodsBlock = must(source.match(/export const METHODS = \[([\s\S]*?)\] as const;/), 'METHODS', file)[1];
  const methods = readList(methodsBlock, QUOTED, 'METHODS', file).map(unquote);

  const codesBlock = must(source.match(/export const ERROR_CODES = \{([\s\S]*?)\} as const;/), 'ERROR_CODES', file)[1];
  const codeEntries = readList(codesBlock, /^([A-Z][A-Z0-9_]*)\s*:\s*(-?\d+)$/, 'ERROR_CODES', file);
  const errorCodes = Object.fromEntries(codeEntries.map((m) => [m[1], Number(m[2])]));
  // A key written twice collapses in the object above; the list length does not.
  if (Object.keys(errorCodes).length !== codeEntries.length) {
    throw new Error(`${file}: ERROR_CODES declares a key twice.`);
  }

  // The capability names live in the private CAPABILITIES set, which is the
  // list the handshake validator actually enforces.
  const capsBlock = must(
    source.match(/const CAPABILITIES: ReadonlySet<string> = new Set<Capability>\(\[([\s\S]*?)\]\);/),
    'CAPABILITIES',
    file
  )[1];
  const capabilities = readList(capsBlock, QUOTED, 'CAPABILITIES', file).map(unquote);

  const interactiveTimeout = readMilliseconds(
    must(source.match(/export const INTERACTIVE_TIMEOUT_MS = ([0-9_]+);/), 'INTERACTIVE_TIMEOUT_MS', file)[1]
  );

  return { version, handlerName, globalName, methods, errorCodes, capabilities, interactiveTimeout };
}

/** A numeric literal with optional `_` separators, which both languages allow. */
function readMilliseconds(literal) {
  return Number(literal.replace(/_/g, ''));
}

/* ── Reading the Swift side ───────────────────────────────────────────── */

/**
 * The cases of a Swift enum, each as `[name, rawValue]`. `rawValue` is the
 * written raw value, or `undefined` when the case has none.
 *
 * Every `case` in the body is read, and every item in a `case a, b = "x"` list
 * must parse, or this throws. The earlier reader matched the shapes it knew and
 * dropped the rest: a trailing comment, or two error codes on one `case` line,
 * made a declaration disappear without a word.
 */
function swiftEnumCases(source, name, file) {
  const block = stripComments(
    must(source.match(new RegExp(`public enum ${name}: [^{]*\\{([\\s\\S]*?)\\n\\}`)), `enum ${name}`, file)[1]
  );
  const cases = [];
  // `case` statements end at a line break or a `;`.
  for (const statement of block.split(/[\n;]/)) {
    const match = statement.match(/^\s*case\s+(.+?)\s*$/);
    if (!match) {
      if (/\bcase\b/.test(statement)) {
        throw new Error(`${file}: could not read "${statement.trim()}" in enum ${name}. Update this checker.`);
      }
      continue;
    }
    for (const part of match[1].split(',')) {
      const m = part.trim().match(/^(\w+)(?:\s*=\s*(?:"([^"]*)"|(-?\d+)))?$/);
      if (!m) throw new Error(`${file}: could not read "${part.trim()}" in enum ${name}. Update this checker.`);
      cases.push([m[1], m[2] ?? m[3]]);
    }
  }
  return cases;
}

/** The raw values of a String enum. A case with none uses its own name. */
function swiftEnumRawValues(source, name, file) {
  return swiftEnumCases(source, name, file).map(([caseName, raw]) => raw ?? caseName);
}

function readSwift(source) {
  const file = SWIFT_PATH;

  const version = Number(must(source.match(/public let bridgeProtocolVersion = (\d+)/), 'bridgeProtocolVersion', file)[1]);
  const handlerName = must(source.match(/public let handlerName = "([^"]+)"/), 'handlerName', file)[1];
  const globalName = must(source.match(/public let globalName = "([^"]+)"/), 'globalName', file)[1];

  const methods = swiftEnumRawValues(source, 'BridgeMethod', file);
  const capabilities = swiftEnumRawValues(source, 'Capability', file);

  const codeCases = swiftEnumCases(source, 'ErrorCode', file);
  for (const [caseName, raw] of codeCases) {
    if (raw === undefined || !/^-?\d+$/.test(raw)) {
      throw new Error(`${file}: ErrorCode.${caseName} has no integer raw value. Update this checker.`);
    }
  }
  const errorCodes = Object.fromEntries(codeCases.map(([caseName, raw]) => [caseName, Number(raw)]));

  // The shell carries the page's interactive budget so it can tell when the
  // page has stopped waiting, and schedule nothing it could never cancel.
  const interactiveTimeout = readMilliseconds(
    must(source.match(/public let interactiveTimeoutMilliseconds = ([0-9_]+)\b/), 'interactiveTimeoutMilliseconds', file)[1]
  );

  return { version, handlerName, globalName, methods, errorCodes, capabilities, interactiveTimeout };
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
  if (ts.interactiveTimeout !== swift.interactiveTimeout) {
    say('interactive timeout differs', ts.interactiveTimeout, swift.interactiveTimeout);
  }

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
  // The reverse direction compares against the TypeScript DECLARATIONS, not
  // just this checker's table. Asking only whether the table names a partner
  // let a code deleted from protocol.ts pass: the table still had the entry,
  // so the Swift code looked partnered while TypeScript no longer declared it.
  const tsNameFor = Object.fromEntries(Object.entries(ERROR_CODE_NAMES).map(([t, s]) => [s, t]));
  for (const [swiftName, value] of Object.entries(swift.errorCodes)) {
    const tsName = tsNameFor[swiftName];
    if (!tsName) {
      problems.push(`Swift error code ${swiftName} has no TypeScript name in this checker's table`);
      continue;
    }
    if (!(tsName in ts.errorCodes)) {
      problems.push(`error code ${swiftName} (${value}) is missing from TypeScript as ${tsName}`);
    }
  }

  return problems;
}

/* ── Self-test ────────────────────────────────────────────────────────── */

/**
 * Proves the comparison still fires.
 *
 * Each case changes a copy of one or both real sources and states the result it
 * requires: a reported difference, a clean read of a harmless reformatting, or
 * a refusal of a shape the readers cannot consume. The reformatting cases are
 * what prove the readers lose nothing; the others prove the comparison fires.
 *
 * A checker nobody has broken on purpose is a checker that may be comparing
 * nothing: the extractors return empty lists as readily as full ones
 * when a declaration moves, which is why `must` throws instead.
 */
function selfTest(tsSource, swiftSource) {
  // Each case mutates one or both sources and states what must follow:
  //   differ  the comparison reports a problem
  //   same    the comparison reports nothing -- a reformatting the readers
  //           must see through, rather than lose a declaration in
  //   throw   a reader refuses a shape it cannot consume
  const swift = (what, mutate) => ({ what, swift: mutate, expect: 'differ' });
  const cases = [
    swift('a changed protocol version', (s) => s.replace('bridgeProtocolVersion = 1', 'bridgeProtocolVersion = 2')),
    swift('a changed handler name', (s) => s.replace('handlerName = "litroNative"', 'handlerName = "litroShell"')),
    swift('a changed global name', (s) => s.replace('globalName = "__litroNative"', 'globalName = "__litro"')),
    swift('a renamed method', (s) => s.replace('case hapticsImpact = "haptics.impact"', 'case hapticsImpact = "haptics.buzz"')),
    swift('a dropped method', (s) => s.replace('    case requestReview = "requestReview"\n', '')),
    swift('a reordered method list', (s) =>
      s.replace('    case handshake = "handshake"\n    case hapticsImpact = "haptics.impact"\n',
                '    case hapticsImpact = "haptics.impact"\n    case handshake = "handshake"\n')),
    swift('a changed error code', (s) => s.replace('case permissionDenied = -32000', 'case permissionDenied = -32010')),
    swift('a dropped capability', (s) => s.replace('    case review\n', '')),
    swift('an added capability', (s) => s.replace('    case review\n', '    case review\n    case camera\n')),
    swift('a changed interactive timeout', (s) =>
      s.replace('interactiveTimeoutMilliseconds = 120_000', 'interactiveTimeoutMilliseconds = 60_000')),
    {
      what: 'an interactive timeout written without separators',
      swift: (s) => s.replace('interactiveTimeoutMilliseconds = 120_000', 'interactiveTimeoutMilliseconds = 120000'),
      expect: 'same',
    },
    {
      what: 'a Swift interactive timeout the reader cannot find',
      swift: (s) => s.replace('public let interactiveTimeoutMilliseconds = 120_000', 'public let interactiveTimeout = 120.0'),
      expect: 'throw',
    },
    swift('a dropped Swift error code', (s) => s.replace('    case permissionDenied = -32000\n', '')),
    {
      what: 'a dropped TypeScript error code',
      ts: (s) => s.replace('  PERMISSION_DENIED: -32000,\n', ''),
      expect: 'differ',
    },
    // The extractor once required a trailing comma, so the last entry written
    // without one vanished. Swift drops the same code, and the two lost
    // declarations used to cancel out into OK.
    {
      what: 'a last TypeScript error code with no trailing comma, missing from Swift',
      ts: (s) => s.replace('  VERSION_UNSUPPORTED: -32002,\n', '  VERSION_UNSUPPORTED: -32002\n'),
      swift: (s) => s.replace('    case versionUnsupported = -32002\n', ''),
      expect: 'differ',
    },
    // The extractor once read only the first declaration on a line.
    {
      what: 'a second TypeScript error code on the same line',
      ts: (s) => s.replace('  VERSION_UNSUPPORTED: -32002,\n', '  VERSION_UNSUPPORTED: -32002, EXTRA_ERROR: -32003,\n'),
      expect: 'differ',
    },
    {
      what: 'a TypeScript error code that is not a plain number',
      ts: (s) => s.replace('  VERSION_UNSUPPORTED: -32002,\n', '  VERSION_UNSUPPORTED: BASE - 2,\n'),
      expect: 'throw',
    },
    {
      what: 'a TypeScript method written on one line with another, in double quotes',
      ts: (s) => s.replace("  'canShare',\n  'share',\n", '  \'canShare\', "share",\n'),
      expect: 'same',
    },
    {
      what: 'two Swift error codes on one case line',
      swift: (s) => s.replace('    case timeout = -32001\n', '    case timeout = -32001, versionUnsupported = -32002\n')
                     .replace(/\n    case versionUnsupported = -32002\n/, '\n'),
      expect: 'same',
    },
    {
      what: 'a Swift capability with a trailing comment',
      swift: (s) => s.replace('    case review\n', '    case review // the store prompt\n'),
      expect: 'same',
    },
    {
      what: 'a Swift case the reader cannot consume',
      swift: (s) => s.replace('    case review\n', '    case review(String)\n'),
      expect: 'throw',
    },
  ];

  let failures = 0;
  const fail = (text) => {
    console.error(`  self-test FAILED: ${text}`);
    failures += 1;
  };
  for (const { what, ts: mutateTs, swift: mutateSwift, expect } of cases) {
    const tsMutated = mutateTs ? mutateTs(tsSource) : tsSource;
    const swiftMutated = mutateSwift ? mutateSwift(swiftSource) : swiftSource;
    if ((mutateTs && tsMutated === tsSource) || (mutateSwift && swiftMutated === swiftSource)) {
      console.error(`  self-test BROKEN: ${what} changed nothing; the mutation no longer applies`);
      failures += 1;
      continue;
    }
    let problems;
    try {
      problems = compare(readTypeScript(tsMutated), readSwift(swiftMutated));
    } catch (error) {
      if (expect === 'throw') console.log(`  refused ${what}`);
      else fail(`${what} threw instead of being read: ${error.message}`);
      continue;
    }
    if (expect === 'throw') fail(`${what} was read without complaint`);
    else if (expect === 'differ' && problems.length === 0) fail(`${what} was not reported`);
    else if (expect === 'same' && problems.length > 0) fail(`${what} lost a declaration: ${problems.join('; ')}`);
    else console.log(`  ${expect === 'same' ? 'read through' : 'caught'} ${what}`);
  }

  // And the real pair must pass, or every case above would "catch" a problem
  // that was already there.
  const real = compare(readTypeScript(tsSource), readSwift(swiftSource));
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
    `${ts.capabilities.length} capabilities, ${Object.keys(ts.errorCodes).length} error codes, ` +
    `interactive timeout ${ts.interactiveTimeout}ms`
);
