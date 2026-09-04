---
'@beatzball/litro-agent': patch
---

`fileSessionStore` no longer breaks permanently when its session directory disappears, and can be pointed elsewhere with `LITRO_AGENT_SESSIONS_DIR`.

The store creates `.litro/sessions` once and caches that result for the life of the process. If the directory was then removed — a cleanup script, a log rotation, a tmpfs reaper — every later `append` failed with `ENOENT` forever and the agent endpoint returned a 500 error event on every turn until the server restarted. It now recreates the directory and retries the append once.

`LITRO_AGENT_SESSIONS_DIR` overrides the default directory (an explicit `fileSessionStore({ dir })` still wins). It exists for the case where two servers run against the same project directory and must not share session state.
