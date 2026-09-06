/**
 * The interactive MCP App: a form, three buttons, and state the view owns.
 *
 * The other two demos are one-shot — the host hands them a result and they
 * render it. This one drives the conversation: it takes typed input, calls a
 * tool on its own, keeps the last reading, and re-renders it in either unit
 * without asking the server again. The model never sees any of that.
 *
 * Light DOM and a hand-written runtime, deliberately. Nothing here needs a
 * component framework, and self-containment means every document carries its
 * own copy of whatever it does use.
 */
import { defineMcpApp } from '@beatzball/litro-agent/mcp-app';
import { html } from 'lit';

export default defineMcpApp({
  // No `uri`: the packer derives it. The package name is the authority and
  // the file path is the path, so this packs as ui://playground/weather-explorer.
  title: 'Weather explorer',

  shell: html`
    <div id="card">
      <form id="form" autocomplete="off">
        <input id="city-input" type="text" placeholder="City" aria-label="City" />
        <button id="submit" type="submit">Go</button>
      </form>

      <div id="reading">
        <span id="city"></span>
        <span id="temp"></span>
        <span id="summary">Type a city to begin.</span>
      </div>

      <div id="controls">
        <button id="refresh" type="button" disabled>Refresh</button>
        <button id="reset" type="button" disabled>Reset</button>
        <button id="unit" type="button" disabled aria-label="Toggle temperature unit">&deg;F</button>
      </div>

      <span id="status" role="status"></span>
    </div>
  `,

  styles: `
    /*
     * THEME. The bridge sets data-theme on <html> from the host's hostContext,
     * but only once the handshake completes — and the shell is on screen before
     * that. So: a light default, prefers-color-scheme as the pre-handshake
     * guess, and the host's explicit answer winning over both.
     */
    :root {
      color-scheme: light dark;
      --card-bg: #ffffff;
      --card-fg: #1a1a1a;
      --card-muted: #5b5b5b;
      --card-border: #d0d0d0;
      --card-button-bg: #f4f4f4;
      --card-accent: #2563eb;
    }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme='light']) {
        --card-bg: #1f1f1f;
        --card-fg: #ededed;
        --card-muted: #a9a9a9;
        --card-border: #414141;
        --card-button-bg: #2e2e2e;
        --card-accent: #7aa2f7;
      }
    }
    :root[data-theme='dark'] {
      --card-bg: #1f1f1f;
      --card-fg: #ededed;
      --card-muted: #a9a9a9;
      --card-border: #414141;
      --card-button-bg: #2e2e2e;
      --card-accent: #7aa2f7;
    }
    :root[data-theme='light'] {
      --card-bg: #ffffff;
      --card-fg: #1a1a1a;
      --card-muted: #5b5b5b;
      --card-border: #d0d0d0;
      --card-button-bg: #f4f4f4;
      --card-accent: #2563eb;
    }

    body { margin: 0; padding: 8px; font: 14px system-ui, sans-serif;
           background: transparent; color: var(--card-fg); }

    #card { display: flex; flex-direction: column; gap: 10px; padding: 12px;
            border: 1px solid var(--card-border); border-radius: 8px;
            max-width: 20rem; background: var(--card-bg); color: var(--card-fg); }

    #form { display: flex; gap: 6px; }
    #city-input { flex: 1 1 auto; min-width: 0; padding: 5px 8px; font: inherit;
                  color: var(--card-fg); background: var(--card-bg);
                  border: 1px solid var(--card-border); border-radius: 6px; }
    #city-input:focus-visible { outline: 2px solid var(--card-accent); outline-offset: 1px; }

    #reading { display: flex; flex-direction: column; gap: 2px; min-height: 3.6em; }
    #city { font-weight: 600; }
    #temp { font-size: 22px; line-height: 1.1; }
    #summary { color: var(--card-muted); }

    #controls { display: flex; gap: 6px; }

    button { padding: 4px 10px; font: inherit; cursor: pointer;
             color: var(--card-fg); background: var(--card-button-bg);
             border: 1px solid var(--card-border); border-radius: 6px; }
    button:disabled { opacity: .45; cursor: default; }
    button:focus-visible { outline: 2px solid var(--card-accent); outline-offset: 1px; }

    #status { font-size: 12px; color: var(--card-muted); min-height: 1.2em; }
  `,

  /*
   * A CUSTOM APPLY BYPASSES THE DENY LIST, so this one only ever writes
   * textContent. `structuredContent` is server JSON and a tool result routinely
   * carries third-party text; nothing here may reach innerHTML or an attribute.
   */
  apply: `function (el, data) {
    if (window.__wx) window.__wx.receive(data);
  }`,

  // Runs before the bridge, so it may not touch window.litroMcp yet — that is
  // read inside the handlers, by which time the bridge has installed it.
  runtime: `
    (function () {
      // state.query is what the USER TYPED; reading.city is the label the
      // geocoder returned. Refresh must re-send the query — handing back
      // "Denver, US" asks the geocoder to find a place by its own answer,
      // which is a different and much more fragile lookup.
      var state = { reading: null, query: '', unit: null, userPicked: false };

      var $ = function (id) { return document.getElementById(id); };
      var text = function (id, value) { var n = $(id); if (n) n.textContent = value; };

      /*
       * THE DEFAULT UNIT IS DECIDED ONCE, from the FIRST reading that carries a
       * country: US gets Fahrenheit, everywhere else Celsius. After that the
       * user owns it — a later lookup in another country must not silently
       * flip the unit under someone who just chose one.
       */
      function chooseUnit(reading) {
        if (state.userPicked) return;
        if (!reading || !reading.country) return;
        state.unit = reading.country === 'US' ? 'F' : 'C';
      }

      function render() {
        var r = state.reading;
        var unit = state.unit || 'C';
        // THE BUTTON NAMES WHAT YOU GET, NOT WHAT YOU HAVE. Showing the
        // current unit reads as a label for the reading right above it, which
        // already says its own unit — so the button looked like a duplicate
        // rather than a control.
        var other = unit === 'F' ? 'C' : 'F';
        $('unit').textContent = other === 'F' ? '\\u00B0F' : '\\u00B0C';
        $('unit').setAttribute('aria-label', other === 'F' ? 'Switch to Fahrenheit' : 'Switch to Celsius');

        var has = !!(r && !r.empty);
        $('refresh').disabled = !has;
        $('reset').disabled = !has;
        $('unit').disabled = !has;

        if (!has) {
          text('city', '');
          text('temp', '');
          text('summary', 'Type a city to begin.');
          return;
        }

        text('city', String(r.city == null ? '' : r.city));
        var deg = unit === 'F' ? r.tempF : r.tempC;
        text('temp', (deg == null ? '' : deg) + (unit === 'F' ? '\\u00B0F' : '\\u00B0C'));
        // A placeholder must never read as a forecast.
        text('summary', String(r.summary == null ? '' : r.summary) + (r.live === false ? ' — not a real reading' : ''));
      }

      function receive(data) {
        if (!data || data.empty) { state.reading = null; render(); return; }
        state.reading = data;
        chooseUnit(data);
        if (!state.unit) state.unit = 'C';
        text('status', '');
        render();
      }

      function lookup(city, note) {
        if (!city) return;
        state.query = city;
        text('status', note);
        window.litroMcp
          .callTool('get-weather', { city: city })
          .then(function (result) {
            if (result && result.structuredContent) receive(result.structuredContent);
            else text('status', 'No result.');
          })
          .catch(function (err) {
            text('status', 'Could not reach the tool: ' + (err && err.message ? err.message : 'failed'));
          });
      }

      document.addEventListener('submit', function (event) {
        if (!event.target || event.target.id !== 'form') return;
        event.preventDefault();
        var input = $('city-input');
        var city = input ? input.value.trim() : '';
        if (!city) { text('status', 'Type a city first.'); return; }
        lookup(city, 'Looking up ' + city + '\\u2026');
      });

      document.addEventListener('click', function (event) {
        var hit = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!hit) return;

        if (hit.id === 'refresh') {
          if (state.query) lookup(state.query, 'Refreshing\\u2026');
          return;
        }

        if (hit.id === 'reset') {
          // Back to the shell's own state, including the unit default — a reset
          // that kept the last unit would not be a reset.
          state.reading = null;
          state.query = '';
          state.unit = null;
          state.userPicked = false;
          var input = $('city-input');
          if (input) input.value = '';
          text('status', '');
          render();
          return;
        }

        if (hit.id === 'unit') {
          state.unit = state.unit === 'F' ? 'C' : 'F';
          state.userPicked = true;
          render();
        }
      });

      window.__wx = { receive: receive };
      render();
    })();
  `,

  // No `csp`: callTool travels over postMessage to the host, not over the
  // network. The SERVER talks to the weather API; this view never does, so it
  // still needs no origins declared and the sandbox keeps its tight defaults.
  prefersBorder: true,
});
