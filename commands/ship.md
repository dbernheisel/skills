Run the full review and cleanup pipeline for the current branch.

## Step 1: Detect and Verify

Determine what changed on this branch compared to the base branch:

```bash
git diff --name-only $(git merge-base HEAD main)..HEAD
```

Then inspect the project's `mix.exs` for available aliases and deps:

- **Always run:** `mix format` and `mix compile --warnings-as-errors`
- **Always run:** `mix test` (or the project's test alias if one exists)
- **Run if available:** `mix credo` — but only if `:credo` is in the project's deps

Run these sequentially. If any step fails, stop and present the failures. Do not proceed to reviews until the codebase is green.

## Step 2: Parallel Reviews

Based on the changed files from Step 1, dispatch review subagents **in parallel** using the Agent tool in a single message. Always dispatch the Opus reviewer; only dispatch the others when relevant to the changed files:

- **Opus code review** — always. Dispatch an Agent with `model: opus` and instruct it to invoke the `code-review` skill (i.e. run `/code-review`) on the branch diff, reporting findings back. This is the holistic correctness pass that runs alongside the specialized reviewers below.
- **elixir-reviewer** — if any `.ex` or `.exs` files changed. Reviews against OTP/BEAM principles with direct, opinionated feedback. If the changed files include migrations (`priv/repo/migrations/`) or files containing Ecto queries (Repo calls, `from` queries, schema changes), also dispatch the **elixir-database-architect** and **ecto-index-optimizer** agents in the same parallel batch. Pass their findings to the elixir-reviewer's summary so all database-related feedback is consolidated:
  - **elixir-database-architect** — reviews schema design, migration safety, and Ecto best practices
  - **ecto-index-optimizer** — analyzes queries and migrations for missing or redundant indexes
- **Frontend design expert** — if any `.heex`, `.js`, `.ts`, `.css`, or `.scss` files changed. This agent should be given the `frontend-design` skill and instructed to focus on:
  - LiveView and HEEX best practices (component structure, event handling, assigns)
  - Accessibility and semantic HTML
  - Consistent styling patterns
  - HEEx-specific anti-patterns (unnecessary assigns, bloated templates, logic in templates)

Each reviewer should be given the list of changed files and told to review only those files. Pass the git diff for context:

```bash
git diff $(git merge-base HEAD main)..HEAD
```

Wait for all reviewers to complete, then present their findings to the user as a combined report.

## Step 3: Simplify

Run the **code-simplifier:code-simplifier** agent, passing it the combined review findings from Step 2. The simplifier should use the reviewer feedback to guide its refactoring — not just generic cleanup, but acting on the specific issues the reviewers identified.

Include in the prompt to the code-simplifier:
- The full review output from Step 2
- The list of changed files
- Instruction to address the reviewers' findings while also applying its own judgment on clarity, consistency, and maintainability

After the simplifier completes, re-run `mix format` and `mix compile --warnings-as-errors` to make sure everything is still clean.

## Step 4: Comms and Strategy

Run these two agents **in parallel** using the Agent tool in a single message:

- **comms-reviewer** — summarizes the branch into a PR description and Slack message
- **product-manager** — pass it the comms-reviewer output after it completes, so it can search Linear for related issues and map the branch to company goals. The product-manager is allowed to create a new Linear issue under a clearly relevant project when no existing issue matches; if it does, call that out explicitly when presenting its output.

Present the comms-reviewer results first. Then run the product-manager with those results and present its output.

Note: comms-reviewer and product-manager run sequentially (product-manager needs comms output), but both run after the code work is done.
