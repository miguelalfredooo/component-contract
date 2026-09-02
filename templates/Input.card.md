# Input — what you may use

A single-line text field. One appearance, no variants — every input in the studio looks the same on purpose.

Part of **alfredo-studio core**. Everything below comes from that system; nothing below is a suggestion.

## The options

```
type      text        —
```

States handled for you: focus-visible, disabled. You never style these.

## The rules

- **Color, radius, spacing come from tokens this component already reads.**
  Never write a hex value, an `rgb()`, or a pixel color anywhere.
- **Never restyle it and never fork it.** If it looks wrong in your flow, that
  is a finding about the system, not a reason to override it locally.
- **Anything not listed above does not exist.** An option you have not seen
  here will not render — it falls back to the default, silently.
- **The focus ring is part of the component.** Do not remove it.

## What this component will not do

**No size or variant axis.**
One field height keeps forms aligned. A different height is a form-layout decision, not a component one.

**No built-in label, hint or error text.**
Those are a Field's job — an input that owns its own label cannot be laid out beside another one.

## If your flow needs something that is not on this card

Do not invent it, and do not approximate it with a hardcoded value. Say
**"the system can't do this yet"**, build with the nearest option that is
listed, and file the request:

```json
{
  "contract": "input.contract.json",
  "prop": "<which option axis>",
  "add": "<the value you need>",
  "because": "<the flow that needs it — one sentence>"
}
```

Save it beside the contract as `.proposals/<name>.proposal.json`. A reviewer
decides, the contract grows by one step, and your screen picks up the change
without being rebuilt.

A prototype that quietly invents an option looks finished and teaches everyone
the wrong thing about what the system can do. One that says where it stopped is
the more useful artifact, every time.

---
*Generated from `input.contract.json` v1.0.0. Do not edit this card — edit
the contract and regenerate, or the two will disagree.*
