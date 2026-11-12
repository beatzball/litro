# Playground

The weather demo at `/agent` works without an API key. The separate coder demo
at `/coder` runs commands in sandpiper microVMs. It adds no framework API.

## Run code

Use Node.js 22.12 or later and pnpm. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @beatzball/litro-router build
pnpm --filter @beatzball/litro build
pnpm --filter @beatzball/litro-agent build
pnpm install --frozen-lockfile
export SANDPIPER_URL=http://127.0.0.1:7171
export SANDPIPER_TOKEN='<host token>'
pnpm dev
```

Start sandpiperd on a Linux KVM host with the `node` template installed. See
[sandpiper host setup](https://github.com/beatzball/sandpiper/blob/main/docs/host-setup.md).
With Lima's `sandpiper-dev` VM running sandpiperd on guest `127.0.0.1:7171`,
Lima forwards that port to the Mac's `127.0.0.1:7171`. Keep the URL and bearer
token on the playground server. They are never passed to the browser or model.
The sandbox has no host mounts and no network access.

Open `/coder` and select **Run**. The default command is:

```json
["node", "-e", "console.log(1+1)"]
```

The result is `2`, with exit code 0. Enter a JSON argv array for another command.
Use `["sh", "-c", "your script"]` for shell syntax. Without `LLM_URL`, a
scripted provider calls the real tool without a model or API key. With
`LLM_URL`, `LLM_MODEL`, and optional `OPENAI_API_KEY`, the coder uses an
OpenAI-compatible provider and accepts natural language requests.

`agents/coder/tools/run-code.ts` validates the command, calls
`machines.forSession(sessionId, { template: 'node' })`, and runs it with a
10-second limit. The tool renders `<run-output>` as Declarative Shadow DOM.
The model sees only the exit code and the last 8000 stdout characters and
4000 stderr characters. The component shows the full output retained by the
host, with timeout and truncation indicators. HTML in output stays text.

The browser tab keeps its session ID across reloads.
Each session's machine ID is saved in `.litro/sandpiper/`. Set
`SANDPIPER_SESSIONS_DIR` to use another directory. Reconnects and server restarts
reuse that ID after checking the machine is still running. A missing, stopped,
failed, or expired machine is replaced. Authentication and transport errors
propagate without allocating another machine. The daemon owns idle and maximum
TTLs and destroys expired machines. Commands are never retried automatically.
This demo uses one server process and a local binding directory; it does not
provide shared binding locks across multiple playground processes.

If either sandpiper environment variable is unset, the tool returns a clear
configuration error. The weather demo and other playground routes still work.

## Tests

```sh
pnpm --filter playground test
pnpm --filter playground typecheck
```

These commands cover the existing MCP limits and the run-code fake-host tests.
They are included in the existing CI package test and playground type-check
steps. The run-code tests check session reuse, restart persistence, replacement,
authentication failures, output trimming, SSR escaping, timeout display, command
validation, and lost streams without command retries.

For the real KVM proof, start sandpiperd and set the two environment variables
above. Then run:

```sh
pnpm --filter playground test:run-code:vm
```

This test calls the actual tool. It checks that Node returns `2`, the session
binding is reused, and the result contains rendered shadow DOM and stdout.
It then calls the tool with `wget -T 3 -O - http://1.1.1.1` and requires a failed
connection with a nonzero exit code. The test destroys its machine and removes
its temporary bindings. It skips when `SANDPIPER_URL` is unset. A configured URL
with a missing token is a failure.

## Vendored client

`vendor/sandpiper/` is a built copy of the dependency-free
`@beatzball/sandpiper` client. The relative `file:vendor/sandpiper` dependency
works in a fresh standalone clone and CI. It needs no sibling checkout or npm
publish. `SOURCE.json` records the upstream package version and a digest of
the copied files. The Apache 2.0 license is included.

To refresh it, build `clients/ts` in a sandpiper checkout with `npm ci` and
`npm run build`. From this repository, set the source directory explicitly:

```sh
SANDPIPER_CLIENT_DIR=../sandpiper/clients/ts node scripts/refresh-sandpiper-client.mjs
pnpm install --force
```

The script also accepts a relative directory as its first argument. It copies
only built JavaScript, declarations, and the license. It records no local path.
Review the vendor and lockfile diffs before committing a refresh.
