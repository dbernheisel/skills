---
name: domain-driven-feature-design
description: Design, model, and review new features using Domain-Driven Design — establishing the domain language, locating the bounded context, drawing aggregate and consistency boundaries, and deciding where each rule lives. Use this whenever the user is adding a new feature or capability, modeling a domain concept, deciding how to structure new code, naming things in a system, asking "where should this logic go", "how should I model X", "what should own this", or reviewing an existing design for structural problems — even if they never say "DDD", "domain model", or "aggregate". Also use when a design discussion involves multiple teams or services disagreeing about the meaning of a shared term.
---

# Domain-Driven Feature Design

A procedure for turning a feature request into a design that reflects how the business actually works, rather than into another layer of plumbing around a database.

The central bet of this approach: **the hard part of most software is understanding the domain, and the model you build is only as good as the language you build it in.** Code that uses the words the domain experts use, with the same meanings, stays cheap to change. Code that invents its own vocabulary — `OrderProcessor`, `UserDataManager`, `status_flag` — drifts away from the business until every change requires a translation step in someone's head.

Apply this with judgment. Not every feature deserves a modeling session. See "When not to use this" at the end.

## The workflow

Work through these five phases in order. Don't skip to phase 3 — most bad domain models are bad because someone started drawing boxes before they understood the words.

### Phase 1 — Establish the language

Before proposing any structure, extract the vocabulary. The goal is a small set of terms that the user, the domain experts, and the code will all use identically.

Ask about the things you cannot infer:

- What do people who do this work call it? Use their noun, not a synonym you prefer.
- Walk me through this happening once, concretely, start to finish.
- What has to be true for this to be valid? What would be a bug that nobody notices for a month?
- Who or what triggers it? What happens downstream when it succeeds?
- What's the exception case that makes this annoying?

Then feed the language back explicitly, and flag every term that's doing double duty:

> You've used "device" three ways: the physical hardware, the provisioning record, and the session lease. Those have different lifecycles. Are they one concept or three?

**A word that means different things to different people is the single highest-value discovery in this phase.** It usually means you're standing on a context boundary (phase 2), not that someone is being sloppy.

Push back on terms that carry no domain meaning: `data`, `info`, `manager`, `handler`, `item`, `record`, `process`. When a name is that generic, either the concept hasn't been found yet or the name is hiding it.

### Phase 2 — Locate the bounded context

A bounded context is the zone within which a model and its terms hold one consistent meaning. Every model has a limit; the mistake is pretending it doesn't and building one universal schema for the whole company.

Determine:

1. **Which context does this feature live in?** Usually an existing one — a service, an app, a team's area of ownership.
2. **What does it need from other contexts?** Name each one and the terms it uses.
3. **What is the relationship?** Name it from the catalog: Anticorruption Layer, Customer/Supplier, Conformist, Shared Kernel, Open Host Service, or Separate Ways. Naming it forces the question of who absorbs change when the other side moves.

The critical decision here is at the seams: **when data crosses a context boundary, translate it into this context's terms rather than adopting the other side's model.** An external API's `subscriber_status` enum should not propagate into your domain objects. Convert it at the edge into your concept, once, in one place. That translation layer is what keeps someone else's model from slowly becoming yours.

Also ask: **is this feature in the core domain?** The core is the part that makes the business worth running. Generic and supporting subdomains (auth, notifications, file storage, reporting) deserve the boring solution — buy it, wrap a library, keep it dumb. Reserve modeling effort for the core. Spending three days modeling an email preferences screen is a real failure mode of this approach.

### Phase 3 — Model the change

Now build the objects. For each concept from phase 1, classify it:

**Value Object** — defined entirely by its attributes. Two with the same values are interchangeable. Immutable. Money, a date range, a coordinate, a device address, a retry policy.

**Entity** — has continuity and identity that survive changes to its attributes. Something in the domain needs to refer to *that specific one* over time. An order, a device, a user, a session.

**Aggregate** — a cluster of entities and value objects with a single root, treated as one unit for consistency.

Decision rules, in order of how often they're gotten wrong:

- **Default to Value Object.** Entities cost identity management, lifecycle, storage, and concurrency control. Only promote to Entity when the domain genuinely tracks a specific instance through change. If two instances with identical fields could be swapped with no consequence, it's a value.
- **Draw the aggregate around an invariant, not around a diagram.** An aggregate is a *transactional consistency boundary*. Ask: what rule must be true at the end of every single operation, with no window where it's false? Everything that rule touches goes inside. Everything else goes outside.
- **Prefer small aggregates.** The test: if two users act on these two things at the same instant, does the business actually break? If it doesn't, they belong to separate aggregates. Large aggregates are the most common structural defect — they cause contention, slow loads, and lock-ordering pain, usually to protect a rule that was only ever eventually consistent.
- **Reference other aggregates by identity, never by object.** Holding a direct reference invites someone to modify two aggregates in one transaction, which is exactly what the boundary exists to prevent.
- **One transaction, one aggregate.** When a change spans aggregates, it becomes a domain event and a second operation. Say so explicitly in the design, and name the window during which the system is inconsistent.

Repositories, Factories, Domain Services, Domain Events, and Modules are the supporting cast; phase 4 decides which one each rule needs.

### Phase 4 — Place the behavior

Every business rule needs an owner. Decide deliberately; the default of "put it in the controller/handler and call it a day" is what produces an anemic model — data structures with no behavior, surrounded by procedural services that manipulate them from outside.

| The rule concerns... | It belongs on... |
|---|---|
| One object's own state or its own validity | That object |
| Several objects inside one aggregate | The aggregate root |
| Two or more aggregates, or has no natural owner | A Domain Service, named as a domain verb |
| Selecting or retrieving existing instances | A Repository (aggregate roots only) |
| Complex or invariant-critical construction | A Factory |
| Reacting to something that already happened | A Domain Event handler |
| Orchestration, transactions, auth, HTTP | Application layer — *not* the domain |

Two rules that do most of the work:

**Make illegal states unrepresentable at the boundary.** Parse input into a validated domain type once, at the edge, and let everything downstream trust it. Re-checking the same condition in six places means the type isn't carrying the guarantee.

**Keep the domain free of infrastructure.** No HTTP clients, no SQL, no framework annotations inside domain objects. If the domain needs something from outside, express it as an interface the domain defines and infrastructure implements. The test: can you exercise the entire rule in a unit test with no database?

Reach for supple design where the model is worked hardest: intention-revealing names, side-effect-free functions, assertions that state the invariant, and closure of operations — an operation whose argument and return type are the same, so results compose without leaving the type.

### Phase 5 — Pressure-test the design

Before presenting, run the design against these. Each one is a symptom with a usual cause.

| Smell | Usual cause |
|---|---|
| Objects hold only data; all logic sits in `*Service` | Anemic model — behavior wasn't placed (phase 4) |
| A name contains Manager, Helper, Util, Processor, Data, Info | An undiscovered concept is hiding behind a generic name |
| A rule you can't state in one sentence of domain language | Wrong abstraction, or a missing concept |
| The aggregate keeps growing to protect one more thing | That rule is eventually consistent; split it |
| Loading a whole aggregate just to read one field | That's a query — build a read model, don't route it through the domain |
| Repository with 15 bespoke finder methods | Reporting needs are leaking into the domain; separate reads |
| Passing IDs into domain methods so they can look things up | Dependency inverted — resolve first, pass the object |
| An external system's field names appear in domain objects | Missing anticorruption layer (phase 2) |
| The same word means two things in one context | Missed a context boundary (phase 2) |
| A flag or enum that gates large blocks of behavior | Two concepts sharing one type |

Then state the honest tradeoffs. Every aggregate boundary buys consistency somewhere and gives it up somewhere else — name where.

## Output format

Produce a design document, not a lecture. Use this structure:

```markdown
## Language
Term — definition in the domain's own words. Note any term that changes meaning across a boundary.

## Context
Which bounded context this lives in; which others it touches and how each relationship is managed.

## Model
Each concept classified as Entity / Value Object / Aggregate (with root), plus the invariant each aggregate protects.

## Behavior
Each rule, and which object owns it. Anything crossing aggregates, marked as an event with the inconsistency window named.

## Tradeoffs
What this design makes easy, what it makes hard, and what you'd revisit first.

## Open questions
Terms or rules that need a domain expert to settle.
```

Include code only where it clarifies a boundary — a type signature, a struct definition, a function head. Full implementations belong after the design is agreed.

## Working style

**Ask before assuming.** Phase 1 questions are not a formality. If the user gives a one-line feature request, ask two or three sharp questions before designing. Guessing at domain rules produces confident, wrong models.

**Propose the language explicitly and let it be corrected.** Naming is the design work, not decoration around it.

**Refactor toward insight rather than defending v1.** A model that "works" but requires explanation every time someone reads it hasn't found the concept yet. When the user pushes back with a distinction you missed, that's the signal to restructure — not to add a flag.

**Say when a pattern doesn't apply.** Recommending "no aggregate needed here, this is a lookup table" is a valid and frequently correct output.

## When not to use this

Skip the full workflow for CRUD screens over data with no rules, throwaway scripts and spikes, generic subdomains where a library exists, and features inside a context that already has an established model where the change is a straightforward extension. In those cases, borrow phase 1 (get the names right) and move on.

The cost of this approach is real: it needs domain expert access, it slows the first version down, and it only pays back on software that lives long enough to change repeatedly. If none of that holds, say so rather than performing the ritual.

## A note on non-OO languages

The pattern names come from an object-oriented tradition, but the ideas survive
translation; only the mechanics change.

In Elixir, an Entity is usually a struct with a persistent id plus the module of
functions that operate on it, and a Value Object is a struct with no id that you
never mutate — you build a new one. The aggregate root becomes the single module
that owns the invariant and is the only public way in; "reference other
aggregates by identity" becomes holding an id in the struct rather than a nested
struct or a preloaded association. A Domain Service is a plain module of
functions, and a Repository is the context module, not `Repo` itself. Behavior
lives in the domain module rather than "on" the data, which is the same rule as
"no anemic model" stated for a language without methods.

What does *not* translate is putting rules in a changeset and calling it a
model. A changeset validates a form submission; an invariant holds for the life
of the data.

---

*Inspired by the domain-driven design literature, in particular Eric Evans'
Domain-Driven Design.*
