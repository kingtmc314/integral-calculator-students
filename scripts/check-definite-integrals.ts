import { calculateDefiniteIntegral } from "../client/src/lib/integralEngine";

const cases = [
  { expression: "x^2", lower: "0", upper: "2", expected: "ok" },
  { expression: "sin(x)", lower: "0", upper: "pi", expected: "ok" },
  { expression: "cos(2*x)", lower: "0", upper: "pi/4", expected: "ok" },
  { expression: "sec(x)^2", lower: "0", upper: "pi/4", expected: "ok" },
  { expression: "2^x", lower: "0", upper: "3", expected: "ok" },
  { expression: "log(x,2)", lower: "1", upper: "2", expected: "ok" },
  { expression: "θ*sin(θ)", lower: "0", upper: "pi", expected: "ok" },
];

let failed = 0;
for (const item of cases) {
  const result = calculateDefiniteIntegral(item.expression, item.lower, item.upper);
  const line = `${item.expression} [${item.lower}, ${item.upper}] -> ${result.status} :: ${result.valueExpr ?? result.hintEn}`;
  console.log(line);
  if (result.status !== item.expected) failed += 1;
  if (result.status === "ok" && !result.valueLatex) failed += 1;
}

if (failed > 0) {
  console.error(`Failed definite integral checks: ${failed}`);
  process.exit(1);
}

console.log("All definite integral checks passed.");
