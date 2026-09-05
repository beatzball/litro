/**
 * The View-side bridge that ships inside every MCP App document.
 *
 * MCP Apps (SEP-1865, spec 2026-01-26) puts the document in a sandboxed iframe
 * and talks to it with JSON-RPC 2.0 over `postMessage`. This is our side of
 * that conversation: the `ui/initialize` handshake, `ping`, teardown, size
 * reporting, and filling the server-rendered shell when the tool result lands.
 *
 * WHY THIS IS A STRING AND NOT A MODULE
 *
 * The document must be self-contained — the spec allows no external URL for
 * content, and the default CSP is `default-src 'none'`. So this code has to be
 * inlined into a `<script>` tag rather than imported. `litro-agent` builds with
 * plain `tsc` and no bundler, so there is no compiled artifact to read back at
 * pack time without coupling the packager to build order. Keeping the source
 * here as a string is the option with no build coupling; the cost is that tsc
 * does not type-check it, which is paid back by `bridge.test.ts` evaluating
 * this exact string in jsdom and driving it through a fake host.
 *
 * The code below therefore uses NO backticks and NO `${`, so it survives the
 * template literal it lives in unescaped.
 *
 * Per-app values (name, version, display modes) are NOT interpolated here. The
 * document writes them to `window.__litroMcpApp` in a script ahead of this one,
 * which keeps this a constant the tests can evaluate as-is.
 */

/** The protocol version this bridge speaks. Pinned, not tracked to `draft`. */
export const MCP_UI_PROTOCOL_VERSION = '2026-01-26';

/**
 * Element properties a tool result may never set.
 *
 * `Object.assign(el, structuredContent)` was the original fill step and it is
 * an injection sink: `structuredContent` is server JSON, `innerHTML` is a
 * setter, and the host's own default CSP is `script-src 'self' 'unsafe-inline'`
 * — which permits inline event handlers. A result of
 * `{ "innerHTML": "<img src=x onerror=...>" }` therefore executes, and the code
 * it runs holds `window.litroMcp.callTool`, so it can drive the MCP server
 * through the host. Tool results routinely carry third-party text, so this is
 * not a hypothetical path.
 *
 * Anything starting with `on` is refused as well; the list below is the rest.
 */
export const DENIED_PROPERTIES = [
  'innerHTML',
  'outerHTML',
  'innerText',
  'insertAdjacentHTML',
  'srcdoc',
  'src',
  'href',
  'action',
  'formaction',
  'formAction',
  'style',
  'contentWindow',
  'contentDocument',
  'ownerDocument',
  'attributes',
  '__proto__',
  'constructor',
  'prototype',
];

/** The View's half of the MCP Apps postMessage protocol, as browser source. */
export const BRIDGE_SOURCE = `(function () {
  'use strict';
  var PROTOCOL = '2.0';
  var UI_PROTOCOL_VERSION = '${MCP_UI_PROTOCOL_VERSION}';
  var DENIED = ${JSON.stringify(DENIED_PROPERTIES)};

  var appMeta = window.__litroMcpApp || {};
  var nextId = 1;
  // Null-prototype: ids arrive from the host, and a response carrying an id of
  // "__proto__" or "constructor" would otherwise hit an inherited member and
  // throw inside the message handler rather than being ignored.
  var pending = Object.create(null);
  var root = null;
  var lastSize = { width: -1, height: -1 };

  function post(msg) {
    if (window.parent === window) return;
    window.parent.postMessage(msg, '*');
  }

  function request(method, params) {
    var id = nextId++;
    post({ jsonrpc: PROTOCOL, id: id, method: method, params: params || {} });
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
    });
  }

  // The shell's outermost element is what a tool result fills. Re-read it when
  // it has been replaced, but cache it otherwise: this runs on every result.
  function rootEl() {
    if (root && root.isConnected) return root;
    root = document.body.firstElementChild;
    return root;
  }

  function isDenied(key) {
    if (key.length > 1 && key.slice(0, 2) === 'on') return true;
    return DENIED.indexOf(key) !== -1;
  }

  // The default fill step. Deliberately NOT Object.assign — see DENIED_PROPERTIES.
  function assignSafely(el, data) {
    var refused = [];
    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      if (isDenied(key)) { refused.push(key); continue; }
      try { el[key] = data[key]; } catch (e) { refused.push(key); }
    }
    if (refused.length) {
      post({
        jsonrpc: PROTOCOL,
        method: 'notifications/message',
        params: {
          level: 'warning',
          data: 'MCP App refused ' + refused.length + ' unsafe propert(y/ies) from structuredContent: ' + refused.join(', '),
        },
      });
    }
  }

  function applyResult(structuredContent) {
    var el = rootEl();
    if (!el || !structuredContent || typeof structuredContent !== 'object') return;
    if (typeof window.litroMcpApply === 'function') {
      window.litroMcpApply(el, structuredContent);
      return;
    }
    assignSafely(el, structuredContent);
  }

  // Hosts using flexible dimensions size the iframe from this. Without it the
  // host has to guess, and a real one was measured falling back to a fixed
  // 400px for 112px of content.
  function reportSize() {
    var body = document.body;
    if (!body) return;
    var width = Math.ceil(body.scrollWidth);
    var height = Math.ceil(body.scrollHeight);
    if (width === lastSize.width && height === lastSize.height) return;
    lastSize = { width: width, height: height };
    post({
      jsonrpc: PROTOCOL,
      method: 'ui/notifications/size-changed',
      params: { width: width, height: height },
    });
  }

  var sizeTimer = null;
  function scheduleSizeReport() {
    if (sizeTimer) clearTimeout(sizeTimer);
    sizeTimer = setTimeout(reportSize, 50);
  }

  window.addEventListener('message', function (event) {
    // Only the host frame drives this document. Anything else is not ours.
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.jsonrpc !== PROTOCOL) return;

    // A response to something we sent: it has an id and no method.
    if (msg.id !== undefined && msg.method === undefined) {
      var slot = pending[msg.id];
      if (!slot) return;
      delete pending[msg.id];
      if (msg.error) slot.reject(msg.error);
      else slot.resolve(msg.result);
      return;
    }

    // A request with no id is a NOTIFICATION and must not be answered.
    if (msg.method === 'ping') {
      if (msg.id !== undefined) post({ jsonrpc: PROTOCOL, id: msg.id, result: {} });
      return;
    }

    // The host waits for this before tearing the view down, so that a view with
    // unsaved state can finish first. Answering late is better than not at all.
    if (msg.method === 'ui/resource-teardown') {
      if (msg.id !== undefined) post({ jsonrpc: PROTOCOL, id: msg.id, result: {} });
      return;
    }

    // params IS the context here: "params: Partial<HostContext>" (spec:1225).
    // It is NOT wrapped in a hostContext field — that nesting belongs to
    // McpUiInitializeResult, which is a different shape. Reading the wrong one
    // meant this handler never fired and a host toggling dark mode changed
    // nothing. The first test for it encoded the same misreading and passed.
    if (msg.method === 'ui/notifications/host-context-changed') {
      applyHostContext(msg.params);
      return;
    }

    // Sent before the result: the arguments the tool was called with. Lets the
    // shell show what was asked while the answer is still being computed.
    if (msg.method === 'ui/notifications/tool-input') {
      var el = rootEl();
      if (el && msg.params) el.toolInput = msg.params.arguments;
      return;
    }

    if (msg.method === 'ui/notifications/tool-result') {
      applyResult(msg.params && msg.params.structuredContent);
      scheduleSizeReport();
      return;
    }
  });

  function applyHostContext(ctx) {
    if (!ctx) return;
    if (ctx.theme) document.documentElement.setAttribute('data-theme', String(ctx.theme));
    if (ctx.locale) document.documentElement.setAttribute('lang', String(ctx.locale));
    if (ctx.displayMode) document.documentElement.setAttribute('data-display-mode', String(ctx.displayMode));
  }

  window.litroMcp = {
    callTool: function (name, args) {
      return request('tools/call', { name: name, arguments: args || {} });
    },
    readResource: function (uri) {
      return request('resources/read', { uri: uri });
    },
    reportSize: reportSize,
  };

  // The handshake. All four params are required: a real host rejected a request
  // carrying only "capabilities" with -32602 naming appInfo, appCapabilities and
  // protocolVersion. clientInfo is sent alongside appInfo because the spec's own
  // example uses that name while the reference host validates for appInfo;
  // sending both satisfies either reading and costs one line.
  var info = {
    name: appMeta.name || 'litro-mcp-app',
    version: appMeta.version || '0.0.0',
  };

  request('ui/initialize', {
    protocolVersion: UI_PROTOCOL_VERSION,
    // capabilities was dropped once, on a misreading of the host's rejection.
    // The error named appInfo, appCapabilities and protocolVersion -- three
    // ABSENT fields. capabilities was not among them; it was the one field
    // already correct, and the spec's own example (line 462) sends it. Removing
    // it recreated the very failure the rest of this handshake exists to fix.
    // (No backticks in this string, per the note at the top of the file.)
    capabilities: {},
    appInfo: info,
    clientInfo: info,
    appCapabilities: {
      availableDisplayModes: appMeta.displayModes || ['inline'],
    },
  })
    .then(function (result) {
      applyHostContext(result && result.hostContext);
      post({ jsonrpc: PROTOCOL, method: 'ui/notifications/initialized', params: {} });

      reportSize();
      if (typeof ResizeObserver === 'function' && document.body) {
        new ResizeObserver(scheduleSizeReport).observe(document.body);
      }
    })
    .catch(function () {
      // No host, or it refused the handshake. The server-rendered shell is
      // already on screen and stays there; that is the whole point of it.
    });
})();
`;
