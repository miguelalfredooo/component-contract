# MUTATIONS — what was broken to prove each check bites

**What this is.** Every mutation run against `tools/check.mjs`: what it changed,
what it should do, and what it actually did. Re-run the whole table on any
change to the checker.

**Why it exists.** A guard nobody has watched fail is a guard nobody has tested.
Mutation-testing this repo's v4 guards once found **ten** that stayed green with
the bug restored, and two that fired on correct code. Both directions are
failures, and neither is findable by reading.

**How to read it.** The verdict is an **exit code**, never a line of output. And
a mutation that applies can still be a runtime no-op — read the injected code
before concluding a guard is weak.

**Baseline.** `button.contract.json` fails on **C3**, a live double default in
`components/ui/button.tsx`. That is why C3 appears beside most rows below: it is
the real bug, still present, not an artifact of the mutation.
`sketchbook-cta.contract.json` fails on C8, C6 and C5 — all real.

Run: 2026-09-01, against `alfredo-studio` @ `3dcea80e`.

| # | Mutation | Expected | Codes fired | Exit | Verdict |
|---|---|---|---|---|---|
| M1 | Contract promises a `success` variant the code lacks | C2 red | `C2 C3` | `1` | ok |
| M2 | Token renamed to `--radius-mdd`, which does not exist | C4 red | `C3 C4` | `1` | ok |
| M3 | Contract declares a `tone` prop the component lacks | C1 red | `C1 C3` | `1` | ok |
| M4 | **Fix** the real double default in a repo copy | green | `` | `0` | **ok — the check releases.** Fixing the real bug turns the run green, which is the half most guards are never tested for. |
| M5 | No-op: description text only | unchanged | `C3` | `1` | **ok — determinism (NC-5).** Same verdict, same codes. Prose changes cannot move a verdict. |
| M6 | Real specificity bug, after the C8 aim fix | C8 red | `C5 C6 C8` | `1` | **ok — the aim fix did not blind it.** 23 false alarms went to 0 and this real catch survived. |
| M7 | Misspell `props` as `prop` | C0 red | `C0` | `1` | **ok — this was a silent pass before.** A typo'd field used to switch off every check that reads it. |
| M8 | Tailwind arbitrary color `bg-[#b8559b]` | C5 red | `C3 C5` | `1` | ok — a color no stylesheet scan could reach |
| M9 | `oklch()` literal in a token slot | C5 red | `C3 C5` | `1` | ok — the net covers every notation, not only hex |
| M10 | `semantics.element` changed to `div` | C6 red | `C3 C6` | `1` | ok |

## Run 2 — 2026-09-01, after the `:not()` fix and the `plain` idiom

| # | Mutation | Expected | Result |
|---|---|---|---|
| M13 | Restore `.page a { color: inherit }` over the `:not(.btn)` fix | C8 red | **ok — 2 failures with the bug, 0 with the fix.** Both directions run. The fix is dismissed for an element carrying `.btn`; the unexcluded original is still caught. |
| M14 | The C8 `:not()` reader itself, on a correct fix | stay green | **ok.** Before this, C8 fired on the correct fix for its own finding — a guard firing on correct code, which is as broken as one that misses the bug. |
| M15 | `a11y.focusVisible: true` against `card.tsx`, which has no focus rule | C7 red | **ok.** C7 was listed as unproven in run 1; this closes it. |
| M16 | An option list declared on a `plain`-idiom component | C1 + C2 red | ok — an enum where no variant system exists is a stale idiom or a wrong prop |
| M17 | A prop the `plain` component does not have | C1 red | ok |
| M18 | A `forwardRef` component behind the `cva` idiom | **UNREADABLE**, not a pass | **ok.** Listed as unsupported in `extraction.md`; now proven to fail loudly rather than find nothing and report clean. |

**A note on the harness, because it cost real time.** M13's first run reported
BLINDED and the checker was fine — the test matched `grep "✗ \[C8\]"`, and an
ANSI reset sits between the mark and the space, so it matched nothing in either
state. A harness that reports a verdict without measuring anything is the same
defect this file exists to catch, one level up. **Strip ANSI before counting**,
and never trust a mutation result that did not also run the opposite direction.

## Not yet mutation-tested

Named here rather than left to be discovered. Per this repo's standard, a check
nobody has watched fail is a check nobody has tested — these are therefore
**unproven**, not passing.

| Check | Why it is untested |
|---|---|
| **C8 warn path** — a rival scoped to an undeclared ancestor | The warning fires in the live run, but no mutation yet proves it stays a warning rather than escalating. |
| **`inline` idiom** | Declared in the schema, not implemented. A contract naming it should fail; that has not been run. |

## How to re-run

```bash
cd component-contract
node tools/check.mjs example/ --repo ~/Code/alfredo-studio   # baseline: 2 fail
```

Then mutate one thing, run again, and confirm the exit code moved. Restore.
A mutation is never committed — it is restored by design, so its only evidence
is this table.
