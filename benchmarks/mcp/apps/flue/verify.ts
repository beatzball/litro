import assert from 'node:assert/strict';
import * as v from 'valibot';
import weather from './weather.js';

// Direct authoring API proof; this does not exercise an MCP server or agent loop.
const log = { info() {}, warn() {}, error() {} };
async function call(input: unknown) {
  const data = v.parse(weather.input, input);
  return (await weather.run({ data, log, toolCallId: 'direct-verification' })).output;
}
for (const city of [' Lisbon ', 'x', 'x'.repeat(80), '  ' + 'x'.repeat(80) + '  ']) {
  assert.deepEqual(await call({ city }), { city: city.trim(), tempC: 21, summary: 'sunny' });
}
for (const input of [{ city: '' }, { city: '  ' }, { city: 'x'.repeat(81) }, { city: 1 }, {}]) {
  await assert.rejects(() => call(input));
}
console.log(JSON.stringify({ framework: 'flue', protocolServer: null, directTool: 'passed', result: await call({ city: ' Lisbon ' }) }));
