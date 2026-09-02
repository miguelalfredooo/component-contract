# A real Button, contracted

**What this is.** One component from a live codebase, taken through the whole
skill: extract a contract, run the checker, read what it found, hand out the
card.

**Why a button.** It is the component everyone thinks is too simple to need a
contract. That is exactly why it is the right example — the drift in it had
been shipping for months, in a file two people had reviewed, and nothing on
screen looked wrong.

**Why it matters.** Every finding below is real, and the story is now complete:
the bug was found by this checker, fixed in `alfredo-studio` PR #733, and the
same contract that failed on it passes today. The component is
`components/ui/button.tsx`.

---

## 1 · The component, before anything

A shadcn Button, styled with `cva`. Seven visual variants, ten sizes — **seventy
combinations**, all correct, all in one 74-line file. Nobody had complained
about it.

```tsx
const buttonVariants = cva("…base…", {
  variants: {
    variant: { default, outline, secondary, surface, ghost, destructive, link },
    size:    { default: "h-8 …", xs, sm, lg: "h-9 …", xl, xxl, icon, … },
  },
  defaultVariants: {
    variant: "default",
    size: "lg",                       // ← the design system's stated default
  },
})

function Button({ className, variant = "default", size = "default", … }) {
  return <Comp className={cn(buttonVariants({ variant, size, className }))} … />
}                              //  ↑ the default that actually ships
```

## 2 · The contract

Written *from* that file, not from what anyone wished it said. Under 60 lines,
and every line is checkable.

```jsonc
{
  "id": "studio.button",
  "system": { "name": "alfredo-studio core",
              "tokenFiles": ["app/globals.css", "public/shared/tokens-core.css"] },
  "semantics": { "element": "button" },
  "props": [
    { "name": "variant",
      "type": { "enum": ["default","outline","secondary","surface",
                         "ghost","destructive","link"] },
      "default": "default" },
    { "name": "size",
      "type": { "enum": ["default","xs","sm","lg","xl","xxl",
                         "icon","icon-xs","icon-sm","icon-lg"] },
      "default": "default" }
  ],
  "anatomy": { "root": { "tokens": { "border-radius": "var(--radius-md)" },
                         "states": { "focus-visible": { "outline-color": "var(--ring)" } } } },
  "a11y": { "focusVisible": true, "contrast": "AA" },
  "bindings": { "code": { "anchors": { "sourcePath": "components/ui/button.tsx",
                                       "export": "Button", "idiom": "cva" } } },
  "gaps": [ { "what": "No success or warning variant.",
              "why": "The palette carries one accent and one destructive; a third
                      signal color is a token decision, not a component decision." } ]
}
```

## 3 · What the checker found

```
$ node tools/check.mjs example/button.contract.json --repo ~/Code/alfredo-studio

  FAIL  button.contract.json
        ✗ [C3] `size` has TWO declared defaults that disagree
          cva `defaultVariants.size` says `lg`; the signature says `default`.
          The signature always wins here because the value is threaded into
          cva(), so the design-system-layer default is dead code.
          Two owners for one decision.

exit 1
```

### Why this is worth a whole tool

`size` is declared twice, in one file, with two different answers.

| Where | Says | Wins? |
|---|---|---|
| `cva defaultVariants` — the design-system layer, where a designer would look | `lg` → `h-9` | no |
| the function signature — ordinary React plumbing | `default` → `h-8` | **yes** |

Every Button in the app written as `<Button>Save</Button>` renders **32px tall,
not 36**. The design system's stated default has never once applied.

Now the part that matters: **nothing on screen looks broken.** Both values
produce a real button. It passes every test, renders in both themes, and reads
as correct to anyone opening the file — because the wrong line is the one that
looks most authoritative. A linter has no opinion; a type-checker is satisfied;
a code review sees two sensible defaults and no reason to compare them.

> A contract catches it because a contract can only hold **one** answer.
> Asking "what is the default?" out loud is what makes two answers a failure
> instead of a coincidence. *(NC-2 — normalized over redundant.)*

### Fixing it turns the run green

The fix went into `alfredo-studio` as PR #733, and it was chosen by reading the
code rather than by preference. `default` is what already ships — the signature
threads its own value into `cva()`, so `defaultVariants` never reaches
`<Button>`. The two callers that *do* reach it were checked first: `pagination`
passes `size` explicitly, and `calendar` overrides with `size-(--cell-size) p-0`,
which `twMerge` resolves over the only two classes the tiers differ in. The
change renders identically everywhere.

```
$ node tools/check.mjs example/button.contract.json --repo ~/Code/alfredo-studio
  PASS  button.contract.json
1 contract checked — 1 passing, 0 drifted.        exit 0
```

That is the check earning its place: red on a real defect, green the moment the
defect left. A guard nobody has watched do both is a guard nobody has tested.

**And the value was a design decision the contract deliberately did not make.**
If 36px had been the intended default height, the fix would have gone the other
way and moved every default button in the app. A contract surfaces that choice;
it does not make it for you.

## 4 · The card that falls out

The same contract generates what a partner reads. They never open the JSON.

```
$ node tools/card.mjs example/button.contract.json
```

```
# Button — what you may use

variant   default · outline · secondary · surface · ghost · destructive · link   default: default
size      default · xs · sm · lg · xl · xxl · icon · icon-xs · icon-sm · icon-lg default: default

States handled for you: hover, focus-visible, active, disabled. You never style these.

## What this component will not do
**No success or warning variant.**
The palette carries one accent and one destructive; a third signal color is a
token decision, not a component decision.

## If your flow needs something that is not on this card
Say "the system can't do this yet", build with the nearest listed option, and
file the request.
```

**The gap is the useful half.** Without it, a partner who needs a green confirm
button gets silence and reaches for a hex value. With it, they get a reason and
a way to ask. The refusal was written once, by the person who knew why, and
now it answers every time it is needed.

## 5 · What one small contract bought

| | Before | After |
|---|---|---|
| The default | Two answers, one dead, nobody aware | One answer, checked on every run |
| Handing it to a partner | "Use the Button component" + a Slack thread | A card listing all 70 combinations and the one thing it won't do |
| Asking for a green button | A hex value in a prototype, found in review or never | A one-line request against a reviewed file |
| Cost to keep true | Human vigilance | One command, seconds, exit code |

None of this required a design tool, a plugin, or a migration. One JSON file,
one component, one command.

---

*Reproduce: `node tools/check.mjs example/button.contract.json --repo <your alfredo-studio>`
— unpiped, so the exit code you read is the checker's. It passes on `main` as of
`0f6dd85e`; to see the finding that started this, check out `3dcea80e`. Every
mutation used to prove these checks bite is in `tools/MUTATIONS.md`.*
