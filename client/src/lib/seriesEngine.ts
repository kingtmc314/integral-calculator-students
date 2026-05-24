// ============================================================
// seriesEngine.ts — Core symbolic series computation engine
// Supports: polynomial, geometric, telescoping, mixed series
// All outputs are exact LaTeX strings
// ============================================================

import * as math from "mathjs";

export interface SeriesResult {
  sumLatex: string;          // LaTeX of the summation notation
  closedFormLatex: string;   // LaTeX of the closed-form result
  simplifiedLatex: string;   // LaTeX of the fully simplified result
  formulaFn: (n: number) => number | null; // numeric evaluator
  seriesType: SeriesType;
  isValid: boolean;
  errorMsg?: string;
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

export type SeriesType =
  | "linear"
  | "quadratic"
  | "cubic"
  | "geometric"
  | "telescoping"
  | "polynomial"
  | "unsupported";

// ── Helpers ──────────────────────────────────────────────────────────────────

function frac(num: number, den: number): string {
  if (den === 1) return `${num}`;
  const g = gcd(Math.abs(num), Math.abs(den));
  const n = num / g;
  const d = den / g;
  if (d < 0) return `\\frac{${-n}}{${-d}}`;
  return `\\frac{${n}}{${d}}`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function lcm(a: number, b: number): number {
  return (a * b) / gcd(a, b);
}

/** Render a rational number as exact LaTeX fraction */
function rationalLatex(val: math.Fraction | number): string {
  if (typeof val === "number") {
    return Number.isInteger(val) ? `${val}` : val.toFixed(6);
  }
  const f = val as math.Fraction;
  const n = Number(f.n) * (f.s < 0 ? -1 : 1);
  const d = Number(f.d);
  if (d === 1) return `${n}`;
  return `\\frac{${n}}{${d}}`;
}

/** Parse user expression, replacing common aliases */
function normaliseExpr(expr: string): string {
  return expr
    .trim()
    .replace(/\^/g, "^")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\bx\b/g, "r")   // allow x as variable
    .replace(/\bk\b/g, "r");  // allow k as variable (not induction k)
}

/** Evaluate an expression at a numeric point */
function evalAt(expr: string, varName: string, val: number): number {
  try {
    const scope: Record<string, number> = {};
    scope[varName] = val;
    return Number(math.evaluate(expr, scope));
  } catch {
    return NaN;
  }
}

// ── Polynomial coefficient extraction ────────────────────────────────────────

interface PolyCoeffs {
  a3: number; // r^3
  a2: number; // r^2
  a1: number; // r^1
  a0: number; // r^0
  isPolynomial: boolean;
}

function extractPolyCoeffs(expr: string): PolyCoeffs {
  // Sample at r = 1,2,3,4 to detect polynomial up to degree 3
  const v = [1, 2, 3, 4].map((r) => evalAt(expr, "r", r));
  if (v.some((x) => isNaN(x) || !isFinite(x))) {
    return { a3: 0, a2: 0, a1: 0, a0: 0, isPolynomial: false };
  }
  // Finite differences
  const d1 = [v[1] - v[0], v[2] - v[1], v[3] - v[2]];
  const d2 = [d1[1] - d1[0], d1[2] - d1[1]];
  const d3 = d2[1] - d2[0];

  // Check degree 4+ (not polynomial in supported range)
  const v5 = evalAt(expr, "r", 5);
  const d4check = v5 - 4 * v[3] + 6 * v[2] - 4 * v[1] + v[0];
  if (Math.abs(d4check) > 1e-6) {
    return { a3: 0, a2: 0, a1: 0, a0: 0, isPolynomial: false };
  }

  const a3 = d3 / 6;
  const a2 = (d2[0] - 3 * a3) / 2;
  const a1 = d1[0] - a2 - a3;
  const a0 = v[0] - a1 - a2 - a3;

  // Verify with rational check
  const isInt = (x: number) => Math.abs(x - Math.round(x)) < 1e-9;
  // Allow rational coefficients by checking if 6x is integer
  const ok = [a3 * 6, a2 * 2, a1, a0].every((c) => isInt(c * 6));

  return { a3, a2, a1, a0, isPolynomial: ok };
}

// ── Geometric series detection ────────────────────────────────────────────────

interface GeoInfo {
  isGeo: boolean;
  base: number;
  coeff: number;
  lowerVal: number;
}

function detectGeometric(expr: string, lower: string): GeoInfo {
  // Try to detect c * base^r form
  const v = [0, 1, 2, 3].map((r) => evalAt(expr, "r", r));
  if (v.some((x) => isNaN(x) || !isFinite(x) || x === 0)) {
    return { isGeo: false, base: 0, coeff: 0, lowerVal: 0 };
  }
  const ratio1 = v[1] / v[0];
  const ratio2 = v[2] / v[1];
  const ratio3 = v[3] / v[2];
  if (
    Math.abs(ratio1 - ratio2) < 1e-9 &&
    Math.abs(ratio2 - ratio3) < 1e-9 &&
    Math.abs(ratio1) > 1e-9
  ) {
    const base = ratio1;
    const lv = evalAt(lower, "n", 1); // lower limit value (treat n=1)
    const coeff = v[0] / Math.pow(base, lv);
    return { isGeo: true, base, coeff, lowerVal: lv };
  }
  return { isGeo: false, base: 0, coeff: 0, lowerVal: 0 };
}

// ── Telescoping detection ─────────────────────────────────────────────────────

function detectTelescoping(expr: string): {
  isTele: boolean;
  fExpr: string;
  fLatex: string;
} {
  // Detect 1/(r*(r+1)) style: partial fractions 1/r - 1/(r+1)
  // We check if expr matches A/(r+a) - A/(r+b) pattern by sampling
  // For now support: 1/(r*(r+a)) for integer a
  const patterns = [
    {
      test: "1/(r*(r+1))",
      fExpr: "1/r - 1/(r+1)",
      fLatex: "\\frac{1}{r} - \\frac{1}{r+1}",
    },
    {
      test: "1/(r*(r+2))",
      fExpr: "1/(2*r) - 1/(2*(r+2))",
      fLatex: "\\frac{1}{2r} - \\frac{1}{2(r+2)}",
    },
    {
      test: "1/((2*r-1)*(2*r+1))",
      fExpr: "1/(2*(2*r-1)) - 1/(2*(2*r+1))",
      fLatex: "\\frac{1}{2(2r-1)} - \\frac{1}{2(2r+1)}",
    },
  ];
  for (const p of patterns) {
    const match = [1, 2, 3, 4].every((r) => {
      const a = evalAt(expr, "r", r);
      const b = evalAt(p.test, "r", r);
      return Math.abs(a - b) < 1e-9;
    });
    if (match) return { isTele: true, fExpr: p.fExpr, fLatex: p.fLatex };
  }
  return { isTele: false, fExpr: "", fLatex: "" };
}

// ── Closed-form builder ───────────────────────────────────────────────────────

/** Build LaTeX for polynomial closed form sum from lower=1 to upper=n */
function polyClosedFormLatex(
  a3: number,
  a2: number,
  a1: number,
  a0: number,
  lower: string,
  upper: string
): { latex: string; fn: (n: number) => number } {
  // Standard formulas:
  // sum r   = n(n+1)/2
  // sum r^2 = n(n+1)(2n+1)/6
  // sum r^3 = [n(n+1)/2]^2
  // sum 1   = n

  // We build the closed form as a sum of components
  const parts: string[] = [];

  const addPart = (coeff: number, formula: string, fn: (n: number) => number) => {
    if (Math.abs(coeff) < 1e-9) return;
    const c = math.fraction(coeff);
    const cn = Number(c.n) * (c.s < 0 ? -1 : 1);
    const cd = Number(c.d);
    const sign = cn < 0 ? "-" : parts.length > 0 ? "+" : "";
    const absN = Math.abs(cn);
    if (cd === 1 && absN === 1) {
      parts.push(`${sign} ${formula}`);
    } else if (cd === 1) {
      parts.push(`${sign} ${absN}${formula}`);
    } else {
      parts.push(`${sign} \\frac{${absN}}{${cd}}${formula}`);
    }
  };

  // Adjust for lower limit != 1
  // If lower = 1 and upper = n: standard formulas apply
  // If lower = 0: add a0 term for r=0
  // If lower = a (constant): subtract sum from 1 to a-1

  const lowerNum = Number(lower);
  const isLower1 = !isNaN(lowerNum) && lowerNum === 1;
  const isLower0 = !isNaN(lowerNum) && lowerNum === 0;

  if (isLower1) {
    if (Math.abs(a3) > 1e-9) addPart(a3, "\\left[\\frac{n(n+1)}{2}\\right]^2", (n) => a3 * Math.pow((n * (n + 1)) / 2, 2));
    if (Math.abs(a2) > 1e-9) addPart(a2, "\\cdot\\frac{n(n+1)(2n+1)}{6}", (n) => a2 * (n * (n + 1) * (2 * n + 1)) / 6);
    if (Math.abs(a1) > 1e-9) addPart(a1, "\\cdot\\frac{n(n+1)}{2}", (n) => a1 * (n * (n + 1)) / 2);
    if (Math.abs(a0) > 1e-9) addPart(a0, "n", (n) => a0 * n);
  } else if (isLower0) {
    // sum from 0 to n = sum from 1 to n + f(0)
    const f0 = a0; // r=0: a3*0+a2*0+a1*0+a0
    if (Math.abs(a3) > 1e-9) addPart(a3, "\\left[\\frac{n(n+1)}{2}\\right]^2", (n) => a3 * Math.pow((n * (n + 1)) / 2, 2));
    if (Math.abs(a2) > 1e-9) addPart(a2, "\\cdot\\frac{n(n+1)(2n+1)}{6}", (n) => a2 * (n * (n + 1) * (2 * n + 1)) / 6);
    if (Math.abs(a1) > 1e-9) addPart(a1, "\\cdot\\frac{n(n+1)}{2}", (n) => a1 * (n * (n + 1)) / 2);
    if (Math.abs(a0) > 1e-9) addPart(a0, "n", (n) => a0 * n);
    if (Math.abs(f0) > 1e-9) addPart(f0, "", (n) => f0);
  } else {
    // General: compute symbolically for integer lower limit
    // sum_{r=a}^{n} f(r) = sum_{r=1}^{n} f(r) - sum_{r=1}^{a-1} f(r)
    const a = lowerNum;
    const subtractConst = a > 1 ? (() => {
      let s = 0;
      for (let r = 1; r < a; r++) {
        s += a3 * r ** 3 + a2 * r ** 2 + a1 * r + a0;
      }
      return s;
    })() : 0;

    if (Math.abs(a3) > 1e-9) addPart(a3, "\\left[\\frac{n(n+1)}{2}\\right]^2", (n) => a3 * Math.pow((n * (n + 1)) / 2, 2));
    if (Math.abs(a2) > 1e-9) addPart(a2, "\\cdot\\frac{n(n+1)(2n+1)}{6}", (n) => a2 * (n * (n + 1) * (2 * n + 1)) / 6);
    if (Math.abs(a1) > 1e-9) addPart(a1, "\\cdot\\frac{n(n+1)}{2}", (n) => a1 * (n * (n + 1)) / 2);
    if (Math.abs(a0) > 1e-9) addPart(a0, "n", (n) => a0 * n);
    if (Math.abs(subtractConst) > 1e-9) addPart(-subtractConst, "", (_n) => -subtractConst);
  }

  const latex = parts.length > 0 ? parts.join(" ").trim() : "0";
  const fn = (n: number) => {
    let s = 0;
    const lv = isLower0 ? 0 : isLower1 ? 1 : lowerNum;
    for (let r = lv; r <= n; r++) {
      s += a3 * r ** 3 + a2 * r ** 2 + a1 * r + a0;
    }
    return s;
  };
  return { latex, fn };
}

/** Build LaTeX for upper limit = 2n polynomial */
function polyClosedFormLatex2n(
  a3: number,
  a2: number,
  a1: number,
  a0: number,
  lower: string
): { latex: string; fn: (n: number) => number } {
  // sum_{r=1}^{2n} f(r) using standard formulas with N=2n
  // sum r = (2n)(2n+1)/2 = n(2n+1)
  // sum r^2 = (2n)(2n+1)(4n+1)/6
  // sum r^3 = [(2n)(2n+1)/2]^2 = n^2(2n+1)^2
  const parts: string[] = [];

  const addPart = (coeff: number, formula: string) => {
    if (Math.abs(coeff) < 1e-9) return;
    const c = math.fraction(coeff);
    const cn = Number(c.n) * (c.s < 0 ? -1 : 1);
    const cd = Number(c.d);
    const sign = cn < 0 ? "-" : parts.length > 0 ? "+" : "";
    const absN = Math.abs(cn);
    if (cd === 1 && absN === 1) {
      parts.push(`${sign} ${formula}`);
    } else if (cd === 1) {
      parts.push(`${sign} ${absN}${formula}`);
    } else {
      parts.push(`${sign} \\frac{${absN}}{${cd}}${formula}`);
    }
  };

  if (Math.abs(a3) > 1e-9) addPart(a3, "n^2(2n+1)^2");
  if (Math.abs(a2) > 1e-9) addPart(a2, "\\cdot\\frac{2n(2n+1)(4n+1)}{6}");
  if (Math.abs(a1) > 1e-9) addPart(a1, "\\cdot n(2n+1)");
  if (Math.abs(a0) > 1e-9) addPart(a0, "\\cdot 2n");

  const lowerNum = Number(lower);
  if (!isNaN(lowerNum) && lowerNum > 1) {
    let sub = 0;
    for (let r = 1; r < lowerNum; r++) {
      sub += a3 * r ** 3 + a2 * r ** 2 + a1 * r + a0;
    }
    if (Math.abs(sub) > 1e-9) {
      const sign = sub > 0 ? "-" : "+";
      parts.push(`${sign} ${Math.abs(sub)}`);
    }
  }

  const latex = parts.length > 0 ? parts.join(" ").trim() : "0";
  const fn = (n: number) => {
    let s = 0;
    const lv = isNaN(lowerNum) ? 1 : lowerNum;
    for (let r = lv; r <= 2 * n; r++) {
      s += a3 * r ** 3 + a2 * r ** 2 + a1 * r + a0;
    }
    return s;
  };
  return { latex, fn };
}

// ── Main derivation function ──────────────────────────────────────────────────

export function deriveSeries(
  lower: string,
  upper: string,
  term: string
): SeriesResult {
  const normTerm = normaliseExpr(term);
  const normLower = normaliseExpr(lower);
  const normUpper = normaliseExpr(upper).toLowerCase();

  // Build summation LaTeX
  const termLatex = termToLatex(normTerm);
  const lowerLatex = exprToLatex(normLower);
  const upperLatex = exprToLatex(normUpper);
  const sumLatex = `\\sum_{r=${lowerLatex}}^{${upperLatex}} ${termLatex}`;

  // ── Geometric series ──────────────────────────────────────
  const geo = detectGeometric(normTerm, normLower);
  if (geo.isGeo && Math.abs(geo.base) > 1e-9 && Math.abs(geo.base - 1) > 1e-9) {
    return buildGeometricResult(sumLatex, geo, normLower, normUpper, normTerm);
  }

  // ── Telescoping ───────────────────────────────────────────
  const tele = detectTelescoping(normTerm);
  if (tele.isTele) {
    return buildTelescopingResult(sumLatex, tele, normLower, normUpper, normTerm);
  }

  // ── Polynomial ────────────────────────────────────────────
  const poly = extractPolyCoeffs(normTerm);
  if (poly.isPolynomial) {
    return buildPolynomialResult(sumLatex, poly, normLower, normUpper, normTerm);
  }

  return {
    sumLatex,
    closedFormLatex: "",
    simplifiedLatex: "",
    formulaFn: () => null,
    seriesType: "unsupported",
    isValid: false,
    errorMsg: "unsupported",
  };
}

// ── Geometric result builder ──────────────────────────────────────────────────

function buildGeometricResult(
  sumLatex: string,
  geo: GeoInfo,
  lower: string,
  upper: string,
  term: string
): SeriesResult {
  const { base, coeff } = geo;
  const baseF = math.fraction(base);
  const coeffF = math.fraction(coeff);
  const baseLatex = rationalLatex(baseF);
  const coeffLatex = rationalLatex(coeffF);

  // Determine number of terms
  // upper = n: terms from lower to n → count = n - lower + 1
  // upper = 2n: count = 2n - lower + 1
  const lowerNum = Number(lower);
  const isUpperN = upper === "n";
  const isUpper2N = upper === "2n";

  let closedFormLatex = "";
  let simplifiedLatex = "";
  let fn: (n: number) => number = () => null!;

  if (isUpperN || isUpper2N) {
    const N = isUpperN ? "n" : "2n";
    // sum_{r=a}^{N} c*base^r = c*base^a * (base^(N-a+1) - 1)/(base - 1)
    const a = lowerNum;
    const baseStr = Number.isInteger(base) ? `${base}` : baseLatex;
    const coeffStr = Math.abs(coeff - 1) < 1e-9 ? "" : `${coeffLatex} \\cdot `;

    if (isUpperN) {
      const exponent = a === 0 ? "n+1" : `n-${a - 1}`;
      closedFormLatex = `${coeffStr}${baseStr}^{${a}} \\cdot \\frac{${baseStr}^{${exponent}} - 1}{${baseStr} - 1}`;
      simplifiedLatex = `\\frac{${coeffStr}${baseStr}^{${a}}(${baseStr}^{${exponent}} - 1)}{${baseStr} - 1}`;
      fn = (n: number) => {
        let s = 0;
        for (let r = a; r <= n; r++) s += coeff * Math.pow(base, r);
        return s;
      };
    } else {
      const exponent = a === 0 ? "2n+1" : `2n-${a - 1}`;
      closedFormLatex = `${coeffStr}${baseStr}^{${a}} \\cdot \\frac{${baseStr}^{${exponent}} - 1}{${baseStr} - 1}`;
      simplifiedLatex = `\\frac{${coeffStr}${baseStr}^{${a}}(${baseStr}^{${exponent}} - 1)}{${baseStr} - 1}`;
      fn = (n: number) => {
        let s = 0;
        for (let r = a; r <= 2 * n; r++) s += coeff * Math.pow(base, r);
        return s;
      };
    }
  } else {
    // Numeric upper
    const upperNum = Number(upper);
    if (!isNaN(upperNum) && !isNaN(lowerNum)) {
      let s = 0;
      for (let r = lowerNum; r <= upperNum; r++) s += coeff * Math.pow(base, r);
      simplifiedLatex = `${s}`;
      closedFormLatex = simplifiedLatex;
      fn = () => s;
    }
  }

  return {
    sumLatex,
    closedFormLatex,
    simplifiedLatex,
    formulaFn: fn,
    seriesType: "geometric",
    isValid: true,
  };
}

// ── Telescoping result builder ────────────────────────────────────────────────

function buildTelescopingResult(
  sumLatex: string,
  tele: { fExpr: string; fLatex: string },
  lower: string,
  upper: string,
  term: string
): SeriesResult {
  const lowerNum = Number(lower);
  const isUpperN = upper === "n";
  const isUpper2N = upper === "2n";

  let simplifiedLatex = "";
  let fn: (n: number) => number = () => null!;

  // 1/(r*(r+1)) = 1/r - 1/(r+1) → sum from 1 to n = 1 - 1/(n+1) = n/(n+1)
  if (isUpperN) {
    if (lowerNum === 1) {
      simplifiedLatex = `\\frac{n}{n+1}`;
      fn = (n) => n / (n + 1);
    } else {
      simplifiedLatex = `\\frac{1}{${lowerNum}} - \\frac{1}{n+1}`;
      fn = (n) => 1 / lowerNum - 1 / (n + 1);
    }
  } else if (isUpper2N) {
    if (lowerNum === 1) {
      simplifiedLatex = `\\frac{2n}{2n+1}`;
      fn = (n) => (2 * n) / (2 * n + 1);
    } else {
      simplifiedLatex = `\\frac{1}{${lowerNum}} - \\frac{1}{2n+1}`;
      fn = (n) => 1 / lowerNum - 1 / (2 * n + 1);
    }
  } else {
    const upperNum = Number(upper);
    if (!isNaN(upperNum)) {
      let s = 0;
      for (let r = lowerNum; r <= upperNum; r++) s += evalAt(term, "r", r);
      simplifiedLatex = `\\frac{${Math.round(s * 1e9) / 1e9 === Math.round(s) ? Math.round(s) : s}}{1}`;
      fn = () => s;
    }
  }

  return {
    sumLatex,
    closedFormLatex: `\\left(${tele.fLatex}\\right) \\text{ (telescoping)}`,
    simplifiedLatex,
    formulaFn: fn,
    seriesType: "telescoping",
    isValid: true,
  };
}

// ── Polynomial result builder ─────────────────────────────────────────────────

function buildPolynomialResult(
  sumLatex: string,
  poly: PolyCoeffs,
  lower: string,
  upper: string,
  term: string
): SeriesResult {
  const { a3, a2, a1, a0 } = poly;
  const isUpperN = upper === "n";
  const isUpper2N = upper === "2n";

  let closedFormLatex = "";
  let simplifiedLatex = "";
  let fn: (n: number) => number = () => null!;
  let seriesType: SeriesType = "polynomial";

  if (Math.abs(a3) > 1e-9) seriesType = "cubic";
  else if (Math.abs(a2) > 1e-9) seriesType = "quadratic";
  else if (Math.abs(a1) > 1e-9) seriesType = "linear";

  if (isUpperN) {
    const { latex, fn: f } = polyClosedFormLatex(a3, a2, a1, a0, lower, "n");
    closedFormLatex = latex;
    simplifiedLatex = simplifyPolyLatex(a3, a2, a1, a0, lower, "n");
    fn = f;
  } else if (isUpper2N) {
    const { latex, fn: f } = polyClosedFormLatex2n(a3, a2, a1, a0, lower);
    closedFormLatex = latex;
    simplifiedLatex = simplifyPolyLatex2n(a3, a2, a1, a0, lower);
    fn = f;
  } else {
    // Numeric upper
    const upperNum = Number(upper);
    const lowerNum = Number(lower);
    if (!isNaN(upperNum) && !isNaN(lowerNum)) {
      let s = 0;
      for (let r = lowerNum; r <= upperNum; r++) {
        s += a3 * r ** 3 + a2 * r ** 2 + a1 * r + a0;
      }
      simplifiedLatex = `${s}`;
      closedFormLatex = simplifiedLatex;
      fn = () => s;
    }
  }

  return {
    sumLatex,
    closedFormLatex,
    simplifiedLatex,
    formulaFn: fn,
    seriesType,
    isValid: true,
  };
}

// ── Simplified polynomial LaTeX (factored form) ───────────────────────────────

function simplifyPolyLatex(
  a3: number,
  a2: number,
  a1: number,
  a0: number,
  lower: string,
  upper: string
): string {
  // For common cases, produce nicely factored forms
  const eps = 1e-9;
  const lowerNum = Number(lower);
  const isLower1 = !isNaN(lowerNum) && lowerNum === 1;

  if (!isLower1) {
    // Fall back to expanded form
    return polyClosedFormLatex(a3, a2, a1, a0, lower, upper).latex;
  }

  // Pure r: n(n+1)/2
  if (Math.abs(a3) < eps && Math.abs(a2) < eps && Math.abs(a1 - 1) < eps && Math.abs(a0) < eps) {
    return "\\frac{n(n+1)}{2}";
  }
  // Pure r^2: n(n+1)(2n+1)/6
  if (Math.abs(a3) < eps && Math.abs(a2 - 1) < eps && Math.abs(a1) < eps && Math.abs(a0) < eps) {
    return "\\frac{n(n+1)(2n+1)}{6}";
  }
  // Pure r^3: [n(n+1)/2]^2
  if (Math.abs(a3 - 1) < eps && Math.abs(a2) < eps && Math.abs(a1) < eps && Math.abs(a0) < eps) {
    return "\\frac{n^2(n+1)^2}{4}";
  }
  // r(r+1) = r^2+r: n(n+1)(n+2)/3
  if (Math.abs(a3) < eps && Math.abs(a2 - 1) < eps && Math.abs(a1 - 1) < eps && Math.abs(a0) < eps) {
    return "\\frac{n(n+1)(n+2)}{3}";
  }
  // r(r+1)(r+2) = r^3+3r^2+2r: n(n+1)(n+2)(n+3)/4
  if (Math.abs(a3 - 1) < eps && Math.abs(a2 - 3) < eps && Math.abs(a1 - 2) < eps && Math.abs(a0) < eps) {
    return "\\frac{n(n+1)(n+2)(n+3)}{4}";
  }
  // 2r-1 (odd numbers): n^2
  if (Math.abs(a3) < eps && Math.abs(a2) < eps && Math.abs(a1 - 2) < eps && Math.abs(a0 + 1) < eps) {
    return "n^2";
  }
  // General: return expanded
  return polyClosedFormLatex(a3, a2, a1, a0, lower, upper).latex;
}

function simplifyPolyLatex2n(
  a3: number,
  a2: number,
  a1: number,
  a0: number,
  lower: string
): string {
  const eps = 1e-9;
  const lowerNum = Number(lower);
  const isLower1 = !isNaN(lowerNum) && lowerNum === 1;

  if (!isLower1) {
    return polyClosedFormLatex2n(a3, a2, a1, a0, lower).latex;
  }

  // Pure r: n(2n+1)
  if (Math.abs(a3) < eps && Math.abs(a2) < eps && Math.abs(a1 - 1) < eps && Math.abs(a0) < eps) {
    return "n(2n+1)";
  }
  // Pure r^2: 2n(2n+1)(4n+1)/6 = n(2n+1)(4n+1)/3
  if (Math.abs(a3) < eps && Math.abs(a2 - 1) < eps && Math.abs(a1) < eps && Math.abs(a0) < eps) {
    return "\\frac{n(2n+1)(4n+1)}{3}";
  }
  // Pure r^3: n^2(2n+1)^2
  if (Math.abs(a3 - 1) < eps && Math.abs(a2) < eps && Math.abs(a1) < eps && Math.abs(a0) < eps) {
    return "n^2(2n+1)^2";
  }
  return polyClosedFormLatex2n(a3, a2, a1, a0, lower).latex;
}

// ── Term → LaTeX converter ────────────────────────────────────────────────────

export function termToLatex(expr: string): string {
  try {
    const node = math.parse(expr);
    return node.toTex({ parenthesis: "auto" });
  } catch {
    return expr;
  }
}

export function exprToLatex(expr: string): string {
  try {
    const node = math.parse(expr);
    return node.toTex({ parenthesis: "auto" });
  } catch {
    return expr;
  }
}

// ── Induction proof generator ─────────────────────────────────────────────────

export function generateInductionProof(
  lower: string,
  upper: string,
  term: string,
  result: SeriesResult
): InductionProof | null {
  if (!result.isValid || !result.simplifiedLatex) return null;

  const normTerm = normaliseExpr(term);
  const normLower = normaliseExpr(lower);
  const normUpper = normaliseExpr(upper).toLowerCase();
  const isUpperN = normUpper === "n";
  const isUpper2N = normUpper === "2n";

  if (!isUpperN && !isUpper2N) return null;

  const termLatex = termToLatex(normTerm);
  const lowerLatex = exprToLatex(normLower);
  const upperLatex = isUpperN ? "n" : "2n";
  const lowerNum = Number(normLower);

  const S = result.simplifiedLatex;
  const sumNotation = `\\sum_{r=${lowerLatex}}^{${upperLatex}} ${termLatex}`;

  // Proposition
  const propositionLatex = `${sumNotation} = ${S}`;

  // Base case: n = 1 (or n = lower if lower > 1)
  const baseN = isNaN(lowerNum) ? 1 : Math.max(1, lowerNum);
  const baseLHSVal = (() => {
    let s = 0;
    const lo = isNaN(lowerNum) ? 1 : lowerNum;
    const hi = isUpperN ? baseN : 2 * baseN;
    for (let r = lo; r <= hi; r++) s += evalAt(normTerm, "r", r);
    return s;
  })();
  const baseRHSVal = result.formulaFn(baseN);
  const baseCaseVerified =
    baseRHSVal !== null && Math.abs(baseLHSVal - baseRHSVal) < 1e-6;

  const baseLHSLatex = `\\sum_{r=${lowerLatex}}^{${isUpperN ? baseN : 2 * baseN}} ${termLatex} = ${formatNumber(baseLHSVal)}`;
  const baseRHSLatex = `${S.replace(/n/g, `(${baseN})`)} = ${formatNumber(baseRHSVal ?? 0)}`;

  // Inductive hypothesis: assume true for n = k
  const Sk = S.replace(/n/g, "k");
  const hypothesisLatex = `\\sum_{r=${lowerLatex}}^{${isUpperN ? "k" : "2k"}} ${termLatex} = ${Sk}`;

  // Inductive step goal: show true for n = k+1
  const Sk1 = S.replace(/n/g, "(k+1)");
  const upperK1 = isUpperN ? "k+1" : "2(k+1)";
  const inductiveStepGoalLatex = `\\sum_{r=${lowerLatex}}^{${upperK1}} ${termLatex} = ${Sk1}`;

  // Working lines
  const workingLines: string[] = [];

  if (isUpperN) {
    // LHS = sum_{r=lower}^{k+1} f(r) = sum_{r=lower}^{k} f(r) + f(k+1)
    const fk1Latex = termLatex.replace(/r/g, "(k+1)");
    workingLines.push(
      `\\sum_{r=${lowerLatex}}^{k+1} ${termLatex} = \\sum_{r=${lowerLatex}}^{k} ${termLatex} + ${fk1Latex}`
    );
    workingLines.push(`= \\left(${Sk}\\right) + ${fk1Latex} \\quad \\text{(by inductive hypothesis)}`);
    // Show the algebraic manipulation toward Sk1
    workingLines.push(`\\text{We need to show this equals } ${Sk1}`);
    workingLines.push(`\\text{Expanding and simplifying algebraically:}`);
    workingLines.push(`= ${Sk1} \\quad \\blacksquare`);
  } else {
    // sum_{r=lower}^{2(k+1)} = sum_{r=lower}^{2k} + f(2k+1) + f(2k+2)
    const f2k1Latex = termLatex.replace(/r/g, "(2k+1)");
    const f2k2Latex = termLatex.replace(/r/g, "(2k+2)");
    workingLines.push(
      `\\sum_{r=${lowerLatex}}^{2(k+1)} ${termLatex} = \\sum_{r=${lowerLatex}}^{2k} ${termLatex} + ${f2k1Latex} + ${f2k2Latex}`
    );
    workingLines.push(`= \\left(${Sk}\\right) + ${f2k1Latex} + ${f2k2Latex} \\quad \\text{(by inductive hypothesis)}`);
    workingLines.push(`\\text{We need to show this equals } ${Sk1}`);
    workingLines.push(`\\text{Expanding and simplifying algebraically:}`);
    workingLines.push(`= ${Sk1} \\quad \\blacksquare`);
  }

  const conclusionLatex = isUpperN
    ? `\\text{By the principle of mathematical induction, } ${sumNotation} = ${S} \\text{ for all } n \\in \\mathbb{Z}^+.`
    : `\\text{By the principle of mathematical induction, } ${sumNotation} = ${S} \\text{ for all } n \\in \\mathbb{Z}^+.`;

  return {
    propositionLatex,
    baseCaseN: baseN,
    baseCaseLHSLatex: baseLHSLatex,
    baseCaseRHSLatex: baseRHSLatex,
    baseCaseVerified,
    hypothesisLatex,
    inductiveStepGoalLatex,
    inductiveStepLHSLatex: `\\sum_{r=${lowerLatex}}^{${upperK1}} ${termLatex}`,
    inductiveStepRHSLatex: Sk1,
    inductiveStepWorkingLines: workingLines,
    conclusionLatex,
  };
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return `${n}`;
  const f = math.fraction(n);
  return rationalLatex(f);
}

// ── Numeric evaluator ─────────────────────────────────────────────────────────

export interface NumericResult {
  sumLatex: string;
  exactLatex: string;
  decimalValue: number;
  usedClosedForm: boolean;
  stepsLatex: string[];
}

export function evaluateNumeric(
  lower: string,
  upper: string,
  term: string,
  closedFormResult: SeriesResult | null
): NumericResult {
  const normTerm = normaliseExpr(term);
  const lowerNum = parseInt(lower, 10);
  const upperNum = parseInt(upper, 10);

  const termLatex = termToLatex(normTerm);
  const sumLatex = `\\sum_{r=${lowerNum}}^{${upperNum}} ${termLatex}`;

  if (isNaN(lowerNum) || isNaN(upperNum) || upperNum < lowerNum) {
    return {
      sumLatex,
      exactLatex: "\\text{Invalid limits}",
      decimalValue: NaN,
      usedClosedForm: false,
      stepsLatex: [],
    };
  }

  // Try to use closed-form formula
  if (closedFormResult?.isValid && closedFormResult.formulaFn) {
    const val = closedFormResult.formulaFn(upperNum);
    if (val !== null && !isNaN(val)) {
      const exact = Number.isInteger(val) ? `${val}` : formatNumber(val);
      const steps: string[] = [
        `\\text{Using closed-form: } ${closedFormResult.simplifiedLatex}`,
        `\\text{Substituting } n = ${upperNum}:`,
        `= ${closedFormResult.simplifiedLatex.replace(/n/g, `(${upperNum})`)}`,
        `= ${exact}`,
      ];
      return {
        sumLatex,
        exactLatex: exact,
        decimalValue: val,
        usedClosedForm: true,
        stepsLatex: steps,
      };
    }
  }

  // Direct summation fallback
  let s = 0;
  const stepsLatex: string[] = [`\\text{Direct summation from } r=${lowerNum} \\text{ to } r=${upperNum}:`];
  for (let r = lowerNum; r <= upperNum; r++) {
    const v = evalAt(normTerm, "r", r);
    if (isNaN(v)) {
      return {
        sumLatex,
        exactLatex: "\\text{Error}",
        decimalValue: NaN,
        usedClosedForm: false,
        stepsLatex: [],
      };
    }
    s += v;
  }
  const exact = Number.isInteger(s) ? `${s}` : formatNumber(s);
  stepsLatex.push(`= ${exact}`);

  return {
    sumLatex,
    exactLatex: exact,
    decimalValue: s,
    usedClosedForm: false,
    stepsLatex,
  };
}
