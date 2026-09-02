# skills

Agent skills by [David Bernheisel](https://github.com/dbernheisel), packaged as a
Claude Code plugin marketplace.

## Install

```
/plugin marketplace add dbernheisel/skills
/plugin install dbern-skills@dbernheisel
```

## Skills

### `visualize-svg`

Creates and previews animated SVG explainers with playback controls, timeline
scrubbing, zoom and pan, WebM export, and GitHub PR attachment guidance. Adapted from
[veelenga/preview-skills](https://github.com/veelenga/preview-skills/tree/main/skills/preview-svg).

### `elixir-conventions`

Elixir, Ecto, Phoenix and ExUnit conventions. The guidance is split by layer so a
project only loads what it uses:

| Working on | Reads |
| --- | --- |
| Any Elixir | `references/elixir-conventions.md` |
| Ecto schemas, changesets, queries | `references/ecto-conventions.md` |
| Ecto migrations, data migrations, backfills | `+ references/migrations.md` |
| Routers, controllers, LiveViews, HEEx | `references/phoenix-conventions.md` |
| ExUnit tests | `references/testing.md` |

The migrations reference is derived from
[fly-apps/safe-ecto-migrations](https://github.com/fly-apps/safe-ecto-migrations)
(`README.md` and `Backfilling.md`).

### `domain-driven-feature-design`

A five-phase procedure for turning a feature request into a design: establish the
domain language, locate the bounded context, model the change, place the
behavior, then pressure-test it against a table of structural smells. Outputs a
design document, not a lecture. Language-agnostic, with a section on translating
the patterns into Elixir.

Includes a "when not to use this" section — CRUD screens, spikes, and generic
subdomains do not get a modeling session.

## Agents

| Agent | Does |
| --- | --- |
| `elixir-developer` | Writes Elixir with OTP/BEAM-first design |
| `elixir-reviewer` | Opinionated review against OTP and BEAM principles |
| `elixir-database-architect` | Ecto schema design, migration safety, PostgreSQL |
| `ecto-index-optimizer` | Finds missing and redundant indexes |
| `comms-reviewer` | Turns a branch into a PR description |
| `product-manager` | Maps a branch to Linear issues and initiatives |

`product-manager` needs the Linear MCP server connected.

## Commands

### `/ship`

Full pre-merge pipeline for the current branch: format, compile, test, credo, then
parallel reviews (the agents above plus `code-review` and `frontend-design`),
simplification, and finally comms. Expects a Mix project with `main` as the base
branch.

## Adding a skill, agent, or command

Drop a directory under `skills/` containing a `SKILL.md`, or a markdown file with
`name`/`description` frontmatter under `agents/` or `commands/`, then bump
`version` in `.claude-plugin/plugin.json` — installed copies are cached by version
and won't pick up changes without it.

## License

MIT
