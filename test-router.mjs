import { config } from "dotenv";
config();

import { appRouter } from "./server/routers.ts";

const ctx = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: { clearCookie: () => {} }
};

const caller = appRouter.createCaller(ctx);

async function testCompute(term, lower = "1", upper = "n") {
  console.log(`\n--- sum r=${lower} to ${upper} of (${term}) ---`);
  try {
    const r = await caller.series.compute({ lower, upper, term, lang: "en" });
    console.log("isValid:", r.isValid);
    console.log("seriesType:", r.seriesType);
    console.log("simplified:", r.simplifiedLatex);
    console.log("sampleValues:", r.sampleValues);
    if (!r.isValid) console.log("errorMsg:", r.errorMsg);
  } catch(e) {
    console.error("ERROR:", e.message);
    if (e.cause) console.error("CAUSE:", e.cause);
  }
}

async function testEvaluate(term, lower, upper, simplifiedLatex) {
  console.log(`\n--- evaluate r=${lower} to ${upper} of (${term}) ---`);
  try {
    const r = await caller.series.evaluate({ lower, upper, term, simplifiedLatex, lang: "en" });
    console.log("exactLatex:", r.exactLatex);
    console.log("decimalValue:", r.decimalValue);
    console.log("usedClosedForm:", r.usedClosedForm);
  } catch(e) {
    console.error("ERROR:", e.message);
    if (e.cause) console.error("CAUSE:", e.cause);
  }
}

await testCompute("r");
await testCompute("r^2");
await testCompute("r^3");
await testCompute("1/(r*(r+1))");
await testCompute("2^r", "0", "n-1");
await testCompute("r*(r+1)");
await testCompute("1/((2*r-1)*(2*r+1))");
await testCompute("r", "1", "2n");
await testCompute("3^r");
await testCompute("1/(r*(r+2))");

await testEvaluate("r", 1, 10, "\\frac{n(n+1)}{2}");
await testEvaluate("r^2", 1, 5, "\\frac{n(n+1)(2n+1)}{6}");
