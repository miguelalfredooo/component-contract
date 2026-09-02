# Reading a component into a contract

**What this is.** How to turn a component that already exists into a contract,
per styling idiom, and what each idiom's contract can and cannot govern.

**Why it is written per idiom.** The checker reads source by pattern, not with
a parser. That is a real limit and this file is where it is stated, rather than
discovered by someone whose contract reports UNREADABLE.

**The rule that outranks the rest.** Read the component **as it is**, never as
it should be. A contract describing the system you wish you had cannot fail its
first check, and a check that cannot fail tells you nothing (NC-5).

---

## Before the idiom: name the system

A repo can hold several design systems. `alfredo-studio` holds four. Read the
authority doc, decide which governs *this file*, and fill `system.name` and
`system.tokenFiles`.

Getting this wrong makes every later finding wrong in the same direction —
"it doesn't use our tokens" is the wrong finding about a component that
deliberately belongs to another surface.

## Idiom: `cva` (class-variance-authority + Tailwind)

**What the checker reads.** The `cva()` config's `variants` object for option
axes and their values; `defaultVariants` for the design-system default; the
component function's destructured parameters for the default that actually
ships. C3 exists because those last two can disagree.

**Supported shapes.**

| Shape | Read? |
|---|---|
| `const x = cva("base", { variants, defaultVariants })` | yes |
| `function Name({ a = 1 }: Props)` | yes |
| `const Name = ({ a = 1 }: Props) => …` | yes |
| `<Comp>` aliased from a conditional with a literal fallback | yes — the fallback is taken as the element |
| A cva config held in a variable and passed in | **no — UNREADABLE** |
| `forwardRef` wrapping the component | **no — UNREADABLE** (proven by M18) |

An unsupported shape fails loudly and names the shape it wanted. That is the
design: a reader that returns nothing looks exactly like a clean run.

**What the contract governs here, and what it does not.**

Governs: the option axes and their values, the defaults, the semantics, the
states, and the token references it can see — `var(--radius-md)` in a class
string, a token named in `anatomy`.

Does **not** govern: the Tailwind utilities themselves. `h-8 gap-1.5 px-2.5` is
real styling the contract says nothing about. Do not restate it in `anatomy` to
look thorough — a claim nothing checks is drift waiting to happen (NC-2).

The one exception the checker does see: an arbitrary value like `bg-[#b8559b]`,
which is a hardcoded color bypassing the token layer where no stylesheet scan
could ever find it (C5).

## Idiom: `css-module`

**What the checker reads.** The stylesheet named by `stylePath`, parsed into
rules. Each `anatomy` part names its class in `selector`, and the checker finds
the rules that style it.

**Two fields do the heavy lifting**, and a contract without them gets noise:

- **`element`** — what the part renders. Without it, C8 must suspect every rule
  ending in an element selector, because `.beat p` *might* match. With it,
  `.beat p` is dismissed instantly. This alone took one contract from 23 false
  alarms to zero.
- **`scope`** — the ancestor classes this part always sits inside. C8 cannot
  prove containment without a DOM. A rival scoped to a declared ancestor
  definitely reaches the part and is a failure; one scoped elsewhere is
  reported as unproven, with the fix named.

**Watch for the wrong unit.** If the component turns out to be loose classes in
a page rather than a component, the checker says so instead of reporting a
confusing element mismatch. That finding is usually the useful one: styling
nothing owns is styling nothing can hold to a contract. Extract the component
first, then contract it.

## Idiom: `plain`

A component with no variant system at all — `Input` is the example. The option
checks have nothing to read, and running them anyway would report every prop as
missing, so they are skipped and said to be skipped. Everything else applies in
full: tokens must resolve, colors must not be hardcoded, the element must match,
and a claimed focus ring must exist.

Two failures are specific to it: an option list declared here means either the
component grew variants and the idiom is stale, or the prop is not really a
closed list. Both are worth knowing.

## Idiom: `inline`

Styling written as inline style objects. Recorded in the schema; **not yet
implemented** in the checker. A contract declaring this idiom will fail rather
than pass quietly.

## The five steps

1. **Name the system.** `system.name`, `system.tokenFiles`.
2. **Read the options off the code.** Every axis, every value, both defaults if
   there are two — record what is there, not what should be.
3. **Fill only what is checkable.** Delete anything else. If removing a line
   changes nothing a check would notice, it was never part of the contract.
4. **Write the gaps.** What it deliberately cannot do, and why. This is the
   field a partner needs most, and the one an extraction cannot infer — it comes
   from the person who knows the reason.
5. **Run the checker.** An extracted contract is a **draft** until its first
   run. Extraction is the one place inference exists in this skill, which is
   exactly why its output is not trusted until a deterministic check has seen it.

## What a first run usually finds

Not "the extraction was wrong" — real drift that was already there. The first
two contracts written with this skill found a dead default in a shadcn Button
and a shipped black-on-black CTA, neither of which anyone had reported.

Expect the first run to be red. That is the contract doing its job on day one.
