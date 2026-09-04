/**
 * The View-side bridge that ships inside every MCP App document.
 *
 * MCP Apps (SEP-1865, spec 2026-01-26) puts the document in a sandboxed iframe
 * and talks to it with JSON-RPC 2.0 over `postMessage`. This is our side of
 * that conversation: it performs the `ui/initialize` handshake, answers `ping`,
 * and fills the server-rendered shell when the tool result arrives.
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
 */

/** The View's half of the MCP Apps postMessage protocol, as browser source. */
export const BRIDGE_SOURCE = `(function () {
  'use strict';
  var PROTOCOL = '2.0';
  var nextId = 1;
  var pending = {};
  var root = null;

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

  function applyResult(structuredContent) {
    var el = rootEl();
    if (!el || !structuredContent || typeof structuredContent !== 'object') return;
    if (typeof window.litroMcpApply === 'function') {
      window.litroMcpApply(el, structuredContent);
      return;
    }
    Object.assign(el, structuredContent);
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

    if (msg.method === 'ping') {
      post({ jsonrpc: PROTOCOL, id: msg.id, result: {} });
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
      return;
    }
  });

  window.litroMcp = {
    callTool: function (name, args) {
      return request('tools/call', { name: name, arguments: args || {} });
    },
    readResource: function (uri) {
      return request('resources/read', { uri: uri });
    },
  };

  request('ui/initialize', { capabilities: {} })
    .then(function (result) {
      var ctx = (result && result.hostContext) || {};
      if (ctx.theme) document.documentElement.setAttribute('data-theme', String(ctx.theme));
      if (ctx.locale) document.documentElement.setAttribute('lang', String(ctx.locale));
      post({ jsonrpc: PROTOCOL, method: 'ui/notifications/initialized', params: {} });
    })
    .catch(function () {
      // No host, or it refused the handshake. The server-rendered shell is
      // already on screen and stays there; that is the whole point of it.
    });
})();
`;
