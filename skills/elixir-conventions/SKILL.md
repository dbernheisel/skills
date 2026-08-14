---
name: elixir-conventions
description: |
  Elixir coding conventions and patterns for Phoenix, LiveView, and Ecto
  projects. Use when writing, reviewing, or refactoring Elixir code. Trigger on
  any Elixir, Phoenix, LiveView, Ecto, GenServer, or OTP task. Also use when
  discussing naming conventions, module structure, callback patterns, flaky or
  noisy tests, mocks, or test organization in Elixir projects. The guidance is
  split by layer so a project only loads what it uses: always read
  references/elixir-conventions.md (core Elixir, OTP); read
  references/testing.md only for ExUnit tests, references/ecto-conventions.md
  only for schemas, changesets or queries, references/migrations.md only for
  migrations, and references/phoenix-conventions.md only for routers, LiveViews
  or HEEx.
---

# Which conventions to read

Read the file for the layer you are working in. Projects without a database or
web layer do not need the Ecto or Phoenix references.

| Working on | Read |
| --- | --- |
| Any code at all | `references/coding-standards.md` |
| Any Elixir at all | `references/elixir-conventions.md` |
| Ecto schemas, changesets, queries | `references/ecto-conventions.md` |
| Ecto migrations | `references/ecto-conventions.md` + `references/migrations.md` |
| Routers, controllers, LiveViews, HEEx | `references/phoenix-conventions.md` |
| ExUnit tests | `references/testing.md` |
