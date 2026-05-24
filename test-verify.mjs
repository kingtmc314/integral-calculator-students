// Verify correctness of specific series results
import { config } from "dotenv";
config();

import { appRouter } from "./server/routers.ts";

const ctx = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {} }
};
const caller = appRouter.createCaller(ctx);

// Verify 1/(r*(r+2)) — should be (3/4)(1 - 1/(n+1) - 1/(n+2)) = n(3n+5)/(4(n+1)(n+2))
// At n=1: 1/(1*3) = 1/3 ≈ 0.333 ✓
// At n=2: 1/3 + 1/(2*4) = 1/3 + 1/8 = 11/24 ≈ 0.458... wait let me check
// Actually: 1/(r*(r+2)) = (1/2)(1/r - 1/(r+2))
// Telescoping: (1/2)(1 + 1/2 - 1/(n+1) - 1/(n+2)) = (1/2)(3/2 - 1/(n+1) - 1/(n+2))
// = 3/4 - 1/(2(n+1)) - 1/(2(n+2))
// At n=1: 3/4 - 1/4 - 1/6 = 9/12 - 3/12 - 2/12 = 4/12 = 1/3 ✓
// At n=2: 3/4 - 1/6 - 1/8 = 18/24 - 4/24 - 3/24 = 11/24 ≈ 0.458... but LLM said 0.5?

// Let me verify manually
function verify1overRTimesRPlus2(n) {
  let sum = 0;
  for (let r = 1; r <= n; r++) {
    sum += 1 / (r * (r + 2));
  }
  return sum;
}

console.log("Manual verification of sum 1/(r*(r+2)) for n=1..5:");
for (let n = 1; n <= 5; n++) {
  console.log(`  n=${n}: ${verify1overRTimesRPlus2(n)}`);
}

// Verify r*(r+1)
function verifyRTimesRPlus1(n) {
  let sum = 0;
  for (let r = 1; r <= n; r++) {
    sum += r * (r + 1);
  }
  return sum;
}
console.log("\nManual verification of sum r*(r+1) for n=1..5:");
for (let n = 1; n <= 5; n++) {
  console.log(`  n=${n}: ${verifyRTimesRPlus1(n)}`);
}
// Formula: n(n+1)(n+2)/3
console.log("Formula n(n+1)(n+2)/3 for n=1..5:");
for (let n = 1; n <= 5; n++) {
  console.log(`  n=${n}: ${n*(n+1)*(n+2)/3}`);
}

// Verify 3^r (geometric, r=1 to n)
function verify3r(n) {
  let sum = 0;
  for (let r = 1; r <= n; r++) {
    sum += Math.pow(3, r);
  }
  return sum;
}
console.log("\nManual verification of sum 3^r for n=1..5:");
for (let n = 1; n <= 5; n++) {
  console.log(`  n=${n}: ${verify3r(n)}`);
}
// Formula: 3(3^n - 1)/2
console.log("Formula 3(3^n-1)/2 for n=1..5:");
for (let n = 1; n <= 5; n++) {
  console.log(`  n=${n}: ${3*(Math.pow(3,n)-1)/2}`);
}
