import { config } from "dotenv";
config();

const API_URL = process.env.BUILT_IN_FORGE_API_URL;
const API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

async function testSeries(term, lower = "1", upper = "n") {
  console.log(`\n=== Testing: sum from r=${lower} to ${upper} of (${term}) ===`);
  const response = await fetch(`${API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: "You are a math expert. Output ONLY valid JSON, no markdown fences." },
        { role: "user", content: `Compute the exact closed-form of sum from r=${lower} to r=${upper} of (${term}).
Return JSON with exactly these fields: sumLatex (string), closedFormLatex (string), simplifiedLatex (string), seriesType (string), isValid (boolean), sampleValues (array of 5 numbers for n=1..5).` }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2048,
    }),
  });
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  try {
    const parsed = JSON.parse(content);
    console.log("isValid:", parsed.isValid);
    console.log("seriesType:", parsed.seriesType);
    console.log("simplifiedLatex:", parsed.simplifiedLatex);
    console.log("sampleValues:", parsed.sampleValues);
    // Check all required fields
    const required = ["sumLatex","closedFormLatex","simplifiedLatex","seriesType","isValid","sampleValues"];
    const missing = required.filter(k => !(k in parsed));
    if (missing.length) console.log("MISSING FIELDS:", missing);
    else console.log("✓ All required fields present");
  } catch(e) {
    console.error("Parse error:", e.message, "\nContent:", content?.substring(0, 200));
  }
}

await testSeries("r");
await testSeries("r^2");
await testSeries("1/(r*(r+1))");
await testSeries("2^r", "0", "n-1");
await testSeries("r/(r+1)");
await testSeries("1/((2*r-1)*(2*r+1))");
