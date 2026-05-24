// ============================================================
// seriesTypes.ts — Shared types for the series calculator
// These mirror the tRPC output schemas from seriesRouter.ts
// ============================================================

export interface SeriesResult {
  sumLatex: string;
  closedFormLatex: string;
  simplifiedLatex: string;
  seriesType: string;
  isValid: boolean;
  errorMsg?: string;
  sampleValues?: number[];
}

export interface InductionProof {
  propositionLatex: string;
  baseCaseN: number;
  baseCaseLHSLatex: string;
  baseCaseRHSLatex: string;
  baseCaseVerified: boolean;
  hypothesisLatex: string;
  inductiveStepGoalLatex: string;
  inductiveStepLHSLatex: string;
  inductiveStepRHSLatex: string;
  inductiveStepWorkingLines: string[];
  conclusionLatex: string;
}

export interface NumericResult {
  sumLatex: string;
  exactLatex: string;
  decimalValue: number | null;
  usedClosedForm: boolean;
  stepsLatex: string[];
  method?: string; // 'direct_substitution' | 'split_sum' | 'direct_summation'
}

/** Convert a plain math expression to a rough LaTeX preview string.
 *  This is a lightweight client-side helper — no mathjs required.
 *  Used only for the live preview box; actual LaTeX comes from the LLM.
 */
export function termToLatexPreview(expr: string): string {
  if (!expr) return "";
  return expr
    .replace(/\*\*/g, "^")
    .replace(/(\w+)\s*\^\s*(\w+)/g, "{$1}^{$2}")
    .replace(/(\d+)\s*\*\s*(\w)/g, "$1$2")
    .replace(/(\w)\s*\*\s*(\w)/g, "$1 \\cdot $2")
    .replace(/1\s*\/\s*\(([^)]+)\)/g, "\\frac{1}{$1}")
    .replace(/\(([^)]+)\)\s*\/\s*\(([^)]+)\)/g, "\\frac{$1}{$2}");
}
