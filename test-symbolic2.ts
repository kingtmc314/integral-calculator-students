// Direct router test for symbolic bounds
import { appRouter } from "./server/routers";

const caller = appRouter.createCaller({ user: null });

async function main() {
  console.log("=== Test 1: r^2 from 6 to 10 using Part 1 (n+1 to 2n) ===");
  const r1 = await caller.series.evaluate({
    lower: 6,
    upper: 10,
    term: "r^2",
    simplifiedLatex: "\\frac{n(2n+1)(7n+1)}{6}",
    part1Lower: "n+1",
    part1Upper: "2n",
    lang: "en",
  });
  console.log("Method:", r1.method);
  console.log("Exact:", r1.exactLatex);
  console.log("Decimal:", r1.decimalValue);
  console.log("Has aligned:", r1.stepsLatex[0]?.includes("begin{aligned}"));
  console.log("Steps[0] preview:", r1.stepsLatex[0]?.substring(0, 200));
  console.log("Expected: 330");
  console.log("");

  console.log("=== Test 2: r^2 from 17 to 50 using Part 1 (1 to n) ===");
  const r2 = await caller.series.evaluate({
    lower: 17,
    upper: 50,
    term: "r^2",
    simplifiedLatex: "\\frac{n(n+1)(2n+1)}{6}",
    part1Lower: "1",
    part1Upper: "n",
    lang: "en",
  });
  console.log("Method:", r2.method);
  console.log("Exact:", r2.exactLatex);
  console.log("Decimal:", r2.decimalValue);
  console.log("Has aligned:", r2.stepsLatex[0]?.includes("begin{aligned}"));
  console.log("Steps[0] preview:", r2.stepsLatex[0]?.substring(0, 200));
  console.log("Expected: 41429");
}

main().catch(console.error);
