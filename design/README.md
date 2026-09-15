# design/

Planning documents for Litro. They say what we meant to build and why.
The docs site says how things work today. That lives in `packages/docs-content/`.

## What goes where

| Folder | What it holds | File name |
|---|---|---|
| `specs/` | A design: the problem, the options, the recommendation. | `YYYY-MM-DD-short-slug.md` |
| `plans/` | The task plan for building an accepted design. | `YYYY-MM-DD-short-slug.md` |
| `adr/` | An architecture decision record (ADR): one decision and why we made it. | `NNNN-short-title.md` |

## Status line

Every file starts with a status line, under its title:

```
Status: Draft
```

Use one of these:

- `Draft` — still being written or reviewed.
- `Accepted` — agreed, not built yet.
- `Accepted — shipped` — agreed and on `main`.
- `Superseded by <file>` — a newer file replaces this one.

When the state changes, change the line.

## May not be committed

- Secrets, tokens, keys, internal URLs or hostnames.
- Personal names, usernames, emails, home-directory paths.
- Notes about who or what wrote the file: agent sessions, panes, windows, tools or harnesses.
- Other companies' product names, when a neutral term works. Write "an MCP host" or "a provider".
- Line numbers in code references. They drift. Use the file path and the symbol name.
- Scratch output: raw logs, review transcripts, agent reports. Write a summary of what matters.
- Anything that only makes sense inside one session, like "the branch above" or "as I said".

## Should be committed

- The problem.
- The options we considered.
- The recommendation or the decision.
- The phases.
- The risks.
- What must be checked.

These still make sense a year later.

## Specs and ADRs

A spec is the full design. It can be long.

When a design is accepted, record the decision as a short ADR. One page is enough.

The ADR holds only the why. Living detail goes in a rule or in the docs, not in a rewritten ADR.
When a decision changes, update the rule. Then write a new ADR that supersedes the old one.

## When to write an ADR

Write one when the decision:

- is hard or costly to reverse,
- affects more than one package, or a public contract,
- trades something off that a future reader will question, or
- sets a pattern that others must follow.

Do not write one for a bug fix, a refactor that does not change behaviour, or a routine dependency bump.

The test: will someone six months from now wonder why we did this?

## ADR sections

1. **Title** — the decision, in imperative form. For example, "Serve MCP tools from the agent package".
2. **Date**
3. **Status**
4. **Context** — the problem and the forces on it.
5. **Decision** — what we chose.
6. **Alternatives considered** — what we did not choose, and why.
7. **Consequences** — the good and the bad.

Copy `adr/0000-template.md` to start one.

## DECISIONS.md

The root `DECISIONS.md` log stays as it is. New decisions go in `adr/`.
Do not move the old entries.
