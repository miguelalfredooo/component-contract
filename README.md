# Component Contract

One small file per component that the design decision and the shipped code both answer to — and a checker whose verdict is its exit code.

A component exists twice: as the design someone decided, and as the code that ships. Keeping two copies in step is not a discipline problem you can train away; it is what happens when one thing is maintained in two places. And the failure is the invisible kind — a wrong default still renders a button, a hardcoded color still paints. Nothing looks broken, so nothing gets reported.

---

## The central diagnostic has two edges

**Do the two copies still agree?** Not "does this look right" — a component built immaculately to the wrong default renders perfectly. The contract holds one answer, so a second answer is a failure rather than a coincidence.

**Can a partner be refused honestly?** A prototype that quietly invents an option looks finished and teaches everyone the wrong thing about the system. One that says where it stopped is the more useful artifact.

---

## What this skill provides

- **A contract format**: one JSON file per component, using Southleft's field names so it stays readable by their tooling
  - Options, defaults, semantics, states, the tokens each part reads
  - `gaps` — what the component deliberately cannot do, and why
  - Its own version, moving separately from the schema's
- **Four modes**: Extract a contract from real code · Check it against that code · generate the partner Card · Amend it when the system must grow
- **Nine checks** (`C0`–`C8`): `C0` asks whether the contract is validly formed, `C1`–`C8` whether it is precisely implemented
- **Four styling idioms**: `cva`, `css-module`, `plain`, `inline` — the checker reads each differently, and says so when it cannot read one
- **A seven-facet principle set** (`NC-1`–`NC-7`), adopted from Nathan Curtis's *Component Contracts and Schemas*
- **Sixteen recorded mutations** proving each check bites, in both directions
- **Two outputs**: a per-component partner card, and a pass/fail run whose exit code is the result

**What it does not do.** It records Figma bindings but never checks them. It does not generate code or Figma variants — it verifies that two copies agree. It cannot say whether the design is good: a contract can state that a Card takes a header, a body and a footer, but not what a good pricing card looks like. That takes worked examples, and they sit beside a contract rather than inside it.

---

## What a contract looks like

Roughly sixty lines. Everything in it is checkable, and anything that is not has been deleted.

```jsonc
{
  "id": "studio.button",
  "name": "Button",
  "version": "1.0.0",
  "system": { "name": "alfredalfred core",
              "tokenFiles": ["app/globals.css", "public/shared/tokens-core.css"] },
  "semantics": { "element": "button" },
  "props": [
    { "name": "variant",
      "type": { "enum": ["default","outline","secondary","surface",
                         "ghost","destructive","link"] },
      "default": "default" }
  ],
  "anatomy": { "root": { "tokens": { "border-radius": "var(--radius-md)" } } },
  "a11y": { "focusVisible": true, "contrast": "AA" },
  "bindings": { "code": { "anchors": { "sourcePath": "components/ui/button.tsx",
                                       "export": "Button", "idiom": "cva" } } },
  "gaps": [ { "what": "No success or warning variant.",
              "why": "The palette carries one accent and one destructive; a third
                      signal color is a token decision, not a component decision." } ]
}
```

`system` is the field people skip and should not. A repo can hold several design systems; every later finding inherits which one you named.

`gaps` is the field that does the work a checker cannot. It is the refusal, written once by the person who knew the reason, and it is carried verbatim into the partner card.

---

## Install for Claude Code

The repo is private, so this assumes you already have access to it.

```bash
ln -sfn ~/Code/claude-skills/component-contract ~/.claude/skills/component-contract
```

Then invoke with:

```
/component-contract write a contract for components/ui/Button.tsx
```

The skill reads the component, names the design system that governs it, writes the contract, and runs the checker against it immediately. An extracted contract is a draft until its first run.

## Run the tools without Claude

The two tools are plain Node with **no dependencies and no package.json** — only `node:fs` and `node:path`. Nothing needs installing, and nothing here calls a model.

```bash
node tools/check.mjs example/ --repo /path/to/your/repo
node tools/card.mjs example/button.contract.json --out ./cards
```

That matters beyond convenience: the checker is a compiler, not a model. Same contract in, same verdict out, every time — which is what makes a red run something you can act on rather than argue with. Wire `check.mjs` into CI and the exit code does the rest.

---

## Useful prompts

```
/component-contract write a contract for components/ui/Badge.tsx
```

```
/component-contract check every contract against this repo
```

```
/component-contract give me the card a partner can prototype from
```

```
/component-contract we need a green confirm button — what do I do?
```

What happens on the last one:

- Checks the contract's option list — there is no green
- Reads the matching `gaps` entry and answers in the system's own words
- Writes a `.proposal.json` beside the contract
- Builds with the nearest listed option and says where it stopped

---

## Output formats

### Run the checker

Ask for a check when you want to know whether a contract and its code still agree.

```bash
node tools/check.mjs <contract.json | dir> --repo <repo-root>
```

It reads the component source, compares it to every claim the contract makes, and prints one line per contract plus the findings. The exit code is the result: `0` if every contract holds, `1` if any drifted.

**Run it unpiped.** Pipe it through `tail` or `grep` and the shell reports the *filter's* status instead, so a red run reads as green.

When a reader cannot find the shape it expects, it reports **UNREADABLE and fails**. It must never find nothing and report clean.

### Generate a partner card

Ask for a card when you are handing work to someone who should not need to open the JSON.

```bash
node tools/card.mjs <contract.json> --out <dir>
```

You get one page: every option and its values, the rules, the gaps quoted verbatim, and the refusal rule. It is generated rather than written, because a hand-edited card and its contract disagree the first time either moves.

### What a finding looks like

Every finding names what happened, and then the thing that matters most — what the bug looks like when nobody is checking.

```
✗ [C3] `size` has TWO declared defaults that disagree
     cva `defaultVariants.size` says `lg`; the signature says `default`.
     The signature always wins here because the value is threaded into
     cva(), so the design-system-layer default is dead code.
     Two owners for one decision.
```

That one was live in a reviewed file for months. Every `<Button>` written without a size rendered 32px while the design system said it shipped 36. Nothing looked broken, both values make a real button, and the wrong line was the one that looked most authoritative.

---

## How the knowledge base works

Every finding cites a numbered facet or names its check. No verdicts from taste.

- `references/curtis-principles.md` — `NC-1`–`NC-7`, the standard for what makes a contract good, with how this skill applies each
- `references/fields.md` — every contract field, what it is for, and which check reads it
- `references/extraction.md` — how to read a component into a contract, per idiom, and which code shapes are unsupported
- `references/drift.md` — the nine checks, what each catches, and **what the bug looks like when nobody is checking**
- `references/amendment.md` — the refusal, the proposal, and what accepting one means

A run walks: name the governing system, read the code as it is, fill only what is checkable, write the gaps, run the checker. The contract is a draft until that last step.

**The one rule.** Code and the contract never update each other directly. A change goes into the contract first, is reviewed there, and both sides follow. In practice: never edit a component to match a contract, and never widen a contract to match code, without saying so as an amendment.

The checker must not guess. An undecidable case — a CSS rival whose containment cannot be proven without a DOM — is reported as a warning that names the one thing which would settle it, never as drift. A check that fires on correct code is as broken as one that misses the bug.

---

## Repository map

```
component-contract/
├── SKILL.md                          modes, the one rule, status
├── README.md                         this file
├── contract.schema.json              the model — versioned separately (v1.0.0)
├── references/
│   ├── curtis-principles.md          NC-1 … NC-7
│   ├── fields.md                     every field, and which check reads it
│   ├── extraction.md                 per idiom, and the unsupported shapes
│   ├── drift.md                      the nine checks and their silent failures
│   └── amendment.md                  refusal, proposal, accept sequence
├── tools/
│   ├── check.mjs                     the checker — no dependencies
│   ├── card.mjs                      the partner card generator
│   └── MUTATIONS.md                  16 mutations, both directions
├── example/
│   ├── button.contract.json          cva idiom
│   ├── badge.contract.json           cva idiom
│   ├── input.contract.json           plain idiom
│   ├── sketchbook-cta.contract.json  css-module — the precision stress test
│   └── WORKED-EXAMPLE.md             one Button, end to end
├── templates/                        generated cards, never hand-edited
└── review/                           dated, frozen reviews
```

---

## Validate

```bash
node tools/check.mjs example/ --repo ~/Code/alfredo-studio
node ../_tools/check-voice.mjs .
```

The first runs all four example contracts against the live repo. Three pass. The fourth fails on `C6` — *this contract points at a page, not a component* — which is a true structural finding: the sketchbook CTA is loose classes in a page rather than a component, and that is exactly why its bug could ship.

`tools/MUTATIONS.md` records what was broken to prove each check bites, run by run, with the result transcribed from the run rather than remembered.

---

## Who this is for

**Solo, or a team of three:** you do not need this. You are Figma and you are code at once, and there is no handoff for the two to drift across. A contract would be a third thing to maintain so that two things you already agree on can agree.

**Twenty to two hundred people:** this is the case. Big enough that design and code have properly drifted, too small to pay anyone to keep them together, and leaning on AI hardest precisely because nobody is spare.

**Enterprise:** it fits, and they will have some version of it already.

The framing is Christine Vallaure's, and her observation holds: both the middle and the top need this, only one can currently staff it, which is the wrong way round.

## Composes with

- **`design-token-vitals`** owns repo-wide token health — leakage, coverage, orphans, modes. Run it first for any question about the token layer, and cite its grade rather than re-deriving one.
- **`design-contract`** audits authority and evidence across four layers. This skill produces the artifact that one reasons about; its component layer cites these cards rather than re-judging components.
- **`tastemaker`** judges whether a design is any good. A contract is deliberately silent on that.

None of the three replaces usability, accessibility, security or compliance review.

## Reviews

`review/` holds dated, frozen reviews. The 2026-09-01 three-lens review is why `C8` aims the way it does and why Curtis's facets are the principle set — it found the checker raising 23 alarms about correct code beside 2 real ones. Reviews are not edited after the fact; a review rewritten to look prescient is not a record of anything.

---

## Status and limitations

**Working, still moving.** The schema, the nine checks and the card generator are stable and proven — the checker has found two real bugs in live code, both since fixed upstream: a dead `cva` default that made every unsized button 4px shorter than the design system claimed, and a CTA rendering black on black at 1:1.

Known limits, named rather than discovered:

- **Extraction reads TypeScript by pattern, not with a parser.** A `forwardRef` component or a `cva` config held in a variable reports UNREADABLE. Supported shapes are listed in `references/extraction.md`, and each has a mutation proving what it does.
- **The `inline` idiom is declared and not implemented.** A contract naming it fails rather than passing quietly.
- **No check here sees layout.** jsdom performs no layout and neither does this. Guard the source contract; confirm the pixels in a browser.
- **`C8` compares selectors within one stylesheet**, which is where the specificity bugs in this repo have actually lived — not across the whole cascade.
- **Compound components have no idiom yet.** Card and Dialog are next.

Contract the prototyping kit — five to eight components partners actually reach for — not the library. A contract nobody prototypes against is inventory with a maintenance bill.

---

## Attribution and license

No license file — this is a private repo of personal skills, not a distribution.

The seven facets are Nathan Curtis's, from [*Component Contracts and Schemas*](https://nathanacurtis.substack.com/p/component-contracts-and-schemas). The contract-in-the-middle model and the field names come from [Southleft's ds-contracts proof of concept](https://github.com/southleft/ds-contracts-poc), by way of [Christine Vallaure's write-up](https://christinevallaure.substack.com/p/design-system-contracts-the-component). The 69-versus-100 result is Southleft's.

This skill is one code-side implementation of their ideas, not a reimplementation of their tooling.

Authoring standard for this repo: [`../PRINCIPLES.md`](../PRINCIPLES.md).
