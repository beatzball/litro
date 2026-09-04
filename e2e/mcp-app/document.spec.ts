/**
 * The packed MCP App document, in a real browser, inside a real iframe.
 *
 * The unit tests drive the bridge in jsdom, which is enough for the protocol
 * but cannot prove the two things that only a browser decides:
 *
 *   1. Declarative Shadow DOM is attached BY THE PARSER. `el.shadowRoot` exists
 *      with no script having run — which is the whole reason a server-rendered
 *      shell paints before anything downloads, and what the read-only example's
 *      `apply` reaches into. jsdom does not implement DSD at all.
 *   2. `window.parent` across a real iframe boundary, with real postMessage.
 *
 * It runs against the artifact `litro mcp-app build` actually writes, not a
 * document rebuilt in the test, so the CLI is under test here too.
 */
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Playwright transpiles specs to CJS, where import.meta.url is not available.
// Its cwd is the directory holding playwright.config.ts, which is the repo root.
const repoRoot = process.cwd();
const playground = join(repoRoot, 'playground');
const cli = join(repoRoot, 'packages', 'framework', 'dist', 'cli', 'index.js');

let cardDoc = '';

test.beforeAll(() => {
  if (!existsSync(cli)) {
    throw new Error(`Build the framework first: ${cli} is missing (pnpm --filter @beatzball/litro build)`);
  }
  execFileSync(process.execPath, [cli, 'mcp-app', 'build'], { cwd: playground, stdio: 'pipe' });
  cardDoc = readFileSync(join(playground, 'dist', 'mcp-apps', 'weather-card.html'), 'utf8');
});

/**
 * Stands up a fake host: installs the message handler FIRST, then creates the
 * iframe. The bridge sends `ui/initialize` the moment the document runs, so a
 * handler installed afterwards would miss it.
 */
async function mountView(page: import('@playwright/test').Page, doc: string) {
  await page.setContent('<main></main>');
  await page.evaluate((docHtml) => {
    const w = window as unknown as Record<string, unknown>;
    w.__hostLog = [] as unknown[];

    window.addEventListener('message', (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.jsonrpc !== '2.0') return;
      (w.__hostLog as unknown[]).push(msg);

      if (msg.method === 'ui/initialize') {
        (event.source as Window).postMessage(
          { jsonrpc: '2.0', id: msg.id, result: { hostContext: { theme: 'dark', locale: 'en-GB' } } },
          '*',
        );
      }
    });

    const frame = document.createElement('iframe');
    frame.id = 'view';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.srcdoc = docHtml;
    document.querySelector('main')!.appendChild(frame);
  }, doc);
}

test('the shell paints before any data, then the tool result fills it', async ({ page }) => {
  await mountView(page, cardDoc);

  const card = page.frameLocator('#view').locator('demo-weather-card');

  // Before any result: real markup, real styles, no script needed. This is the
  // claim the whole format is built on.
  await expect(card).toContainText('Waiting for the forecast');
  await expect(card).toContainText('—');

  // The parser attached the shadow root on its own.
  const hasShadow = await page
    .frameLocator('#view')
    .locator('demo-weather-card')
    .evaluate((el) => Boolean(el.shadowRoot));
  expect(hasShadow).toBe(true);

  // Now the host delivers the result, exactly as it would after a tool call.
  await page.evaluate(() => {
    const frame = document.querySelector<HTMLIFrameElement>('#view')!;
    frame.contentWindow!.postMessage(
      {
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-result',
        params: { structuredContent: { city: 'Doha', tempC: 38, summary: 'clear' } },
      },
      '*',
    );
  });

  await expect(card).toContainText('Doha');
  await expect(card).toContainText('38°C');
  await expect(card).toContainText('clear');
});

test('the view completes the handshake and applies hostContext', async ({ page }) => {
  await mountView(page, cardDoc);

  await expect
    .poll(async () =>
      page.evaluate(
        () => ((window as unknown as { __hostLog: { method?: string }[] }).__hostLog ?? []).map((m) => m.method),
      ),
    )
    .toEqual(expect.arrayContaining(['ui/initialize', 'ui/notifications/initialized']));

  const theme = await page
    .frameLocator('#view')
    .locator('html')
    .getAttribute('data-theme');
  expect(theme).toBe('dark');
});

test('the document loads nothing from the network', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    if (!req.url().startsWith('data:') && !req.url().startsWith('about:')) external.push(req.url());
  });

  await mountView(page, cardDoc);
  await expect(page.frameLocator('#view').locator('demo-weather-card')).toContainText('Waiting');

  // The host serves this under `default-src 'none'`. Anything requested here
  // would fail silently there, so it must request nothing.
  expect(external).toEqual([]);
});
