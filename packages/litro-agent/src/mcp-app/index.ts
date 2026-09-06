/**
 * MCP Apps packager — turns a Litro component into one self-contained HTML5
 * document an MCP server can serve as a `ui://` resource.
 *
 * Spec: MCP Apps (SEP-1865), specification version 2026-01-26.
 *
 * THE CONSTRAINT THAT SHAPES ALL OF THIS
 *
 * A `ui://` resource is a STATIC, CACHED, DATA-FREE template. The spec is
 * explicit that it "separates presentation (template) from data (tool
 * results)", and hosts may prefetch it and treat it as immutable across many
 * tool calls. Data reaches the view only afterwards, by notification:
 *
 *   1. view  -> host  `ui/initialize`
 *   2. host  -> view  hostContext (theme, locale, dimensions) — NOT the result
 *   3. host  -> view  `ui/notifications/tool-input`   (the arguments)
 *   4. host  -> view  `ui/notifications/tool-result`  (`structuredContent`)
 *
 * So `ui()`'s per-call rendered html does NOT map onto a `ui://` resource, and
 * the two must not be wired together. What is packaged here is a DATA-FREE
 * SHELL, rendered once at pack time, that the bridge fills at step 4.
 *
 * The shell is the point. Every other MCP Apps implementation ships a
 * client-rendered bundle, so the iframe starts empty and paints after the
 * framework downloads. A server-rendered shell is real, styled markup in the
 * first byte the host receives.
 */
import { AgentError } from '../errors.js';
import { ui } from '../ui/index.js';
import { BRIDGE_SOURCE } from './bridge.js';
import { assertSelfContained } from './external-urls.js';

export const MCP_APP_CONFIG = Symbol.for('litro.agent.mcpApp');

/** The spec version this packager emits for. Pinned, not tracked to `draft`. */
export const MCP_APPS_SPEC_VERSION = '2026-01-26';

/** The one content type the spec currently defines. */
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';

/**
 * Origins the view may reach, by kind. The host builds its CSP from these and
 * "MAY further restrict but MUST NOT allow undeclared domains".
 *
 * OMIT this entirely when the view needs no network. The spec has the sandbox
 * "apply restrictive defaults if no CSP metadata is provided", which is the
 * tightest policy available; declaring an empty object instead hands the host
 * a policy to construct and is not equivalent.
 */
export interface McpAppCsp {
  /** fetch / XHR / WebSocket -> `connect-src` */
  connectDomains?: string[];
  /** images, scripts, styles, fonts, media */
  resourceDomains?: string[];
  /** nested iframes -> `frame-src` */
  frameDomains?: string[];
  /** document base URIs -> `base-uri` */
  baseUriDomains?: string[];
}

/** Browser capabilities the view asks the host for. */
export interface McpAppPermissions {
  camera?: Record<string, never>;
  microphone?: Record<string, never>;
  geolocation?: Record<string, never>;
  clipboardWrite?: Record<string, never>;
}

export interface McpAppConfig {
  /**
   * Resource address. MUST start with `ui://`.
   *
   * OPTIONAL because `litro mcp-app build` derives one: the package name is
   * the authority and the file path is the path, so `mcp-apps/weather/card.ts`
   * in package `playground` packs as `ui://playground/weather/card`. Set it to
   * override that, or when calling `buildMcpAppDocument` standalone, where
   * there is no file to derive from. An explicit value always wins.
   */
  uri?: string;
  /**
   * Resource name. The base MCP `Resource` type requires it alongside `uri`,
   * and a server forwarding our descriptor into `resources/list` emits an
   * invalid entry without it. Defaults to the last path segment of `uri`.
   */
  name?: string;
  /** App version, reported to the host in the handshake. Defaults to `0.0.0`. */
  version?: string;
  /**
   * Display modes this view can handle. The spec makes declaring them a MUST:
   * "View MUST declare all display modes it supports in
   * `appCapabilities.availableDisplayModes` during initialization."
   * Defaults to `['inline']`.
   */
  displayModes?: Array<'inline' | 'fullscreen' | 'pip'>;
  /**
   * The data-free shell, as a template for the adapter selected by
   * `LITRO_ADAPTER` — a Lit `TemplateResult`, or an HTML string for FAST.
   * Render it in its EMPTY state: whatever the view shows before a result
   * arrives.
   */
  shell: unknown;
  /** `<title>` for the document. */
  title?: string;
  /** CSS inlined into a single `<style>`. There is no external stylesheet. */
  styles?: string;
  /**
   * Component runtime, inlined ahead of the bridge. Self-containment means each
   * document carries its own copy; nothing can be shared between them.
   */
  runtime?: string;
  /**
   * BROWSER SOURCE for a custom fill step, as the text of a function
   * `(element, structuredContent) => void`. Defaults to
   * `Object.assign(element, structuredContent)` — the same move
   * `hydrateUIResult` makes in the session client.
   *
   * A string, not a function, on purpose: a function value would have to be
   * serialized with `Function.prototype.toString()`, which silently drops
   * everything it closed over. That failure appears only in the iframe, where
   * nobody is watching.
   */
  apply?: string;
  csp?: McpAppCsp;
  permissions?: McpAppPermissions;
  /** Presentation hint: the host may draw a border around the view. */
  prefersBorder?: boolean;
}

export interface McpAppDefinition {
  [MCP_APP_CONFIG]: McpAppConfig;
}

/** What an MCP server publishes for this app, in `resources/*` shape. */
export interface McpAppDescriptor {
  uri: string;
  /** Required by the base MCP `Resource` type, not just by this extension. */
  name: string;
  mimeType: typeof MCP_APP_MIME_TYPE;
  _meta: {
    ui: {
      csp?: McpAppCsp;
      permissions?: McpAppPermissions;
      prefersBorder?: boolean;
    };
  };
}

export interface McpAppDocument {
  /** The complete HTML5 document. Serve as the resource's `text`. */
  html: string;
  /** The resource entry, for `resources/list` and `resources/read`. */
  descriptor: McpAppDescriptor;
}

/**
 * Rejects anything that is not a `ui://` address.
 *
 * Shared by `defineMcpApp` (when a uri is written by hand) and
 * `buildMcpAppDocument` (for the resolved one), so a hand-written and a
 * path-derived uri are held to exactly one standard.
 */
function assertUiUri(uri: unknown, caller: string): asserts uri is string {
  if (typeof uri !== 'string' || !/^ui:\/\/.+/.test(uri)) {
    throw new AgentError(
      `${caller}: "uri" must start with "ui://" and name something after it — got ${JSON.stringify(uri)}. ` +
        'The scheme is how a host tells a UI resource from every other resource, and the spec requires it.',
      { status: 500 },
    );
  }
}

export function defineMcpApp(config: McpAppConfig): McpAppDefinition {
  // Only checked when one is GIVEN. An absent uri is not an error here: the
  // packager supplies a path-derived one, and it is only at build time — once
  // we know whether an override is coming — that "no uri anywhere" is decidable.
  if (config.uri !== undefined) assertUiUri(config.uri, 'defineMcpApp');
  if (config.shell === undefined || config.shell === null) {
    throw new AgentError(
      'defineMcpApp: "shell" is required — it is the data-free markup the host paints before any tool result arrives.',
      { status: 500 },
    );
  }
  if (config.apply !== undefined && typeof config.apply !== 'string') {
    throw new AgentError(
      'defineMcpApp: "apply" must be browser SOURCE as a string, not a function. A function would be serialized ' +
        'with Function.prototype.toString(), which silently drops its closure — and that breaks inside the ' +
        'iframe, where no one sees it.',
      { status: 500 },
    );
  }
  return { [MCP_APP_CONFIG]: config };
}

/** Last path segment of a `ui://` address, used as the default resource name. */
export function nameFromUri(uri: string): string {
  const path = uri.replace(/^ui:\/\//, '').replace(/[?#].*$/, '');
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

/** Neutralises a closing tag that would end the element early. */
function inlineSafe(source: string, tag: 'script' | 'style'): string {
  // `<\\/` is safe in both a string and a regex literal: `\\/` is the correct
  // escape for `/` in each. That is what makes rewriting acceptable here.
  return source.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');
}

/**
 * Refuses source that could escape its own `<script>` element.
 *
 * `</script` is not the only way out. Inside a script element `<!--` moves the
 * HTML tokenizer into "script data escaped" state, and a following `<script`
 * moves it into "script data double escaped", where `</script>` NO LONGER
 * CLOSES THE ELEMENT — the rest of the document is swallowed and the build
 * reports success while shipping a dead file.
 *
 * This THROWS rather than rewriting, and that is the whole point. The obvious
 * fix was to backslash them the way `</script` is backslashed, but `\\/` is the
 * correct escape for `/` in a string AND a regex, while `\\s` is not:
 *
 *     author:  var re = /<script/;
 *     rewrite: var re = /<\\script/;   // now matches "< cript", not "<script"
 *
 * That silently turns valid author code into different, working, wrong code.
 * `\\!` is worse — `/<\\!--/u` is a SyntaxError. A build tool refusing input it
 * cannot safely carry is honest; one that quietly rewrites it is not.
 *
 * The JSON path needs none of this: `jsonSafe` escapes `<` itself.
 */
function assertNoScriptEscape(source: string, key: 'runtime' | 'apply'): void {
  const found = ['<!--', '<script'].filter((seq) =>
    source.toLowerCase().includes(seq.toLowerCase()),
  );
  if (found.length === 0) return;

  throw new AgentError(
    `defineMcpApp: "${key}" contains ${found.join(' and ')}, which cannot be inlined safely.\n` +
      'Inside a <script> element those sequences put the HTML tokenizer into a state where ' +
      '</script> stops closing the element, and the rest of the document is swallowed — the ' +
      'build would succeed and ship a dead file. Escaping them would corrupt a regex literal, ' +
      "so this refuses instead. Build the string at runtime: '<' + '!--' , or '<' + 'script'.",
    { status: 500 },
  );
}

/**
 * JSON for an inline `<script>`, with `<` escaped as `\u003c`.
 *
 * Unlike inlineSafe this needs no assumption about where the text sits: the
 * escape is valid JSON everywhere, so no `<!--`, `<script` or `</script`
 * sequence can survive into the tokenizer at all.
 */
function jsonSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build-time inputs that come from outside the app file. */
export interface BuildMcpAppOptions {
  /**
   * Fallback address, used only when the config has none. `litro mcp-app build`
   * passes the value it derives from the file path.
   *
   * A fallback and not an override: the config wins, so a file that names its
   * own uri keeps it, and adding this to an existing project changes no address.
   */
  uri?: string;
}

/** Renders the shell and assembles the document. */
export async function buildMcpAppDocument(
  app: McpAppDefinition,
  options: BuildMcpAppOptions = {},
): Promise<McpAppDocument> {
  const config = app[MCP_APP_CONFIG];
  if (!config) {
    throw new AgentError(
      'buildMcpAppDocument: expected a definition from defineMcpApp().',
      { status: 500 },
    );
  }

  // The one place a uri is finally decided, which is why validation lives here
  // and not in defineMcpApp. Neither source alone can tell whether the app has
  // an address; only both together can.
  const uri = config.uri ?? options.uri;
  if (uri === undefined) {
    throw new AgentError(
      'buildMcpAppDocument: this app has no "uri" and none was supplied. ' +
        'Either set "uri" in defineMcpApp(), or pack the file with `litro mcp-app build`, ' +
        'which derives one from the file path.',
      { status: 500 },
    );
  }
  assertUiUri(uri, 'buildMcpAppDocument');

  // Rendered with no data on purpose — see the constraint at the top of this file.
  const shell = await ui(config.shell);

  const head = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(config.title ?? uri)}</title>`,
    config.styles ? `<style>\n${inlineSafe(config.styles, 'style')}\n</style>` : '',
  ].filter(Boolean);

  // Read by the bridge for its ui/initialize handshake. A separate script so
  // BRIDGE_SOURCE stays a constant the tests can evaluate unchanged.
  const appMeta = {
    name: config.name ?? nameFromUri(uri),
    version: config.version ?? '0.0.0',
    displayModes: config.displayModes ?? ['inline'],
  };

  if (config.runtime) assertNoScriptEscape(config.runtime, 'runtime');
  if (config.apply) assertNoScriptEscape(config.apply, 'apply');

  const scripts = [
    `<script>\nwindow.__litroMcpApp = ${jsonSafe(appMeta)};\n</script>`,
    config.runtime ? `<script>\n${inlineSafe(config.runtime, 'script')}\n</script>` : '',
    config.apply
      ? `<script>\nwindow.litroMcpApply = ${inlineSafe(config.apply, 'script')};\n</script>`
      : '',
    `<script>\n${BRIDGE_SOURCE}</script>`,
  ].filter(Boolean);

  const html =
    '<!doctype html>\n' +
    '<html>\n' +
    '<head>\n' +
    head.join('\n') +
    '\n</head>\n' +
    '<body>\n' +
    shell.html +
    '\n' +
    scripts.join('\n') +
    '\n</body>\n' +
    '</html>\n';

  assertSelfContained(html, uri);

  const meta: McpAppDescriptor['_meta']['ui'] = {};
  if (config.csp) meta.csp = config.csp;
  if (config.permissions) meta.permissions = config.permissions;
  if (config.prefersBorder !== undefined) meta.prefersBorder = config.prefersBorder;

  return {
    html,
    // Nested `_meta.ui.*` only. The flat `_meta["ui/resourceUri"]` form is
    // deprecated and the spec removes it before GA.
    descriptor: {
      uri,
      name: appMeta.name,
      mimeType: MCP_APP_MIME_TYPE,
      _meta: { ui: meta },
    },
  };
}
