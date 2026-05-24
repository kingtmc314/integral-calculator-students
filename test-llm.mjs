// Quick test to see what the LLM actually returns
import { config } from "dotenv";
config();

const API_URL = process.env.BUILT_IN_FORGE_API_URL;
const API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!API_URL || !API_KEY) {
  console.error("Missing env vars:", { API_URL: !!API_URL, API_KEY: !!API_KEY });
  process.exit(1);
}

const response = await fetch(`${API_URL}/v1/chat/completions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a math expert. Output ONLY valid JSON, no markdown fences.",
      },
      {
        role: "user",
        content: `Compute the exact closed-form of sum from r=1 to r=n of r.
Return JSON: {"sumLatex":"...","closedFormLatex":"...","simplifiedLatex":"...","seriesType":"linear","isValid":true,"sampleValues":[1,3,6,10,15]}`,
      },
    ],
    response_format: { type: "json_object" },
  }),
});

const data = await response.json();
console.log("Status:", response.status);
console.log("Response:", JSON.stringify(data, null, 2));
console.log("\nContent type:", typeof data.choices?.[0]?.message?.content);
console.log("Content:", data.choices?.[0]?.message?.content);
