// Guards the embed's inline browser script, which cannot be typechecked.
//
// Two failure modes have shipped from this file before:
//   1. Backslashes eaten by the template literal, so /\.?0+$/ reached the
//      browser as /.?0+$/ and truncated every fractional axis label.
//   2. lib/chartSvg.ts and the inline script are independent copies of the
//      same renderer, so a fix applied to one silently missed the other.
//
// This evaluates the script exactly as the route serves it and checks both.
// Run with `npm run verify:embed` (also runs on `npm run build`).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "app/embed/route.ts"), "utf8");

const failures = [];
const fail = (msg) => failures.push(msg);

// --- Extract the script the way the browser receives it -------------------
const declaration = "const CHART_SCRIPT = String.raw`";
const start = source.indexOf(declaration);
if (start === -1) {
  console.error(
    "verify-embed FAILED\n\n  * CHART_SCRIPT is no longer declared with " +
      "String.raw. A plain template literal eats lone backslashes " +
      "(\\. \\d \\s \\w), silently corrupting any regex in the embedded " +
      "script. Restore String.raw.\n",
  );
  process.exit(1);
}

const bodyStart = start + declaration.length;
const bodyEnd = source.indexOf("\n`;", bodyStart);
const raw = source.slice(bodyStart, bodyEnd);

// String.raw only differs from a plain literal in its handling of backslashes,
// and the body has no ${} interpolation, so the raw slice is what ships.
if (raw.includes("${")) {
  fail("CHART_SCRIPT contains ${} interpolation; this check assumes it does not.");
}

// --- 1. No regex escape may have been swallowed ---------------------------
for (const [, seq] of raw.matchAll(/\\(.)/g)) {
  if (seq === "\\") {
    fail(
      "CHART_SCRIPT contains a doubled backslash (\\\\). Under String.raw that " +
        "reaches the browser as a literal backslash, which is almost never " +
        "intended in a regex. Write \\. not \\\\. inside this literal.",
    );
    break;
  }
}

// --- 2. The shipped formatter must behave ---------------------------------
const fmtSource = raw.match(/function fmt\(v\)\{[\s\S]*?\n {2}\}/);
if (!fmtSource) fail("Could not locate fmt() in CHART_SCRIPT.");

const shippedFmt = fmtSource && new Function(`${fmtSource[0]}; return fmt;`)();

// The oracle: same contract as fmtTick() in lib/chartSvg.ts.
const cases = [
  [0, "0"], [1, "1"], [3, "3"], [10, "10"], [100, "100"],
  [0.2, "0.2"], [0.4, "0.4"], [0.6, "0.6"], [0.8, "0.8"],
  [0.15, "0.15"], [0.05, "0.05"], [1.5, "1.5"], [2.25, "2.25"],
  [0.002, "0.002"], [0.0002, "0.0002"], [0.0015, "0.0015"],
  [-0.25, "-0.25"], [-0.0002, "-0.0002"],
  [500, "500"], [1000, "1k"], [1500, "1.5k"], [2500, "2.5k"],
  [-1234, "-1.23k"], [1000000, "1M"], [1200000, "1.2M"],
];

if (shippedFmt) {
  for (const [input, expected] of cases) {
    const actual = shippedFmt(input);
    if (actual !== expected) {
      fail(`fmt(${input}) shipped as "${actual}", expected "${expected}"`);
    }
  }
}

// --- 3. The two renderers must agree --------------------------------------
// lib/chartSvg.ts is real TypeScript with real regex literals, so it is the
// reference. Lift its fmtTick() out and diff the two over a wide range.
const chartSvg = readFileSync(join(root, "lib/chartSvg.ts"), "utf8");
const tickSource = chartSvg.match(/function fmtTick\(v: number\): string \{[\s\S]*?\n\}/);
if (!tickSource) {
  fail("Could not locate fmtTick() in lib/chartSvg.ts.");
} else if (shippedFmt) {
  const js = tickSource[0].replace(/: number/g, "").replace(/\): string/g, ")");
  const referenceFmt = new Function(`${js}; return fmtTick;`)();
  const probes = [];
  for (let e = -6; e <= 7; e++) {
    for (const m of [1, 1.5, 2, 2.5, 3.33, 5, 7.5, 9.99]) {
      probes.push(m * 10 ** e, -m * 10 ** e);
    }
  }
  const drift = probes.filter((v) => shippedFmt(v) !== referenceFmt(v));
  if (drift.length) {
    const shown = drift.slice(0, 5)
      .map((v) => `  ${v}: embed "${shippedFmt(v)}" vs chartSvg "${referenceFmt(v)}"`)
      .join("\n");
    fail(
      `embed fmt() and lib/chartSvg.ts fmtTick() disagree on ${drift.length} ` +
        `of ${probes.length} values:\n${shown}`,
    );
  }
}

if (failures.length) {
  console.error("verify-embed FAILED\n");
  for (const f of failures) console.error("  * " + f + "\n");
  process.exit(1);
}
console.log("verify-embed passed (escapes intact, fmt correct, renderers agree)");
