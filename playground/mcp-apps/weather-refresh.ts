/**
 * An interactive MCP App: a card with a button that calls a tool back.
 *
 * This is the half of the protocol the read-only card does not show. The
 * bridge exposes `window.litroMcp.callTool(name, args)`, which the host
 * forwards to the server as `tools/call` — so a view is not limited to the one
 * result it was rendered for.
 *
 * Light DOM and a hand-written `runtime`, deliberately. Nothing here needs a
 * component framework, and self-containment means every document carries its
 * own copy of whatever it does use — so the cheapest interactive app is one
 * that uses none.
 */
import { defineMcpApp } from '@beatzball/litro-agent/mcp-app';
import { html } from 'lit';

export default defineMcpApp({
  // No `uri`: the packer derives it. The package name is the authority and
  // the file path is the path, so this packs as `ui://playground/weather-refresh`.
  title: 'Weather, refreshable',

  shell: html`
    <div id="card">
      <span id="city">—</span>
      <span id="temp"></span>
      <span id="summary">Waiting for the forecast…</span>
      <button id="refresh" type="button">Refresh</button>
      <span id="status" role="status"></span>
    </div>
  `,

  styles: `
    /*
     * THEME. The bridge sets data-theme on <html> from the host's
     * hostContext, but only once the handshake completes — and the shell is
     * on screen before that. So: a light default, prefers-color-scheme as the
     * pre-handshake guess, and the host's explicit answer winning over both.
     *
     * Custom properties, not rules, because they inherit THROUGH a shadow root
     * — which is how the same palette reaches a Lit component's shadow DOM.
     */
    :root {
      color-scheme: light dark;
      --card-bg: #ffffff;
      --card-fg: #1a1a1a;
      --card-muted: #5b5b5b;
      --card-border: #d0d0d0;
      --card-button-bg: #f4f4f4;
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme='light']) {
        --card-bg: #1f1f1f;
        --card-fg: #ededed;
        --card-muted: #a9a9a9;
        --card-border: #414141;
        --card-button-bg: #2e2e2e;
      }
    }
    :root[data-theme='dark'] {
      --card-bg: #1f1f1f;
      --card-fg: #ededed;
      --card-muted: #a9a9a9;
      --card-border: #414141;
      --card-button-bg: #2e2e2e;
    }
    :root[data-theme='light'] {
      --card-bg: #ffffff;
      --card-fg: #1a1a1a;
      --card-muted: #5b5b5b;
      --card-border: #d0d0d0;
      --card-button-bg: #f4f4f4;
    }

    body { margin: 0; padding: 8px; font: 14px system-ui, sans-serif; background: transparent;
           color: var(--card-fg); }
    #card { display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
            padding: 12px; border: 1px solid var(--card-border); border-radius: 8px;
            max-width: 16rem; background: var(--card-bg); color: var(--card-fg); }
    #city { font-weight: 600; }
    #status { font-size: 12px; color: var(--card-muted); }
    button { padding: 4px 10px; font: inherit; cursor: pointer;
             color: var(--card-fg); background: var(--card-button-bg);
             border: 1px solid var(--card-border); border-radius: 6px; }
  `,

  apply: `function (el, data) {
    var set = function (id, text) {
      var node = el.querySelector('#' + id);
      if (node) node.textContent = text;
    };
    if (data.city !== undefined) set('city', String(data.city));
    if (data.tempC !== undefined) set('temp', data.tempC + '\\u00B0C');
    if (data.summary !== undefined) set('summary', String(data.summary));
    set('status', '');
  }`,

  // Runs before the bridge, so it only wires the button. window.litroMcp does
  // not exist yet at this point; it is read inside the click handler, by which
  // time the bridge has installed it.
  runtime: `
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('#refresh');
      if (!button) return;

      var card = document.getElementById('card');
      var status = document.getElementById('status');
      var city = document.getElementById('city');
      if (status) status.textContent = 'Refreshing…';

      window.litroMcp
        .callTool('get-weather', { city: city ? city.textContent : '' })
        .then(function (result) {
          // A tools/call answer carries the same structuredContent shape a
          // notification does, so the same fill step handles both.
          if (result && result.structuredContent) window.litroMcpApply(card, result.structuredContent);
        })
        .catch(function () {
          if (status) status.textContent = 'Could not refresh.';
        });
    });
  `,

  // No `csp`: callTool travels over postMessage to the host, not over the
  // network, so this view needs no origins declared. Omitting it leaves the
  // sandbox on its restrictive defaults.
  prefersBorder: true,
});
