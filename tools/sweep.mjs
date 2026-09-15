#!/usr/bin/env node
/**
 * sweep — check every contract in one go and write the result up plainly.
 *
 * The per-change checks answer "did this edit break anything". This answers
 * "what is the standing state of every contract here", which nothing else asks.
 *
 * THE REPORT IS FOR SOMEBODY WHO HAS NEVER SEEN THIS PROJECT. What was found
 * comes before what it means, no term appears without a plain phrase first, and
 * every line says what would fix it. Exit codes and check numbers go in a
 * collapsed section at the bottom for anyone who wants them.
 *
 * NOT EXAMINED IS NOT A PASS, and the closing count says so.
 *
 * Usage: node tools/sweep.mjs [contracts-dir] [--repo <root>]
 * EXIT: 0 always. A report that fails a build is a report somebody turns off.
 */
import { readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, basename } from "node:path";

const ROOT = process.cwd();
const dir = resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "example");
const repoFlag = process.argv.indexOf("--repo");
const repo = repoFlag > -1 ? resolve(process.argv[repoFlag + 1]) : ROOT;
const today = new Date().toISOString().slice(0, 10);

/** What each check is called in plain words, and what fixes it. */
const PLAIN = {
  C0: ["The file is written correctly", "A field is misspelled or unknown. Correct the spelling."],
  C1: ["Options the component does not have", "The description lists a setting the code does not accept. Remove it, or add it to the code."],
  C2: ["The list of choices matches", "The description and the code offer different choices. Make the two lists agree."],
  C3: ["One starting value, not two", "Two places set a different starting value. Keep one."],
  C4: ["Every named value exists", "A name is used that nothing defines, so it quietly does nothing."],
  C5: ["Nothing typed by hand", "A color or size is written directly instead of using a shared name."],
  C6: ["The parts described are the parts rendered", "The description names a part the code does not draw."],
  C7: ["Keyboard and screen-reader promises", "The description claims something the code does not do."],
  C8: ["One owner per styling rule", "Two rules set the same thing, so which wins is luck."],
};

if (!existsSync(dir)) {
  console.error(`could not run: no contracts directory at ${dir}`);
  process.exit(0);
}
const contracts = readdirSync(dir).filter((f) => f.endsWith(".contract.json"));

const r = (() => {
  try {
    return { code: 0, out: execFileSync("node", [join(ROOT, "tools/check.mjs"), dir, "--repo", repo],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
  } catch (e) { return { code: e.status ?? 2, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; }
})();

/* One row per check number. A check nobody's contracts exercise is NOT EXAMINED
   rather than passing — a number that never ran cannot be reported as clean. */
const rows = Object.entries(PLAIN).map(([id, [name, fix]]) => {
  const hits = (r.out.match(new RegExp(`\\\\[${id}\\\\]`, "g")) || []).length;
  if (r.code === 2) return { id, name, state: "not-examined", found: "the checker could not start", fix };
  if (hits > 0) return { id, name, state: "partial", found: `${hits} place${hits === 1 ? "" : "s"}`, fix };
  return { id, name, state: "verified", found: "nothing", fix: "—" };
});

const count = (s) => rows.filter((x) => x.state === s).length;
const open = count("partial") + count("not-examined");
const L = [];
L.push(`# Contract check — ${today}`, "");
L.push("A contract is a short file describing what one piece of an interface promises:");
L.push("the choices it offers, the values it starts with, and the parts it draws. This");
L.push("run compares every contract against the code it describes.", "");
L.push(`Checked **${contracts.length}** contract${contracts.length === 1 ? "" : "s"}: ${contracts.map((c) => basename(c, ".contract.json")).join(", ")}.`, "");
L.push("## What was found", "");
L.push("**Passed** means checked and nothing wrong. **Needs attention** means something");
L.push("was found. **Could not check** means it did not run, and those count as open below.", "");
L.push("| Check | Result | What was found | What would fix it |", "|---|---|---|---|");
const MARK = { verified: "Passed", partial: "Needs attention", "not-examined": "Could not check" };
rows.forEach((x) => L.push(`| ${x.name} | ${MARK[x.state]} | ${x.found} | ${x.fix} |`));
L.push("");
L.push("## How close this is to clean", "");
if (open === 0) L.push("Everything was checked and everything passed.");
else {
  L.push(`**${open} of ${rows.length} lines are open**, counting the **${count("not-examined")}** that could not be checked.`, "");
  rows.filter((x) => x.state !== "verified").forEach((x) => L.push(`- **${x.name}** — ${x.fix}`));
  L.push("");
}
const first = rows.find((x) => x.state === "not-examined") || rows.find((x) => x.state === "partial");
L.push("## If you only do one thing", "");
L.push(first ? first.fix : "Nothing needs doing.", "");
L.push("<details>", "<summary>Details for anyone who wants them</summary>", "");
L.push("| Code | Name | State |", "|---|---|---|");
rows.forEach((x) => L.push(`| ${x.id} | ${x.name} | ${x.state} |`));
L.push("", "```", r.out.trim().split("\n").slice(-12).join("\n"), "```", "</details>", "");

mkdirSync(join(ROOT, "reports"), { recursive: true });
const out = join(ROOT, "reports", `sweep-${today}.md`);
writeFileSync(out, L.join("\n") + "\n");
console.log(L.join("\n"));
console.error(`\nwrote reports/sweep-${today}.md`);
process.exit(0);
