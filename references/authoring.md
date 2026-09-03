# Writing a contract before the component exists

**What this is.** How to build a contract with a person, when there is no code
to read yet — or when a contract already exists but is missing fields. Same
schema, same fields, same nine checks once code lands. The only thing that
changes is where the answers come from: a person, instead of a file.

**Why this is not a separate schema.** A contract authored before code and a
contract extracted from code are indistinguishable once written — both are
`contract.schema.json` documents, both go through `check.mjs`, both produce a
card. The only structural difference is `bindings.code.anchors`: extraction
records where the code **is**; authoring records where it **will be**. Nothing
else in the schema changes, so nothing else in this skill has to.

**The rule that outranks the rest, restated for this mode.** A contract
describing the system you wish you had cannot fail its first check (NC-5) —
that rule does not relax just because there is no code yet to check against
*yet*. What changes is *when* the check runs, not whether the contract is
honest before then. An author-mode contract is `status: draft` for a reason
different from extraction's: not "hasn't been checked" in the sense of
"probably fine, wasn't run" — it is **structurally unchecked**, and 8 of 9
checks are reported N/A rather than skipped silently.

---

## Triage: which of the four states is this?

Before asking anything, work out which state you are actually in. Search for
code matching the intended name and `sourcePath`; search for an existing
`<id>.contract.json`.

| Code exists? | Contract exists? | State | Route |
|---|---|---|---|
| No | No | Genuine 0-to-1 | **Author, from scratch** — below |
| Yes | No | Real component, undocumented | `references/extraction.md` (Extract mode) |
| No | Yes | A contract was started and code hasn't landed | **Author, resumed** — same sequence, skip what's answered |
| Yes | Yes | Both exist | Run `check.mjs` first — its verdict decides Card or Amend, not this file |

**"Half-built" is not a fifth state.** It is either "Author, resumed" (some
fields are empty) or a contract that fails `C0` (malformed against the schema)
— both are handled by walking the same sequence below and only asking about
what is missing or invalid. Never restart a contract that already has real
answers in it; a re-asked question a person already answered reads as the
skill not having listened.

---

## The sequence

Same order as `references/fields.md`, because NC-3 makes `system` meaningless
to skip: every field after it is unverifiable until this one is right.

Ask one section at a time. Do not move to the next section until the current
one is either answered or explicitly deferred to a recommendation (see below).

### 1 — Name and place

*"What do you want to call this component, and what family does it belong to
— button, field, surface, layout, or something new?"*

→ `name`, derived `id` (`<system-slug>.<lowercase-name>`), `archetype`. Only
mint a new archetype label if nothing existing fits — a new label per
component defeats the point of the field.

### 2 — Which system governs it

*"Which design system does this belong to?"*

Skip this question entirely if the repo has exactly one system — fill
`system.name` / `system.tokenFiles` / `system.authority` from its own
authority doc without asking. **Only ask if the repo has more than one** (this
is not hypothetical: alfredo-studio has four). Getting this wrong makes every
later field wrong in the same direction.

### 3 — What it's for

*"In one sentence — not what it looks like, what does a partner reach for it
to DO?"*

→ `description`. Reject anything under 20 characters or that describes
appearance ("a rounded button with a shadow" is not an answer to this
question — see `fields.md`'s note that this line "arbitrates nothing on
purpose").

### 4 — Semantics

*"What HTML element renders at the root? Does that ever change — e.g. does it
become an `<a>` when given an `href`?"*

→ `semantics.element`, `semantics.elementByProp` if the answer to the second
question is yes.

### 5 — Props, looped

For each prop, in this fixed order, and repeat until the person says "that's
all of them":

1. Name.
2. *"Closed list of values, or open text / number / boolean / a slot for
   content?"* → `type`.
3. *"What's the value when nobody passes one? One answer — if you're tempted
   to say 'it depends,' that's a sign there are two props here, not one."*
   → `default`. **Never leave this unanswered** — C3 exists specifically to
   catch two defaults disagreeing, and an author-mode contract with no default
   recorded is a contract that has already lost the one thing C3 checks.
4. Required (no default, caller must supply it)?
5. One-line purpose — what it controls, not how it looks.
6. *"Anything you're tempted to add here but aren't sure about yet?"* — that
   answer goes into `gaps`, **never** into the enum. This is the actual
   mechanism that stops a later agent from inventing an option: the temptation
   was named and refused once, in the system's own voice, instead of
   improvised under pressure months later.

### 6 — States

*"Which of these does the component handle itself: hover, focus-visible,
active, disabled, selected, expanded? Anything real that isn't on this list —
`armed`, `playing`, whatever the component actually does?"*

→ `states`. The list is open on purpose (see `fields.md`); a real state not on
the standard list is a better answer than forcing it into a nearby one.

### 7 — Anatomy and tokens

*"How many visually distinct parts does it have — just the root, or root plus
icon, label, and so on? For each part, which token does each property read —
never a literal value, a reference like `var(--radius-md)`."*

A token reference is a design decision you can state before the code exists,
the same way you'd write it in a spec — this is not inference, it's the
person deciding what the component will read once built. Repeat for any part
that changes on a state from section 6.

### 8 — Accessibility

*"Does it own its own focus ring? What's the minimum touch target, if this is
interactive? AA or AAA contrast?"*

→ `a11y.focusVisible`, `a11y.minHitArea`, `a11y.contrast`.

### 9 — Gaps, asked explicitly

*"What will this deliberately NOT do — and why, in the system's own terms, not
'not built yet'?"*

Do not leave this empty by default. If the person genuinely has none yet,
record that as a decision — "no known gaps at authoring time" — rather than
an empty array that looks skipped. An empty `gaps` array and a section nobody
got to look identical in the JSON; only the person authoring it knows which
one it is, so make them say which.

### 10 — Bindings, forward-declared

*"Where will the code live — path, exported name — and which idiom will it
use: `cva`, `css-module`, `plain`, or `inline`?"*

→ `bindings.code.anchors.sourcePath`, `.export`, `.idiom`. This is a real
design decision, not a guess: it commits to where the implementation will sit
before anyone writes it, exactly the way a spec names a file that doesn't
exist yet. `status` is set to `"draft"` automatically — it is a fact about the
contract's state, not a judgment call, so it is never asked.

---

## When the person doesn't know yet — recommend, never invent silently

Author mode is not allowed to stall on "I don't know," and it is not allowed
to fill a field with a plausible-sounding guess and move on as if it were
answered. Both failure modes are covered by NC-5 (determinism over inference):
a guess dressed as an answer is exactly the "inference" that rule exists to
keep out of a contract.

The resolution: when a field can't be answered, look for a repo convention
first, fall back to a small evergreen default second, and **write down which
one happened** — every recommended (not confirmed) field goes into a companion
file, `<id>.contract.recommendations.md`, sitting beside the contract. This
file is never read by `check.mjs` and never affects the schema; it exists so
the gap between "the person decided this" and "the skill suggested this while
waiting for them to know more" doesn't quietly disappear into the JSON.

```markdown
## `a11y.contrast`
Recommended: `AA`
Why: no answer given at authoring time. AA is the WCAG floor and every other
contract in this repo targets AA; AAA is an opt-in, not a default.
Status: UNCONFIRMED — revisit once the real requirement is known.
```

**Repo convention beats evergreen default, every time.** Before reaching for
the table below, grep the repo's other contracts and its actual components for
the same field. A recommendation grounded in what the team already does is a
different, stronger claim than a generic one — cite which contract or file it
came from.

### The evergreen table

Safe, cross-project defaults for the fields people most often can't answer yet
at the point a component is only an idea. "Evergreen" means: this does not need
revisiting as *this repo* changes — only as *this component's own requirements*
become known. Each one names why it's the safe floor rather than a guess.

| Field | Evergreen default | Why this one, not something else |
|---|---|---|
| `a11y.focusVisible` | `true` | An interactive component that doesn't own its focus ring is the accessibility gap C7 exists to catch — defaulting to "no" would recommend the bug. |
| `a11y.contrast` | `AA` | The WCAG floor, not a compromise. AAA is a stricter opt-in a system chooses deliberately; assuming it by default overstates a commitment nobody made yet. |
| `states` (any interactive archetype) | `["hover", "focus-visible", "disabled"]` | The three states almost nothing interactive ships without. Add `active`/`selected`/`expanded` once the component's real behavior is known — removing a wrongly-added state is more visible than adding a missing one later. |
| `props[].required` | `false` | A required prop with no default is the harder, more restrictive claim. Defaulting to optional is the reversible mistake; defaulting to required and being wrong blocks every caller until it's fixed. |
| `bindings.code.anchors.idiom` | whichever idiom the *majority* of the repo's existing contracts already use | Not evergreen across repos — this one is repo-sourced on purpose. A new component matching the house style is the safer default than introducing a fifth idiom nobody asked for. |
| `archetype` | the closest existing label (`button`, `field`, `surface`, `layout`) | A new archetype per component is the same failure as a new token per component — it stops being a shared vocabulary. Mint a new one only when a *second* real component needs it too. |
| `gaps` | never defaulted — always asked (section 9) | The one field this table refuses to guess for. A gap is a decision about what the system chooses not to do yet, and that decision belongs to a person, not a table. |

If a field isn't in this table and the repo has no convention for it either,
that's a real open question — say so plainly and leave it out of the contract
rather than inventing a plausible-sounding value. An honestly incomplete
contract is more useful than a confidently wrong one; `gaps` exists to record
"we don't know yet" as a first-class answer.

---

## After the sequence

1. **Write the contract**, `status: "draft"`.
2. **Run `check.mjs` anyway.** It reports `DRAFT`, exit `0`, with one `INFO
   [C0]` line naming `bindings.code.anchors.sourcePath` as not-yet-real and
   `C1`–`C8` as N/A — not skipped silently, not failed, not passed.
3. **Generate the card regardless.** `card.mjs` runs off the contract, not off
   a passing check — this is the actual deliverable: something a partner or an
   agent can prototype against today, honestly labeled as unverified until real
   code lands.
4. **Say plainly what happens next, and that it is a decision, not a
   mechanism.** `check.mjs` never edits the contract file — it only reports.
   Once code exists at the declared path, re-running it either comes back
   clean (a person then chooses to promote `status` to `review`/`stable`,
   `check.mjs` will not do it for you) or reports real drift naming exactly
   where the shipped component disagreed with what was decided here.
5. **List every `UNCONFIRMED` line from the recommendations file** in the
   same message — a recommendation nobody revisits is a silent decision with
   someone else's name on it.
