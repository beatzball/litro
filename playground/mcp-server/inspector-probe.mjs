/**
 * Drives MCP Inspector V2 in a headless browser and prints what a REAL host
 * does with the packed documents. This is how every finding in the MCP Apps
 * host report was produced, so it is here rather than in a scratch directory —
 * a finding nobody can re-run is a claim, not a result.
 *
 *   1. pnpm --filter playground mcp-app
 *   2. node playground/mcp-server/index.ts --http
 *   3. npx @mcp-use/inspector --url http://localhost:3111/mcp --no-open
 *   4. node playground/mcp-server/inspector-probe.mjs [--inspector <url>]
 *
 * It reports three things the fake hosts in our own tests cannot:
 *  - the host's reply to the bridge's `ui/initialize` (ours is rejected),
 *  - whether the server-rendered shell is on screen before the result,
 *  - whether the view's own `tools/call` round-trip reaches the server.
 */
import { chromium } from '@playwright/test';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const INSPECTOR = arg('--inspector', 'http://localhost:8082/inspector');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });

const wire = [];
page.on('console', async (m) => {
  if (!/Sending message|Parsed message|MCP Apps CSP/.test(m.text())) return;
  try {
    const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => '<?>')));
    wire.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  } catch {
    /* a console arg that will not serialise is not worth failing the probe over */
  }
});

/** The View itself is the `about:srcdoc` frame the sandbox writes our HTML into. */
const view = () => page.frames().find((f) => f.url() === 'about:srcdoc');
const viewText = async () => {
  const f = view();
  if (!f) return '<no view frame>';
  return f.evaluate(() => {
    const el = document.body.firstElementChild;
    // The weather card fills its shadow root; the refresh card fills light DOM.
    const shadow = el && el.shadowRoot ? el.shadowRoot.textContent : '';
    return `${shadow} ${document.body.innerText}`.replace(/\s+/g, ' ').trim();
  });
};

async function runTool(label, city) {
  await page.goto(INSPECTOR, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(8000);
  await page.getByText(label, { exact: true }).first().click();
  await page.waitForTimeout(1500);
  if (city) await page.locator('input[type="text"], input:not([type])').first().fill(city);
  await page.getByRole('button', { name: /execute/i }).first().click();
}

console.log('### 1. get-weather: does the shell paint before the result? ###');
console.log('    (set LITRO_MCP_TOOL_DELAY_MS on the server to widen the gap)');
const started = Date.now();
await runTool('get-weather', 'Reykjavik');
let last = '';
for (let i = 0; i < 60; i++) {
  const now = await viewText();
  if (now !== last && now !== '<no view frame>') {
    console.log(`  ${String(Date.now() - started).padStart(5)}ms  ${now.slice(-70)}`);
    last = now;
  }
  await page.waitForTimeout(250);
}

console.log('\n### 2. weather-refresh: does the view own tools/call round-trip? ###');
await runTool('weather-refresh-demo');
await page.waitForTimeout(8000);
console.log('  before click:', await viewText());
await view().locator('#refresh').click();
await page.waitForTimeout(400);
console.log('  mid-flight  :', await viewText());
await page.waitForTimeout(6000);
console.log('  after result:', await viewText());

console.log('\n### 3. host <-> view wire ###');
for (const line of wire) console.log('  ' + line.slice(0, 500));

await browser.close();
