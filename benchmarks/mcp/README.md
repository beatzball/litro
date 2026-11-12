# MCP comparison suite

The [comparison](../../research/mcp-comparison.md) explains project identities,
source evidence, measured versions, limitations and results. This suite is
independent of the web and HN benchmarks and does not write their results.
Use Node 24 and npm 11 on macOS or Linux (`ps` supplies server RSS).

From the repository root:

```sh
cd benchmarks/mcp
npm ci
node run.mjs --install --verify-only
node run.mjs
node summary.mjs
```

`--install` runs locked `npm ci` in each standalone app. It requires registry
access. Apps and the harness have separate lockfiles, outside the pnpm
workspace. Install and browser activity must finish before recording timings.
The suite builds every app and checks each supported transport with the same
official `@modelcontextprotocol/client@2.4.0` client. It asserts one tool, city
schema bounds, trimming, five invalid inputs and deterministic output. It reads
and hashes each linked MCP App document. Flue's native tool executes directly;
Flue has no native MCP server, so protocol measurements are N/A.

A full run performs five clean builds per app, then seven fresh processes per
supported transport. Each process handles ten warmup requests per method and
100 timed requests per method at concurrency one. Methods alternate list/call;
combination order rotates between rounds. No LLM or weather service runs.
`tools/list` explicitly bypasses the SDK's response cache. HTTP uses loopback.

Cold time starts immediately before spawning a server and ends after the
client receives the first `tools/list`. Port allocation happens before the
clock, while TCP polling (5 ms), transport connection and negotiation are
inside it. The client and filesystem caches are warm; this is process startup,
not a reboot or container-image download. Litro negotiates the legacy era;
Mastra and Eve pin 2026-07-28 to avoid the SDK's extra stdio probe process.

Idle RSS is the median of three `ps` readings, 50 ms apart, after a 200 ms
pause following that first listing. It includes only the server process,
before warmups or tool calls. It excludes the client, inspector and operating
system cache. Install size counts logical regular-file bytes recursively in
`node_modules`, including dev dependencies, and excludes symlinks. It is not
compressed download size or allocated disk blocks. Build time includes npm
startup and each fixture's clean build. Eve requires its native compiler and
Nitro output; the other fixtures use a smaller build path. Compare these build
workloads with that difference in mind.

Full default results replace `results/latest.json`; the summary is derived
from that file. Partial and verification runs default to ignored
`results/partial.json`. `--output path` selects a different result file.
`--app litro|mastra|flue|eve`, `--runs N`, `--samples N` and `--build-runs N`
select a diagnostic subset. Do not publish a subset as the full comparison.
Raw samples, per-run percentiles, environment fields, exact direct versions,
lockfile hashes and source fingerprints are retained. No hostnames, usernames,
working directories or absolute paths are recorded.

The app READMEs describe their native APIs. Published packages are pinned;
this does not benchmark an unpublished workspace build or the framework's
scaffolding CLI. The two UI resources use a native Litro bridge and the full
bundled official MCP Apps guest SDK for Mastra. Their bytes describe these
fixtures and runtime choices, not minimum possible framework sizes.

## Browser resource verification

Protocol/resource checks run above. The separate browser check uses MCP
Inspector as a real host, outside the timing run. Install Chromium once:

```sh
npx playwright install chromium
```

Run both UI fixtures with one command:

```sh
node verify-ui.mjs
```

The script starts each built app on a free loopback port, launches the pinned
`@mcp-use/inspector@20.3.29` host with `npx`, drives it with Chromium, and stops
the child processes. It asserts the heading and `Lisbon: 21°C, sunny` appear
in the host's actual MCP App iframe. It writes `results/ui-verification.json`
with host and browser versions. Registry access is needed to provision the
pinned Inspector on the first run. `--app litro` or `--app mastra` selects a
single check and writes an ignored partial result. This verifies Inspector;
it does not claim support in other desktop hosts.
