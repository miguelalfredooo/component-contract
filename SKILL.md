---
name: component-contract
description: "Write, check and hand out component contracts — one small file per component that both the design decision and the shipped code answer to. Use for 'write a contract for this component', 'help me build a contract for a component that doesn't exist yet', 'check our components against their contracts', 'why did the design system default not apply', 'give a partner something safe to prototype with', 'stop AI inventing variants that do not exist', 'our Figma and code have drifted'. Authors a contract 0-to-1 through a guided question sequence when no code exists yet (or resumes one that's half-built), extracts a contract from real code, verifies it with a checker that exits non-zero on drift, and generates the one-page card a cross-functional partner reads. Follows Nathan Curtis's seven contract facets. Code-side only; it records Figma bindings but never checks them."
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Write, Edit
---

# Component Contract

> **Status: working, still moving.** The schema, the nine checks and the card
> generator are stable and proven against live code — the checker has found two
> real bugs in `alfredo-studio` and both are now fixed upstream. The extraction
> step is the least settled part: it reads TypeScript by pattern, not with a
> parser, so a component shape nobody has tested yet reports UNREADABLE rather
> than a wrong answer. Supported shapes are listed in `references/extraction.md`,
> and every one of them has a mutation proving what it does. **Author mode is
> new and has no live run yet** — the sequence and the evergreen defaults table
> are a considered design, not something that has caught a real gap in the
> field the way Extract's mutations have. Treat its output with the same
> scrutiny as any other draft, and expect this note to change once it has.
> This note changes none of the modes below.

## What this is

A **contract** is one small file per component — the options it has, the tokens
it reads, what it cannot do — that sits between the design decision and the
shipped code. Neither side is crowned; both answer to the file.

## Why it exists

A component exists twice: as the design someone decided, and as the code that
ships. Keeping two copies in step is not a discipline problem you can train
away — it is what happens when one thing is maintained in two places. A
contract replaces vigilance with a check you can run.

And the failure it catches is the invisible kind. A wrong default still renders
a button. A hardcoded color still paints. Nothing looks broken, so nothing gets
reported, and the system quietly stops meaning what it says.

## Why it matters now

An agent handed a design system with no contract invents options that do not
exist, hardcodes colors, and restyles to taste — 69 out of 100 in Southleft's
A/B test. The same agent handed the contract as a rulebook scored 100, because
it was allowed to say *"the system can't do this yet"* instead of faking it.

---

## The one rule

> **Code and the contract never update each other directly.**
>
> A change — a new option, a different color — goes into the contract first,
> gets reviewed there, and both sides follow.

In practice this means: **never edit a component to match a contract, and never
widen a contract to match code, without saying so as an amendment.** Either
direction is a proposal a person approves. See `references/amendment.md`.

## The principles

Every check and every recommendation traces to one of Nathan Curtis's seven
facets (NC-1…NC-7) in **`references/curtis-principles.md`** — read it before
writing or changing a contract. Cite the number. Never invent one.

His framing, which decides most arguments: **a description informs, a contract
arbitrates.**

---

## Modes

| Mode | Trigger | Output |
|---|---|---|
| **Author** | "help me build a contract for a new Badge" — no code exists yet, or a contract exists with fields still empty | `<name>.contract.json`, `status: "draft"`, forward-declared `bindings`, a `.recommendations.md` for anything unconfirmed |
| **Extract** *(default when code exists)* | "write a contract for Button" | `<name>.contract.json` + whatever drift the extraction itself surfaced |
| **Check** | "check the contracts", or CI | per-component pass/fail, non-zero exit |
| **Card** | handing work to a partner or an agent | a one-page `PROMPT.md` — the options, the rules, and the refusal |
| **Amend** | "we need a green button" | a `.proposal.json`, never a widened enum in place |

**Which mode, without being asked.** Before doing anything, check: does code
for this component exist, and does a contract for it already exist? No code
and no contract → Author. Code and no contract → Extract. A contract exists
with empty fields and its code doesn't exist yet → Author, resumed — walk the
same sequence and silently skip whatever is already answered; never re-ask a
question someone already answered. Both exist → run Check first, its verdict
decides Card or Amend, not a guess.

### Author

Building a contract with a person, before the code exists to read one from.
Same schema, same nine checks once code lands — the only difference is that
`bindings.code.anchors` records where the code **will** live, not where it
does. Ask one section at a time, in the fixed order in
`references/authoring.md`: name/place → governing system (skip if the repo has
only one) → what it's for → semantics → props (looped, one default each,
temptations go to `gaps` not the enum) → states → anatomy/tokens → a11y → gaps
(asked explicitly, never left implicitly empty) → bindings (forward-declared).

**Never stall on "I don't know," and never guess silently.** When an answer
isn't known yet, check the repo's own conventions first, fall back to the
evergreen defaults table in `references/authoring.md`, and write down which
one happened in `<name>.contract.recommendations.md` — a file `check.mjs`
never reads, that exists purely so "the person decided this" and "the skill
suggested this" don't collapse into the same JSON value.

After the sequence: write the contract, run `check.mjs` anyway (only `C0` can
resolve without code — report the other eight as **N/A**, not skipped),
generate the card regardless, and name every `UNCONFIRMED` line from the
recommendations file in the same message. Full sequence, the triage table, and
the evergreen defaults: `references/authoring.md`.

### Extract

1. **Name the governing system first.** A repo can hold several. Read its
   authority doc, and record `system.name` and `system.tokenFiles`. Everything
   else is unverifiable until this is right (NC-3).
2. **Read the component as it is, not as it should be.** A contract describing
   the system you want cannot fail its first check, and a check that cannot
   fail tells you nothing (NC-5).
3. **Fill only what is checkable.** Options, defaults, semantics, states, the
   token references the checker can map. Delete anything else — if removing a
   line changes nothing checkable, it was never part of the contract (NC-2).
4. **Write the gaps.** What the component deliberately cannot do, and why. This
   is the field that lets a partner be refused honestly, so it is not optional.
5. **Run the checker immediately.** An extracted contract is a *draft* until
   its first run. Extraction is the one place inference exists in this skill.

Per-idiom instructions: `references/extraction.md`.
Field meanings: `references/fields.md`.

### Check

```bash
node tools/check.mjs <contract.json | dir> --repo <repo-root>
```

Nine checks — C0 asks whether the contract is validly formed, C1–C8 whether it
is precisely implemented. The exit code is the result. What each one catches,
and how it fails silently when it is missing: `references/drift.md`.

Run it unpiped. `check-voice.mjs` and this share the same trap: pipe either
through `tail` or `grep` and the shell reports the *filter's* exit code, not the
checker's, so a red run reads as green.

**Never mark a contract clean from reading it.** Run the command. A checker
that has not run has said nothing.

### Card

```bash
node tools/card.mjs <contract.json> --out <dir>
```

Generated from the contract, never hand-written — a hand-edited card and its
contract disagree the first time either moves. The card carries the options,
the rules, the gaps verbatim, and the refusal rule. Nobody outside the system
team should need to open the JSON.

### Amend

When something is needed that the contract does not allow: **do not invent it,
and do not approximate it with a hardcoded value.** Write a proposal, build
with the nearest listed option, and say where you stopped.
`references/amendment.md` has the accept sequence and what a version bump means.

---

## Scope — contract the prototyping kit, not the library

**Five to eight components, the ones partners actually reach for.** Button,
Badge, Card, Input, Dialog, and whatever else appears in real prototypes.

Contracted so far: **Button** (`cva`), **Badge** (`cva`), **Input** (`plain`).
Each new one has paid for itself by finding something — Input is why the
`plain` idiom exists, and Card is the component that proved C7 fires. Next:
Card and Dialog, both compound components, which is a shape no idiom covers yet.

Refuse breadth-first extraction. A contract nobody prototypes against is
inventory with a maintenance bill, and the cost that decides this is not
writing it but keeping it true (NC-6). If a contract has been failing for a
week and nobody has moved, delete it — it is rotting in public.

## What this does not do

- **Figma.** The binding fields are recorded so a contract stays readable by
  Southleft's tooling; nothing here checks them.
- **Generate code or Figma variants** from the contract. This skill verifies
  two copies agree; it does not produce either.
- **Judge whether the design is good.** A contract can say a Card takes a
  header, a body and a footer. It cannot say what a good pricing card looks
  like — that takes worked examples, and they sit beside a contract, not inside
  it. For taste, use `tastemaker`.
- **See pixels.** jsdom performs no layout and neither does the checker. It
  verifies the source contract; a browser confirms the result.

Composes with `design-token-vitals` (which owns repo-wide token health) and
`design-contract` (which audits authority and evidence). This skill produces the
artifact those two reason about.

## Verifying your own work

Before calling any change here done:

1. Run the checker against a real repo. Not a fixture — a real one.
2. **Break what it protects and watch it go red, by exit code.** Then restore
   and watch it go green.
3. Record both in `tools/MUTATIONS.md`. A guard nobody has watched fail is a
   guard nobody has tested.
4. Run the voice check: `node ../_tools/check-voice.mjs .`

This repo's authoring standard is `../PRINCIPLES.md`.

## Reviews

`review/` holds dated, frozen reviews of this skill — what was found, what
changed because of it, and what is still open. The 2026-09-01 three-lens review
is why the checker's C8 aims the way it does and why Curtis's facets are the
principle set. Start at `review/README.md`.
