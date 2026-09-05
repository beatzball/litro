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
  // No `uri`: the packer derives it from this file's path. `weather-refresh.ts` in
  // package `playground` packs as `ui://playground/weather-refresh`.
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
    body { margin: 0; padding: 8px; font: 14px system-ui, sans-serif; background: transparent; }
    #card { display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
            padding: 12px; border: 1px solid #ccc; border-radius: 8px; max-width: 16rem; }
    #city { font-weight: 600; }
    #status { font-size: 12px; opacity: .7; }
    button { padding: 4px 10px; }
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
