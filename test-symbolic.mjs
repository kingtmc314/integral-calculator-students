// Test: Part 3 evaluate with symbolic Part 1 bounds (n+1 to 2n)
// and verify the aligned block is returned

const BASE = "http://localhost:3000/api/trpc";

async function callTRPC(procedure, input) {
  const url = `${BASE}/${procedure}`;
  const body = JSON.stringify({ json: input });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result?.data?.json ?? json.result?.data;
}

async function main() {
  console.log("=== Test 1: Evaluate r^2 from 6 to 10 using Part 1 (n+1 to 2n) ===");
  // Part 1 closed form for sum r^2 from n+1 to 2n = n(2n+1)(7n+1)/6
  // For r=6 to 10: n+1=6, 2n=10 → n=5
  // F(5) = 5*11*36/6 = 330
  const result1 = await callTRPC("series.evaluate", {
    lower: 6,
    upper: 10,
    term: "r^2",
    simplifiedLatex: "\\frac{n(2n+1)(7n+1)}{6}",
    part1Lower: "n+1",
    part1Upper: "2n",
    lang: "en",
  });
  console.log("Method:", result1.method);
  console.log("Exact:", result1.exactLatex);
  console.log("Decimal:", result1.decimalValue);
  console.log("Steps count:", result1.stepsLatex.length);
  console.log("Has aligned:", result1.stepsLatex[0]?.includes("\\begin{aligned}"));
  console.log("Expected: 330");
  console.log("");

  console.log("=== Test 2: Evaluate r from 17 to 50 using Part 1 (1 to n) ===");
  // Part 1: sum r from 1 to n = n(n+1)/2
  // S(17,50) = F(50) - F(16) = 50*51/2 - 16*17/2 = 1275 - 136 = 1139
  const result2 = await callTRPC("series.evaluate", {
    lower: 17,
    upper: 50,
    term: "r",
    simplifiedLatex: "\\frac{n(n+1)}{2}",
    part1Lower: "1",
    part1Upper: "n",
    lang: "en",
  });
  console.log("Method:", result2.method);
  console.log("Exact:", result2.exactLatex);
  console.log("Decimal:", result2.decimalValue);
  console.log("Steps count:", result2.stepsLatex.length);
  console.log("Has aligned:", result2.stepsLatex[0]?.includes("\\begin{aligned}"));
  console.log("Expected: 1139");
  console.log("");

  console.log("=== Test 3: Evaluate r^2 from 17 to 50 using Part 1 (1 to n) ===");
  // Part 1: sum r^2 from 1 to n = n(n+1)(2n+1)/6
  // S(17,50) = F(50) - F(16) = 50*51*101/6 - 16*17*33/6 = 42925 - 1496 = 41429
  const result3 = await callTRPC("series.evaluate", {
    lower: 17,
    upper: 50,
    term: "r^2",
    simplifiedLatex: "\\frac{n(n+1)(2n+1)}{6}",
    part1Lower: "1",
    part1Upper: "n",
    lang: "en",
  });
  console.log("Method:", result3.method);
  console.log("Exact:", result3.exactLatex);
  console.log("Decimal:", result3.decimalValue);
  console.log("Steps count:", result3.stepsLatex.length);
  console.log("Has aligned:", result3.stepsLatex[0]?.includes("\\begin{aligned}"));
  console.log("Expected: 41429");
}

main().catch(console.error);
