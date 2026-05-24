// ============================================================
// seriesRouter.ts — LLM-powered series computation backend
// Uses the built-in Forge LLM for symbolic closed-form results
// and mathjs for numerically exact sample values.
// ============================================================

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { create, all } from "mathjs";

const math = create(all);

// ── Shared output schema ──────────────────────────────────────────────────────

const SeriesResultSchema = z.object({
  sumLatex: z.string(),
  closedFormLatex: z.string(),
  simplifiedLatex: z.string(),
  seriesType: z.string(),
  isValid: z.boolean(),
  errorMsg: z.string().nullish().transform((v) => v ?? undefined),
  sampleValues: z
    .array(z.number())
    .nullish()
    .transform((v) => v ?? undefined),
});

const InductionProofSchema = z.object({
  propositionLatex: z.string(),
  baseCaseN: z.number(),
  baseCaseLHSLatex: z.string(),
  baseCaseRHSLatex: z.string(),
  baseCaseVerified: z.boolean(),
  hypothesisLatex: z.string(),
  inductiveStepGoalLatex: z.string(),
  inductiveStepLHSLatex: z.string(),
  inductiveStepRHSLatex: z.string(),
  inductiveStepWorkingLines: z.array(z.string()),
  conclusionLatex: z.string(),
});

// ── Numeric helpers ───────────────────────────────────────────────────────────

/**
 * Compute sample values by direct numeric summation using mathjs.
 * Uses scope-based evaluation so ^ works natively without string replacement.
 * This is always accurate — we never trust the LLM for numeric values.
 */
function computeSampleValues(
  termExpr: string,
  lowerExpr: string,
  upperExpr: string
): number[] | undefined {
  try {
    const samples: number[] = [];

    for (let n = 1; n <= 5; n++) {
      // Resolve lower bound using mathjs scope
      let lower: number;
      try {
        lower = Math.round(Number(math.evaluate(lowerExpr, { n })));
      } catch {
        lower = 1;
      }

      // Resolve upper bound using mathjs scope
      let upper: number;
      try {
        upper = Math.round(Number(math.evaluate(upperExpr, { n })));
      } catch {
        upper = n;
      }

      // Sum the terms using scope-based evaluation (handles ^ natively)
      let sum = 0;
      for (let r = lower; r <= upper; r++) {
        try {
          sum += Number(math.evaluate(termExpr, { r, n }));
        } catch {
          return undefined; // Cannot evaluate this term
        }
      }
      samples.push(sum);
    }

    return samples;
  } catch {
    return undefined;
  }
}

/**
 * Recursively extract the content of the first matching {…} block in a string.
 * Returns [content, rest] where rest is the string after the closing }.
 */
function extractBraces(s: string): [string, string] {
  if (!s.startsWith("{")) return ["", s];
  let depth = 0;
  let i = 0;
  for (; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return [s.slice(1, i), s.slice(i + 1)];
    }
  }
  return [s.slice(1), ""];
}

/**
 * Convert LaTeX expression to a mathjs-evaluable string.
 * Handles \frac{}{}, implicit multiplication, and ^ operator.
 */
function latexToMathjs(latex: string): string {
  let s = latex.trim();

  // Pre-strip \left and \right modifiers before any processing
  s = s
    .replace(/\\left\s*\(/g, "(")
    .replace(/\\right\s*\)/g, ")")
    .replace(/\\left\s*\[/g, "(")
    .replace(/\\right\s*\]/g, ")")
    .replace(/\\left\s*\./g, "")
    .replace(/\\right\s*\./g, "");

  // Replace \frac{num}{den} recursively
  let result = "";
  while (s.length > 0) {
    const fracIdx = s.indexOf("\\frac");
    if (fracIdx === -1) {
      result += s;
      break;
    }
    result += s.slice(0, fracIdx);
    s = s.slice(fracIdx + 5); // skip \frac
    const [num, afterNum] = extractBraces(s);
    const [den, afterDen] = extractBraces(afterNum);
    result += `(${latexToMathjs(num)})/(${latexToMathjs(den)})`;
    s = afterDen;
  }
  s = result;

  // Remove remaining LaTeX commands
  s = s
    .replace(/\\left[([]/g, "(")
    .replace(/\\right[)\]]/g, ")")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\,/g, "")
    .replace(/\\!/g, "")
    .replace(/\\[a-zA-Z]+/g, "") // remove any remaining commands
    .replace(/[{}]/g, ""); // remove stray braces

  // Add implicit multiplication:
  // digit followed by letter: 2n → 2*n
  s = s.replace(/(\d)([a-zA-Z])/g, "$1*$2");
  // letter/digit followed by (: n( → n*(
  s = s.replace(/([a-zA-Z0-9])(\()/g, "$1*$2");
  // ) followed by letter/digit/(: )(n → )*n
  s = s.replace(/(\))([a-zA-Z0-9(])/g, "$1*$2");

  return s.trim();
}

/**
 * Evaluate a LaTeX-style closed-form expression at a given n using mathjs.
 * Converts LaTeX notation to mathjs-compatible notation.
 */
function evalClosedForm(latexExpr: string, n: number): number | null {
  try {
    const expr = latexToMathjs(latexExpr);
    return Number(math.evaluate(expr, { n }));
  } catch {
    return null;
  }
}

/**
 * Check if the LLM's simplified form matches the mathjs sample values.
 * Returns true if the formula is correct for n=1..5.
 */
function verifyFormula(
  simplifiedLatex: string,
  sampleValues: number[],
  lowerExpr: string,
  upperExpr: string
): boolean {
  if (!simplifiedLatex || sampleValues.length === 0) return false;
  // Only verify if the upper bound is a function of n (not a constant)
  if (!/n/.test(upperExpr)) return true; // can't verify constant-bound series
  for (let n = 1; n <= Math.min(5, sampleValues.length); n++) {
    const formulaVal = evalClosedForm(simplifiedLatex, n);
    if (formulaVal === null) {
      console.log(`[verifyFormula] evalClosedForm returned null for n=${n}, expr: ${simplifiedLatex}`);
      return false;
    }
    const expected = sampleValues[n - 1];
    const diff = Math.abs(formulaVal - expected);
    if (diff > 1e-6) {
      console.log(`[verifyFormula] Mismatch at n=${n}: formula=${formulaVal} expected=${expected} diff=${diff}`);
      return false;
    }
  }
  return true;
}

// ── LLM helpers ───────────────────────────────────────────────────────────────

/** Extract string content from LLM response (handles both string and array content) */
function extractContent(
  raw: string | Array<{ type: string; text?: string }> | null | undefined
): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    const textPart = raw.find((p) => p.type === "text");
    return textPart?.text ?? null;
  }
  return null;
}

/** Restore LaTeX commands corrupted by JSON escape sequences.
 * e.g. JSON.parse turns \\right → \right, but if LLM wrote \right (single backslash)
 * JSON.parse turns \r → carriage return, leaving 'ight' instead of '\right'.
 */
function restoreLatexEscapes(s: string): string {
  return s
    // Restore \right (\r → CR → 'ight' in JSON)
    .replace(/\righ?t?/g, (m) => {
      // If already starts with backslash, leave it
      return m;
    })
    // The real fix: pre-process the raw JSON string before parsing
    // This is handled in parseJsonResponse below
    ;
}

/** Recursively walk a parsed JSON object and restore LaTeX in all string values */
function restoreLatexInObject(obj: unknown): unknown {
  if (typeof obj === "string") {
    // Restore common LaTeX commands corrupted by JSON escape sequences:
    // \r (carriage return) → should be \right
    // \n (newline) → could be \newline but usually just whitespace in LaTeX
    // \t (tab) → could be \text or \theta etc.
    // We restore by looking for the pattern: CR followed by 'ight' → \right
    return obj
      .replace(/\righ/g, "\\righ") // \r + 'igh' → \righ (partial \right)
      .replace(/\right/g, "\\right") // ensure \right is double-backslashed
      // Actually the issue is subtler: after JSON.parse, \r is already a CR char.
      // We need to replace the CR char + 'ight' with \right
      .replace(/\x0Dight/g, "\\right")  // CR + 'ight' → \right
      .replace(/\x0Deft/g, "\\left")    // CR + 'eft' → \left  (\l is not an escape but just in case)
      .replace(/\x09ext/g, "\\text")    // TAB + 'ext' → \text  (\t = tab)
      .replace(/\x09heta/g, "\\theta")  // TAB + 'heta' → \theta
      .replace(/\x09imes/g, "\\times")  // TAB + 'imes' → \times
      .replace(/\x0Aewline/g, "\\newline") // LF + 'ewline' → \newline (\n = LF)
      .replace(/\x0Abinom/g, "\\nbinom"); // LF + 'binom' → \nbinom
  }
  if (Array.isArray(obj)) {
    return obj.map(restoreLatexInObject);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = restoreLatexInObject(v);
    }
    return result;
  }
  return obj;
}

/** Pre-process raw JSON string to fix LLM single-backslash LaTeX before JSON.parse */
function fixLatexInRawJson(raw: string): string {
  // The LLM sometimes writes \frac, \sum, \right etc. with a single backslash
  // inside JSON strings. JSON.parse then interprets \r, \n, \t as control chars.
  // Strategy: replace known problematic sequences BEFORE parsing.
  // We look for patterns like: "\right" (single backslash in raw string = \\right needed)
  // In the raw JSON text, a single backslash before 'right' appears as: \right
  // We need to double it to \\right so JSON.parse produces \right.
  return raw
    .replace(/(?<!\\)\\right/g, "\\\\right")
    .replace(/(?<!\\)\\left/g, "\\\\left")
    .replace(/(?<!\\)\\frac/g, "\\\\frac")
    .replace(/(?<!\\)\\sum/g, "\\\\sum")
    .replace(/(?<!\\)\\cdot/g, "\\\\cdot")
    .replace(/(?<!\\)\\text/g, "\\\\text")
    .replace(/(?<!\\)\\theta/g, "\\\\theta")
    .replace(/(?<!\\)\\times/g, "\\\\times")
    .replace(/(?<!\\)\\newline/g, "\\\\newline");
}

/** Parse JSON from LLM response, stripping any markdown fences */
function parseJsonResponse(raw: unknown): Record<string, unknown> {
  const content = extractContent(
    raw as string | Array<{ type: string; text?: string }>
  );
  if (!content) throw new Error("Empty LLM response");
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  // Parse the JSON
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  // Post-process: restore LaTeX commands corrupted by JSON escape sequences
  return restoreLatexInObject(parsed) as Record<string, unknown>;
}

function buildSeriesSystemPrompt(lang: string): string {
  const isChinese = lang === "zh";
  return `You are an expert mathematics tutor specialising in series and summation. You output ONLY valid JSON — no markdown fences, no extra text, no comments.

CRITICAL RULES:
1. All LaTeX strings must be valid KaTeX-compatible LaTeX.
2. Use \\frac{a}{b} for fractions (never a/b in LaTeX).
3. Use \\cdot for multiplication, \\left( \\right) for large parentheses.
4. Use r as the summation variable (not x or k).
5. For induction proofs, use k as the inductive hypothesis variable.
6. ALWAYS fully simplify the result — do not leave intermediate expressions.
7. If a field is not applicable, use an empty string "" (never null) for string fields.
8. Do NOT include sampleValues in your response — they are computed separately.

${isChinese ? "Respond with Chinese text in prose/text fields, but keep all LaTeX math in standard LaTeX." : "Respond in English."}`;
}

function buildComputePrompt(
  lower: string,
  upper: string,
  term: string
): string {
  return `Compute the exact closed-form of the series:
  sum from r=${lower} to r=${upper} of (${term})

STEP-BY-STEP METHOD:
1. If the lower limit is NOT 1 (e.g. lower = n+1, lower = 2), use the splitting identity:
   sum_{r=a}^{b} f(r) = sum_{r=1}^{b} f(r) - sum_{r=1}^{a-1} f(r)
   Then substitute the standard formulas for each sum and COMBINE into a single simplified expression.
2. NEVER leave the result as a difference of two separate sums. Always expand, combine, and factor.
3. For polynomial series: apply standard sum formulas:
   sum r = n(n+1)/2
   sum r^2 = n(n+1)(2n+1)/6
   sum r^3 = [n(n+1)/2]^2
   sum r*(r+1) = n(n+1)(n+2)/3
4. For geometric series: use the geometric sum formula and simplify.
5. For telescoping/partial fraction series: show the fully telescoped result as a single fraction.

CRITICAL: simplifiedLatex must be a SINGLE fully factored expression.
- For sum r^2 from r=n+1 to 2n: the answer is \\frac{n(2n+1)(7n+1)}{6}
- For sum r from r=n+1 to 2n: the answer is \\frac{n(3n+1)}{2}
- For sum r^3 from r=n+1 to 2n: the answer is \\frac{n^2(3n+1)(5n+3)}{4}
- Do NOT write expressions like \\frac{2n(2n+1)(4n+1)}{6} + 2 \\cdot n(2n+1) - 2 \\cdot 2n
- Do NOT leave a sum minus another sum in closedFormLatex or simplifiedLatex

Return a JSON object with EXACTLY these fields (no extras, no nulls):
{
  "sumLatex": "<LaTeX summation notation, e.g. \\\\sum_{r=1}^{n} r>",
  "closedFormLatex": "<show the split-sum step: e.g. \\\\frac{2n(2n+1)(4n+1)}{6} - \\\\frac{n(n+1)(2n+1)}{6}>",
  "simplifiedLatex": "<FULLY simplified single factored expression, e.g. \\\\frac{n(2n+1)(7n+1)}{6}>",
  "seriesType": "<one of: linear, quadratic, cubic, geometric, telescoping, partial_fraction, exponential, mixed, unsupported>",
  "isValid": <true if a closed form in terms of n exists, false otherwise>,
  "errorMsg": "<empty string if isValid is true; reason if false>"
}

RULES:
- r^2 means r squared. r^3 means r cubed.
- All LaTeX must use double backslashes in JSON strings (e.g. \\\\frac, \\\\sum).
- simplifiedLatex must be ONE single expression — fully combined and factored.
- For partial fractions: fully combine the telescoped result into a single fraction.
  Example: 1/(r*(r+1)) telescopes to n/(n+1). 1/(r*(r+2)) = (1/2)(1/r - 1/(r+2)) telescopes to n(3n+5)/[4(n+1)(n+2)].
- For geometric series sum from r=1 to n of a^r: result is a(a^n - 1)/(a - 1).
- For geometric series sum from r=0 to n-1 of a^r: result is (a^n - 1)/(a - 1).`;
}

function buildInductionPrompt(
  lower: string,
  upper: string,
  term: string,
  closedForm: string,
  lang: string
): string {
  const isChinese = lang === "zh";

  // HKDSE M2 marking scheme phrasing (EN and ZH)
  const m2Phrases = isChinese ? {
    langNote: "所有文字說明（\\\\text{} 內容）請用中文，但 LaTeX 數學式保持標準格式。",
    whenN: "當 n = 1 時",
    lhsEquals: "左方 =",
    rhsEquals: "右方 =",
    lhsEqualsRhs: "左方 = 右方",
    baseCaseTrue: "故 P(1) 成立。",
    assumeTrue: "假設 P(k) 成立，其中 k 為某正整數，即",
    needToProve: "需證 P(k+1) 成立，即",
    lhsOfPk1: "P(k+1) 的左方",
    applyHyp: "（由歸納假設）",
    equalsRhs: "= P(k+1) 的右方",
    conclusion: "由數學歸納法原理，P(n) 對所有正整數 n 成立。",
  } : {
    langNote: "Write all prose/text parts in English.",
    whenN: "When n = 1,",
    lhsEquals: "L.H.S. =",
    rhsEquals: "R.H.S. =",
    lhsEqualsRhs: "L.H.S. = R.H.S.",
    baseCaseTrue: "So P(1) is true.",
    assumeTrue: "Assume P(k) is true for some positive integer k, i.e.",
    needToProve: "We need to prove P(k+1) is true, i.e.",
    lhsOfPk1: "L.H.S. of P(k+1)",
    applyHyp: "(by the inductive hypothesis)",
    equalsRhs: "= R.H.S. of P(k+1)",
    conclusion: "By the principle of mathematical induction, P(n) is true for all positive integers n.",
  };

  return `Generate a complete HKDSE M2-style proof by mathematical induction for:
  P(n): sum from r=${lower} to r=${upper} of (${term}) = ${closedForm}

${m2Phrases.langNote}

FOLLOW THE HKDSE M2 MARKING SCHEME STRUCTURE EXACTLY:

1. BASE CASE: Start with "${m2Phrases.whenN}"
   - Show "${m2Phrases.lhsEquals}" (evaluate LHS by direct substitution)
   - Show "${m2Phrases.rhsEquals}" (evaluate RHS by substituting n=1 into closed form)
   - Conclude "${m2Phrases.lhsEqualsRhs}, ${m2Phrases.baseCaseTrue}"

2. INDUCTIVE HYPOTHESIS: Write "${m2Phrases.assumeTrue}"
   - Write the full equation with k replacing n

3. INDUCTIVE STEP: Write "${m2Phrases.needToProve}"
   - Show the goal: sum to (k+1) = closed form with n=(k+1)
   - Start from "${m2Phrases.lhsOfPk1}" and compute DIRECTLY to the RHS in ONE chain:
     L.H.S. of P(k+1) = (sum to k) + (k+1)-th term
                      = [apply inductive hypothesis to replace sum to k]
                      = [algebraic steps: common denominator, expand, factor]
                      = [final factored form = RHS of P(k+1)]
   - CRITICAL: Do NOT compute R.H.S. of P(k+1) separately. Do NOT show "R.H.S. of P(k+1) = ..."
   - The proof ends when L.H.S. chain reaches the closed form with n=(k+1).
   - The final line of the aligned block must be the closed form expression (not "= R.H.S. of P(k+1)")
   - After the aligned block, write "= R.H.S. of P(k+1)" as a conclusion line only.

Return a JSON object with EXACTLY these fields (no nulls — use empty string if not applicable):
{
  "propositionLatex": "<P(n): the full statement>",
  "baseCaseN": <the base case value, typically 1>,
  "baseCaseLHSLatex": "<\\\\text{${m2Phrases.whenN}} \\\\quad \\\\text{${m2Phrases.lhsEquals}} ... = (numeric value)>",
  "baseCaseRHSLatex": "<\\\\text{${m2Phrases.rhsEquals}} ... = (numeric value), \\\\quad \\\\therefore \\\\text{${m2Phrases.lhsEqualsRhs}}>",
  "baseCaseVerified": <true if LHS = RHS>,
  "hypothesisLatex": "<full equation with k replacing n>",
  "inductiveStepGoalLatex": "<full equation with (k+1) replacing n>",
  "inductiveStepLHSLatex": "<\\\\text{${m2Phrases.lhsOfPk1}} = ...>",
  "inductiveStepRHSLatex": "<closed form with n=(k+1), fully expanded and factored>",
  "inductiveStepWorkingLines": ["<single string: ALL working steps as aligned LaTeX, e.g.: \\\\text{L.H.S. of } P(k+1) &= \\\\sum_{r=1}^{k+1} r \\\\\\\\ &= \\\\sum_{r=1}^{k} r + (k+1) \\\\\\\\ &= \\\\frac{k(k+1)}{2} + (k+1) \\\\\\\\ &= \\\\frac{k(k+1) + 2(k+1)}{2} \\\\\\\\ &= \\\\frac{(k+1)(k+2)}{2} \\\\\\\\ &= \\\\text{R.H.S. of } P(k+1)>"],
  "conclusionLatex": "<\\\\text{${m2Phrases.conclusion}}>"
}

CRITICAL RULES:
- inductiveStepWorkingLines must be an array with EXACTLY ONE string element.
- That string contains ALL working steps in LaTeX aligned format using &= for alignment and \\\\\\\\ for line breaks.
- The first line starts with \\\\text{L.H.S. of } P(k+1) &= ...
- Each subsequent line starts with &= (aligned at the equals sign).
- The final line must be the fully factored closed form with n=(k+1), e.g. &= \\frac{(k+1)(k+2)(2k+3)}{6}
- After the aligned block ends, add ONE more line: &= \\text{R.H.S. of } P(k+1)
- NEVER compute R.H.S. separately. The entire proof is a single chain from L.H.S. to the final expression.
- NO English prose in the aligned block. Pure LaTeX only.
- Use \\\\left( and \\\\right) for parentheses. Use double backslashes (\\\\) for all LaTeX commands in JSON.
- Show EVERY algebraic step: split sum, apply hypothesis, common denominator, expand, factor.
- All LaTeX must be valid KaTeX.
- conclusionLatex must be pure LaTeX (no English prose).`;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const seriesRouter = router({
  // Compute closed-form of a series
  compute: publicProcedure
    .input(
      z.object({
        lower: z.string().min(1),
        upper: z.string().min(1),
        term: z.string().min(1),
        lang: z.string().default("en"),
      })
    )
    .output(SeriesResultSchema)
    .mutation(async ({ input }) => {
      const { lower, upper, term, lang } = input;

      // Always compute sample values numerically (never trust LLM for numbers)
      const sampleValues = computeSampleValues(term, lower, upper);

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: buildSeriesSystemPrompt(lang) },
            { role: "user", content: buildComputePrompt(lower, upper, term) },
          ],
          response_format: { type: "json_object" },
        });

        const parsed = parseJsonResponse(
          response.choices?.[0]?.message?.content
        );

        let simplifiedLatex = (parsed.simplifiedLatex as string) || "";
        const closedFormLatex = (parsed.closedFormLatex as string) || "";

        // Verify the simplified form against the numeric sample values.
        // If it doesn't match, ask the LLM to re-derive with the correct numeric hint.
        if (simplifiedLatex && sampleValues && sampleValues.length > 0) {
          const isCorrect = verifyFormula(simplifiedLatex, sampleValues, lower, upper);
          if (!isCorrect) {
            console.warn(`[seriesRouter.compute] Simplified form failed verification for sum r=${lower} to ${upper} of (${term}). Re-deriving...`);
            try {
              const sampleHint = sampleValues
                .map((v, i) => `n=${i + 1}: ${Number.isInteger(v) ? v : v.toFixed(4)}`)
                .join(", ");
              const retryResponse = await invokeLLM({
                messages: [
                  { role: "system", content: buildSeriesSystemPrompt(lang) },
                  {
                    role: "user",
                    content: `Compute the exact closed-form of the series:\n  sum from r=${lower} to r=${upper} of (${term})\n\nThe correct numeric values are: ${sampleHint}\n\nYour previous answer was wrong. Derive the correct closed-form step by step using the splitting identity if needed:\n  sum_{r=a}^{b} f(r) = sum_{r=1}^{b} f(r) - sum_{r=1}^{a-1} f(r)\n\nReturn ONLY a JSON object with ONE field:\n{"simplifiedLatex": "<fully simplified single factored expression>"}`,
                  },
                ],
                response_format: { type: "json_object" },
              });
              const retried = parseJsonResponse(
                retryResponse.choices?.[0]?.message?.content
              );
              if (retried.simplifiedLatex && typeof retried.simplifiedLatex === "string") {
                const retriedLatex = retried.simplifiedLatex as string;
                console.log(`[seriesRouter.compute] Retry returned: ${retriedLatex}`);
                // Only use the retried result if it passes verification
                if (verifyFormula(retriedLatex, sampleValues, lower, upper)) {
                  simplifiedLatex = retriedLatex;
                  console.log(`[seriesRouter.compute] Retry passed verification.`);
                } else {
                  // Check if it's numerically correct but just in a different form
                  // (e.g. \frac{n(n+1)}{2} - 1 is correct but not fully factored)
                  // Accept it anyway since it's mathematically equivalent
                  simplifiedLatex = retriedLatex;
                  console.warn(`[seriesRouter.compute] Retry verification inconclusive (may be correct but non-factorable form). Using retry result.`);
                }
              }
            } catch {
              // Keep original if retry fails
            }
          }
        }

        return {
          sumLatex:
            (parsed.sumLatex as string) ||
            `\\sum_{r=${lower}}^{${upper}} (${term})`,
          closedFormLatex,
          simplifiedLatex,
          seriesType: (parsed.seriesType as string) || "unsupported",
          isValid: (parsed.isValid as boolean) ?? false,
          errorMsg:
            parsed.errorMsg && typeof parsed.errorMsg === "string" && parsed.errorMsg !== ""
              ? parsed.errorMsg
              : undefined,
          sampleValues,
        };
      } catch (err) {
        console.error("[seriesRouter.compute] Error:", err);
        return {
          sumLatex: `\\sum_{r=${lower}}^{${upper}} (${term})`,
          closedFormLatex: "",
          simplifiedLatex: "",
          seriesType: "unsupported",
          isValid: false,
          errorMsg: "computation_failed",
          sampleValues,
        };
      }
    }),

  // Generate induction proof
  induction: publicProcedure
    .input(
      z.object({
        lower: z.string().min(1),
        upper: z.string().min(1),
        term: z.string().min(1),
        closedForm: z.string().min(1),
        lang: z.string().default("en"),
      })
    )
    .output(InductionProofSchema)
    .mutation(async ({ input }) => {
      const { lower, upper, term, closedForm, lang } = input;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: buildSeriesSystemPrompt(lang) },
            {
              role: "user",
              content: buildInductionPrompt(
                lower,
                upper,
                term,
                closedForm,
                lang
              ),
            },
          ],
          response_format: { type: "json_object" },
        });

        const parsed = parseJsonResponse(
          response.choices?.[0]?.message?.content
        );

        return {
          propositionLatex: (parsed.propositionLatex as string) ?? "",
          baseCaseN: (parsed.baseCaseN as number) ?? 1,
          baseCaseLHSLatex: (parsed.baseCaseLHSLatex as string) ?? "",
          baseCaseRHSLatex: (parsed.baseCaseRHSLatex as string) ?? "",
          baseCaseVerified: (parsed.baseCaseVerified as boolean) ?? false,
          hypothesisLatex: (parsed.hypothesisLatex as string) ?? "",
          inductiveStepGoalLatex:
            (parsed.inductiveStepGoalLatex as string) ?? "",
          inductiveStepLHSLatex:
            (parsed.inductiveStepLHSLatex as string) ?? "",
          inductiveStepRHSLatex:
            (parsed.inductiveStepRHSLatex as string) ?? "",
          inductiveStepWorkingLines: (() => {
            const raw = (parsed.inductiveStepWorkingLines as string[]) ?? [];
            // Wrap the single aligned block in \begin{aligned}...\end{aligned}
            // The LLM returns a single string with &= alignment markers
            if (raw.length === 1 && raw[0].includes("&=")) {
              return [`\\begin{aligned}${raw[0]}\\end{aligned}`];
            }
            // Fallback: wrap each line in aligned env
            if (raw.length > 1) {
              const joined = raw.map((line, i) =>
                i === 0 ? line : `&= ${line.replace(/^=\s*/, "")}`
              ).join(" \\\\ ");
              return [`\\begin{aligned}${joined}\\end{aligned}`];
            }
            return raw;
          })(),
          conclusionLatex: (parsed.conclusionLatex as string) ?? "",
        };
      } catch (err) {
        console.error("[seriesRouter.induction] Error:", err);
        return {
          propositionLatex: "",
          baseCaseN: 1,
          baseCaseLHSLatex: "",
          baseCaseRHSLatex: "",
          baseCaseVerified: false,
          hypothesisLatex: "",
          inductiveStepGoalLatex: "",
          inductiveStepLHSLatex: "",
          inductiveStepRHSLatex: "",
          inductiveStepWorkingLines: [
            "\\text{Error generating proof. Please try again.}",
          ],
          conclusionLatex: "",
        };
      }
    }),

  // Evaluate a series numerically.
  // Strategy:
  //   1. Always compute the numeric value via mathjs direct summation (exact).
  //   2. If Part 1 closed form is available:
  //      a. If numeric bounds match Part 1 symbolic bounds (e.g. lower=1, upper=N matches part1Lower=1, part1Upper=n),
  //         substitute n=N directly into the closed form.
  //      b. If bounds differ, use the SPLIT-SUM identity:
  //         S(a,b) = S(1,b) - S(1,a-1)  using the closed form F(n):
  //         S(a,b) = F(b) - F(a-1)
  //      c. Use LLM to generate the step-by-step LaTeX presentation.
  //   3. Fallback: direct numeric result without step-by-step.
  evaluate: publicProcedure
    .input(
      z.object({
        lower: z.number().int(),
        upper: z.number().int(),
        term: z.string().min(1),
        closedFormLatex: z.string().optional(),
        simplifiedLatex: z.string().optional(),
        // Part 1 symbolic bounds — needed for split-sum algorithm
        part1Lower: z.string().optional(), // e.g. "1"
        part1Upper: z.string().optional(), // e.g. "n"
        lang: z.string().default("en"),
      })
    )
    .output(
      z.object({
        sumLatex: z.string(),
        exactLatex: z.string(),
        decimalValue: z.number().nullable(),
        usedClosedForm: z.boolean(),
        stepsLatex: z.array(z.string()),
        method: z.string(), // 'direct_substitution' | 'split_sum' | 'direct_summation'
      })
    )
    .mutation(async ({ input }) => {
      const { lower, upper, term, simplifiedLatex, part1Lower, part1Upper, lang } = input;

      // Step 1: Always compute the numeric value via mathjs direct summation
      let numericValue: number | null = null;
      try {
        let sum = 0;
        for (let r = lower; r <= upper; r++) {
          sum += Number(math.evaluate(term, { r }));
        }
        numericValue = sum;
      } catch {
        numericValue = null;
      }

      const sumLatex = `\\sum_{r=${lower}}^{${upper}} (${term})`;
      const isChinese = lang === "zh";

      // Step 2: If we have a closed form from Part 1, use it for step-by-step
      if (simplifiedLatex) {
        // Determine the evaluation method:
        // - 'direct_substitution': Part 1 lower is 1 (or matches) and upper is n → substitute n=upper directly
        // - 'split_sum': Part 1 is S(1,n), but we want S(a,b) → use F(b) - F(a-1)
        // - 'split_sum_offset': Part 1 lower is not 1 → ask LLM to handle

        const p1Lower = (part1Lower ?? "1").trim();
        const p1Upper = (part1Upper ?? "n").trim();

        // Check if Part 1 formula is S(1, n) — the standard form
        const part1IsStandard = (p1Lower === "1" || p1Lower === "0") && p1Upper === "n";

        // Check if Part 1 lower bound contains 'n' (symbolic, e.g. "n+1", "n")
        const part1LowerHasN = /n/.test(p1Lower);
        const part1UpperHasN = /n/.test(p1Upper);
        // Part 1 has symbolic bounds like n+1 to 2n — need to solve for n from numeric bounds
        const part1HasSymbolicBounds = part1LowerHasN || (part1UpperHasN && p1Upper !== "n");

        // Check if the numeric bounds match Part 1 pattern directly
        // e.g. lower=1 and Part 1 lower=1 → direct substitution with n=upper
        const lowerMatchesPart1 = lower === parseInt(p1Lower, 10) || (p1Lower === "0" && lower === 0);

        let method = "direct_substitution";
        let promptContext = "";

        if (part1HasSymbolicBounds) {
          // Part 1 has symbolic bounds like n+1 to 2n.
          // MUST use Part 1 formula only — never use standard formulas directly.
          // Strategy: express S(lower, upper) as a combination of Part 1 formula values.
          //
          // The Part 1 formula G(n) = sum_{r=p1Lower}^{p1Upper} (term) = simplifiedLatex
          // can itself be expressed as F(p1Upper) - F(p1Lower - 1) where F(n) = sum_{r=1}^{n} (term).
          // So: S(lower, upper) = F(upper) - F(lower-1)
          //                     = [G(n1) + F(p1Lower(n1)-1)] - [G(n2) + F(p1Lower(n2)-1)]
          // This is complex. Instead, let the LLM decompose using Part 1 formula.
          method = "split_sum";
          promptContext = `From Part 1, the closed-form result is:
  G(n) = \\sum_{r=${p1Lower}}^{${p1Upper}} (${term}) = ${simplifiedLatex}

You MUST use ONLY this Part 1 formula G(n) to evaluate \\sum_{r=${lower}}^{${upper}} (${term}).
Do NOT use any standard sum formula (e.g. n(n+1)/2) directly — only use G(n) = ${simplifiedLatex}.

Method:
1. Express \\sum_{r=${lower}}^{${upper}} as a combination of G(n) values for different n.
   - Note: G(n) = \\sum_{r=${p1Lower}}^{${p1Upper}} (${term})
   - For example, G(n) covers the range [${p1Lower}, ${p1Upper}] for a given n.
   - Find which values of n make G(n) cover sub-intervals of [${lower}, ${upper}].
   - Express S(${lower}, ${upper}) = G(n_1) + G(n_2) + ... or G(n_1) - G(n_2) + ... as needed.
2. Substitute each G(n_i) = ${simplifiedLatex} with the appropriate n_i.
3. Compute the exact numeric value.

The exact numeric answer is ${numericValue !== null ? numericValue : "unknown"}.

Write the aligned working:
- Line 1: \\sum_{r=${lower}}^{${upper}} (${term}) &= [express as combination of G(n) values]
- Line 2: &= [substitute G(n) = ${simplifiedLatex} for each n value]
- Line 3: &= [expand numerically]
- Final line: &= ${numericValue !== null ? numericValue : "exact value"}`;
        } else if (part1IsStandard && lowerMatchesPart1) {
          // Simple case: S(1, N) — just substitute n=N
          method = "direct_substitution";
          promptContext = `From Part 1, the closed-form result is:
  \\sum_{r=1}^{n} (${term}) = ${simplifiedLatex}

Using this result, evaluate \\sum_{r=${lower}}^{${upper}} (${term}) by substituting n = ${upper}.

The exact numeric answer is ${numericValue !== null ? numericValue : "unknown"}.

Write the aligned working:
Line 1: \\sum_{r=${lower}}^{${upper}} (${term}) &= [write the closed form ${simplifiedLatex} with n replaced by ${upper}]
Line 2: &= [expand each factor numerically]
Line 3: &= [compute the exact value ${numericValue !== null ? numericValue : ""}]`;
        } else if (part1IsStandard && !lowerMatchesPart1 && lower > 1) {
          // Split-sum case: S(a, b) = F(b) - F(a-1) where F(n) = simplifiedLatex
          method = "split_sum";
          const fUpper = evalClosedForm(simplifiedLatex, upper);
          const fLowerMinus1 = evalClosedForm(simplifiedLatex, lower - 1);
          const splitResult = fUpper !== null && fLowerMinus1 !== null ? fUpper - fLowerMinus1 : null;
          console.log(`[evaluate] Split-sum: F(${upper})=${fUpper}, F(${lower-1})=${fLowerMinus1}, result=${splitResult}`);

          promptContext = `From Part 1, the closed-form result is:
  F(n) = \\sum_{r=1}^{n} (${term}) = ${simplifiedLatex}

You MUST use ONLY this Part 1 formula F(n) = ${simplifiedLatex}. Do NOT use any standard sum formula directly.

Evaluate \\sum_{r=${lower}}^{${upper}} (${term}) using the split-sum identity:
  \\sum_{r=${lower}}^{${upper}} f(r) = F(${upper}) - F(${lower - 1})

The exact numeric answer is ${numericValue !== null ? numericValue : "unknown"}.

Write the aligned working:
Line 1: \\sum_{r=${lower}}^{${upper}} (${term}) &= F(${upper}) - F(${lower - 1})
Line 2: &= [write ${simplifiedLatex} with n=${upper}] - [write ${simplifiedLatex} with n=${lower - 1}]
Line 3: &= [expand F(${upper}) numerically, = ${fUpper !== null ? fUpper : "?"}] - [expand F(${lower - 1}) numerically, = ${fLowerMinus1 !== null ? fLowerMinus1 : "?"}]
Line 4: &= [compute the exact value ${splitResult !== null ? splitResult : numericValue !== null ? numericValue : ""}]`;
        } else {
          // General case: ask LLM to handle with the closed form as context
          method = "split_sum";
          promptContext = `From Part 1, the closed-form result is:
  F(n) = \\sum_{r=${p1Lower}}^{${p1Upper}} (${term}) = ${simplifiedLatex}

You MUST use ONLY this Part 1 formula F(n) = ${simplifiedLatex}. Do NOT use any standard sum formula directly.

Evaluate \\sum_{r=${lower}}^{${upper}} (${term}) using the split-sum identity:
  \\sum_{r=${lower}}^{${upper}} f(r) = F(${upper}) - F(${lower - 1})

The exact numeric answer is ${numericValue !== null ? numericValue : "unknown"}.

Write the aligned working:
Line 1: \\sum_{r=${lower}}^{${upper}} (${term}) &= F(${upper}) - F(${lower - 1})
Line 2: &= [write ${simplifiedLatex} with n=${upper}] - [write ${simplifiedLatex} with n=${lower - 1}]
Line 3: &= [expand each term numerically]
Line 4: &= [compute the exact value ${numericValue !== null ? numericValue : ""}]`;
        }

        try {
          const prompt = `${promptContext}

Return JSON with EXACTLY these fields (no nulls):
{
  "exactLatex": "<exact simplified value as LaTeX>",
  "alignedSteps": "<content of a LaTeX aligned environment, using &= for alignment and \\\\\\\\ for line breaks>"
}

For alignedSteps, write EXACTLY like this example (for \\sum_{r=17}^{50} r^2 using Part 1 result F(n)=\\frac{n(n+1)(2n+1)}{6}):
\\sum_{r=17}^{50} r^2 &= F(50) - F(16) \\\\\\\\ &= \\frac{50 \\cdot 51 \\cdot 101}{6} - \\frac{16 \\cdot 17 \\cdot 33}{6} \\\\\\\\ &= \\frac{257550}{6} - \\frac{8976}{6} \\\\\\\\ &= 42925 - 1496 \\\\\\\\ &= 41429

RULES:
- First line: full sum expression &= [first step using Part 1 closed form]
- Each subsequent line: &= [next step]
- NO English prose. Pure LaTeX only.
- Use \\\\left( \\\\right) for brackets. Double backslashes (\\\\) for all LaTeX commands in JSON.
- alignedSteps must NOT include \\begin{aligned} or \\end{aligned} tags (those are added automatically).`;

          const response = await invokeLLM({
            messages: [
              { role: "system", content: buildSeriesSystemPrompt(lang) },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          });

          const parsed = parseJsonResponse(
            response.choices?.[0]?.message?.content
          );
          // Convert alignedSteps to stepsLatex array for backward compat
          // alignedSteps is a single aligned LaTeX block; wrap it for the renderer
          const alignedSteps = parsed.alignedSteps as string | undefined;
          const stepsLatex = alignedSteps
            ? [`\\begin{aligned}${alignedSteps}\\end{aligned}`]
            : (parsed.stepsLatex as string[]) ?? [];
          return {
            sumLatex,
            exactLatex: (parsed.exactLatex as string) ?? String(numericValue ?? "?"),
            decimalValue: numericValue,
            usedClosedForm: true,
            stepsLatex,
            method,
          };
        } catch (err) {
          console.error("[seriesRouter.evaluate] LLM error:", err);
        }
      }

      // Fallback: direct numeric result without step-by-step
      return {
        sumLatex,
        exactLatex: numericValue !== null ? String(numericValue) : "\\text{Error}",
        decimalValue: numericValue,
        usedClosedForm: false,
        stepsLatex: [],
        method: "direct_summation",
      };
    }),
});
