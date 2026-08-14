# ExUnit test conventions

A test suite has two outputs: pass/fail, and the noise it prints. Both matter.
A suite that is green but only on the third run, or green but scrolls warnings,
is not done.

## Quick reference

| Symptom | Fix |
| --- | --- |
| Test passes sometimes | `mix test <file> --repeat-until-failure 100 --max-failures 1` |
| `async: false` | Inject the shared/stateful dependency instead |
| Test hits the network / a device | Thread an option through to a mock server |
| `Process.sleep` in a test | Injectable interval, zeroed in `config/test.exs` |
| Log lines in test output | `@tag :capture_log`, or assert on `capture_log/1` |
| "local function … performance penalty" | Named handler, not an anonymous fn |
| Needs a unique name | `ctx.test`, never `System.unique_integer/1` |
| Test writes files to disk | `@tag :tmp_dir`, write under `ctx.tmp_dir` |

## 1. Run it more than once

A single green run proves nothing about a concurrent test. Before calling test
work done, run the affected project's suite a couple of times.

```
mix test                                                  # twice, minimum
mix test test/my_thing_test.exs --repeat-until-failure 100 --max-failures 1
```

Run every project you touched, not just the one you edited last. Shared helpers
and shared macros mean a change in one app can break a sibling's suite.

If it fails on run two, it is a flake and it is yours. Do not re-run until green
and move on.

## 2. Inject anything stateful, shared, or networked

`async: false` is a smell, not a solution. It means the test needs exclusive
access to something global — a named process, a port, a real socket, the
filesystem. Make that thing an argument.

House shape, per-call override → app-env override → compiled default:

```elixir
defp discovery_impl(opts) do
  Keyword.get(opts, :discovery, Application.get_env(:my_app, :discovery, MyApp.Discovery.SSDP))
end
```

Then the test passes its own:

```elixir
test "reports the peers found on the wire", ctx do
  {:ok, server} = start_supervised({FakeSSDP, name: ctx.test, peers: [@peer]})

  assert {:ok, [%{id: "peer-1"}]} = Discovery.scan(discovery: {FakeSSDP, server})
end
```

Rules:

- Anything that opens a socket, shells out, or talks to a device gets an
  injectable seam. No exceptions for "it's only localhost".
- Prefer a real mock **server** (a `start_supervised!`d process speaking the
  protocol) over stubbing the client function. It exercises the wire code.
- For HTTP clients use `Req.Test` — do not hand-roll a plug stub.
- Injected collaborators are passed as options, not read from a global at call
  time. A global read is the `async: false` you were trying to avoid.
- Name every started process off `ctx.test` so parallel tests don't collide.

## 3. Waiting and retrying must be free in tests

Any function that sleeps, polls, backs off, or retries takes its timings as
options with application-env defaults. Tests set them to zero.

```elixir
# lib/my_app/reconnector.ex
@backoff [100, 500, 2_000]

defp backoff(opts) do
  Keyword.get(opts, :backoff, Application.get_env(:my_app, :reconnect_backoff, @backoff))
end
```

```elixir
# config/test.exs
config :my_app, reconnect_backoff: [0, 0, 0]
```

- Never hard-code a sleep inside a GenServer to make a test pass.
- Never wrap `Process.sleep` in a `tick/0` helper — fix the timing knob.
- Wait on a condition (`assert_receive`, `eventually/1`), never on a clock.

## 4. Capture logs — and then assert on them

Logs are part of the behaviour. Silencing them loses coverage; printing them
loses the signal. Do both at once: capture, then assert the message is right.

```elixir
test "warns when the bundle has no signing certificate" do
  log = capture_log(fn -> refute Signature.valid?(unsigned_bundle(), @ca) end)

  assert log =~ "no signing certificate"
end
```

For tests whose logging isn't the thing under test, silence the file:

```elixir
@tag :capture_log
```

Test output should be dots and nothing else. Any line you see scroll past is
either a missing `capture_log` or a bug.

## 5. Telemetry handlers in tests must be named functions

`:telemetry.attach/4` with an anonymous fn (or a bare capture of a local
function) logs a "local function … may cause a performance penalty" warning on
every attach. That is the noise polluting the suite.

Use the handler that ships with `telemetry`. It sends messages to a pid and its
handler is a proper `telemetry_test:handle_event/4`:

```elixir
test "emits a dropped event when the session dies", ctx do
  ref = :telemetry_test.attach_event_handlers(self(), [[:my_app, :session, :dropped]])
  on_exit(fn -> :telemetry.detach(ref) end)

  Process.exit(session.owner, :kill)

  assert_receive {[:my_app, :session, :dropped], ^ref, _measurements, %{id: ^session_id}}
end
```

If you need filtering or reshaping the message, define a public function on the
test module and capture *that* — never an inline `fn`:

```elixir
def handle_event(_event, _measurements, meta, pid), do: send(pid, {:correlated, meta})

:telemetry.attach(ctx.test, [:my_app, :cache, :correlate], &__MODULE__.handle_event/4, self())
```

`&__MODULE__.fun/4` is a named capture and does not warn. `&fun/4` inside the
same module is a *local* capture and does warn — the `__MODULE__.` is load-bearing.

## 6. Files on disk go in `@tag :tmp_dir`

Never write to a hand-rolled path under `System.tmp_dir/0`, and never clean up
scratch files by hand. Tag the test and ExUnit hands you a path in `ctx.tmp_dir`:

```elixir
@tag :tmp_dir
test "writes the export to disk", %{tmp_dir: tmp_dir} do
  path = Path.join(tmp_dir, "report.csv")

  assert :ok = Report.write(@rows, path)
  assert File.exists?(path)
end
```

The path is `tmp/<Module>/<test name>-<hash>`, so it is unique per test and safe
under `async: true`. Works as `@moduletag` and `@describetag` too, and
`tmp_dir: "sub/path"` appends to it.

One thing to know: ExUnit `rm_rf`s the directory **before** creating it, not
after the test. Contents survive the run — handy for inspecting what a failing
test wrote, but it means `tmp/` accumulates and is not a substitute for
`on_exit/1` when something outside that directory needs cleaning up.

## Naming and uniqueness

- Use `ctx.test` for anything that must be unique — process names, handler IDs,
  device ids. It is unique per test by construction.
- For temp directories use `@tag :tmp_dir`, not `ctx.test` and a manual path.
- Never `System.unique_integer/1`.
- Mock modules in async tests: `Module.concat(__MODULE__, ctx.test)`.

## Process management

- `start_supervised!/1`, never a bare `start_link` — ExUnit tears it down in
  order and failures surface as test failures instead of leaks.
- `on_exit/1` for anything not supervised (detaching handlers, deleting files).
- Never assert on `Process.alive?/1` as a guard before acting on a pid.

## Assertions

Use `assert_raise` for expected exceptions:

```elixir
assert_raise ArgumentError, fn -> invalid_function() end
```

## Mix flags worth knowing

```
mix test test/my_test.exs:123          # one test by line
mix test --failed                      # re-run last failures
mix test --max-failures 3              # stop early
mix test --only integration            # by @tag
mix test --seed 0                      # disable shuffling while bisecting
```

`mix help test` for the rest.

## Common mistakes

| Mistake | Why it's wrong |
| --- | --- |
| Marking a flaky test `async: false` | Hides the shared state instead of removing it |
| Loosening an assertion to make it pass | Sliming. The test no longer tests anything |
| Sleeping until the race stops happening | The race is still there, on slower CI it returns |
| Testing a private function directly | Test the public API; delete tests the typechecker covers |
| One helper used by one test | Inline it |
