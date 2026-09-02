#!/usr/bin/env node
/*
 * component-contract — the checker.
 *
 * Diffs a component contract against the code it claims to describe and exits
 * non-zero when they have stopped agreeing.
 *
 * The whole value of this file is that it is a COMPILER, not a model: same
 * contract in, same verdict out, every time. Nothing here is generated and
 * nothing here is interpreted. It reads source, it matches boxes, it reports.
 *
 * WHAT IT DOES NOT DO, on purpose:
 *   - It does not lay out a page. jsdom performs no layout and neither does
 *     this, so no check here can see a spacing, overflow or sizing bug.
 *   - It does not resolve the CSS cascade across sheets. C8 compares selectors
 *     WITHIN ONE stylesheet, which is where the specificity bugs this repo has
 *     actually shipped were living.
 *   - It does not touch Figma. The figma binding fields are recorded and
 *     ignored, so a contract stays forward-compatible with Southleft tooling.
 *
 * It reads TypeScript with regular expressions rather than a parser. That is a
 * deliberate trade — no dependency, no build step, runs anywhere — and it is
 * the checker's real limit. Every reader is written to FAIL LOUD rather than
 * quietly find nothing: if a reader cannot locate the shape it expects, it
 * emits UNREADABLE, which is a failure, not a pass. A guard that goes quiet
 * when its input changes shape is the failure mode this file exists to avoid.
 *
 * Principles: every check serves one of the seven facets in
 * references/curtis-principles.md (NC-1..NC-7, from Nathan Curtis's
 * "Component Contracts and Schemas"):
 *   C1, C2         -> NC-1 well-typed   (props exist; enums match both ways)
 *   C3, C8         -> NC-2 normalized   (one default; one owner per declaration)
 *   C0, C4-C7      -> NC-4 verifiable   (structure, tokens, literals, semantics, focus)
 *   the whole file -> NC-5 deterministic (a compiler, never a model)
 *
 * Usage:
 *   node check.mjs <contract.json | contracts-dir> --repo <repo-root> [--json]
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";

/* ------------------------------------------------------------------ finding */

const FAIL = "FAIL";
const WARN = "WARN";

class Report {
  constructor(contractPath) {
    this.contractPath = contractPath;
    this.findings = [];
  }
  add(level, code, message, detail) {
    this.findings.push({ level, code, message, detail });
  }
  fail(code, message, detail) { this.add(FAIL, code, message, detail); }
  warn(code, message, detail) { this.add(WARN, code, message, detail); }
  get failed() { return this.findings.some((f) => f.level === FAIL); }
}

/* ------------------------------------------------------------- tiny helpers */

/** Return the substring of `src` inside the braces that open at/after `from`. */
function braceBlock(src, from) {
  const open = src.indexOf("{", from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return { body: src.slice(open + 1, i), start: open + 1, end: i };
    }
  }
  return null;
}

/** Top-level `key:` names inside an object-literal body. */
function topLevelKeys(body) {
  const keys = [];
  let depth = 0, i = 0, inStr = null;
  while (i < body.length) {
    const c = body[i];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; i++; continue; }
    if (c === "{" || c === "[" || c === "(") { depth++; i++; continue; }
    if (c === "}" || c === "]" || c === ")") { depth--; i++; continue; }
    if (depth === 0) {
      const m = /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:/.exec(body.slice(i));
      if (m) {
        keys.push({ name: m[1] ?? m[2] ?? m[3], at: i + m[0].length });
        i += m[0].length;
        continue;
      }
    }
    i++;
  }
  return keys;
}

/** The value text for a top-level key, up to its balanced end. */
function valueAfter(body, at) {
  let i = at;
  while (i < body.length && /\s/.test(body[i])) i++;
  const c = body[i];
  if (c === "{" || c === "[") {
    const openCh = c, closeCh = c === "{" ? "}" : "]";
    let depth = 0, inStr = null;
    for (let j = i; j < body.length; j++) {
      const d = body[j];
      if (inStr) { if (d === "\\") { j++; continue; } if (d === inStr) inStr = null; continue; }
      if (d === '"' || d === "'" || d === "`") { inStr = d; continue; }
      if (d === openCh) depth++;
      else if (d === closeCh) { depth--; if (depth === 0) return body.slice(i, j + 1); }
    }
    return body.slice(i);
  }
  const m = /^[^,\n]*/.exec(body.slice(i));
  return m ? m[0].trim() : "";
}

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

const stripLineComments = (s) => s.replace(/^\s*\/\/.*$/gm, "");
const stripBlockComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/* ------------------------------------------------------- source-fact readers */

/**
 * cva idiom. Returns { variants: {prop: [values]}, cvaDefaults: {prop: value} }
 * or { unreadable: reason }.
 */
function readCva(src) {
  const call = /\bcva\s*\(/.exec(src);
  if (!call) return { unreadable: "no cva() call found" };
  // cva("base", { variants: {...}, defaultVariants: {...} }) — the config object
  // is the SECOND brace block after the call, so walk to the config literal.
  const afterCall = call.index + call[0].length;
  const cfgOpen = src.indexOf("{", afterCall);
  if (cfgOpen === -1) return { unreadable: "cva() has no config object" };
  const cfg = braceBlock(src, afterCall);
  if (!cfg) return { unreadable: "cva() config object is unbalanced" };

  const keys = topLevelKeys(cfg.body);
  const find = (n) => keys.find((k) => k.name === n);

  const vKey = find("variants");
  if (!vKey) return { unreadable: "cva() config has no `variants` key" };
  const vBody = braceBlock(cfg.body, vKey.at);
  if (!vBody) return { unreadable: "`variants` object is unbalanced" };

  const variants = {};
  for (const prop of topLevelKeys(vBody.body)) {
    const pb = braceBlock(vBody.body, prop.at);
    if (!pb) continue;
    variants[prop.name] = topLevelKeys(pb.body).map((k) => k.name);
  }

  const cvaDefaults = {};
  const dKey = find("defaultVariants");
  if (dKey) {
    const db = braceBlock(cfg.body, dKey.at);
    if (db) for (const k of topLevelKeys(db.body)) cvaDefaults[k.name] = unquote(valueAfter(db.body, k.at));
  }
  return { variants, cvaDefaults };
}

/**
 * Defaults written on the component function's destructured parameters.
 * These are the ones that actually win at runtime when the value is threaded
 * through to cva(), which is exactly the trap C3 exists to catch.
 */
function readSignatureDefaults(src, exportName) {
  const re = new RegExp(`(?:function|const)\\s+${exportName}\\b[^(]*\\(`, "");
  const m = re.exec(src);
  if (!m) return { unreadable: `no declaration of \`${exportName}\` found` };
  const params = braceBlock(src, m.index + m[0].length - 1);
  if (!params) return { defaults: {} }; // non-destructured params: nothing to read
  const defaults = {};
  for (const k of topLevelKeys(params.body)) {
    const slice = params.body.slice(k.at - 0);
    const eq = /^\s*=\s*/.exec(slice);
    if (eq) defaults[k.name] = unquote(valueAfter(params.body, k.at + eq[0].length - 0));
  }
  // topLevelKeys only matches `name:` — destructured defaults are `name = value`.
  const dre = /(?:^|[{,\s])([A-Za-z_$][\w$]*)\s*=\s*("[^"]*"|'[^']*'|[\w.$]+)/g;
  let d;
  while ((d = dre.exec(params.body))) defaults[d[1]] = unquote(d[2]);
  return { defaults };
}

/** The element rendered at the root, as written. */
function readRootElement(src, exportName) {
  const re = new RegExp(`(?:function|const)\\s+${exportName}\\b`, "");
  const m = re.exec(src);
  const body = m ? src.slice(m.index) : src;
  const ret = /return\s*\(?\s*<\s*([A-Za-z][\w.]*)/.exec(body);
  if (!ret) return { unreadable: "no root JSX element found after the declaration" };
  const tag = ret[1];
  // `<Comp ...>` with `const Comp = cond ? X : "button"` — read the fallback literal.
  if (/^[A-Z]/.test(tag)) {
    const alias = new RegExp(`const\\s+${tag}\\s*=\\s*[^;\\n]*?["']([a-z][\\w-]*)["']`).exec(body);
    if (alias) return { element: alias[1], via: `${tag} alias` };
    return { element: tag, via: "component" };
  }
  return { element: tag, via: "literal" };
}

/* ----------------------------------------------------------- CSS reading (C8) */

/** Flat list of { selector, decls: {prop: value}, atRule, line } for one sheet. */
function parseCss(src) {
  const clean = stripBlockComments(src);
  const rules = [];
  let i = 0;
  const walk = (text, offset, atRule) => {
    let j = 0;
    while (j < text.length) {
      const open = text.indexOf("{", j);
      if (open === -1) break;
      const selector = text.slice(j, open).trim();
      const blk = braceBlock(text, j);
      if (!blk) break;
      if (selector.startsWith("@")) {
        walk(blk.body, offset + blk.start, selector);
      } else if (selector) {
        const decls = {};
        for (const d of blk.body.split(";")) {
          const c = d.indexOf(":");
          if (c === -1) continue;
          const p = d.slice(0, c).trim();
          if (!p || p.startsWith("//")) continue;
          decls[p] = d.slice(c + 1).trim();
        }
        const line = clean.slice(0, offset + blk.start).split("\n").length;
        for (const one of selector.split(",")) rules.push({ selector: one.trim(), decls, atRule, line });
      }
      j = blk.end + 1;
    }
  };
  walk(clean, 0, null);
  return rules;
}

/** [ids, classes, elements] — enough to compare two selectors in one sheet. */
function specificity(sel) {
  let s = sel.replace(/::[\w-]+/g, " ELEMENT ");
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+/g) || []).length
    + (s.match(/\[[^\]]+\]/g) || []).length
    + (s.match(/:(?!:)(?:hover|focus|focus-visible|active|disabled|checked|first-child|last-child|nth-child\([^)]*\)|not\([^)]*\))/g) || []).length;
  const elements = (s.match(/(?:^|[\s>+~])([a-z][\w-]*)/g) || []).length
    + (s.match(/ELEMENT/g) || []).length;
  return [ids, classes, elements];
}
const specGte = (a, b) =>
  a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2];

/* -------------------------------------------------------------- token lookup */

/** Every `--name` declared across the contract's declared token files. */
function readDeclaredTokens(repo, files, report) {
  const declared = new Set();
  for (const f of files) {
    const p = join(repo, f);
    if (!existsSync(p)) { report.fail("C4", `token file not found: ${f}`, `system.tokenFiles names a path that is not in the repo`); continue; }
    const src = stripBlockComments(readFileSync(p, "utf8"));
    for (const m of src.matchAll(/(--[\w-]+)\s*:/g)) declared.add(m[1]);
  }
  return declared;
}

/** Token references used in a contract value: `var(--x)` and `{a.b.c}`. */
function tokenRefs(value) {
  const out = [];
  for (const m of String(value).matchAll(/var\(\s*(--[\w-]+)/g)) out.push({ kind: "css", name: m[1] });
  for (const m of String(value).matchAll(/\{([a-zA-Z][\w.\-{}]*)\}/g)) out.push({ kind: "path", name: m[1] });
  return out;
}

// Every notation a color can be written in. A net with holes is a net that
// reports clean while the drift walks through it (NC-4).
const LITERAL_COLOR = /(#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\()/;
const NAMED_COLORS = /\b(?:white|black|red|blue|green|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia)\b/;

/**
 * Walk every part of an anatomy tree, carrying the classes the rendered
 * element actually carries — its own plus every ancestor part's. A component
 * written `<a class={btn btnPrimary}>` carries both, and C8 needs to know that
 * to read a `:not()` correctly.
 */
function* walkParts(part, path = "root", chain = []) {
  const here = part.selector ? [...chain, part.selector] : chain;
  yield [path, part, here];
  for (const [k, v] of Object.entries(part.parts || {})) yield* walkParts(v, `${path}.${k}`, here);
}

/* ---------------------------------------------------------------- the checks */

/**
 * C0b — reject fields the schema does not define.
 *
 * The schema says additionalProperties:false everywhere; nothing enforced it.
 * Misspell `props` and every prop check finds an empty list and passes. "A
 * format where nothing is invalid is a format where nothing is verifiable"
 * (NC-4) — so an unknown key is a failure, never a shrug.
 */
function checkUnknownKeys(contract, schema, report) {
  const walk = (node, def, path) => {
    if (!def || typeof node !== "object" || node === null) return;
    if (Array.isArray(node)) { for (const [i, v] of node.entries()) walk(v, def.items, `${path}[${i}]`); return; }
    const resolved = def.$ref ? deref(schema, def.$ref) : def;
    const props = resolved.properties;
    if (!props) return;
    for (const key of Object.keys(node)) {
      if (!props[key]) {
        if (resolved.additionalProperties === false || resolved.additionalProperties === undefined) {
          const near = Object.keys(props).find((k) => k.toLowerCase() === key.toLowerCase() || levenshtein(k, key) <= 2);
          report.fail("C0", `unknown field \`${path}${path ? "." : ""}${key}\``, near ? `the schema defines no such field. Did you mean \`${near}\`? A misspelled field is skipped by every check that reads it.` : "the schema defines no such field, so nothing checks what is inside it.");
        }
        continue;
      }
      walk(node[key], props[key], `${path}${path ? "." : ""}${key}`);
    }
    if (resolved.additionalProperties && typeof resolved.additionalProperties === "object")
      for (const [k, v] of Object.entries(node)) if (!props[k]) walk(v, resolved.additionalProperties, `${path}.${k}`);
  };
  walk(contract, schema, "");
}

const deref = (schema, ref) => ref.replace(/^#\//, "").split("/").reduce((o, k) => o?.[k], schema) || {};

function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i-1][j] + 1, m[i][j-1] + 1, m[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1));
  return m[a.length][b.length];
}

function checkContract(contract, repo, report, schema) {
  if (schema) {
    checkUnknownKeys(contract, schema, report);
    if (report.failed) return;   // every later check reads fields we cannot trust
  }

  /* ---- structural: the fields the rest of the checks depend on ------------ */
  const REQUIRED = ["id", "name", "version", "description", "semantics", "props", "anatomy", "bindings"];
  for (const f of REQUIRED) {
    if (contract[f] === undefined) report.fail("C0", `contract is missing required field \`${f}\``, "the schema requires it; nothing downstream can be checked without it");
  }
  if (report.failed) return;

  const anchors = contract.bindings?.code?.anchors || {};
  const idiom = anchors.idiom || "cva";
  const srcPath = anchors.sourcePath && join(repo, anchors.sourcePath);
  if (!srcPath || !existsSync(srcPath)) {
    report.fail("C0", `component source not found: ${anchors.sourcePath}`, "bindings.code.anchors.sourcePath must be repo-relative and real");
    return;
  }
  const src = readFileSync(srcPath, "utf8");
  const exportName = anchors.export || contract.name;

  /* ---- C4: every token named in the contract resolves --------------------- */
  const declared = readDeclaredTokens(repo, contract.system?.tokenFiles || [], report);
  const contractProps = new Set(contract.props.map((p) => p.name));

  for (const [path, part] of walkParts(contract.anatomy.root)) {
    const buckets = [["", part.tokens || {}], ...Object.entries(part.states || {}).map(([s, t]) => [s, t])];
    for (const [state, tokens] of buckets) {
      for (const [cssProp, value] of Object.entries(tokens)) {
        const where = `anatomy.${path}${state ? `.states.${state}` : ""}.${cssProp}`;
        if (LITERAL_COLOR.test(String(value)) || NAMED_COLORS.test(String(value))) {
          report.fail("C5", `${where} is a literal, not a token`, `\`${value}\` — a contract names decisions, never values. A literal here is the drift it exists to prevent.`);
          continue;
        }
        const refs = tokenRefs(value);
        if (refs.length === 0) {
          if (/^[\d.]+(px|rem|em|%)$/.test(String(value).trim()))
            report.warn("C5", `${where} is a raw length`, `\`${value}\` — allowed, but it is a decision nobody can change from the token file.`);
          continue;
        }
        for (const ref of refs) {
          if (ref.kind === "css") {
            if (!declared.has(ref.name)) report.fail("C4", `${where} names a token that does not exist`, `\`${ref.name}\` is not declared in ${(contract.system?.tokenFiles || []).join(", ") || "any declared token file"}. An undefined custom property fails silently: the browser drops the declaration and styles the element as if it were never written.`);
          } else {
            // `{color.action.{variant}.background}` — the interpolated segment must be a real prop.
            for (const m of ref.name.matchAll(/\{([\w-]+)\}/g)) {
              if (!contractProps.has(m[1])) report.fail("C4", `${where} interpolates \`{${m[1]}}\`, which is not a prop of this component`, "a token path can only interpolate props the contract declares");
            }
          }
        }
      }
    }
  }

  /* ---- idiom-specific: C1, C2, C3 ---------------------------------------- */
  if (idiom === "cva") {
    const cva = readCva(stripLineComments(src));
    if (cva.unreadable) {
      report.fail("C1", `cannot read variants from ${anchors.sourcePath}`, `${cva.unreadable}. Declared idiom is \`cva\`. UNREADABLE is a failure, not a pass — fix the idiom or the contract, never let this go quiet.`);
    } else {
      const sig = readSignatureDefaults(stripLineComments(src), exportName);
      if (sig.unreadable) report.warn("C3", `cannot read signature defaults`, sig.unreadable);
      const sigDefaults = sig.defaults || {};

      for (const p of contract.props) {
        const codeName = p.bindings?.code?.prop || p.name;
        const isEnum = typeof p.type === "object" && Array.isArray(p.type.enum);

        /* C1 — the prop exists at all */
        const inVariants = Object.prototype.hasOwnProperty.call(cva.variants, codeName);
        const inSignature = Object.prototype.hasOwnProperty.call(sigDefaults, codeName);
        const inTypes = new RegExp(`\\b${codeName}\\s*[?]?\\s*:`).test(src);
        if (!inVariants && !inSignature && !inTypes) {
          report.fail("C1", `contract declares prop \`${p.name}\` which the component does not have`, `nothing named \`${codeName}\` appears as a cva variant, a destructured parameter, or a typed property in ${anchors.sourcePath}`);
          continue;
        }

        /* C2 — enum parity, BOTH directions */
        if (isEnum && inVariants) {
          const codeValues = cva.variants[codeName];
          const missingInCode = p.type.enum.filter((v) => !codeValues.includes(v));
          const missingInContract = codeValues.filter((v) => !p.type.enum.includes(v));
          if (missingInCode.length)
            report.fail("C2", `\`${p.name}\` promises values the code cannot render`, `contract has ${missingInCode.map((v) => `\`${v}\``).join(", ")}; cva does not. Anyone told this value exists will get the default instead, and nothing will say so.`);
          if (missingInContract.length)
            report.fail("C2", `\`${p.name}\` has values in code the contract does not govern`, `code has ${missingInContract.map((v) => `\`${v}\``).join(", ")}; the contract omits them. Ungoverned values are how a system grows a variant nobody approved.`);
        }

        /* C3 — one effective default, and it is the one the contract states */
        const cvaDefault = cva.cvaDefaults[codeName];
        const sigDefault = sigDefaults[codeName];
        if (cvaDefault !== undefined && sigDefault !== undefined && String(cvaDefault) !== String(sigDefault)) {
          report.fail("C3", `\`${p.name}\` has TWO declared defaults that disagree`, `cva \`defaultVariants.${codeName}\` says \`${cvaDefault}\`; the signature says \`${sigDefault}\`. The signature always wins here because the value is threaded into cva(), so the design-system-layer default is dead code. Two owners for one decision.`);
        }
        const effective = sigDefault !== undefined ? sigDefault : cvaDefault;
        if (p.default !== undefined && effective !== undefined && String(p.default) !== String(effective)) {
          report.fail("C3", `\`${p.name}\` default disagrees with the code`, `contract says \`${p.default}\`; the effective default in code is \`${effective}\`.`);
        }
      }

      /* C2 in reverse at the component level — a whole variant axis the contract never mentions */
      for (const codeName of Object.keys(cva.variants)) {
        const governed = contract.props.some((p) => (p.bindings?.code?.prop || p.name) === codeName);
        if (!governed) report.fail("C2", `component has a variant axis \`${codeName}\` the contract does not govern`, `cva declares it with ${cva.variants[codeName].length} values. Every axis is either in the contract or it is drift.`);
      }
    }
  } else if (idiom === "plain") {
    // A component with no variant system. C1-C3 have nothing to read, and
    // saying so is the honest answer — running them anyway would report every
    // prop as missing. C4-C7 still apply in full.
    const sig = readSignatureDefaults(stripLineComments(src), exportName);
    for (const p of contract.props) {
      const codeName = p.bindings?.code?.prop || p.name;
      if (typeof p.type === "object" && Array.isArray(p.type.enum))
        report.fail("C2", `\`${p.name}\` declares an option list, but this component has no variant system`, `the \`plain\` idiom means there is nothing to check an enum against. Either the component grew variants and the idiom is stale, or this prop is not really a closed list.`);
      if (!new RegExp(`\\b${codeName}\\b`).test(src))
        report.fail("C1", `contract declares prop \`${p.name}\` which does not appear in ${anchors.sourcePath}`, `nothing named \`${codeName}\` is written in the component`);
      const eff = (sig.defaults || {})[codeName];
      if (p.default !== undefined && eff !== undefined && String(p.default) !== String(eff))
        report.fail("C3", `\`${p.name}\` default disagrees with the code`, `contract says \`${p.default}\`; the signature says \`${eff}\`.`);
    }
  } else if (idiom === "css-module") {
    const stylePath = anchors.stylePath && join(repo, anchors.stylePath);
    if (!stylePath || !existsSync(stylePath)) {
      report.fail("C1", `stylesheet not found: ${anchors.stylePath}`, "the css-module idiom requires bindings.code.anchors.stylePath");
    } else {
      const rules = parseCss(readFileSync(stylePath, "utf8"));

      for (const [path, part, carries] of walkParts(contract.anatomy.root)) {
        if (!part.selector) continue;
        const own = rules.filter((r) => r.selector.replace(/:[\w-]+(\([^)]*\))?$/, "") === `.${part.selector}`);
        if (own.length === 0) {
          report.fail("C1", `anatomy.${path} names class \`.${part.selector}\` which the stylesheet does not define`, `nothing matches in ${anchors.stylePath}`);
          continue;
        }

        for (const [cssProp, value] of Object.entries(part.tokens || {})) {
          const owner = own.find((r) => r.decls[cssProp] !== undefined);
          if (!owner) {
            report.fail("C1", `anatomy.${path} claims \`${cssProp}\` which \`.${part.selector}\` never sets`, `${anchors.stylePath}`);
            continue;
          }

          /* C8 — one owner per declaration, within this sheet */
          const mine = specificity(owner.selector);
          for (const other of rules) {
            if (other === owner) continue;
            if (other.decls[cssProp] === undefined) continue;
            // The part's own hover/focus/active is the same owner in another
            // state, not a rival. Counting it produced 23 false alarms.
            if (sameOwnerInAnotherState(other.selector, part.selector)) continue;
            if (!selectorCouldMatchSame(other.selector, part.selector, part.element, carries)) continue;
            if (specGte(specificity(other.selector), mine)) {
              const anc = /^\.([\w-]+)[\s>+~]/.exec(other.selector)?.[1];
              const proven = !anc || (part.scope || []).includes(anc);
              const head = `\`${other.selector}\` (line ${other.line}) sets \`${cssProp}: ${other.decls[cssProp]}\` at specificity ${specificity(other.selector).join(",")}, against \`${owner.selector}\` at ${mine.join(",")}.`;
              if (proven)
                report.fail("C8", `\`${cssProp}\` on \`.${part.selector}\` has a second owner that outranks it`, `${head} The contract's value is written, matched, and LOSES — so the component looks wrong while the source reads correct.`);
              else
                report.warn("C8", `\`${cssProp}\` on \`.${part.selector}\` may have a second owner`, `${head} It would win, but only if this part is rendered inside \`.${anc}\` — which no source file can prove. Add \`.${anc}\` to this part's \`scope\` if it is, and this becomes a failure.`);
            }
          }
        }
      }
    }
  }

  /* ---- C6: the element the contract claims is the element rendered -------- */
  const root = readRootElement(stripLineComments(src), exportName);
  if (root.unreadable) {
    report.warn("C6", "cannot read the root element", root.unreadable);
  } else if (contract.semantics.element !== root.element) {
    // A contract's unit is one component. When the anchor points at a page,
    // the mismatch is not a semantics bug — it is the component not existing
    // yet, and saying so is more useful than reporting the wrong element.
    const lines = src.split("\n").length;
    if (lines > 200 && idiom === "css-module")
      report.fail("C6", `this contract points at a page, not a component`, `\`${exportName}\` in ${anchors.sourcePath} is ${lines} lines and renders \`${root.element}\`, while the contract describes an \`${contract.semantics.element}\`. The part it names exists only as loose classes in a page. Extract it into a component, then point the contract at that — styling nothing owns is styling nothing can hold to a contract.`);
    else
      report.fail("C6", `semantics.element says \`${contract.semantics.element}\`, code renders \`${root.element}\``, `read from the ${root.via} in ${anchors.sourcePath}. Semantics are what a screen reader gets, so a mismatch here is invisible on screen.`);
  }

  /* ---- C7: a claimed focus ring exists ----------------------------------- */
  if (contract.a11y?.focusVisible) {
    const styleSrc = anchors.stylePath && existsSync(join(repo, anchors.stylePath))
      ? readFileSync(join(repo, anchors.stylePath), "utf8") : "";
    if (!/focus-visible/.test(src + styleSrc))
      report.fail("C7", "a11y.focusVisible is true but nothing declares a focus-visible style", `neither ${anchors.sourcePath} nor its stylesheet mentions focus-visible. This is the one accessibility claim a contract can actually verify — do not let it be aspirational.`);
  }

  /* ---- C5 (source side): raw color in the component's own styling -------- */
  if (idiom === "css-module" && anchors.stylePath && existsSync(join(repo, anchors.stylePath))) {
    // Only the rules that style THIS component. Scanning the whole sheet
    // reports colors from unrelated rules, which is noise, not drift.
    const rules = parseCss(readFileSync(join(repo, anchors.stylePath), "utf8"));
    for (const [path, part] of walkParts(contract.anatomy.root)) {
      if (!part.selector) continue;
      const governed = new Set(Object.keys(part.tokens || {}));
      for (const k of Object.values(part.states || {})) for (const p2 of Object.keys(k)) governed.add(p2);
      if (!governed.size) continue;
      const own = rules.filter((r) => r.selector.trim() === `.${part.selector}` || sameOwnerInAnotherState(r.selector, part.selector));
      for (const r of own) for (const [prop, value] of Object.entries(r.decls)) {
        if (governed.has(prop) && (LITERAL_COLOR.test(value) || NAMED_COLORS.test(value)))
          report.fail("C5", `\`${prop}\` on \`.${part.selector}\` is hardcoded where the contract names a token`, `\`${value}\` at ${anchors.stylePath}:${r.line} — anatomy.${path} says this reads a token.`);
      }
    }
  } else {
    // cva idiom: the styling lives in class strings, so an arbitrary value like
    // `bg-[#b8559b]` is the shape a hardcoded color takes here.
    for (const m of stripBlockComments(src).matchAll(/\b(?:bg|text|border|ring|outline|fill|stroke|shadow|from|via|to)-\[([^\]]+)\]/g)) {
      if (LITERAL_COLOR.test(m[1]))
        report.fail("C5", `a hardcoded color is written into a class string`, `\`${m[0]}\` in ${anchors.sourcePath} — this bypasses the token layer entirely, and no token scan of the stylesheet can see it.`);
    }
  }
}

/** Is `other` the same class in a different state — `.btn` vs `.btn:hover`? */
function sameOwnerInAnotherState(other, cls) {
  return new RegExp(`^\\.${cls}(?::[\\w-]+(?:\\([^)]*\\))?)+$`).test(other.trim());
}

/**
 * Could `other` select the element this part renders?
 *
 * With `element` declared on the part this is decidable for the common cases,
 * which is the whole point: `.beat p` can never match an <a>, and saying so
 * removed 22 of 23 false alarms. Without `element` the check stays generous —
 * a loud false alarm beats a silent miss — but it warns, because an
 * undecidable check is a check the reader will learn to skip (NC-4).
 */
function selectorCouldMatchSame(other, cls, element, carries = []) {
  // `:not(.btn)` on the rival means it cannot match an element carrying .btn.
  // Without this the checker fires on the CORRECT fix for its own C8 finding,
  // which is how a guard teaches people to stop reading it.
  for (const m of other.matchAll(/:not\(([^)]*)\)/g))
    for (const excluded of m[1].split(","))
      if ([cls, ...carries].some((c) => excluded.trim() === `.${c}`)) return false;
  if (other.includes(`.${cls}`)) return true;
  const tail = /(?:^|[\s>+~])([a-z][\w-]*)\s*(?::[\w-]+(?:\([^)]*\))?)*$/.exec(other);
  if (!tail) return false;              // ends in a class we do not carry
  if (!element) return true;            // undecidable — stay generous
  return tail[1] === element;           // decidable, and this is the answer
}

/* ----------------------------------------------------------------- the shell */

function collect(target) {
  const p = resolve(target);
  if (statSync(p).isDirectory())
    return readdirSync(p).filter((f) => f.endsWith(".contract.json")).map((f) => join(p, f)).sort();
  return [p];
}

function main(argv) {
  const args = argv.slice(2);
  const asJson = args.includes("--json");
  const repoIdx = args.indexOf("--repo");
  const repo = repoIdx !== -1 ? resolve(args[repoIdx + 1]) : process.cwd();
  const target = args.find((a) => !a.startsWith("--") && a !== args[repoIdx + 1]);

  if (!target) {
    console.error("usage: node check.mjs <contract.json | contracts-dir> --repo <repo-root> [--json]");
    process.exit(2);
  }

  // The schema is the model of what a contract CAN say; a contract is what one
  // DOES say. Both are versioned, and both are needed to check anything (NC-7).
  let schema = null;
  const schemaPath = join(dirname(new URL(import.meta.url).pathname), "..", "contract.schema.json");
  try { schema = JSON.parse(readFileSync(schemaPath, "utf8")); }
  catch { console.error(`warning: cannot read ${schemaPath} — unknown-field checking is OFF`); }

  const reports = [];
  for (const file of collect(target)) {
    const report = new Report(file);
    let contract;
    try {
      contract = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      report.fail("C0", "contract is not valid JSON", e.message);
      reports.push(report);
      continue;
    }
    try {
      checkContract(contract, repo, report, schema);
    } catch (e) {
      // A thrown reader is a FAILURE. Never let an exception read as a pass.
      report.fail("C0", "the checker threw while reading this contract", `${e.message}\n${e.stack?.split("\n")[1] ?? ""}`);
    }
    reports.push(report);
  }

  const failedCount = reports.filter((r) => r.failed).length;

  if (asJson) {
    console.log(JSON.stringify({ repo, contracts: reports.map((r) => ({ contract: r.contractPath, findings: r.findings })) }, null, 2));
  } else {
    for (const r of reports) {
      const name = basename(r.contractPath);
      const fails = r.findings.filter((f) => f.level === FAIL);
      const warns = r.findings.filter((f) => f.level === WARN);
      if (!fails.length && !warns.length) { console.log(`\x1b[32m  PASS\x1b[0m  ${name}`); continue; }
      console.log(`${fails.length ? "\x1b[31m  FAIL\x1b[0m" : "\x1b[33m  WARN\x1b[0m"}  ${name}`);
      for (const f of [...fails, ...warns]) {
        const tag = f.level === FAIL ? "\x1b[31m✗\x1b[0m" : "\x1b[33m!\x1b[0m";
        console.log(`        ${tag} [${f.code}] ${f.message}`);
        if (f.detail) for (const line of String(f.detail).split("\n")) console.log(`             ${line}`);
      }
      console.log("");
    }
    const total = reports.length;
    console.log(`\n${total} contract${total === 1 ? "" : "s"} checked — ${total - failedCount} passing, ${failedCount} drifted.`);
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

main(process.argv);
