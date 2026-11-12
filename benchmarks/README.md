# Benchmarks

The web and HN benchmark runner is in `src/`; run its commands from the
repository root with `pnpm bench`, `pnpm bench:cross` or `pnpm bench:all`.

The independent [MCP comparison suite](mcp/README.md) has locked standalone
apps, a common official SDK client, protocol checks, browser resource checks
and repeated measurements. Its results are in `mcp/results/`, separate from
`results/latest.json` used by the web benchmarks.
