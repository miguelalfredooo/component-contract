#!/usr/bin/env node
/*
 * component-contract — the partner card.
 *
 * Turns a contract into the one page a cross-functional partner (or an agent
 * working for one) reads before prototyping. It is the only artifact in this
 * skill a non-engineer is meant to open.
 *
 * The card carries three things and nothing else:
 *   1. What you may use          — the fence. Everything listed is yours.
 *   2. What the system won't do  — the gate, in the system's own words.
 *   3. What to do when blocked   — the refusal rule.
 *
 * Point 3 is the card. Southleft's A/B test found an agent left to taste
 * scored 69/100 — it invented options and hardcoded colors. The same agent
 * handed a strict rulebook scored 100/100, because it was allowed to say no.
 * The tables only make the no fair.
 *
 * Usage:  node card.mjs <contract.json> [--out <dir>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--out") + 1]);
if (!file) { console.error("usage: node card.mjs <contract.json> [--out <dir>]"); process.exit(2); }
const c = JSON.parse(readFileSync(file, "utf8"));

const pad = (s, n) => String(s).padEnd(n);
const rows = c.props.map((p) => [
  p.name,
  typeof p.type === "object" && p.type.enum ? p.type.enum.join(" · ")
    : p.type === "boolean" ? "yes / no"
    : String(p.type),
  p.default === undefined ? (p.required ? "required" : "—") : `default: ${p.default}`,
]);
const w0 = Math.max(8, ...rows.map((r) => r[0].length));
const w1 = Math.max(10, ...rows.map((r) => r[1].length));

const out = `# ${c.name} — what you may use

${c.description}

${c.system?.name ? `Part of **${c.system.name}**. Everything below comes from that system; nothing below is a suggestion.\n` : ""}
## The options

\`\`\`
${rows.map((r) => `${pad(r[0], w0)}  ${pad(r[1], w1)}  ${r[2]}`).join("\n")}
\`\`\`
${c.states?.length ? `\nStates handled for you: ${c.states.join(", ")}. You never style these.\n` : ""}${c.preview ? `\nSee it: ${c.preview}\n` : ""}
## The rules

- **Color, radius, spacing come from tokens this component already reads.**
  Never write a hex value, an \`rgb()\`, or a pixel color anywhere.
- **Never restyle it and never fork it.** If it looks wrong in your flow, that
  is a finding about the system, not a reason to override it locally.
- **Anything not listed above does not exist.** An option you have not seen
  here will not render — it falls back to the default, silently.
${c.a11y?.focusVisible ? "- **The focus ring is part of the component.** Do not remove it.\n" : ""}
## What this component will not do
${(c.gaps?.length
  ? c.gaps.map((g) => `\n**${g.what}**\n${g.why}${g.proposal ? `\nAsked for already: \`${g.proposal}\`` : ""}`).join("\n")
  : "\nNothing recorded yet. That does not mean everything is possible — it means\nnobody has hit a limit worth writing down. If you hit one, it belongs here.")}

## If your flow needs something that is not on this card

Do not invent it, and do not approximate it with a hardcoded value. Say
**"the system can't do this yet"**, build with the nearest option that is
listed, and file the request:

\`\`\`json
{
  "contract": "${basename(file)}",
  "prop": "<which option axis>",
  "add": "<the value you need>",
  "because": "<the flow that needs it — one sentence>"
}
\`\`\`

Save it beside the contract as \`.proposals/<name>.proposal.json\`. A reviewer
decides, the contract grows by one step, and your screen picks up the change
without being rebuilt.

A prototype that quietly invents an option looks finished and teaches everyone
the wrong thing about what the system can do. One that says where it stopped is
the more useful artifact, every time.

---
*Generated from \`${basename(file)}\` v${c.version}. Do not edit this card — edit
the contract and regenerate, or the two will disagree.*
`;

const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : null;
if (outDir) {
  const p = join(outDir, `${c.name}.card.md`);
  writeFileSync(p, out);
  console.log(`wrote ${p}`);
} else process.stdout.write(out);
