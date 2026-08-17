# skills

Agent skills by [David Bernheisel](https://github.com/dbernheisel), packaged as a
Claude Code plugin marketplace.

## Install

```
/plugin marketplace add dbernheisel/skills
/plugin install dbern-skills@dbernheisel
```

## Skills

### `elixir-conventions`

Elixir, Ecto, Phoenix and ExUnit conventions. The guidance is split by layer so a
project only loads what it uses:

| Working on | Reads |
| --- | --- |
| Any Elixir | `references/elixir-conventions.md` |
| Ecto schemas, changesets, queries | `references/ecto-conventions.md` |
| Ecto migrations | `+ references/migrations.md` |
| Routers, controllers, LiveViews, HEEx | `references/phoenix-conventions.md` |
| ExUnit tests | `references/testing.md` |

The migrations reference is derived from
[Safe Ecto Migrations](https://fly.io/phoenix-files/safe-ecto-migrations/).

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
