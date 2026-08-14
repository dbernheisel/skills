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

## Adding a skill

Drop a directory under `skills/` containing a `SKILL.md` with `name` and
`description` frontmatter, then bump `version` in `.claude-plugin/plugin.json` —
installed copies are cached by version and won't pick up changes without it.

## License

MIT
