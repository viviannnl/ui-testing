#!/usr/bin/env node
// coverage-report.mjs — merge per-test V8 JS coverage written by fixtures.ts
// into one report per app script: % of functions and % of code executed by
// the whole suite, plus every function and code span no test ever ran.
//
// Usage (from the e2e/ directory):
//   rm -rf .coverage && npx playwright test && node coverage-report.mjs [--min=95]
//
// --min=N  exit 1 if function coverage of any script is below N% (CI gate).
// Exit codes: 0 ok, 1 below --min, 2 no coverage data.
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.cwd(), ".coverage");
const minArg = process.argv.find((a) => a.startsWith("--min="));
const MIN = minArg ? Number(minArg.slice(6)) : null;
const MAX_SPOTS = 40; // keep the listing readable; the count is always printed

const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
if (!files.length) {
  console.error(`❌ No coverage in ${dir}. Run the suite first (fixtures.ts writes it).`);
  process.exit(2);
}

const scripts = new Map(); // url -> { source, covered: Uint8Array, fns: Map }
for (const f of files) {
  for (const entry of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) {
    if (!entry.source) continue;
    let s = scripts.get(entry.url);
    if (!s) scripts.set(entry.url, (s = { source: entry.source, covered: new Uint8Array(entry.source.length), fns: new Map() }));
    // V8 lists ranges outer → inner; applying in order lets nested zero-count
    // blocks override the count of the function that contains them.
    const counts = new Int32Array(entry.source.length).fill(-1);
    for (const fn of entry.functions) {
      for (const r of fn.ranges) counts.fill(r.count, r.startOffset, r.endOffset);
      const top = fn.ranges[0];
      if (!fn.functionName && top.startOffset === 0) continue; // the script body itself
      const key = `${top.startOffset}-${top.endOffset}`;
      const cur = s.fns.get(key) ?? { name: fn.functionName || "(anonymous)", start: top.startOffset, hit: false };
      cur.hit ||= top.count > 0;
      s.fns.set(key, cur);
    }
    for (let i = 0; i < counts.length; i++) if (counts[i] > 0) s.covered[i] = 1;
  }
}

let belowMin = false;
for (const [url, { source, covered, fns }] of scripts) {
  const lineOf = (o) => source.slice(0, o).split("\n").length;
  // Count only code characters: skip whitespace and comment-only lines.
  const code = new Uint8Array(source.length);
  let inBlock = false;
  source.split("\n").reduce((off, line) => {
    const t = line.trim();
    const comment = inBlock || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*");
    if (t.includes("/*") && !t.includes("*/")) inBlock = true;
    else if (t.includes("*/")) inBlock = false;
    if (t && !comment) for (let i = 0; i < line.length; i++) if (line[i] !== " ") code[off + i] = 1;
    return off + line.length + 1;
  }, 0);

  let total = 0, hit = 0;
  for (let i = 0; i < source.length; i++) if (code[i]) { total++; if (covered[i]) hit++; }
  const list = [...fns.values()].sort((a, b) => a.start - b.start);
  const missed = list.filter((f) => !f.hit);
  const fnPct = list.length ? (1 - missed.length / list.length) * 100 : 100;

  const spots = [];
  for (let i = 0; i < source.length; ) {
    if (code[i] && !covered[i]) {
      let j = i;
      while (j < source.length && (!code[j] || !covered[j])) j++;
      const text = source.slice(i, j).trim().replace(/\s+/g, " ");
      if (text.length > 12) spots.push({ line: lineOf(i), text: text.slice(0, 90) }); // skip stray tokens like "}"
      i = j;
    } else i++;
  }

  const ok = MIN == null || fnPct >= MIN;
  belowMin ||= !ok;
  console.log(`\n${ok ? "✅" : "❌"} ${new URL(url).pathname}  (${files.length} test runs)`);
  console.log(`   functions: ${list.length - missed.length}/${list.length} (${fnPct.toFixed(1)}%)${MIN != null ? `  min ${MIN}%` : ""}`);
  console.log(`   code:      ${total ? ((hit / total) * 100).toFixed(1) : "100.0"}% of non-comment characters executed`);
  if (missed.length) {
    console.log("   functions never run:");
    for (const f of missed) console.log(`     line ${String(lineOf(f.start)).padStart(4)}  ${f.name}`);
  }
  if (spots.length) {
    console.log(`   unexecuted code (${spots.length} spots):`);
    for (const s of spots.slice(0, MAX_SPOTS)) console.log(`     line ${String(s.line).padStart(4)}  ${s.text}`);
    if (spots.length > MAX_SPOTS) console.log(`     … ${spots.length - MAX_SPOTS} more`);
  }
}
console.log(belowMin ? "\n❌ Coverage below --min." : "\nEach uncovered item: write the test, or note why it can't happen.");
process.exit(belowMin ? 1 : 0);
