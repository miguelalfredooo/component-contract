# Growing the contract

**What this is.** What happens when someone needs something the contract does
not allow.

**Why it has a procedure.** "A contract that can't change dies, and a contract
that changes without governance was never actually a contract" (NC-7). The
procedure is the difference between evolving and drifting.

**The shape of the answer.** Never invent it, never approximate it with a
hardcoded value. Say where you stopped, and ask.

---

## The refusal

When a flow needs something not on the card:

1. **Say it plainly.** *"The system can't do this yet."* Then say why, using the
   contract's `gaps` entry if one covers it — the reason is already written, by
   the person who knew it.
2. **Build with the nearest listed option.** The prototype stays honest and
   stays inside the vocabulary.
3. **File the proposal.** One small file, beside the contract.

```json
{
  "contract": "button.contract.json",
  "prop": "variant",
  "add": "success",
  "because": "Checkout confirmation needs a positive signal distinct from the accent."
}
```

Saved as `contracts/.proposals/<name>.proposal.json`.

**Why this beats a green button in a prototype.** A prototype that quietly
invents an option looks finished and teaches everyone the wrong thing about what
the system can do. One that says where it stopped is the more useful artifact,
and it converts into a one-line review instead of an argument over a screen
somebody already likes.

## Accepting one

In this order, and the order matters:

| # | Step | Why here |
|---|---|---|
| 1 | **Apply the proposal to the contract** | The contract changes first. That is the one rule. |
| 2 | **Bump the contract version** | Minor for a new option or prop; patch for a binding or documentation fix. |
| 3 | **Change the code** | Code follows the contract, never the other way round. |
| 4 | **Re-run the checker** | Green is the evidence the change actually landed on both sides. |

Doing 3 before 1 is exactly the drift the contract exists to prevent — it is
the same edit, made in the place where nobody reviews it.

## Rejecting one

Also a real outcome, and it leaves a trace. Add or extend a `gaps` entry with
the reason, so the next person to ask gets the answer without asking. A refusal
recorded once answers every time it is needed.

## Changing the schema itself

A change to *what a contract can say* — a new field, a new type — is a bigger
move than a change to what one contract says. Two things follow:

- **The schema carries its own version**, separate from every contract written
  against it. Implementing a contract depends on both.
- **Write a short decision record beside it**: what changed, why, what it
  affects. Curtis calls these ADRs, and the reason is that evolving the model
  privately is "flexibility masquerading as evolvability" — a reader cannot tell
  what changed without re-reading the whole contract from scratch.

## When to delete a contract instead

If a contract has been failing its checks for a week and nobody has moved, it is
not governing anything and people still trust it. Delete it, or fix it today.
"A rotted contract is worse than no contract at all, because people trust
contracts" (NC-6).
