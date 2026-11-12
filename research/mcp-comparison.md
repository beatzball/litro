# MCP server and MCP Apps comparison

Research checked November 12, 2026. Feature claims below target the published packages listed here, with source links pinned to their release commits. Measurements describe the fixtures in `benchmarks/mcp/`; they do not rank the frameworks as a whole.

**The build workloads differ materially.** Eve builds a complete application with its native compiler and Nitro output. Litro and Mastra compile small entry points with esbuild and external runtime dependencies. Flue compiles a direct tool check, with no MCP server. Build times are fixture costs, not a comparison of equally capable compilers. No general winner follows from these measurements.

## Projects and version scope

“Flue” means [withastro/flue][f-readme], the TypeScript agent framework associated with [flueframework.com](https://flueframework.com/). Its documented MCP integration consumes remote tools. The alternative [sfkislev/flue][alt-flue] is a Python bridge for desktop applications, a different project.

“Eve” means [vercel/eve][e-package], the filesystem-first agent framework associated with [eve.dev](https://eve.dev/). The alternative [mcpapp/eve][alt-eve] is an adapter between Eve sessions and a React renderer. EVE Online is the unrelated game, whose [official developer portal](https://developers.eveonline.com/) documents game integrations; it is outside this comparison.

| Framework | Published packages inspected | Release source commit | MCP SDK generation |
| --- | --- | --- | --- |
| Litro | `@beatzball/litro-agent@0.7.3`, `@beatzball/litro@0.18.0`. [Manifests][l-package] [framework][l-framework] | `2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3` | Optional `@modelcontextprotocol/sdk` 1.x peer; fixture pins `1.32.2`. [Peer contract][l-package] |
| Mastra | `@mastra/mcp@2.8.0`, `@mastra/core@1.82.0`. [Manifests][m-package] [core][m-corepackage] | `6e8dfcb83facb0861ebefa4fee384429a113acf4` | Split MCP client/server/core `2.4.0`, Node adapter `2.1.2`, ext-apps `^2.0.3`. [Dependencies][m-package] |
| Flue | `@flue/runtime@2.3.0`. [Manifest][f-package] | `deee93b40d275ecc9a50c50af2158f20089d54bc` | Upstream pins MCP client `2.0.0`; fixture overrides it to `2.4.0` for audit fixes. MCP server is a development dependency, not a published server API. [Manifest][f-package] [client implementation][f-mcp] |
| Eve | `eve@1.0.0-rc.10`. [Manifest][e-package] | `746a74163d712c3a06ff907199ae9ccca1d0e749` | Compiled/vendor MCP server SDK; manifest development input `@modelcontextprotocol/server@2.3.0`. [Manifest][e-package] [import boundary][e-server] |

The release commits resolve the corresponding Git tags: `@beatzball/litro-agent@0.7.3`, `@beatzball/litro@0.18.0`, `@mastra/mcp@2.8.0`, `@mastra/core@1.82.0`, `v2.3.0`, and `eve@1.0.0-rc.10`. Later main-branch source is excluded. In particular, Mastra main's `2.9.0-alpha.4` is not the subject of the feature matrix. Published tarballs were also inspected for the referenced server/app entry points. Mastra's installed `dist/index.js` confirms `appResources`, the MCP Apps MIME type, `startHTTP`, `startStdio`, and the `legacy` default shown by its [release implementation][m-server].

## Feature matrix

This matrix describes **server** capabilities. An MCP client connection lets an agent consume a remote server; it does not expose that agent's tools to another client. “Not identified” means the cited public API and implementation do not expose the feature at this snapshot. It is a bounded source finding, not proof that custom application code or an integration could never add it. Host rendering support is separate from serving a valid MCP resource. Current fixture rendering checks are reported under Measurements.

| Category | Litro 0.7.3 | Mastra MCP 2.8.0 | Flue runtime 2.3.0 | Eve 1.0.0-rc.10 |
| --- | --- | --- | --- | --- |
| Native MCP server | One agent's authored tools and packed app resources. [Core][l-core] | `MCPServer` exposes tools and optionally agents/workflows. [Server][m-server] | No native server API identified; integration constructs an MCP `Client`. [Implementation][f-mcp] [exports][f-package] | `mcpChannel` exposes agent operations, optionally authored tools and skills. [Channel][e-channel] |
| Arbitrary deterministic weather tool | Yes, direct execution without a model. [Dispatch][l-core] | Yes, `tools` entries execute directly. [Dispatch][m-server] | Direct local tool execution is possible, but no native MCP publication surface was identified. [MCP surface][f-mcp] [tool guide][f-tools] | Yes: `agent: false, tools: true` publishes static authored tools with `execute`; calls bypass model turns and workflow runs. [Publication rules][e-doc] [adapter][e-tools] |
| stdio server | Yes, `litro mcp serve` and server/transport APIs. [CLI][l-cli] [core][l-core] | Yes, `startStdio()`. [Implementation][m-server] | Not identified; remote client transports only. [Implementation][f-mcp] | No public stdio server option identified in `mcpChannel`; HTTP channel only. [Config/routes][e-channel] |
| Streamable HTTP server | Yes, h3 handler normally mounted as a Nitro route; POST plus OPTIONS. [Handler][l-http] | Yes, `startHTTP()` integrates with a Node HTTP server. [Implementation][m-server] | Not identified. Outbound `StreamableHTTPClientTransport` is client support. [Implementation][f-mcp] | Yes, native HTTP channel. [Implementation][e-channel] [transport][e-server] |
| Legacy HTTP+SSE transport | No separate legacy SSE endpoint; POST response may itself be SSE. [Handler][l-http] | No separate legacy SSE transport in this release's server API. stdio and Streamable HTTP are the advertised transports. [API][m-ref] [implementation][m-server] | No server identified. Outbound `SSEClientTransport` is client support. [Implementation][f-mcp] | No separate legacy SSE server exposed by the HTTP channel. [Routes][e-channel] [transport][e-server] |
| MCP protocol compatibility | Uses the optional 1.x SDK handshake; fixture uses legacy negotiation. No native modern envelope adapter is present. [SDK loading/core][l-core] | MCP `2026-07-28`; older HTTP clients require `legacy: 'stateless'`. stdio rejects legacy openings. [Implementation][m-server] | Server protocol not applicable; outbound SDK client connects to other servers. [Implementation][f-mcp] | MCP `2026-07-28` and stateless `2025-11-25` compatibility. [Transport][e-server] |
| Bearer authentication | Static shared token, constant-time comparison; explicit local mode can omit it. [Gates][l-gates] | Application middleware or Mastra server auth supplies verified identity; OAuth middleware can challenge bearer requests. [OAuth][m-oauth] [auth integration][m-auth] | No inbound MCP auth surface identified. Outbound static/dynamic bearer credentials are supported. [Client][f-mcp] | Required auth configuration; supports custom token verification and identity strategies. Explicit `none()` allows public access. [Channel auth][e-doc] |
| OAuth server role | No built-in OAuth implementation; static bearer mode only. [Documented boundary][l-doc] | Protected-resource metadata and bearer middleware; configure token validator and separate authorization server. Without validator the helper accepts unvalidated tokens. [Middleware][m-oauth] | No native MCP resource server identified; application owns outbound OAuth flows/storage/refresh. [MCP guide][f-doc] | `oauthResource()` advertises protected-resource discovery and challenges; external issuer handles registration/consent/token issuance. [OAuth contract][e-doc] |
| Tools | `tools/list`, `tools/call`; tool names map from authored agent tools. [Core][l-core] [tool mapping][l-tools] | Direct tools plus optional `ask_*` agents and `run_*` workflows. [Registration][m-server] | No inbound tool publication found; remote tools mount as `mcp__<server>__<tool>`. [Adapter][f-mcp] | Default four `agent_*` tools; optional direct static tools. Dynamic resolvers, subagents and framework/workflow/provider tools are excluded from publication. [Rules][e-doc] |
| Resources | Lists/reads the packed `ui://` app set; no general arbitrary-resource callback API identified. [Handlers][l-core] | General resources, templates and notification APIs, plus app resources. [Registration/handlers][m-server] | No inbound resources API identified. [MCP implementation][f-mcp] [exports][f-package] | Optional `skills: true` exposes skill files under `skill://` through resource methods; this is not an MCP Apps UI resource API. [Skills implementation][e-skills] |
| Prompts | No prompt capability/handlers registered. [Capabilities][l-core] | Prompt list/get and notification APIs. [Implementation][m-server] | No inbound prompts API identified. [MCP implementation][f-mcp] | No prompts publisher identified in the channel's tool/skill feature registration. [Channel][e-channel] |
| JSON Schema / Standard Schema / Zod | Standard Schema validation; input JSON Schema uses `~standard.jsonSchema.input`, falling back to `{ type: 'object' }`. Zod 4 works when its converter is present. [Converter][l-schema] [input contract][l-doc] | Converts supported Standard Schema and Zod schemas; server advertises JSON Schema 2020-12. Core delegates compatibility helpers to schema-compat. [Server conversion][m-server] [schema API][m-schema] | Inbound server schemas not applicable; MCP client adapts remote tool schemas. [Adapter][f-mcp] | Tool authoring accepts Zod, Standard Schema or plain JSON Schema; channel publishes input/output JSON schemas. [Tool contract][e-tool-doc] [publication][e-tools] |
| Structured output and output schema | Returns JSON text plus object `structuredContent`; wraps non-objects under `value`. No output schema advertised. [Result shaping][l-result] [tool fields][l-tools] | Declared `outputSchema` produces validated `structuredContent`, including arbitrary JSON on modern protocol. [Validation/dispatch][m-server] | Inbound MCP output not applicable; remote client validates/consumes results through SDK. [Client adapter][f-mcp] | Object outputs are structured even without output schema; declared schemas permit other JSON values and SDK validation. [Result mapping][e-tools] [registration][e-server] |
| MCP Apps `ui://` publication | Native packer and resource server; tools link via `_meta.ui.resourceUri`. [Packer][l-app] [mapping][l-tools] | Native `appResources` map, linked through `mcp._meta.ui.resourceUri`; supports inline `html` or `htmlPath`. [Loading][m-server] [types][m-types] | No MCP Apps publishing API identified in runtime exports/integration. [Exports][f-package] [MCP implementation][f-mcp] | No `ui://` app publisher or UI metadata option identified in channel config; optional resources are skills. [Config/registration][e-channel] |
| UI build and serving | `litro mcp-app build` renders a data-free, self-contained HTML shell with bridge; Lit/FAST supported, Elena excluded. Packed HTML is returned by `resources/read`. [Build][l-pack] [packer][l-app] [read handler][l-core] | Server reads supplied HTML and serves it with MCP Apps metadata; UI bundling is application code. [Loader][m-server] | No native MCP UI build/serving surface identified. [Runtime exports][f-package] | No native MCP UI build/serving surface identified in channel. [Channel][e-channel] |
| Host support | Requires MCP Apps-capable host; repository records Inspector integration testing. This suite's SDK resource reads alone do not prove iframe rendering. [Existing host rig][l-rig] | Documents app rendering in Mastra Studio and bridge API; this is distinct from compatibility with every third-party host. [App documentation][m-ref] [client/host guide][m-clientdoc] | No native MCP App to claim host support for. [MCP surface][f-mcp] | No native MCP App to claim host support for. [Channel surface][e-channel] |
| Streaming and progress | HTTP SSE response encoding, but no tool progress adapter; 30-second default timeout. [Transport][l-http] [limits][l-result] [documented gap][l-doc] | `context.mcp.progress()` emits when a token was requested; request notifications stream with the response. [Progress contract][m-ref] | Agent conversation streaming is separate from MCP server progress; only an outbound MCP integration was identified. [Client][f-mcp] | Agent operations return invocation state for polling; published-tool adapter exposes no progress callback. No inference from agent streaming to MCP progress. [Channel contract][e-doc] [adapter][e-tools] |
| MCP sessions vs application state | Stateless HTTP, no MCP session ID; direct calls do not use the durable conversation store. [Transport][l-http] [tool context][l-core] | Stateless transport; continuation state/tasks are separate features, not MCP transport sessions. [Server][m-server] | No native MCP server session API identified; client connections are cached per agent instance. [Client cache][f-mcp] | No MCP transport sessions. Optional authenticated `dev.eve/tool-sessions` extension shares sandbox state; agent invocations have separate durable sessions. [Session rules][e-doc] [tool adapter][e-tools] |
| Origin and token gates | Exact origin allowlist, local-loopback exceptions, token gate, then agent access guard. Missing Origin allowed; no wildcard CORS. [Origin/token logic][l-gates] [order][l-http] | Optional DNS-rebinding guards require enabling and nonempty host/origin lists. Matching is hostname-based, not exact scheme/port. Auth must be separately configured. [HTTP implementation][m-server] [options][m-types] | No inbound MCP gates identified; outbound token resolver/allowlist controls client use. [Client][f-mcp] | HTTPS except loopback; Host must match URL and browser Origin must be same-origin. Security gates precede channel authentication. [HTTP security][e-security] [channel wiring][e-channel] |
| UI security boundary | Build rejects external subresource URLs; bridge checks parent frame and guards default property assignment. Custom `apply` remains trusted code. [Packer][l-app] [bridge][l-bridge] | App resource accepts CSP/permissions metadata from ext-apps; sandbox enforcement belongs to host. [Types][m-types] [resource loader][m-server] | No native MCP UI boundary identified. [MCP surface][f-mcp] | No native MCP UI boundary identified. [Channel surface][e-channel] |
| Scaffold and reload | MCP serve CLI plus separate app build; stdio command is not hot reload. Standard application development uses the framework dev pipeline. [CLI][l-cli] [MCP guide][l-doc] | `create-mastra` scaffolds; `mastra dev` provides Studio and API development server. The measured fixture uses standalone `MCPServer`. [Scaffold][m-create] [CLI][m-cli] | `flue init` scaffolds; Vite development server. These are agent tools, not an MCP server scaffold. [Init][f-init] [development][f-start] | `eve init`, `eve dev` with reload, `eve build`/`start`. [CLI][e-cli] [reload][e-start] |
| Test helpers / probes | Existing SDK stdio/HTTP probes and independent Inspector rig; no separate public MCP test-helper package identified. [Probes][l-doc] [rig][l-rig] [exports][l-package] | Direct `executeTool()` for non-protocol calls and official SDK clients for protocol testing. [API][m-ref] [scripts][m-package] | Tools can be tested directly; agent eval guide uses Vitest. No native MCP server test helper identified. [Evals][f-evals] [exports][f-package] | Evals include tool stubs and mock models; they are agent test facilities, not evidence of UI conformance. [Evals][e-evals] |
| License | Apache-2.0. [Manifest][l-package] | Apache-2.0. [Manifest][m-package] | Apache-2.0. [Manifest][f-package] | Apache-2.0. [Manifest][e-package] |

Eve can therefore participate in the deterministic HTTP benchmark without an LLM: publish the authored weather tool with `tools: true` and disable agent operations with `agent: false`. Flue's local weather function check demonstrates the shared tool behavior only; exposing it through a custom SDK wrapper would measure that wrapper, so Flue receives no native MCP latency or UI-resource result. [Eve contract][e-doc] [Flue client implementation][f-mcp]

## Maturity and observed release cadence

Versions are release identifiers, not scores for reliability. Dates below come from the official npm registry `time` records, observed November 12, 2026. The 30 calendar dates are October 14 through November 12, 2026, inclusive, UTC. Counts include published numeric `x.y.z` versions; prerelease counts are stated separately and exclude arbitrary branch/snapshot builds. Publication frequency is not evidence of production stability.

| Package | Current selected release and UTC publication | Observed recent cadence |
| --- | --- | --- |
| Litro agent | `0.7.3`, Nov 4 at 16:46 UTC; framework `0.18.0`, Nov 4 at 16:50 UTC. [Agent registry](https://registry.npmjs.org/@beatzball%2flitro-agent) [framework registry](https://registry.npmjs.org/@beatzball%2flitro) | Three agent releases in the window: `0.7.1` Oct 23, `0.7.2` Oct 29, `0.7.3` Nov 4. Framework: five releases. [Release history][l-changelog] [registry](https://registry.npmjs.org/@beatzball%2flitro-agent) |
| Mastra MCP | `2.8.0`, Nov 3 at 23:55 UTC; core `1.82.0`, Nov 4 at 00:00 UTC. [MCP registry](https://registry.npmjs.org/@mastra%2fmcp) [core registry](https://registry.npmjs.org/@mastra%2fcore) | Six stable MCP releases: Oct 14, 15, 21, 28, 30, Nov 3; 19 numbered alpha releases in the same window. [Registry](https://registry.npmjs.org/@mastra%2fmcp) [release history][m-changelog] |
| Flue runtime | `2.3.0`, Oct 12 at 18:49 UTC. [Registry](https://registry.npmjs.org/@flue%2fruntime) | Zero releases in the 30-date window. Latest three version dates: `2.3.0` Oct 12, `2.2.2` and `2.2.1` Sep 28. This observation alone does not establish maintenance status. [Changelog][f-changelog] [registry](https://registry.npmjs.org/@flue%2fruntime) |
| Eve | `1.0.0-rc.10`, Nov 12 at 02:21 UTC; the npm `latest` tag selects a release candidate. [Registry](https://registry.npmjs.org/eve) | 21 stable version publications and 11 release candidates in the window. RC series spans `rc.0` Oct 30 through `rc.10` Nov 12; recent RC dates include Nov 9, 10, 12. [Registry](https://registry.npmjs.org/eve) |

## Measurements

Captured November 12, 2026, 19:42:34–19:43:26 UTC on an Apple M4 Max,
16 logical CPUs, 128 GiB RAM, Darwin 25.3.0 arm64, Node 24.7.0 and npm 11.5.1.
The host was shared with other benchmark/development jobs; load averages at
capture start were 5.76 / 7.87 / 7.42. Per-process load context is retained.
These are exploratory fixture measurements under that background work.

| Framework | Transport | Install MiB | Build ms | Cold ms | Idle RSS MiB | list p50 / p95 ms | call p50 / p95 ms | UI bytes |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| litro | http | 185.80 | 359.72 [339.94–430.92] | 132.05 [122.15–146.53] | 85.52 [85.00–86.16] | 0.55 [0.47–0.67] / 0.88 [0.73–0.96] | 0.58 [0.51–0.68] / 0.91 [0.87–0.99] | 9935 |
| litro | stdio | 185.80 | 359.72 [339.94–430.92] | 117.90 [114.65–138.24] | 88.45 [86.45–88.63] | 0.06 [0.05–0.07] / 0.11 [0.08–0.12] | 0.07 [0.06–0.09] / 0.12 [0.10–0.15] | 9935 |
| mastra | http | 186.47 | 336.25 [321.60–366.11] | 167.83 [161.09–172.68] | 117.22 [115.97–117.77] | 0.56 [0.50–0.72] / 0.94 [0.75–1.42] | 0.60 [0.52–0.75] / 0.98 [0.75–1.47] | 664825 |
| mastra | stdio | 186.47 | 336.25 [321.60–366.11] | 306.93 [296.22–329.78] | 115.91 [115.56–116.63] | 0.15 [0.14–0.19] / 0.27 [0.20–0.31] | 0.19 [0.17–0.22] / 0.34 [0.24–0.39] | 664825 |
| flue | N/A (client only) | 108.73 | 310.94 [293.01–571.80] | N/A | N/A | N/A | N/A | N/A |
| eve | http | 92.21 | 1562.89 [1477.76–2031.91] | 222.85 [203.25–234.75] | 135.27 [134.11–135.89] | 0.81 [0.74–1.11] / 1.13 [0.98–1.89] | 1.01 [0.90–1.31] / 1.37 [1.12–2.15] | N/A |

Each cell is the median across runs [minimum–maximum]. Latency spreads describe per-run percentiles.
5 clean builds per app; 7 fresh processes per supported transport; 100 timed requests per method per process, after 10 warmups. Serial concurrency 1; client list cache bypassed. MiB = 1,048,576 bytes.

Litro negotiated MCP `2025-11-25` on both transports. Mastra and Eve used
`2026-07-28`. Eve stdio and both Flue server transports are N/A for the native
APIs described above; their omission is not a zero measurement. Flue's install
and build entries describe the local tool sample. Eve has no native MCP App
resource in this fixture. No standalone legacy SSE server transport was measured.

The [raw results](../benchmarks/mcp/results/latest.json) retain all 700 timed
samples per method per supported transport, five build samples per app, seven
startup/RSS samples per transport, exact versions, source and lockfile hashes.
`node benchmarks/mcp/summary.mjs` regenerates this table. The table uses the
median of each run's p50/p95 with the min–max of those per-run statistics;
it does not present pooled percentiles.

Both exact UI artifacts also passed a separate browser run in
`@mcp-use/inspector@20.3.29`, Playwright `1.65.0`, Chromium `158.0.8127.18`.
The real host loaded each `ui://bench-weather/card` document into its iframe,
completed the bridge exchange and displayed `Weather` and
`Lisbon: 21°C, sunny`. The [browser evidence](../benchmarks/mcp/results/ui-verification.json)
records the time, host/browser versions and matching resource sizes/hashes.
Run `npx playwright install chromium` followed by
`node benchmarks/mcp/verify-ui.mjs` to repeat it after building the apps.
This checks the two fixtures in that host, without measuring paint latency or
claiming every desktop host works.

## Reproduction and methodology

Use Node.js 24 or later and npm. Eve's selected package requires Node `>=24`; Flue requires `>=22.19.0`, Mastra MCP `>=22.13.0`. Exact direct dependency versions are in each fixture manifest, and resolved transitive versions are locked by its `package-lock.json`. [Eve engines][e-package] [Flue engines][f-package] [Mastra engines][m-package]

From the repository root:

```sh
cd benchmarks/mcp
npm ci --no-audit --no-fund
npm run verify -- --install
npm run measure -- --runs 7 --samples 100 --build-runs 5
```

`--install` runs isolated `npm ci` in each app. Omit it on later runs when the lockfiles and installed trees agree. The verify command builds each fixture once, checks the shared behavior, and exercises each supported transport with the real official TypeScript SDK client. `npm run measure` runs the complete measurement suite. For a targeted check, use `npm run verify -- --app mastra`; reduced/targeted runs are not substitutes for the complete published result. See [`benchmarks/mcp/run.mjs`](../benchmarks/mcp/run.mjs) for accepted flags and output paths and [`benchmarks/README.md`](../benchmarks/README.md) for benchmark setup.

The suite uses `@modelcontextprotocol/client@2.4.0` for every server, with each server's known protocol era configured before connection: modern `2026-07-28` for Mastra/Eve, legacy for Litro. This is a common client implementation, with different protocol paths. There is no extra stdio discovery probe in the timed path. Record the negotiated version and era from the result, rather than assuming the package version determines them.

The common tool is `get-weather`, modeled after [`playground/agents/demo/tools/get-weather.ts`](../playground/agents/demo/tools/get-weather.ts): `{ city: string }`, trimmed, 1–80 characters, returning `{ city, tempC: 21, summary: 'sunny' }`. There is no external weather request, LLM, or per-call SSR. Verification checks valid/trimmed input, required city, empty/whitespace city, excessive length and wrong type; a subsequent list checks continued availability. The benchmark's Litro result is ordinary data, not a `ui()` result.

The full run records five build samples and seven fresh process starts per supported transport. After ten warmups per method per run, it records 100 sequential `tools/list` and 100 `tools/call` requests per process: 700 measured samples of each method per transport. Concurrency is one; this measures serial round-trip latency, not throughput. The host was shared with other development and benchmark work, so these observations are not an isolated-machine capacity test. Tool-list requests bypass the SDK cache, which matters because modern servers advertise cache hints. SDK parsing/validation is part of the timed client call; the runner's additional equality/schema assertions follow the timed interval. Build and measurement order rotate between runs to reduce fixed-order effects.

| Measurement | Definition and reporting |
| --- | --- |
| Install size | Sum logical regular-file bytes inside each isolated `node_modules`, including development/build tools and optional dependencies npm installs; symlinks excluded. Report MiB (`bytes / 1,048,576`). Excludes app output and the suite's separate client installation. Not transfer size or production-only package size. |
| Build time | Wall time of fixture `npm run build`, repeated five times with output cleaned by fixture scripts. Excludes install and upstream library compilation. Report median and min–max; cached OS pages/dependencies remain warm. |
| Cold start | Fresh server process through client connection and first uncached `tools/list`; client modules already loaded. HTTP includes listener readiness polling at 5 ms intervals. Report seven samples, median, p95 and min–max. This is process-cold, not an empty filesystem cache, machine boot or cloud-function cold start. |
| List/call latency | Official-client elapsed round trip, including transport, serialization, dispatch and validation. The runner summarizes per-run p50/p95 with their median and min–max; label those as median-of-run quantiles. Raw arrays also allow pooled p50/p95 over all 700 samples, but those must be calculated separately and labeled as pooled. Quantiles use nearest rank. |
| Idle memory | Server-process RSS from `ps`, median of three readings 50 ms apart after a 200 ms pause following the first tool list. This excludes the client, kernel/network buffers and any uncounted child processes. It is a startup-idle snapshot, not peak or steady-state memory under load. |
| MCP App size | UTF-8 bytes of the HTML actually returned by `resources/read`, with URI, MIME type and hash. Uncompressed, including bridge/runtime/style bytes. Does not measure browser memory or render latency. |

The final results must preserve the machine's OS, CPU, architecture, Node/npm versions, RAM, run counts, source/lock hashes and individual samples. Machine-specific usernames, home directories and hostnames do not belong in published artifacts. Include the capture timestamp so future reruns are distinguishable.

## Fairness and limits

- **Different build/start surfaces:** Litro uses published package constructors with a pre-resolved agent. HTTP uses the native `createMcpHandler` on an h3 Node listener; stdio connects native `createMcpServer` to SDK `StdioServerTransport`. It excludes Nitro app compilation, filesystem agent discovery, Vite loading and `litro mcp serve` CLI startup. Mastra uses standalone `MCPServer` with a minimal Node listener. Eve uses the real native application build and `.output` Nitro server. These differences affect both build time and cold start. Eve skips sandbox prewarming because this tool opens no sandbox. Its compiler fetches model-catalog metadata after each clean `.eve` deletion, so its build cost includes network-sensitive metadata work, even though no model runs. See the [Eve fixture](../benchmarks/mcp/apps/eve/README.md) and [catalog loader][e-catalog].
- **Different validation work:** Mastra requires its optional output schema to return plain-value `structuredContent`, so this fixture includes one and pays its validation cost. Litro does not publish output schemas; Eve returns object structured content without one. Eve also applies its raw JSON Schema bounds before the authored Zod transform: an 80-character city padded with spaces is rejected before trimming, while ordinary ` Lisbon ` trims correctly. The native behavior is retained and documented in the [Eve fixture](../benchmarks/mcp/apps/eve/README.md). These implementations return the same measured weather response but perform different validation work.
- **Different wire protocols:** Mastra/Eve use modern per-request envelopes, Litro the legacy SDK handshake path. HTTP response encoding and discovery work can differ. Do not present the numbers as a controlled experiment isolating framework overhead.
- **UI implementation choices:** Litro builds a static shell through native `buildMcpAppDocument`; Mastra supplies HTML with the official ext-apps browser bridge. Both can contain initial markup. This is not a Lit-vs-React rendering test, and it cannot establish a universal SSR advantage. Bundle size reflects the selected bridge entry point and bundler configuration as well as framework behavior.
- **Dependency audit fixes:** The Litro fixture pins h3 `1.15.9` and overrides transitive fflate to `0.7.5` and glob to `14.0.2`; Flue overrides its outbound MCP client from `2.0.0` to `2.4.0`. These resolve the initial CI audit findings without suppressing advisories. They affect install/build costs and are recorded in manifests, locks and raw results. The framework packages remain at the selected release versions.
- **Development dependency size:** Full install trees include esbuild, schemas, adapters, optional peers and any fixture-specific diagnostics. They do not isolate production deployment size or the marginal cost of adding MCP to an existing app.
- **Auth is outside the workload:** Local fixtures use local/public settings and loopback listeners; no OAuth round trip, remote proxy, TLS or authentication-provider latency is measured. Feature-table security gates remain relevant to real deployments.
- **App retrieval versus host rendering:** SDK retrieval and browser verification are separate. This suite also loads both exact resources in MCP Inspector and asserts the rendered result in its actual iframe; versions and artifact hashes are recorded below. It does not claim support in every desktop host or measure browser paint latency.
- **Shared host:** Other benchmark/development jobs ran on this machine. The raw results record the host load averages at startup and before each process measurement. Order rotation and spreads expose some variation; neither removes scheduling, cache or thermal interference. Treat these as exploratory fixture observations, not a reproducible ranking or isolated framework overhead.
- **Scope of conclusions:** No provider calls, durable-agent recovery, sandbox startup, concurrent load, edge deployment, large tool catalogs, progress delivery, browser paint or cross-host UI compatibility are measured. Seven process samples give a limited view of startup spread; 700 requests on one machine do not establish fleet-wide tails.

## Related MCP Apps projects not measured

These projects are relevant to a reader evaluating MCP Apps. Their omission is a scope limit, not evidence that Litro is uniquely capable of serving UI resources.

| Project | Why relevant | Why no performance row |
| --- | --- | --- |
| Official `modelcontextprotocol/ext-apps` | Provides the official app/host bridge APIs, server helpers and multiple UI examples. [Pinned README][ext-apps] | It is the protocol extension SDK and reference examples, not one fixed agent-framework runtime; adding a vanilla SDK baseline is useful future work. Mastra's fixture uses it as a dependency. |
| `mcp-use` | Offers TypeScript MCP server/app tooling and an Inspector. [Pinned README][mcp-use] | Outside the requested four-framework set; no matched fixture or timings were collected. |
| FastMCP (`PrefectHQ/fastmcp`) | Python MCP servers, clients and interactive apps. [Pinned README][fastmcp] | Requires a Python runtime and a separate matched fixture/install-size definition; no measurements were collected. |

[l-core]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/src/mcp-server/core.ts
[l-http]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/src/mcp-server/http.ts
[l-gates]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/src/mcp-server/gates.ts
[l-tools]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/src/mcp-server/tools.ts
[l-result]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/src/mcp-server/result.ts
[l-schema]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/src/runtime/json-schema.ts
[l-app]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/src/mcp-app/index.ts
[l-bridge]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/src/mcp-app/bridge.ts
[l-cli]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/framework/src/cli/mcp-serve.ts
[l-pack]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/framework/src/cli/mcp-app.ts
[l-package]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/package.json
[l-framework]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/framework/package.json
[l-doc]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/docs-content/content/docs/mcp-server.md
[l-appdoc]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/docs-content/content/docs/mcp-apps.md
[l-rig]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/playground/mcp-server/README.md
[l-changelog]: https://github.com/beatzball/litro/blob/2d75f0bbe00e43f8f33dce0d8585bb6e2c3692f3/packages/litro-agent/CHANGELOG.md
[m-server]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/packages/mcp/src/server/server.ts
[m-types]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/packages/mcp/src/server/types.ts
[m-oauth]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/packages/mcp/src/server/oauth-middleware.ts
[m-ref]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/docs/src/content/en/reference/tools/mcp-server.mdx
[m-auth]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/docs/src/content/en/docs/guides/mcp-authentication-authorization.mdx
[m-clientdoc]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/docs/src/content/en/docs/connections/mcp.mdx
[m-schema]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/packages/core/src/schema/index.ts
[m-cli]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/docs/src/content/en/reference/cli/mastra.mdx
[m-create]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/docs/src/content/en/reference/cli/create-mastra.mdx
[m-package]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/packages/mcp/package.json
[m-corepackage]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/packages/core/package.json
[m-changelog]: https://github.com/mastra-ai/mastra/blob/6e8dfcb83facb0861ebefa4fee384429a113acf4/packages/mcp/CHANGELOG.md
[e-doc]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/docs/channels/mcp.mdx
[e-channel]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/packages/eve/src/public/channels/mcp.ts
[e-server]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/packages/eve/src/internal/mcp/streamable-http-server.ts
[e-tools]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/packages/eve/src/internal/mcp/published-tools.ts
[e-security]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/packages/eve/src/internal/mcp/http-security.ts
[e-skills]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/packages/eve/src/internal/mcp/skills.ts
[e-package]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/packages/eve/package.json
[e-tool-doc]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/docs/tools/index.mdx
[e-cli]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/docs/reference/cli/index.md
[e-start]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/docs/getting-started.mdx
[e-evals]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/docs/evals/index.mdx
[e-clientdoc]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/docs/connections/mcp.mdx
[f-readme]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/README.md
[f-mcp]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/packages/runtime/src/mcp.ts
[f-doc]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/apps/docs/src/content/docs/guide/mcp.md
[f-package]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/packages/runtime/package.json
[f-init]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/apps/docs/src/content/docs/cli/init.md
[f-start]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/apps/docs/src/content/docs/guide/getting-started.mdx
[f-evals]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/apps/docs/src/content/docs/guide/evals.md
[f-changelog]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/CHANGELOG.md
[alt-flue]: https://github.com/sfkislev/flue/blob/840bb1a3faaddc31689b7431a899038e2d1042ba/README.md
[alt-eve]: https://github.com/mcpapp/eve/blob/a895c405cfb3f1527344b97e46dd94eaeff71200/README.md
[ext-apps]: https://github.com/modelcontextprotocol/ext-apps/blob/ea3e9d0e624a20bc1c51310292f09d9b8ed17161/README.md
[mcp-use]: https://github.com/mcp-use/mcp-use/blob/546081e8242da1e066417cfec7f8816bb018a14d/README.md
[fastmcp]: https://github.com/PrefectHQ/fastmcp/blob/713042447f2db8c16dcf2f1ff5b8e837be1ea3b4/README.md

[f-tools]: https://github.com/withastro/flue/blob/deee93b40d275ecc9a50c50af2158f20089d54bc/apps/docs/src/content/docs/guide/tools.md

[e-catalog]: https://github.com/vercel/eve/blob/746a74163d712c3a06ff907199ae9ccca1d0e749/packages/eve/src/compiler/model-catalog.ts
