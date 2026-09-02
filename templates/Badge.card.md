# Badge — what you may use

A small status or category label. Not a control — if it can be pressed, reach for Button instead.

Part of **alfredalfred core**. Everything below comes from that system; nothing below is a suggestion.

## The options

```
variant   default · secondary · destructive · outline · ghost · link  default: default
asChild   yes / no                                                    default: false
```

States handled for you: hover, focus-visible. You never style these.

## The rules

- **Color, radius, spacing come from tokens this component already reads.**
  Never write a hex value, an `rgb()`, or a pixel color anywhere.
- **Never restyle it and never fork it.** If it looks wrong in your flow, that
  is a finding about the system, not a reason to override it locally.
- **Anything not listed above does not exist.** An option you have not seen
  here will not render — it falls back to the default, silently.
- **The focus ring is part of the component.** Do not remove it.

## What this component will not do

**No size axis.**
One size keeps badges consistent down a list. A badge that needs to be bigger is usually a Button or a heading.

**No success or warning variant.**
Same token decision as Button — the palette carries one accent and one destructive.

## If your flow needs something that is not on this card

Do not invent it, and do not approximate it with a hardcoded value. Say
**"the system can't do this yet"**, build with the nearest option that is
listed, and file the request:

```json
{
  "contract": "badge.contract.json",
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
*Generated from `badge.contract.json` v1.0.0. Do not edit this card — edit
the contract and regenerate, or the two will disagree.*
