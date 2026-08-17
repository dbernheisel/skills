# Elixir conventions

Core Elixir, OTP and tooling conventions. These apply to any Elixir project,
including ones with no database and no web layer.

**Never** alias, import, or require modules inside a function; always place it at the top of the module
**Never** write timeouts as bare millisecond literals (`30_000`, `60_000`, …). Use `Kernel.to_timeout/1` so the unit is self-documenting at the callsite: `to_timeout(second: 30)`, `to_timeout(minute: 1)`, `to_timeout(millisecond: 50)`.

**Never** write `@spec` on functions. Elixir 1.20+ does set-theoretic type inference at compile time, and Dialyzer is no longer in the ship-gate pipeline, so `@spec` carries no validation value. `@type` / `@typep` / `@opaque` are fine when they aid readers.
**Prefer** a small public API. Typically there are high-level APIs and low-level APIs.
**Prefer** pipes and `with` statements for composing functions.
**Prefer** structs for building state, and then pipelines to progressively build state

**Avoid** Aliasing modules as different names. If there is a conflict in names, alias to its parent module and qualify with the parent at callsites.

`fetch_*` functions return {:ok, _} or {:error, _} signatures
Look in docs/ for any relevant guides or documentation when searching for information

## Before you implement

The standard library, OTP, and the project's existing deps already solve most
problems. Finding the right function beats writing one.

1. Check `mix.exs` and `mix.lock` — know what is already in the project
2. Search the docs for relevant modules and functions in Elixir, OTP, and every dep
3. Check the OTP modules especially for cryptography (`:crypto`, `:public_key`,
   `:ssl`), networking (`:gen_tcp`, `:gen_udp`, `:httpc`), data structures
   (`:ets`, `:dets`, `:queue`), and encoding (`:base64`, `:uri_string`)
4. Read the docs for functions you plan to use — options, edge cases, return types

## Design priorities

When two designs are both defensible, these lenses break the tie, in order:

1. **Async over sync.** Default to `cast`, `send`, or PubSub. Reach for `call`
   only when you need the reply or the backpressure.
2. **Processes, not modules, hold state.** Design the topology — who supervises
   whom, and what a restart means.
3. **Let it crash.** Supervision over defensive rescues. Validate at boundaries.
4. **Pattern match.** Function heads and guards over `case`/`cond` in bodies.
5. **Compose pipelines.** Data in, data out; `Enum`/`Stream` over recursion.
6. **Stay simple.** No abstraction until the third use case. Explicit over clever.

## Pattern Matching
- Use pattern matching over conditional logic when possible
- Prefer to match on function heads instead of using `if`/`else` or `case` or `cond` in function bodies
- **Prefer** defguard to extract common questions in function heads
- Elixir lists **do not support index based access via the access syntax**

  <example>
  **Never do this (invalid)**:

      i = 0
      mylist = ["blue", "green"]
      mylist[i]

  Instead, **always** use `Enum.at`, pattern matching, or `List` for index based list access, ie:

      i = 0
      mylist = ["blue", "green"]
      Enum.at(mylist, i)
  </example>

- Elixir supports `if/else` but **does NOT support `if/else if` or `if/elsif`. **Never use `else if` or `elseif` in Elixir**, **always** use `cond` or `case` for multiple conditionals.

  <example>
  **Never do this (invalid)**:

      <%= if condition do %>
        ...
      <% else if other_condition %>
        ...
      <% end %>

  Instead **always** do this:

      <%= cond do %>
        <% condition -> %>
          ...
        <% condition2 -> %>
          ...
        <% true -> %>
          ...
      <% end %>
  </example>

- Elixir variables are immutable, but can be rebound, so for block expressions like `if`, `case`, `cond`, etc
  you *must* bind the result of the expression to a variable if you want to use it and you CANNOT rebind the result inside the expression, ie:

  <example>
      # INVALID: we are rebinding inside the `if` and the result never gets assigned
      if connected?(socket) do
        socket = assign(socket, :val, val)
      end

      # VALID: we rebind the result of the `if` to a new variable
      socket =
        if connected?(socket) do
          assign(socket, :val, val)
        end
  </example>

- Use `with` for chaining operations that return `{:ok, _}` or `{:error, _}`
- **Never** nest multiple modules in the same file as it can cause cyclic dependencies and compilation errors
- **Never** use map access syntax (`changeset[:field]`) on structs as they do not implement the Access behaviour by default. For regular structs, you **must** access the fields directly, such as `my_struct.field` or use higher level APIs that are available on the struct if they exist, `Ecto.Changeset.get_field/2` for changesets
- Elixir's standard library has everything necessary for date and time manipulation. Familiarize yourself with the common `Time`, `Date`, `DateTime`, and `Calendar` interfaces by accessing their documentation as necessary. **Never** install additional dependencies unless asked or for date/time parsing (which you can use the `date_time_parser` package)
- Don't use `String.to_atom/1` on user input (memory leak risk)
- Predicate function names should not start with `is_` and should end in a question mark. Names like `is_thing` should be reserved for guards
- Elixir's builtin OTP primitives like `DynamicSupervisor` and `Registry`, require names in the child spec, such as `{DynamicSupervisor, name: MyApp.MyDynamicSup}`, then you can use `DynamicSupervisor.start_child(MyApp.MyDynamicSup, child_spec)`
- Use `Task.async_stream(collection, callback, options)` for concurrent enumeration over a collection you already hold. It bounds concurrency; it is not a back-pressure mechanism (see "Concurrency and pipelines"). Usually pass `timeout: :infinity`

## Tooling

You should use the tidewave tools if available.

## Mix guidelines

- Read the docs and options before using tasks (by using `mix help task_name`)
- `mix deps.clean --all` is **almost never needed**. **Avoid** using it unless you have good reason

## OTP Usage Rules

## GenServer Best Practices
- Keep state simple and serializable
- Handle all expected messages explicitly
- Use `handle_continue/2` for post-init work
- Implement proper cleanup in `terminate/2` when necessary
- Prefer `gen_statem` if the GenServer needs more state transitions beyond
starting up and initialization.
- **Always** allow GenServers and any that it starts to consume options for asynchronous testing. Tests should never rely or be affected by global state.
- **Always** document modules. If a Genserver or gen_statem, also provide a mermaid graph.

## Process Communication
- Use `GenServer.call/3` for synchronous requests expecting replies
- Use `GenServer.cast/2` for fire-and-forget messages.
- When in doubt, use `call` over `cast`, to ensure back-pressure
- Set appropriate timeouts for `call/3` operations
- **Never** use `Process.sleep`, use GenServer messages

## Fault Tolerance
- Set up processes such that they can handle crashing and being restarted by supervisors
- Use `:max_restarts` and `:max_seconds` to prevent restart loops

## Task and Async
- Use `Task.Supervisor` for better fault tolerance
- Handle task failures with `Task.yield/2` or `Task.shutdown/2`
- Set appropriate task timeouts

## Concurrency and pipelines

**Bounded concurrency is not back-pressure.** `Task.async_stream/3` caps how many
items run at once (`max_concurrency`) over a collection you *already hold*. Real
back-pressure means demand flows upstream to a producer that could otherwise
outpace you — an external queue, a socket, a paged API. Picking the wrong one is
how a service falls over under load rather than slowing down.

The question that decides it: **who controls the rate?** If you do — you have the
list — it's a Task. If something upstream does, you need demand.

| Reach for | When |
| --- | --- |
| `Task.async_stream/3` | You hold the collection. Concurrent map over it, bounded. The default answer. |
| `Task.Supervisor.async_nolink/3` | One-off concurrent work whose failure must not take the caller down. |
| `Flow` | The collection is finite but too big for one pass, and the work needs aggregation — `group_by`, `reduce`, windowing. Task-plus-`Enum` cannot express it. |
| `Broadway` | Ingesting from an external source that pushes or holds a backlog: RabbitMQ, SQS, Kafka, Pub/Sub. Gives batching, per-message acking, rate limiting, graceful drain. |
| `GenStage` | A custom producer/consumer topology Flow and Broadway cannot express. Rare — both are built on it. Do not hand-roll what Broadway already does. |
| `Oban` | The work must survive a restart, be retried with a schedule, or run once cluster-wide. Durability lives in Postgres, not in a process. |

Notes that matter in review:

- **RabbitMQ is a transport, not a processing model.** Reach for a broker when you
  need durability across a deploy, retries with a dead-letter path, fan-out to
  several consumers, or decoupling between services. Then consume it with
  `broadway_rabbitmq` — a bare `GenServer` holding an AMQP channel has no
  demand control and will happily prefetch itself to death.
- **Already have Postgres and no broker?** `Oban` covers most of what teams reach
  to RabbitMQ for, without the extra operational surface.
- A `Task` that is really a background job is a bug: it dies with its caller and
  vanishes on deploy. If losing it matters, it belongs in Oban.
- `Flow` and `Broadway` are not interchangeable. Flow processes a collection to
  completion; Broadway runs forever against a source.

## Elixir Usage Rules

## Error Handling
- Use `{:ok, result}` and `{:error, reason}` tuples for operations that can fail
- Avoid raising exceptions for control flow
- Use `with` for chaining operations that return `{:ok, _}` or `{:error, _}`
- **Prefer** returning error tuple with the value as an exception struct

## Let It Crash

Elixir/OTP embraces failure. Don't write defensive code in processes — let them crash and let supervisors restart them. This means:

- Don't rescue exceptions in GenServers just to keep the process alive; a clean crash + restart is safer than corrupted state
- Do validate at system boundaries (user input, external APIs) — that's not defensive, that's correct
- Design your supervision tree so a crashed child doesn't take down siblings unnecessarily

### Functions that parse values crossing a client-server boundary must be total

A function that pattern-matches specific known-good/known-bad shapes of a value
decoded from a network message (channel join params, HTTP params, JSON) is a
crash waiting on the next shape nobody enumerated — Elixir gives no static
guarantee about what's in a `params` map. Always end with a wildcard fallback
clause instead of enumerating only the values you've observed:

```elixir
# Bad — crashes on any shape not explicitly listed (e.g. a stray `false`)
defp presence(nil), do: nil
defp presence(""), do: nil
defp presence(value) when is_binary(value), do: value

# Good — total; anything that isn't a real value normalizes to nil
defp presence(value) when is_binary(value) and value != "", do: value
defp presence(_value), do: nil
```

An incomplete guard on a hot, unconditional path—one every client hits rather
than a rare conditional path—can turn a single unexpected value into a
system-wide outage.

Before fixing a value that crosses a client-server boundary, read **both**
sides of the contract — grep the producer (the client/caller code that sets
the value) for every place it's set, not just the consumer where the crash
was observed. The full set of legitimate values is rarely visible from one
crash log alone.

## Common Mistakes to Avoid
- Elixir has no `return` statement, nor early returns. The last expression in a block is always returned.
- Elixir has no `else if` or `elsif`. Use `cond` or `case` for multiple branches.
- Don't use `Enum` functions on large collections when `Stream` is more appropriate
- Avoid nested `case` statements - refactor to a single `case`, `with` or separate functions
- Don't use `String.to_atom/1` on user input (memory leak risk — atoms are never GC'd). Use `String.to_existing_atom/1` or avoid entirely.
- Lists and enumerables cannot be indexed with brackets. Use pattern matching or `Enum` functions
- Structs don't implement `Access` — use `struct.field`, not `struct[:field]`. For changesets use `Ecto.Changeset.get_field/2`.
- Prefer `Enum` functions like `Enum.reduce` over recursion
- When recursion is necessary, prefer to use pattern matching in function heads for base case detection
- Avoid boolean parameters — they make call sites unreadable (`send_email(user, true, false)`). Use atoms (`send_email(user, :notify, :no_cc)`) or keyword options (`send_email(user, notify: true)`) instead.
- Do not use the process dictionary (`Process.put/get`) for ordinary state management—pass state through function arguments, GenServer state, or socket assigns. Reserve it for narrow framework boundaries or test infrastructure where process-local implicit state is intentional and documented.
- Only use macros if explicitly requested
- There are many useful standard library functions, prefer to use them where possible

## Before you're done

Always run `mix format` after editing Elixir files. The formatter is not optional — CI enforces it and unformatted code will fail `mix check`.

Run `mix compile --warnings-as-errors` before declaring work complete. Warnings are bugs waiting to happen and CI treats them as errors.

## Function Design
- Use guard clauses: `when is_binary(name) and byte_size(name) > 0`
- Prefer multiple function clauses over complex conditional logic
- Name functions descriptively: `calculate_total_price/2` not `calc/2`
- Predicate function names should not start with `is` and should end in a question mark.
- Names like `is_thing` should be reserved for guards

## Data Structures
- Use structs over maps when the shape is known: `defstruct [:name, :age]`
- Prefer keyword lists for options: `[timeout: 5000, retries: 3]`
- Use maps for dynamic key-value data
- Prefer to prepend to lists `[new | list]` not `list ++ [new]`

## Mix Tasks

- Use `mix help` to list available mix tasks
- Use `mix help task_name` to get docs for an individual task
- Read the docs and options fully before using tasks

## Testing

Read `references/testing.md` before writing or fixing any ExUnit test. It covers
flake detection, dependency injection for stateful/networked code, instant
timings, log capture, telemetry handlers, and temp files.

## Debugging

- Use `dbg/1` to print values while debugging. This will display the formatted value and other relevant information in the console.
