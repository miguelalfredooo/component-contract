# Reviews

**What this is.** Point-in-time reviews of this skill. Each one is dated and
frozen — a record of what was true on that day, not a living document.

**Why they are kept.** The findings are the reason the skill has the shape it
has. Deleting the review leaves the shape unexplained.

**How to read one.** Open the `.html` in a browser. GitHub will not render it;
the summary below is the version GitHub can show.

---

## 2026-09-01 — three-lens review

[`2026-09-01-three-lens-review.html`](2026-09-01-three-lens-review.html) ·
[live version](https://claude.ai/code/artifact/98b18609-c597-4444-9bcb-0b59b301a958)

Reviewed against `alfredo-studio` @ `3dcea80e`, through three lenses: visual
design, product design, and design-systems engineering.

> **Outcome, recorded after the fact.** Both real catches were fixed upstream —
> `alfredo-studio` PRs #732 and #733, merged. The CTA now measures 19.16:1 dark
> and 18.96:1 light, AAA in both. Of the fifteen findings, eleven are closed;
> the four that remain are in `../tools/MUTATIONS.md` and the skill's own scope
> note. The report below is frozen as it was written and does not reflect these
> outcomes — that is deliberate. A review edited to look prescient is not a
> record of anything.

**The verdict.** The idea was proven and the aim was off. The checker found two
real bugs nobody knew about, and raised twenty-three alarms about code that was
fine. A checker that cries wolf gets ignored, so the aim was sharpened during
the review — the false alarms went to zero and both real catches survived.

| | |
|---|---|
| Real bugs caught in live code | **2** |
| False alarms | **23 → 0** |
| Sabotage tests, all bit | **10 / 10** |
| Findings | **15** — 8 closed, 7 logged |

### The two real catches

**A dead default.** `components/ui/button.tsx` declares `size` twice with two
different answers: the `cva` layer says `lg`, the function signature says
`default`, and the signature wins. Every `<Button>` written without a size
renders 32px instead of the 36px the design system says it ships. Nothing looks
broken, which is why it survived months and two reviewers.

**A shipped invisible button.** In `pocket-sketchbook/about`, `.page a { color:
inherit }` at specificity 0,1,1 outranks `.btnPrimary` at 0,1,0. The contract's
value is written, matched, and loses — black on black at 1:1.

### The findings that changed the build

| # | Lens | Finding | Outcome |
|---|---|---|---|
| EN-1 | Engineering | The rival-rule check cried wolf 23 times — it counted the button's own hover as a rival and suspected rules that could never match it | **Fixed.** Parts declare `element` and `scope`; false alarms to zero |
| PD-1 | Product | The part a partner touches was the part not built | **Fixed.** `tools/card.mjs` |
| EN-5 | Engineering | A misspelled field switched off every check that read it | **Fixed.** Unknown fields now fail with a did-you-mean |
| EN-3, EN-4 | Engineering | The color scan read whole stylesheets and saw only hex | **Fixed.** Scoped to contracted parts; covers every notation plus Tailwind arbitrary values |
| PD-5 | Product | Schema and contracts shared one version | **Fixed.** The schema versions on its own clock |
| VD-4 | Visual | On Tailwind, `anatomy` governs less than it appears to | **Fixed** by Curtis's rule: state each decision once, delete what cannot be verified |
| PD-2 | Product | Writing a contract found a *missing component* — the sketchbook CTA is loose classes in a page | **Designed in.** The checker now says so directly |
| VD-2, VD-3, PD-4 | — | Gallery link, unknown-state reporting, the prototyping kit | **Open**, listed in the report |

### What the review also produced

- The **seven facets** (NC-1…NC-7) from Nathan Curtis as this skill's principle
  set — `../references/curtis-principles.md`
- Two additions to the repo charter: the at-a-glance panel is required and goes
  first, and a categorical palette is computed, never eyeballed. The lens colors
  in this very report failed that validator at ΔE 5.9 and had to be re-stepped.
- `_tools/check-voice.mjs`, which found two bugs in itself before it found any
  in the prose.
