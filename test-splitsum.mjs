// Test the split-sum evaluate and induction proof
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const BASE = "http://localhost:3000/api/trpc";

async function callTRPC(procedure, input) {
  const url = `${BASE}/${procedure}?batch=1`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const json = await res.json();
  const item = Array.isArray(json) ? json[0] : json;
  if (item.error) throw new Error(JSON.stringify(item.error));
  return item.result?.data?.json ?? item.result?.data;
}

console.log("=== Test 1: Split-sum S(3,10) for r, using F(n) = n(n+1)/2 ===");
const r1 = await callTRPC("series.evaluate", {
  lower: 3,
  upper: 10,
  term: "r",
  simplifiedLatex: "\\frac{n(n+1)}{2}",
  part1Lower: "1",
  part1Upper: "n",
  lang: "en",
});
// Expected: sum r=3..10 = 3+4+5+6+7+8+9+10 = 52
console.log("Method:", r1.method);
console.log("Numeric value:", r1.decimalValue, "(expected 52)");
console.log("Exact LaTeX:", r1.exactLatex);
console.log("Steps:", r1.stepsLatex);
console.log();

console.log("=== Test 2: Direct substitution S(1,10) for r ===");
const r2 = await callTRPC("series.evaluate", {
  lower: 1,
  upper: 10,
  term: "r",
  simplifiedLatex: "\\frac{n(n+1)}{2}",
  part1Lower: "1",
  part1Upper: "n",
  lang: "en",
});
console.log("Method:", r2.method);
console.log("Numeric value:", r2.decimalValue, "(expected 55)");
console.log("Exact LaTeX:", r2.exactLatex);
console.log();

console.log("=== Test 3: Split-sum S(5,20) for r^2 ===");
const r3 = await callTRPC("series.evaluate", {
  lower: 5,
  upper: 20,
  term: "r^2",
  simplifiedLatex: "\\frac{n(n+1)(2n+1)}{6}",
  part1Lower: "1",
  part1Upper: "n",
  lang: "en",
});
// Expected: sum r^2 from 5..20 = sum 1..20 - sum 1..4 = 2870 - 30 = 2840
let expected3 = 0;
for (let r = 5; r <= 20; r++) expected3 += r * r;
console.log("Method:", r3.method);
console.log("Numeric value:", r3.decimalValue, `(expected ${expected3})`);
console.log("Exact LaTeX:", r3.exactLatex);
console.log();
