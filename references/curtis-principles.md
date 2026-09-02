# The seven facets — this skill's guiding principles

Adopted from Nathan Curtis, "Component Contracts and Schemas" (Jul 2026,
nathanacurtis.substack.com). Curtis is the system architect who coined
components-as-data; these seven facets are his standard for what makes a
contract good, and this skill treats them as its principle set. Every check the
checker runs, and every recommendation the skill makes, should trace to one.

Cite them as NC-1 through NC-7. Never invent a number.

His two sentences that frame everything:

> A description informs. A contract arbitrates.

> A schema models what a contract *can* say.
> A spec based on that schema is what a contract *does* say.

---

## NC-1 · Well-typed over loosely formed

Every value has a legal shape: one choice from a fixed list, a true/false, a
number. A contract where any text is accepted cannot reject `size: kind of
large`. And a signal carried only by a naming convention (`button-primary-hover`)
is a signal the contract cannot verify.

**Here:** the schema types every prop; enums are closed lists with a stated
default. States are the open edge (see the VD-3 finding) — any state name is
accepted, the six common ones are conventions, and the checker marks unknown
states unverified rather than invalid.

**Checks that serve it:** C1 (prop exists), C2 (enum parity, both directions).

## NC-2 · Normalized over redundant

Each decision is stated once. The moment it lives in two places, the contract
can disagree with itself — and "a self-contradicting artifact cannot arbitrate
anything."

**Here, two applications:**
- In the *code*: C3 exists because a default declared in two places (a cva
  `defaultVariants` and a function signature) is the same disease inside one
  file. C8 is the stylesheet version — two rules owning one declaration.
- In the *contract*: do not restate styling the checker cannot map. On the
  Tailwind idiom, anatomy governs the token references it can verify and
  nothing more. If deleting a sentence changes nothing checkable, that
  sentence was not part of the contract.

**Checks that serve it:** C3 (one effective default), C8 (one owner per
declaration).

## NC-3 · Independent over platform-biased

No party owns the contract — not Figma, not React, not this repo's styling
idiom. "A definition biased to one party's point of view is testimony, not a
contract."

**Here:** the contract's core (id, semantics, props, states, a11y, gaps) says
nothing about React or Tailwind. Everything platform-shaped — `sourcePath`,
`idiom`, `stylePath`, the unchecked `figma` block — is quarantined in
`bindings`, at the edge, where Curtis puts it. When a field wants to describe
how this repo happens to build things, it goes in an anchor, never in a prop.

## NC-4 · Verifiable over readable

A machine can rule the contract right or wrong, at two levels: is the file
validly formed, and is it precisely implemented. "Reading is review, not
verification." And the failure mode to fear most: "a format where nothing is
invalid is a format where nothing is verifiable."

**Here:** the checker's whole stance. UNREADABLE is a failure; a thrown reader
is a failure; unknown fields in a contract must be rejected, not skipped
(the EN-5 finding). When prose in a contract is load-bearing, tighten it into
a typed field or move it to `description`, which arbitrates nothing.

**Checks that serve it:** all of them; C0 (structure) is level one, C1–C8 are
level two.

## NC-5 · Determinism over inference

Same input, same output, empty diff. "Deterministic compilation isn't the
goal — it's evidence the contract is good."

**Here:** the checker is a compiler, not a model. No LLM sits between a
contract and its verdict. The M5 sabotage (a description-only change leaves
the verdict untouched) is this facet's standing proof, and belongs in
MUTATIONS.md permanently. Extraction is the one place inference exists —
which is why an extracted contract is a *draft* until its first check run.

## NC-6 · Efficient over expensive to keep true

The cost that matters is not writing the contract but keeping it current.
"A rotted contract is worse than no contract at all, because people trust
contracts." And the economics run both ways: "If you've got 25 simple
components on one platform, this doesn't matter and you shouldn't spend on it."

**Here:** contract the prototyping kit — the five to eight components partners
actually reach for — and refuse breadth-first extraction. The check must stay
cheap enough to run on every change (it is: no dependencies, seconds, exit
code). If a contract fails its checks for a week and nobody moves, delete it;
it is rotting in public.

<!-- voice-ok: Curtis's own facet title, quoted verbatim -->
## NC-7 · Evolvable over simply flexible

Strict does not mean static. "A contract that can't change dies, and a
contract that changes without governance was never actually a contract."

**Here:** growth happens through a proposal (`.proposal.json`), reviewed like
any edit. Accepting one means: apply it, bump the contract version (minor for
a new option or prop, patch for a fix), change the code, re-run the checker —
in that order. And the schema is versioned separately from every contract:
a contract records the schema version it was written against, and a change to
either gets a short decision record beside it. Version the model and the
content on their own clocks; implementing a contract depends on both.

---

*Voice note: this skill's prose follows `design-token-vitals/references/voice.md`
— second person, meaning before principle, no-fault framing, US English, and its
banned-word list. One deliberate exception: Curtis's facet titles are kept
verbatim ("evolvable over `simply` flexible"), because renaming a cited principle
misquotes its author. The exception covers his words only, never ours.*
