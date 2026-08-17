# Ecto conventions

Load this when writing or reviewing Ecto schemas, changesets, or queries. For
migrations, also read `migrations.md`.

## Schemas and changesets

- **Always** preload Ecto associations in queries when they'll be accessed in templates, for example a message that needs to reference the `message.user.email`
- Remember `import Ecto.Query` and other supporting modules when you write `seeds.exs`
- `Ecto.Schema` fields always use the `:string` type, even for `:text`, columns, ie: `field :name, :string`
- `Ecto.Changeset.validate_number/2` **DOES NOT SUPPORT the `:allow_nil` option**. By default, Ecto validations only run if a change for the given field exists and the change value is not nil, so such as option is never needed
- You **must** use `Ecto.Changeset.get_field(changeset, :field)` to access changeset fields
- Fields which are set programatically, such as `user_id`, must not be listed in `cast` calls or similar for security purposes. Instead they must be explicitly set when creating the struct

## Pagination

- Use [Flop](https://hexdocs.pm/flop) and [Flop.Phoenix](https://hexdocs.pm/flop_phoenix) for all filtering, sorting, and pagination. Never build custom OFFSET/LIMIT pagination or manual filter query building. Use `Flop.validate_and_run/3` in contexts, and reuse the project's shared table, pagination, and filter-form components in LiveViews rather than adding new ones.

## `distinct` demotes your `order_by`

Test the *ordering*, not just the contents. The query may succeed and rows come
back but the order is either indeterminate or incorrect.

`distinct([m], m.id)` — or the keyword form `distinct: [expr]` — compiles to
Postgres **`DISTINCT ON`**, which requires its expressions to be the *leading*
`ORDER BY` terms. Ecto prepends them
(`Ecto.Adapters.Postgres.Connection.order_by_concat/2`); your own terms are
still emitted, just demoted behind them:

### `DISTINCT ON` is often correct — don't flag it on sight

Two shapes are deliberate and fine:

- **`order_by` leads with the distinct key.** `order_by_concat/2` collapses a
  shared prefix, so the key appears once and the terms after it choose *which*
  row survives each group. "Newest row per group" is the canonical case —
  `order_by(asc: a.run_id, desc: a.updated_at)` with `distinct(a.run_id)` yields
  `ORDER BY a.run_id, a.updated_at DESC`. The direction has to match too, or the
  column is emitted twice.
- **`DISTINCT ON` confined to a subquery**, sorted in the outer query, so the
  two orderings cannot fight.

### Fixing a real fan-out

First ask why there is a fan-out at all. A join that exists only to filter is a
semi-join, and `where: exists(...)` expresses that without duplicating rows —
nothing to dedupe, nothing to sort around.

When the join has to stay, **`distinct: true`** is the fix. That is a plain
`SELECT DISTINCT`, which imposes no ordering constraint:

```elixir
# BAD — the title sort never happens
from(m in Movie)
|> join(:left, [m], loc in assoc(m, :localizations))
|> distinct([m], m.id)
|> order_by([m], asc: m.title)

# GOOD — dedupes the fan-out, keeps the sort
from(m in Movie)
|> join(:left, [m], loc in assoc(m, :localizations))
|> distinct(true)
|> order_by([m], asc: m.title)
```

Two constraints come with it:

- Every `ORDER BY` expression must appear in the select list, or Postgres raises
  `42P10 invalid_column_reference`. Selecting the whole struct covers that
  schema's own columns; it does not cover a joined table's, so sorting on a
  joined column fails.
- Every *selected* column needs an equality operator. Scalars are fine, but a
  `json` column (as opposed to `jsonb`) has no `=` and will fail.

## Indexes

Assume PostgreSQL. `migrations.md` covers how to *ship* an index safely; this
covers which index to reach for.

Index the shapes the queries actually use — `where/3` filters, equality joins,
`order_by/2` and `group_by/2` keys, soft-delete flags (`deleted_at IS NULL`),
and boolean flags (`is_active = true`).

- **Column order** for multi-column indexes: exact match first, then range, then
  sort keys.
- **btree** unless the access is equality-only on long keys, where hash may win.
- **Partial** indexes for skewed boolean/enum filters and soft-deletes.
- **Covering** indexes with `INCLUDE` to avoid the extra heap lookup.
- Avoid very wide indexes, and avoid a low-selectivity leading column.

Before dropping an index, confirm it does not back a PRIMARY KEY, UNIQUE,
EXCLUDE, or FOREIGN KEY constraint, partitioning, or replication — those are
never drop candidates regardless of query usage. What remains is fair game when
it is a strict duplicate, redundant as a left-prefix of a better index, or has
no matching predicate or ordering anywhere in the codebase.

```elixir
create index(:events, [:account_id, :inserted_at], concurrently: true)

create index(:events, [:account_id], concurrently: true,
       where: "deleted_at IS NULL", name: :events_account_id_active_index)

drop_if_exists index(:events, [:account_id], concurrently: true)
```

`concurrently: true` needs `@disable_ddl_transaction true` in the migration —
see `migrations.md`.

## Migrations

When writing or reviewing Ecto migrations, read `migrations.md` for safe
migration patterns covering indexes, foreign keys, column defaults, type
changes, NOT NULL constraints, and squashing.
