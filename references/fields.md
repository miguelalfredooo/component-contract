# Every field, in plain words

**What this is.** The contract's fields, what each one is for, and which check
reads it.

**Why it reads this way.** A field nothing checks is documentation wearing a
contract's clothes. Each entry below names its check, and the few that name
none say so.

**Where the authority is.** `contract.schema.json` is the model — what a
contract *can* say. A contract is what one *does* say. Both carry their own
version, and implementing one depends on both (NC-7).

---

## Identity

| Field | What it is | Read by |
|---|---|---|
| `id` | Namespaced name, `studio.button`. Unique across the repo. | — |
| `name` | The exported symbol, spelled as code spells it. | C1, C3, C6 |
| `version` | This contract's own version. Minor for a new option or prop, patch for a fix. | amendments |
| `status` | `draft` · `review` · `stable` · `deprecated`. A draft is one that has not passed a check yet. | — |
| `description` | What it is **for**. The sentence a partner reads before choosing it, and the one line of prose that arbitrates nothing on purpose. | the card |
| `archetype` | Free label grouping like-behaving components: `button`, `field`, `surface`. | — |

## `system` — which design system governs this

The first question, and the one that makes every later answer meaningful. A repo
with more than one surface has to answer it before anything is checkable (NC-3).

| Field | What it is | Read by |
|---|---|---|
| `system.name` | The governing system, in the words the repo uses. | reported |
| `system.authority` | Path to the doc that governs the surface. | — |
| `system.tokenFiles` | Repo-relative paths. Every token named anywhere in this contract must resolve in one of these. | **C4** |

## `semantics` — what it is, before what it looks like

| Field | What it is | Read by |
|---|---|---|
| `semantics.element` | The HTML element rendered at the root. What a screen reader gets. | **C6** |
| `semantics.role` | An explicit ARIA role, where the element alone does not carry it. | — |
| `semantics.elementByProp` | The element changes with a prop (a Button that renders `a` when given `href`). | C6 |

## `props` — the fence

Everything listed is a partner's to use freely. Anything not listed does not
exist.

| Field | What it is | Read by |
|---|---|---|
| `name` | The option axis, as the contract names it. | C1 |
| `type` | `{ "enum": [...] }` for a closed list, or `boolean` · `text` · `number` · `node`. A closed list is what makes a wrong value rejectable (NC-1). | **C2** |
| `default` | The value when nobody passes one. **One answer, always** — two is C3's whole reason for existing. | **C3** |
| `required` | No default; the caller must supply it. | the card |
| `bindings.code.prop` | The prop's name in code, when it differs from the contract's. | C1, C2, C3 |
| `bindings.figma` | Recorded, **never checked**. Forward compatibility with Southleft tooling. | nothing |

## `states`

The interaction states the component handles for you: `hover`, `focus-visible`,
`active`, `disabled`, `selected`, `expanded`. A partner never styles these.

The list is open — a component whose real state is `armed` or `playing` says so,
and the checker treats an unfamiliar state as unverified rather than invalid. A
closed list here would be the same rigidity that makes Figma variants awkward.

## `anatomy` — the parts, and the tokens each reads

The tree of what the component is made of. Values are **token references, never
literals** — that is what makes a color a named decision instead of a stray hex.

| Field | What it is | Read by |
|---|---|---|
| `tokens` | CSS property → token reference. `var(--radius-md)`, or a path like `{color.action.{variant}.background}` where `{variant}` names a real prop. | **C4, C5** |
| `states` | state name → `{ property: token }`. What changes on hover, focus, and so on. | C4, C5 |
| `selector` | *css-module idiom.* The class this part is styled by, without the module prefix. | C1, C8 |
| `element` | The element this part renders. Lets C8 dismiss rules that could never match it — this is what took 23 false alarms to zero. | **C8** |
| `scope` | Ancestor classes this part always renders inside. Turns C8's guess into a ruling. | **C8** |
| `parts` | Nested parts, same shape all the way down. | all |
| `slot` | Where caller content goes, and whether it is open or restricted. | the card |

**On the Tailwind idiom, `anatomy` governs less than it appears to.** Utility
classes carry most of the styling, and the contract holds the token references
it can verify. State only what is checkable and delete the rest (NC-2).

## `a11y`

| Field | What it is | Read by |
|---|---|---|
| `focusVisible` | The component owns its focus ring. The one accessibility claim a source check can verify. | **C7** |
| `minHitArea` | Minimum touch target in CSS px. | reported |
| `contrast` | `AA` or `AAA`. Recorded; measuring it needs a browser. | — |

## `gaps` — the gate

What the component deliberately cannot do, and **why**. Written in advance, by
the person who knew the reason.

| Field | What it is |
|---|---|
| `what` | The thing it will not do. "No success or warning variant." |
| `why` | The reason, in the system's own terms. "A third signal color is a token decision, not a component decision." |
| `proposal` | Path to a `.proposal.json`, once someone has asked. |

This is the field that turns *"the system can't do this yet"* from an awkward
moment into a designed one. It is carried verbatim into the card, so a refusal
always arrives in the system's voice rather than an agent's improvisation.

## `bindings` — where the code is

Everything platform-shaped lives here, at the edge, so the rest of the contract
stays independent of how this repo happens to build things (NC-3).

| Field | What it is | Read by |
|---|---|---|
| `code.anchors.sourcePath` | Repo-relative path to the component. | every check |
| `code.anchors.stylePath` | Its stylesheet, where styling lives outside the component file. | C1, C5, C8 |
| `code.anchors.export` | The exported symbol to read. | C1, C3, C6 |
| `code.anchors.idiom` | `cva` · `variant-map` · `css-module` · `plain` · `inline`. Decides how the checker reads the file. `variant-map` is `cva`'s shape without the library — a hand-written object literal indexed by the prop. `plain` is a component with no variant system — the option checks are skipped and said to be skipped. | every check |
| `figma.anchors` | File key, component set, node id. Recorded, never checked. | nothing |
