# The nine checks, and how each one fails silently

**What this is.** Every check `tools/check.mjs` runs, what it catches, and —
the column that matters — what the bug *looks like* when nobody is checking.

**Why that column.** Each of these renders. A wrong default still draws a
button; a lost color still paints something. That is why they survive review,
and why a check is the only thing that finds them.

**How to read it.** `C0` is "is this a validly formed contract"; `C1`–`C8` are
"is it precisely implemented". Curtis calls these the two levels of a verifiable
contract (NC-4).

---

| # | Catches | Renders as | Facet |
|---|---|---|---|
| **C0** | A field the schema does not define — a typo, or a field from an older shape | Nothing. The field is skipped, and every check that reads it finds an empty list and passes. **The quietest failure in the file.** | NC-4 |
| **C1** | A prop in the contract the component does not have | A prototype passes a prop that does nothing. React drops unknown props without a word. | NC-1 |
| **C2** | Option lists that disagree — **in either direction** | Contract-has-more: a partner told the value exists gets the default instead, silently. Code-has-more: an ungoverned variant nobody approved, which is how a system grows sideways. | NC-1 |
| **C3** | Two declared defaults that disagree, or one that disagrees with the contract | A real button, the wrong size. Found live in `button.tsx`: `cva` says `lg`, the signature says `default`, and the signature wins — so the design-system default is dead code. | NC-2 |
| **C4** | A token name that does not resolve | An undefined custom property fails silently: the browser drops the declaration and styles the element as if it were never written. A renamed token is invisible at the call site. | NC-4 |
| **C5** | A hardcoded color where the contract names a token — including Tailwind arbitrary values like `bg-[#b8559b]` | Correct today, frozen forever. Changing the token moves everything except this, and the drift shows up as one component slowly looking foreign. | NC-4 |
| **C6** | The element the contract claims is not the element rendered | Invisible on screen; wrong for everyone using a screen reader. When the anchor points at a page rather than a component, the check says so — that is usually the more useful finding. | NC-1 |
| **C7** | `a11y.focusVisible: true` with no focus-visible rule anywhere | Nothing, unless you navigate by keyboard. The one accessibility claim a contract can verify, so it should never be aspirational. | NC-4 |
| **C8** | Two rules owning one declaration, where the contract's rule loses | The component looks wrong while the source reads correct. Found live: `.page a { color: inherit }` at 0,1,1 beat `.btnPrimary` at 0,1,0 — a black-on-black CTA that shipped, now fixed. | NC-2 |

## What the checker refuses to guess

**UNREADABLE is a failure, not a pass.** If a reader cannot find the shape it
expects, it fails and says which shape it wanted. A guard that goes quiet when
its input changes shape is the failure this file exists to prevent.

**A thrown reader is a failure.** An exception inside a check is reported as a
failure of that contract, never swallowed.

**It reads `:not()`.** A rival carrying `:not(.btn)` cannot match an element
that carries `.btn`, and the check knows it — against the *full class chain* a
part renders with, its own selector plus every ancestor part's. This was added
because C8 fired on the correct fix for its own finding, which is the same
defect as missing the bug: a guard that cries wolf gets switched off.

**Undecidable is a warning that says why.** C8 cannot prove containment without
a DOM. When a rival rule is scoped to an ancestor the part has not declared, it
warns and names the one thing that would settle it — add that ancestor to the
part's `scope`. Reporting it as drift would be a guess wearing a failure's
clothes, and a check that fires on correct code trains people to stop reading it.

## What no check here can see

**Layout.** jsdom performs no layout and neither does this. Nothing here sees a
spacing, overflow, or sizing bug. Guard the source contract; confirm the pixels
in a browser.

**The cascade across files.** C8 compares selectors within one stylesheet,
which is where the specificity bugs in this repo have actually lived.

**Whether the design is right.** Every check answers "do the two copies agree",
never "is this good".
