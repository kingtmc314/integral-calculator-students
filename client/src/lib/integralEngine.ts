import { derivative, parse, simplify, fraction, type MathNode } from "mathjs";
import { exactSimplify } from "./exactMath";

export type IntegralStatus = "ok" | "unsupported" | "invalid";

export interface IntegralResult {
  input: string;
  normalized: string;
  status: IntegralStatus;
  integrandLatex: string;
  answerLatex?: string;
  antiderivative?: string;
  method: string;
  methodZh: string;
  stepsLatex: string[];
  hintEn?: string;
  hintZh?: string;
  variable?: string;
  variableLatex?: string;
}

export interface DefiniteIntegralResult {
  input: string;
  normalized: string;
  lower: string;
  upper: string;
  lowerLatex: string;
  upperLatex: string;
  status: IntegralStatus;
  integrandLatex: string;
  antiderivativeLatex?: string;
  valueExpr?: string;
  valueLatex?: string;
  method: string;
  methodZh: string;
  stepsLatex: string[];
  hintEn?: string;
  hintZh?: string;
  variable?: string;
  variableLatex?: string;
  indefinite?: IntegralResult;
}

interface Integrated {
  expr: string;
  method: string;
  methodZh: string;
  steps: string[];
  exactLatex?: string;
  partsCost?: number;
}

interface IntegrationContext {
  variable: string;
  depth: number;
  partsUsed?: number;
}

class UnsupportedIntegral extends Error {
  hintEn: string;
  hintZh: string;
  constructor(hintEn: string, hintZh: string) {
    super(hintEn);
    this.hintEn = hintEn;
    this.hintZh = hintZh;
  }
}

type AnyNode = MathNode;

const SAMPLE_POINTS = [-2, -1, 0.5, 1, 2, 3, 5];
const GREEK_LOWER = "αβγδεζηθικλμνξοπρστυφχψω";
const CONSTANT_SYMBOLS = new Set(["e", "i", "pi", "Infinity", "NaN"]);
const FUNCTION_NAMES = new Set([
  "sin",
  "cos",
  "tan",
  "sec",
  "csc",
  "cot",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "log",
  "ln",
  "exp",
  "abs",
]);

const GREEK_LATEX: Record<string, string> = {
  α: "\\alpha",
  β: "\\beta",
  γ: "\\gamma",
  δ: "\\delta",
  ε: "\\varepsilon",
  ζ: "\\zeta",
  η: "\\eta",
  θ: "\\theta",
  ι: "\\iota",
  κ: "\\kappa",
  λ: "\\lambda",
  μ: "\\mu",
  ν: "\\nu",
  ξ: "\\xi",
  ο: "o",
  π: "\\pi",
  ρ: "\\rho",
  σ: "\\sigma",
  τ: "\\tau",
  υ: "\\upsilon",
  φ: "\\phi",
  χ: "\\chi",
  ψ: "\\psi",
  ω: "\\omega",
  theta: "\\theta",
  phi: "\\phi",
  alpha: "\\alpha",
  beta: "\\beta",
  gamma: "\\gamma",
  lambda: "\\lambda",
  mu: "\\mu",
  pi: "\\pi",
};

function hasTopLevelComma(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) return true;
  }
  return false;
}

function findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function convertLogNotation(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const lower = input.slice(i).toLowerCase();
    const prev = i > 0 ? input[i - 1] : "";
    const startsName = !/[A-Za-z]/.test(prev);
    const subscriptLog = startsName
      ? input.slice(i).match(/^log_\{?([A-Za-z0-9.]+)\}?\s*\(/i)
      : null;
    if (subscriptLog) {
      const openIndex = i + subscriptLog[0].lastIndexOf("(");
      const closeIndex = findMatchingParen(input, openIndex);
      if (closeIndex >= 0) {
        const inside = convertLogNotation(
          input.slice(openIndex + 1, closeIndex)
        );
        out += `log(${inside},${subscriptLog[1]})`;
        i = closeIndex;
        continue;
      }
    }
    const isLn =
      startsName && lower.startsWith("ln") && /^\s*\(/.test(input.slice(i + 2));
    const isLog =
      startsName &&
      lower.startsWith("log") &&
      /^\s*\(/.test(input.slice(i + 3));
    if (!isLn && !isLog) {
      out += input[i];
      continue;
    }

    const nameLength = isLn ? 2 : 3;
    const afterName = i + nameLength;
    const openOffset = input.slice(afterName).search(/\(/);
    const openIndex = afterName + openOffset;
    const closeIndex = findMatchingParen(input, openIndex);
    if (openOffset < 0 || closeIndex < 0) {
      out += input[i];
      continue;
    }

    const inside = convertLogNotation(input.slice(openIndex + 1, closeIndex));
    if (isLn) out += `log(${inside})`;
    else
      out += hasTopLevelComma(inside) ? `log(${inside})` : `log(${inside},10)`;
    i = closeIndex;
  }
  return out;
}

function preprocess(input: string): string {
  const letters = `A-Za-z${GREEK_LOWER}`;
  return convertLogNotation(input)
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/÷/g, "/")
    .replace(/\be\s*\^\s*\(/gi, "exp(")
    .replace(new RegExp(`(\\d)([${letters}])`, "g"), "$1*$2")
    .replace(new RegExp(`([${GREEK_LOWER}])(\\d)`, "g"), "$1*$2")
    .replace(/([a-zA-Z])(\d)/g, (match, letter, digit) =>
      FUNCTION_NAMES.has(letter) ? match : `${letter}*${digit}`
    )
    .replace(new RegExp(`\\)\\s*([${letters}]|\\d)`, "g"), ")*$1")
    .replace(/(\d)\s*\(/g, "$1*(")
    .replace(new RegExp(`([${GREEK_LOWER}])\\s*\\(`, "g"), "$1*(")
    .replace(/\s+/g, "");
}

function formatCommonLogTex(tex: string): string {
  return tex.replace(
    /\\log_\{10\}\\left\((.*?)\\right\)/g,
    "\\log\\left($1\\right)"
  );
}

function formatFunctionPowerTex(tex: string): string {
  return tex.replace(
    /\{(\\(?:sin|cos|tan|sec|csc|cot)\\left\((.*?)\\right\))\}\^\{([^{}]+)\}/g,
    (_match, fnWithArg: string, arg: string, power: string) => {
      const fn = fnWithArg.match(/^(\\(?:sin|cos|tan|sec|csc|cot))/)?.[1] ?? "";
      return `${fn}^{${power}}\\left(${arg}\\right)`;
    }
  );
}

function toLatex(expr: string): string {
  try {
    return formatFunctionPowerTex(
      formatCommonLogTex(
        parse(expr).toTex({ parenthesis: "keep", implicit: "hide" })
      )
    );
  } catch {
    return expr;
  }
}

function variableLatex(variable: string): string {
  return GREEK_LATEX[variable] ?? toLatex(variable).trim();
}

function dVar(ctx: IntegrationContext): string {
  return `d${variableLatex(ctx.variable)}`;
}

function intLatex(expr: string, ctx: IntegrationContext): string {
  return `\\int ${toLatex(expr)}\\,${dVar(ctx)}`;
}

function simplifyTrigConstants(expr: string): string {
  return expr
    .replace(/\bsin\(0\)/g, "0")
    .replace(/\bcos\(0\)/g, "1")
    .replace(/\btan\(0\)/g, "0")
    .replace(/\bsin\(pi\)/g, "0")
    .replace(/\bcos\(pi\)/g, "-1")
    .replace(/\btan\(pi\)/g, "0")
    .replace(/\bsin\(pi \/ 2\)/g, "1")
    .replace(/\bcos\(pi \/ 2\)/g, "0")
    .replace(/\btan\(pi \/ 4\)/g, "1")
    .replace(/\bsin\(pi \/ 4\)/g, "sqrt(2)/2")
    .replace(/\bcos\(pi \/ 4\)/g, "sqrt(2)/2");
}

function simplifyExpr(expr: string): string {
  return exactSimplify(expr);
}

function derivativeExpr(expr: string, ctx: IntegrationContext): string {
  return simplifyExpr(
    derivative(expr, ctx.variable, { simplify: false }).toString()
  );
}

function isZeroExpr(expr: string, ctx: IntegrationContext): boolean {
  try {
    const s = simplify(expr).toString();
    if (s === "0") return true;
    let checked = 0;
    for (const value of SAMPLE_POINTS) {
      try {
        const y = evalExpr(expr, ctx.variable, value);
        if (!Number.isFinite(y)) continue;
        checked += 1;
        if (Math.abs(y) >= 1e-7) return false;
      } catch {
        continue;
      }
    }
    return checked >= 3;
  } catch {
    return false;
  }
}

function evalExpr(expr: string, variable: string, value: number): number {
  const scope: Record<string, number> = { [variable]: value };
  const result = parse(expr).compile().evaluate(scope);
  if (typeof result === "number") return result;
  return Number(result);
}

function collectVariables(
  node: AnyNode,
  output = new Set<string>()
): Set<string> {
  if (node.type === "SymbolNode") {
    const name = node.toString();
    if (!CONSTANT_SYMBOLS.has(name) && !FUNCTION_NAMES.has(name))
      output.add(name);
  }
  const children = (node as any).args as AnyNode[] | undefined;
  if (children) children.forEach(child => collectVariables(child, output));
  const content = (node as any).content as AnyNode | undefined;
  if (content) collectVariables(content, output);
  return output;
}

function detectVariable(node: AnyNode, preferred?: string): string | null {
  const variables = Array.from(collectVariables(node));
  if (preferred && variables.includes(preferred)) return preferred;
  if (variables.length === 0) return preferred ?? "x";
  if (variables.length === 1) return variables[0];
  if (variables.includes("x")) return "__multiple__";
  return "__multiple__";
}

function hasVariable(expr: string, ctx: IntegrationContext): boolean {
  try {
    return collectVariables(parse(expr)).has(ctx.variable);
  } catch {
    return expr.includes(ctx.variable);
  }
}

function isConstantNode(node: AnyNode, ctx: IntegrationContext): boolean {
  try {
    return !hasVariable(node.toString(), ctx);
  } catch {
    return false;
  }
}

function constantValue(expr: string, ctx?: IntegrationContext): number | null {
  try {
    if (ctx && hasVariable(expr, ctx)) return null;
    const value = parse(expr).compile().evaluate({});
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function isOne(expr: string): boolean {
  const v = constantValue(expr);
  return v !== null && Math.abs(v - 1) < 1e-10;
}

function isMinusOne(expr: string): boolean {
  const v = constantValue(expr);
  return v !== null && Math.abs(v + 1) < 1e-10;
}

function maybeParenthesize(expr: string): string {
  const s = expr.trim();
  if (/^[A-Za-z0-9_.]+$/.test(s)) return s;
  if (new RegExp(`^[${GREEK_LOWER}]+$`).test(s)) return s;
  if (/^[A-Za-z]+\(.+\)$/.test(s)) return s;
  return `(${s})`;
}

function substituteVariable(
  expr: string,
  variable: string,
  replacement: string
): string {
  const replacementNode = parse(replacement);
  return (parse(expr) as any)
    .transform((node: AnyNode) => {
      if (node.type === "SymbolNode" && (node as any).name === variable)
        return replacementNode;
      return node;
    })
    .toString();
}

function multiplyExpr(a: string, b: string): string {
  if (isOne(a)) return b;
  if (isOne(b)) return a;
  if (isMinusOne(a)) return simplifyExpr(`-(${b})`);
  if (isMinusOne(b)) return simplifyExpr(`-(${a})`);
  return simplifyExpr(`(${a})*(${b})`);
}

function divideExpr(a: string, b: string): string {
  if (isOne(b)) return a;
  return simplifyExpr(`(${a})/(${b})`);
}

function addOneToExponent(exp: string): string {
  return simplifyExpr(`(${exp})+1`);
}

function affineDerivative(
  inner: string,
  ctx: IntegrationContext
): string | null {
  try {
    const d = derivativeExpr(inner, ctx);
    if (!hasVariable(d, ctx) && !isZeroExpr(d, ctx)) return d;
    return null;
  } catch {
    return null;
  }
}

function flattenOperator(node: AnyNode, op: string): AnyNode[] {
  if (node.type === "OperatorNode" && (node as any).op === op) {
    return [
      ...flattenOperator((node as any).args[0], op),
      ...flattenOperator((node as any).args[1], op),
    ];
  }
  return [node];
}

function isFunctionNode(node: AnyNode, name: string): boolean {
  return (
    node.type === "FunctionNode" &&
    ((node as any).fn?.name === name || (node as any).name === name)
  );
}

function functionName(node: AnyNode): string | null {
  if (node.type !== "FunctionNode") return null;
  return ((node as any).fn?.name || (node as any).name) as string;
}

function functionArg(node: AnyNode): AnyNode | null {
  const args = (node as any).args as AnyNode[] | undefined;
  return args && args.length >= 1 ? args[0] : null;
}

function functionArgs(node: AnyNode): AnyNode[] {
  return ((node as any).args as AnyNode[] | undefined) ?? [];
}

function isLogFunction(node: AnyNode): boolean {
  return functionName(node) === "log";
}

function logBase(node: AnyNode): string | null {
  if (!isLogFunction(node)) return null;
  const args = functionArgs(node);
  if (args.length === 1) return "e";
  if (args.length === 2) return args[1].toString();
  return null;
}

function isNaturalLogNode(node: AnyNode): boolean {
  return logBase(node) === "e";
}

function isCommonLogNode(node: AnyNode): boolean {
  return logBase(node) === "10";
}

function proportionalTo(
  expr: string,
  target: string,
  ctx: IntegrationContext
): string | null {
  try {
    // Numerical agreement is not an exact coefficient. Require symbolic cancellation.
    const ratio = simplifyExpr(`(${expr})/(${target})`);
    if (hasVariable(ratio, ctx) || constantValue(ratio, ctx) === null)
      return null;
    return ratio;
  } catch {
    return null;
  }
}

function algebraicDegree(expr: string, ctx: IntegrationContext): number | null {
  const s = simplifyExpr(expr);
  if (s === ctx.variable) return 1;
  try {
    const node = parse(s);
    if (node.type === "OperatorNode" && (node as any).op === "^") {
      const [baseNode, expNode] = (node as any).args as AnyNode[];
      if (baseNode.toString() === ctx.variable) {
        const n = constantValue(expNode.toString(), ctx);
        return n !== null && Number.isInteger(n) && n >= 1 ? n : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function byPartsPriority(node: AnyNode, ctx: IntegrationContext): number {
  const text = node.toString();
  const fn = functionName(node);
  if (fn === "log") return 50;
  if (fn === "asin" || fn === "acos" || fn === "atan") return 40;
  const degree = algebraicDegree(text, ctx);
  if (degree !== null) return 30 + degree / 100;
  if (fn === "sin" || fn === "cos" || fn === "tan") return 20;
  if (fn === "exp") return 10;
  return 0;
}

function combineFactors(factors: AnyNode[]): string {
  return factors.map(f => maybeParenthesize(f.toString())).join("*") || "1";
}

type Polynomial = number[];

function trimPoly(poly: Polynomial): Polynomial {
  const result = [...poly];
  while (result.length > 1 && Math.abs(result[result.length - 1]) < 1e-10)
    result.pop();
  return result.length === 0 ? [0] : result;
}

function polyDegree(poly: Polynomial): number {
  return trimPoly(poly).length - 1;
}

function polyAdd(a: Polynomial, b: Polynomial, sign = 1): Polynomial {
  const n = Math.max(a.length, b.length);
  const out = Array(n).fill(0) as Polynomial;
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + sign * (b[i] ?? 0);
  return trimPoly(out);
}

function polyMul(a: Polynomial, b: Polynomial): Polynomial {
  const out = Array(a.length + b.length - 1).fill(0) as Polynomial;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return trimPoly(out);
}

function polyScale(a: Polynomial, c: number): Polynomial {
  return trimPoly(a.map(v => v * c));
}

function polyDivide(
  numerator: Polynomial,
  denominator: Polynomial
): { quotient: Polynomial; remainder: Polynomial } | null {
  const den = trimPoly(denominator);
  if (den.length === 1 && Math.abs(den[0]) < 1e-10) return null;
  let rem = trimPoly(numerator);
  const quotient = Array(
    Math.max(1, polyDegree(rem) - polyDegree(den) + 1)
  ).fill(0) as Polynomial;
  while (
    polyDegree(rem) >= polyDegree(den) &&
    !(rem.length === 1 && Math.abs(rem[0]) < 1e-10)
  ) {
    const power = polyDegree(rem) - polyDegree(den);
    const coeff = rem[rem.length - 1] / den[den.length - 1];
    quotient[power] += coeff;
    const subtractor = Array(power)
      .fill(0)
      .concat(polyScale(den, coeff)) as Polynomial;
    rem = polyAdd(rem, subtractor, -1);
  }
  return { quotient: trimPoly(quotient), remainder: trimPoly(rem) };
}

function rationalNumberString(value: number): string {
  if (Math.abs(value) < 1e-10) return "0";
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-10) return String(rounded);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  for (let d = 2; d <= 1000; d++) {
    const n = Math.round(abs * d);
    if (Math.abs(abs - n / d) < 1e-10) return `${sign}${n}/${d}`;
  }
  return fraction(value).toFraction();
}

function polyToExpr(poly: Polynomial, variable: string): string {
  const terms: string[] = [];
  trimPoly(poly).forEach((coeff, degree) => {
    if (Math.abs(coeff) < 1e-10) return;
    const c = rationalNumberString(coeff);
    if (degree === 0) terms.push(c);
    else if (degree === 1)
      terms.push(
        isOne(c)
          ? variable
          : isMinusOne(c)
            ? `-${variable}`
            : `${c}*${variable}`
      );
    else
      terms.push(
        isOne(c)
          ? `${variable}^${degree}`
          : isMinusOne(c)
            ? `-${variable}^${degree}`
            : `${c}*${variable}^${degree}`
      );
  });
  return terms.length ? simplifyExpr(terms.join("+")) : "0";
}

function nodeToPolynomial(
  node: AnyNode,
  ctx: IntegrationContext
): Polynomial | null {
  if (node.type === "ParenthesisNode")
    return nodeToPolynomial((node as any).content, ctx);
  if (node.type === "ConstantNode") {
    const value = constantValue(node.toString(), ctx);
    return value === null ? null : [value];
  }
  if (node.type === "SymbolNode") {
    const text = node.toString();
    if (text === ctx.variable) return [0, 1];
    if (!hasVariable(text, ctx)) return null;
    return null;
  }
  if (node.type !== "OperatorNode") return null;
  const op = (node as any).op as string;
  const args = (node as any).args as AnyNode[];
  if (op === "unaryMinus" || (op === "-" && args.length === 1)) {
    const inner = nodeToPolynomial(args[0], ctx);
    return inner ? polyScale(inner, -1) : null;
  }
  if (op === "+" || op === "-") {
    const left = nodeToPolynomial(args[0], ctx);
    const right = nodeToPolynomial(args[1], ctx);
    return left && right ? polyAdd(left, right, op === "+" ? 1 : -1) : null;
  }
  if (op === "*") {
    const left = nodeToPolynomial(args[0], ctx);
    const right = nodeToPolynomial(args[1], ctx);
    return left && right ? polyMul(left, right) : null;
  }
  if (op === "/") {
    const left = nodeToPolynomial(args[0], ctx);
    const right = nodeToPolynomial(args[1], ctx);
    if (
      !left ||
      !right ||
      polyDegree(right) !== 0 ||
      Math.abs(right[0]) < 1e-10
    )
      return null;
    return polyScale(left, 1 / right[0]);
  }
  if (op === "^") {
    const base = nodeToPolynomial(args[0], ctx);
    const exponent = constantValue(args[1].toString(), ctx);
    if (
      !base ||
      exponent === null ||
      !Number.isInteger(exponent) ||
      exponent < 0 ||
      exponent > 8
    )
      return null;
    let out: Polynomial = [1];
    for (let i = 0; i < exponent; i++) out = polyMul(out, base);
    return out;
  }
  return null;
}

function exprToPolynomial(
  expr: string,
  ctx: IntegrationContext
): Polynomial | null {
  try {
    return nodeToPolynomial(parse(expr), ctx);
  } catch {
    return null;
  }
}

function tryRationalLongDivision(
  numerator: string,
  denominator: string,
  ctx: IntegrationContext
): Integrated | null {
  const numeratorPoly = exprToPolynomial(numerator, ctx);
  const denominatorPoly = exprToPolynomial(denominator, ctx);
  if (!numeratorPoly || !denominatorPoly) return null;
  if (
    polyDegree(denominatorPoly) < 1 ||
    polyDegree(numeratorPoly) < polyDegree(denominatorPoly)
  )
    return null;

  const divided = polyDivide(numeratorPoly, denominatorPoly);
  if (!divided) return null;
  const quotientExpr = polyToExpr(divided.quotient, ctx.variable);
  const denominatorExpr = polyToExpr(denominatorPoly, ctx.variable);
  const remainderExpr = polyToExpr(divided.remainder, ctx.variable);
  const hasRemainder = !(
    trimPoly(divided.remainder).length === 1 &&
    Math.abs(divided.remainder[0]) < 1e-10
  );

  let quotientIntegral: Integrated;
  try {
    quotientIntegral = integrateNode(parse(quotientExpr), {
      ...ctx,
      depth: ctx.depth + 1,
    });
  } catch {
    return null;
  }

  if (!hasRemainder) {
    return {
      partsCost: quotientIntegral.partsCost,
      expr: quotientIntegral.expr,
      method: "rational function long division",
      methodZh: "有理函數多項式長除法",
      steps: [
        `${toLatex(numerator)}\\div ${toLatex(denominator)}=${toLatex(quotientExpr)}`,
        `${intLatex(`(${numerator})/(${denominator})`, ctx)}=${intLatex(quotientExpr, ctx)}`,
        ...quotientIntegral.steps,
        `${intLatex(`(${numerator})/(${denominator})`, ctx)}=${toLatex(quotientIntegral.expr)}+C`,
      ],
    };
  }

  const remainderQuotient = `(${remainderExpr})/(${denominatorExpr})`;
  let remainderIntegral: Integrated;
  try {
    remainderIntegral = integrateNode(parse(remainderQuotient), {
      ...ctx,
      depth: ctx.depth + 1,
    });
  } catch {
    return null;
  }
  const result = simplifyExpr(
    `(${quotientIntegral.expr})+(${remainderIntegral.expr})`
  );
  return {
    expr: result,
    partsCost:
      (quotientIntegral.partsCost ?? 0) + (remainderIntegral.partsCost ?? 0),
    method: "rational function long division + remainder integration",
    methodZh: "有理函數多項式長除法 + 餘式積分",
    steps: [
      `${toLatex(numerator)}\\div ${toLatex(denominator)}=${toLatex(quotientExpr)}+\\frac{${toLatex(remainderExpr)}}{${toLatex(denominatorExpr)}}`,
      `${intLatex(`(${numerator})/(${denominator})`, ctx)}=${intLatex(quotientExpr, ctx)}+${intLatex(remainderQuotient, ctx)}`,
      ...quotientIntegral.steps,
      ...remainderIntegral.steps,
      `${intLatex(`(${numerator})/(${denominator})`, ctx)}=${toLatex(result)}+C`,
    ],
  };
}

function exponentialInner(node: AnyNode): string | null {
  if (functionName(node) === "exp")
    return functionArg(node)?.toString() ?? null;
  if (node.type === "OperatorNode" && (node as any).op === "^") {
    const [baseNode, exponentNode] = (node as any).args as AnyNode[];
    const base = baseNode.toString();
    if (base === "e" || simplifyExpr(base) === "e")
      return exponentNode.toString();
  }
  return null;
}

function equivalentExpr(
  a: string,
  b: string,
  ctx: IntegrationContext
): boolean {
  return (
    simplifyExpr(a) === simplifyExpr(b) || isZeroExpr(`(${a})-(${b})`, ctx)
  );
}

function tryRepeatedByPartsExpTrig(
  factors: AnyNode[],
  ctx: IntegrationContext
): Integrated | null {
  if (factors.length !== 2 || (ctx.partsUsed ?? 0) > 0) return null;
  const exp = factors.find(f => exponentialInner(f) !== null);
  const trig = factors.find(f =>
    ["sin", "cos"].includes(functionName(f) ?? "")
  );
  if (!exp || !trig) return null;
  const A = exponentialInner(exp)!;
  const B = functionArg(trig)!.toString();
  const a = affineDerivative(A, ctx);
  const b = affineDerivative(B, ctx);
  if (!a || !b) return null;
  const sine = functionName(trig) === "sin";
  const result = simplifyExpr(
    `exp(${A})*((${a})*${sine ? "sin" : "cos"}(${B})${sine ? "-" : "+"}(${b})*${sine ? "cos" : "sin"}(${B}))/((${a})^2+(${b})^2)`
  );
  const E = toLatex(`exp(${A})`);
  const T = toLatex(`${sine ? "sin" : "cos"}(${B})`);
  const U = toLatex(`${sine ? "cos" : "sin"}(${B})`);
  return {
    expr: result,
    partsCost: 2,
    method: "two integrations by parts and solving the cycle",
    methodZh: "兩次分部積分並移項解循環",
    steps: [
      `I=${intLatex(combineFactors(factors), ctx)}`,
      `u=${T},\\quad dv=${E}\\,${dVar(ctx)},\\quad v=\\frac{${E}}{${toLatex(a)}}`,
      `I=\\frac{${E}${T}}{${toLatex(a)}}${sine ? "-" : "+"}\\frac{${toLatex(b)}}{${toLatex(a)}}J`,
      `J=${intLatex(`exp(${A})*${sine ? "cos" : "sin"}(${B})`, ctx)}`,
      `J=\\frac{${E}${U}}{${toLatex(a)}}${sine ? "+" : "-"}\\frac{${toLatex(b)}}{${toLatex(a)}}I`,
      `\\left(1+\\frac{${toLatex(b)}^2}{${toLatex(a)}^2}\\right)I=\\frac{${E}${T}}{${toLatex(a)}}${sine ? "-" : "+"}\\frac{${toLatex(b)}${E}${U}}{${toLatex(a)}^2}`,
      `${intLatex(combineFactors(factors), ctx)}=${toLatex(result)}+C`,
    ],
  };
}

function isVariableNode(node: AnyNode, ctx: IntegrationContext): boolean {
  return node.toString() === ctx.variable;
}

function isNaturalLogOfVariable(
  node: AnyNode,
  ctx: IntegrationContext
): boolean {
  return (
    isNaturalLogNode(node) &&
    !!functionArg(node) &&
    isVariableNode(functionArg(node)!, ctx)
  );
}

function isCommonLogOfVariable(
  node: AnyNode,
  ctx: IntegrationContext
): boolean {
  return (
    isCommonLogNode(node) &&
    !!functionArg(node) &&
    isVariableNode(functionArg(node)!, ctx)
  );
}

function isFixedBaseLogOfVariable(
  node: AnyNode,
  ctx: IntegrationContext
): boolean {
  if (
    !isLogFunction(node) ||
    !functionArg(node) ||
    !isVariableNode(functionArg(node)!, ctx)
  )
    return false;
  const base = logBase(node);
  if (!base) return false;
  const baseValue = constantValue(base, ctx);
  return baseValue !== null && baseValue > 0 && Math.abs(baseValue - 1) > 1e-10;
}

function logBaseDisplay(
  base: string,
  v: string
): { expr: string; latex: string; setup: string[]; du: string } {
  const vl = variableLatex(v);
  if (base === "e") {
    return {
      expr: `log(${v})`,
      latex: `\\ln ${vl}`,
      setup: [],
      du: `\\frac{1}{${vl}}`,
    };
  }
  if (base === "10") {
    return {
      expr: `log(${v},10)`,
      latex: `\\log ${vl}`,
      setup: [`\\log ${vl}=\\frac{\\ln ${vl}}{\\ln 10}`],
      du: `\\frac{1}{${vl}\\ln 10}`,
    };
  }
  const baseLatex = toLatex(base);
  return {
    expr: `log(${v},${base})`,
    latex: `\\log_{${baseLatex}} ${vl}`,
    setup: [`\\log_{${baseLatex}} ${vl}=\\frac{\\ln ${vl}}{\\ln ${baseLatex}}`],
    du: `\\frac{1}{${vl}\\ln ${baseLatex}}`,
  };
}

function isSqrtOfVariable(node: AnyNode, ctx: IntegrationContext): boolean {
  if (functionName(node) === "sqrt" && functionArg(node))
    return isVariableNode(functionArg(node)!, ctx);
  if (node.type === "OperatorNode" && (node as any).op === "^") {
    const [baseNode, expNode] = (node as any).args as AnyNode[];
    const expVal = constantValue(expNode.toString(), ctx);
    return (
      isVariableNode(baseNode, ctx) &&
      expVal !== null &&
      Math.abs(expVal - 0.5) < 1e-10
    );
  }
  return false;
}

function tryTrigLogSubstitution(
  fn: string,
  arg: AnyNode,
  ctx: IntegrationContext
): Integrated | null {
  if (
    (ctx.partsUsed ?? 0) > 0 ||
    (fn !== "sin" && fn !== "cos") ||
    !isNaturalLogOfVariable(arg, ctx)
  )
    return null;
  const v = ctx.variable;
  const vl = variableLatex(v);
  const uLatex = `\\ln ${vl}`;
  const trigExpr = `${fn}(log(${v}))`;
  const result =
    fn === "sin"
      ? simplifyExpr(`${v}*(sin(log(${v}))-cos(log(${v})))/2`)
      : simplifyExpr(`${v}*(sin(log(${v}))+cos(log(${v})))/2`);
  const innerExp = fn === "sin" ? "exp(u)*sin(u)" : "exp(u)*cos(u)";
  const innerResult =
    fn === "sin" ? "exp(u)*(sin(u)-cos(u))/2" : "exp(u)*(sin(u)+cos(u))/2";
  return {
    expr: result,
    partsCost: 2,
    method: "substitution followed by repeated integration by parts",
    methodZh: "代換後連續分部積分",
    steps: [
      `u=${uLatex},\\quad ${dVar(ctx)}=${vl}\\,du=e^u\\,du`,
      `${intLatex(trigExpr, ctx)}=\\int e^u${fn === "sin" ? "\\sin u" : "\\cos u"}\\,du`,
      `\\text{Now use repeated integration by parts and solve for the original integral: }\\int ${toLatex(innerExp)}\\,du=${toLatex(innerResult)}+C`,
      `${intLatex(trigExpr, ctx)}=${toLatex(result)}+C`,
    ],
  };
}

function tryTrigSqrtSubstitution(
  fn: string,
  arg: AnyNode,
  ctx: IntegrationContext
): Integrated | null {
  if (
    (ctx.partsUsed ?? 0) >= 2 ||
    (fn !== "sin" && fn !== "cos") ||
    !isSqrtOfVariable(arg, ctx)
  )
    return null;
  const v = ctx.variable;
  const vl = variableLatex(v);
  const sqrtV = `sqrt(${v})`;
  const sqrtLatex = `\\sqrt{${vl}}`;
  const trigExpr = `${fn}(${sqrtV})`;
  const result =
    fn === "sin"
      ? simplifyExpr(`2*(sin(${sqrtV})-${sqrtV}*cos(${sqrtV}))`)
      : simplifyExpr(`2*(${sqrtV}*sin(${sqrtV})+cos(${sqrtV}))`);
  const transformed = fn === "sin" ? "2*u*sin(u)" : "2*u*cos(u)";
  const transformedResult =
    fn === "sin" ? "2*(sin(u)-u*cos(u))" : "2*(u*sin(u)+cos(u))";
  return {
    expr: result,
    partsCost: 1,
    method: "substitution followed by integration by parts",
    methodZh: "代換後分部積分",
    steps: [
      `u=${sqrtLatex},\\quad ${vl}=u^2,\\quad ${dVar(ctx)}=2u\\,du`,
      `${intLatex(trigExpr, ctx)}=\\int ${fn === "sin" ? "2u\\sin u" : "2u\\cos u"}\\,du`,
      `\\text{Use integration by parts on }\\int ${toLatex(transformed)}\\,du=${toLatex(transformedResult)}+C`,
      `${intLatex(trigExpr, ctx)}=${toLatex(result)}+C`,
    ],
  };
}

function tryValidatedMixedFunctionTechnique(
  fn: string,
  arg: AnyNode,
  ctx: IntegrationContext
): Integrated | null {
  return (
    tryTrigLogSubstitution(fn, arg, ctx) ??
    tryTrigSqrtSubstitution(fn, arg, ctx)
  );
}

function unwrapNode(node: AnyNode): AnyNode {
  return node.type === "ParenthesisNode"
    ? unwrapNode((node as any).content)
    : node;
}

function tryTrigIdentities(
  node: AnyNode,
  ctx: IntegrationContext
): Integrated | null {
  node = unwrapNode(node);
  let rewritten: string | null = null;
  let identity = "";
  if (node.type === "OperatorNode" && (node as any).op === "^") {
    const [rawBase, power] = (node as any).args as AnyNode[];
    const base = unwrapNode(rawBase);
    const fn = functionName(base);
    const arg = functionArg(base)?.toString();
    const n = constantValue(power.toString(), ctx);
    if (arg && affineDerivative(arg, ctx)) {
      if (n === 2 && (fn === "sin" || fn === "cos")) {
        rewritten = `(1${fn === "sin" ? "-" : "+"}cos(2*(${arg})))/2`;
        identity = `\\${fn}^2 u=\\frac{1${fn === "sin" ? "-" : "+"}\\cos 2u}{2}`;
      }
      if (n === 3 && (fn === "sin" || fn === "cos")) {
        rewritten =
          fn === "sin"
            ? `(3*sin(${arg})-sin(3*(${arg})))/4`
            : `(3*cos(${arg})+cos(3*(${arg})))/4`;
        identity =
          fn === "sin"
            ? "\\sin^3 u=\\frac{3\\sin u-\\sin 3u}{4}"
            : "\\cos^3 u=\\frac{3\\cos u+\\cos 3u}{4}";
      }
      if (n === 4 && (fn === "sin" || fn === "cos")) {
        rewritten = `(3${fn === "sin" ? "-" : "+"}4*cos(2*(${arg}))+cos(4*(${arg})))/8`;
        identity = `\\${fn}^4 u=\\frac{3${fn === "sin" ? "-" : "+"}4\\cos 2u+\\cos 4u}{8}`;
      }
      if (n === 2 && (fn === "tan" || fn === "cot")) {
        rewritten = `${fn === "tan" ? "sec" : "csc"}(${arg})^2-1`;
        identity =
          fn === "tan" ? "\\tan^2 u=\\sec^2 u-1" : "\\cot^2 u=\\csc^2 u-1";
      }
    }
  }
  if (node.type === "OperatorNode" && (node as any).op === "*") {
    const factors = flattenOperator(node, "*").map(unwrapNode);
    if (factors.length === 2) {
      const [a, b] = factors;
      const fa = functionName(a);
      const fb = functionName(b);
      const A = functionArg(a)?.toString();
      const B = functionArg(b)?.toString();
      if (
        A &&
        B &&
        affineDerivative(A, ctx) &&
        affineDerivative(B, ctx) &&
        ["sin", "cos"].includes(fa ?? "") &&
        ["sin", "cos"].includes(fb ?? "")
      ) {
        if (fa === "cos" && fb === "cos")
          rewritten = `(cos((${A})-(${B}))+cos((${A})+(${B})))/2`;
        else if (fa === "sin" && fb === "sin")
          rewritten = `(cos((${A})-(${B}))-cos((${A})+(${B})))/2`;
        else {
          const s = fa === "sin" ? A : B;
          const c = fa === "cos" ? A : B;
          rewritten = `(sin((${s})+(${c}))+sin((${s})-(${c})))/2`;
        }
        identity = `${toLatex(node.toString())}=${toLatex(rewritten)}`;
      }
    }
  }
  if (!rewritten) return null;
  try {
    const inner = integrateNode(parse(simplifyExpr(rewritten)), {
      ...ctx,
      depth: ctx.depth + 1,
    });
    return {
      expr: inner.expr,
      partsCost: inner.partsCost,
      method: "trigonometric identities then direct integration",
      methodZh: "三角恆等式變形後直接積分",
      steps: [
        identity,
        `${intLatex(node.toString(), ctx)}=${intLatex(rewritten, ctx)}`,
        ...inner.steps,
        `${intLatex(node.toString(), ctx)}=${toLatex(inner.expr)}+C`,
      ],
    };
  } catch {
    return null;
  }
}

function tryQuadraticRational(
  numerator: string,
  denominator: string,
  ctx: IntegrationContext
): Integrated | null {
  const p = exprToPolynomial(numerator, ctx);
  const q = exprToPolynomial(denominator, ctx);
  if (!p || !q || polyDegree(q) !== 2 || polyDegree(p) > 1) return null;
  const [c, b, a] = q;
  const alpha = (p[1] ?? 0) / (2 * a);
  const beta = (p[0] ?? 0) - alpha * b;
  const shift = rationalNumberString(b / (2 * a));
  const z = simplifyExpr(`${ctx.variable}+(${shift})`);
  const k = c / a - (b * b) / (4 * a * a);
  let primitive: string;
  let substitution: string;
  if (Math.abs(k) < 1e-10) {
    primitive = `-1/((${rationalNumberString(a)})*(${z}))`;
    substitution = `u=${toLatex(z)}`;
  } else if (k > 0) {
    const scale = exactSqrtExpr(k);
    primitive = `atan((${z})/(${scale}))/((${rationalNumberString(a)})*(${scale}))`;
    substitution = `${toLatex(z)}=${toLatex(scale)}\\tan\\theta`;
  } else {
    const scale = exactSqrtExpr(-k);
    primitive = `log(abs(((${z})-(${scale}))/((${z})+(${scale}))))/(2*(${rationalNumberString(a)})*(${scale}))`;
    substitution = `\\frac{1}{u^2-s^2}=\\frac{1}{2s}\\left(\\frac{1}{u-s}-\\frac{1}{u+s}\\right)`;
  }
  const result = simplifyExpr(
    `(${rationalNumberString(alpha)})*log(abs(${denominator}))+(${rationalNumberString(beta)})*(${primitive})`
  );
  return {
    expr: result,
    method: "quadratic decomposition and substitution",
    methodZh: "二次式分拆及代換",
    steps: [
      `${toLatex(denominator)}=${toLatex(`${rationalNumberString(a)}*((${z})^2+(${rationalNumberString(k)}))`)}`,
      `u=${toLatex(z)},\\quad du=${dVar(ctx)}`,
      substitution,
      `${intLatex(`(${numerator})/(${denominator})`, ctx)}=${toLatex(result)}+C`,
    ],
  };
}

function trySquareRootQuadratic(
  inner: string,
  multiplier: string,
  reciprocal: boolean,
  ctx: IntegrationContext
): Integrated | null {
  const q = exprToPolynomial(inner, ctx);
  if (!q || polyDegree(q) !== 2 || q[2] >= 0) return null;
  const [c, b, a] = q;
  const h = -b / (2 * a);
  const radius2 = -(c - (b * b) / (4 * a)) / a;
  if (radius2 <= 0) return null;
  const z = simplifyExpr(`${ctx.variable}-(${rationalNumberString(h)})`);
  const radius = exactSqrtExpr(radius2);
  const scale = exactSqrtExpr(-a);
  const coefficient = reciprocal
    ? divideExpr(multiplier, scale)
    : multiplyExpr(multiplier, scale);
  const core = reciprocal
    ? `asin((${z})/(${radius}))`
    : `((${z})*sqrt((${rationalNumberString(radius2)})-(${z})^2)+(${rationalNumberString(radius2)})*asin((${z})/(${radius})))/2`;
  const result = multiplyExpr(coefficient, core);
  return {
    expr: result,
    method: "trigonometric substitution",
    methodZh: "三角代換法",
    steps: [
      `${toLatex(z)}=${toLatex(radius)}\\sin\\theta,\\quad ${dVar(ctx)}=${toLatex(radius)}\\cos\\theta\\,d\\theta`,
      `\\sqrt{${toLatex(inner)}}=${toLatex(multiplyExpr(scale, radius))}\\cos\\theta`,
      reciprocal
        ? `\\int ${toLatex(coefficient)}\\,d\\theta=${toLatex(coefficient)}\\theta+C`
        : `\\cos^2\\theta=\\frac{1+\\cos2\\theta}{2}`,
      `\\theta=\\sin^{-1}\\left(\\frac{${toLatex(z)}}{${toLatex(radius)}}\\right)`,
      `${intLatex(reciprocal ? `(${multiplier})/sqrt(${inner})` : `(${multiplier})*sqrt(${inner})`, ctx)}=${toLatex(result)}+C`,
    ],
  };
}

function integrateNode(node: AnyNode, ctx: IntegrationContext): Integrated {
  const result = integrateNodeImpl(node, ctx);
  const cost =
    result.partsCost ??
    (result.method.includes("integration by parts") ? 1 : 0);
  if ((ctx.partsUsed ?? 0) + cost > 2) {
    throw new UnsupportedIntegral(
      "This derivation would require more than two integrations by parts, beyond the selected DSE M2 method limit.",
      "此推導需要超過兩次分部積分，超出本工具採用的 DSE M2 方法限制。"
    );
  }
  return { ...result, partsCost: cost };
}

function integrateNodeImpl(node: AnyNode, ctx: IntegrationContext): Integrated {
  node = unwrapNode(node);
  const text = node.toString();
  const identities = tryTrigIdentities(node, ctx);
  if (identities) return identities;

  if (ctx.depth > 10) {
    throw new UnsupportedIntegral(
      "The recursive method became too long for this expression.",
      "此題的遞迴計算過長，暫未能安全處理。"
    );
  }

  if (!hasVariable(text, ctx)) {
    return {
      expr: simplifyExpr(`(${text})*(${ctx.variable})`),
      method: "constant rule",
      methodZh: "常數積分法",
      steps: [
        `${intLatex(text, ctx)}=${toLatex(text)}${variableLatex(ctx.variable)}+C`,
      ],
    };
  }

  if (node.type === "SymbolNode" && text === ctx.variable) {
    return {
      expr: `${ctx.variable}^2/2`,
      method: "power rule",
      methodZh: "冪次法則",
      steps: [
        `${intLatex(ctx.variable, ctx)}=\\frac{${variableLatex(ctx.variable)}^2}{2}+C`,
      ],
    };
  }

  if (node.type === "ParenthesisNode") {
    return integrateNode((node as any).content, ctx);
  }

  if (node.type === "OperatorNode") {
    const op = (node as any).op as string;
    const args = (node as any).args as AnyNode[];

    if (op === "unaryMinus" || (op === "-" && args.length === 1)) {
      const inner = integrateNode(args[0], ctx);
      return {
        partsCost: inner.partsCost,
        expr: simplifyExpr(`-(${inner.expr})`),
        method: `constant multiple + ${inner.method}`,
        methodZh: `常數倍法則 + ${inner.methodZh}`,
        steps: [
          `${intLatex(`-(${args[0].toString()})`, ctx)}=-${intLatex(args[0].toString(), ctx)}`,
          ...inner.steps,
        ],
      };
    }

    if (op === "+") {
      const left = integrateNode(args[0], ctx);
      const right = integrateNode(args[1], {
        ...ctx,
        partsUsed: (ctx.partsUsed ?? 0) + (left.partsCost ?? 0),
      });
      return {
        expr: simplifyExpr(`(${left.expr})+(${right.expr})`),
        partsCost: (left.partsCost ?? 0) + (right.partsCost ?? 0),
        method: "linearity",
        methodZh: "線性法則",
        steps: [
          `${intLatex(`(${args[0].toString()})+(${args[1].toString()})`, ctx)}`,
          ...left.steps,
          ...right.steps,
        ],
      };
    }

    if (op === "-") {
      const left = integrateNode(args[0], ctx);
      const right = integrateNode(args[1], {
        ...ctx,
        partsUsed: (ctx.partsUsed ?? 0) + (left.partsCost ?? 0),
      });
      return {
        expr: simplifyExpr(`(${left.expr})-(${right.expr})`),
        partsCost: (left.partsCost ?? 0) + (right.partsCost ?? 0),
        method: "linearity",
        methodZh: "線性法則",
        steps: [
          `${intLatex(`(${args[0].toString()})-(${args[1].toString()})`, ctx)}`,
          ...left.steps,
          ...right.steps,
        ],
      };
    }

    if (op === "*") {
      const factors = flattenOperator(node, "*").map(unwrapNode);
      const constants = factors
        .filter(f => isConstantNode(f, ctx))
        .map(f => f.toString());
      const variableFactors = factors.filter(f => !isConstantNode(f, ctx));
      if (constants.length > 0 && variableFactors.length > 0) {
        const c = simplifyExpr(constants.join("*"));
        const rest = combineFactors(variableFactors);
        const inner = integrateNode(parse(rest), {
          ...ctx,
          depth: ctx.depth + 1,
        });
        return {
          partsCost: inner.partsCost,
          expr: multiplyExpr(c, inner.expr),
          method: `constant multiple + ${inner.method}`,
          methodZh: `常數倍法則 + ${inner.methodZh}`,
          steps: [
            `${intLatex(`${c}*(${rest})`, ctx)}=${toLatex(c)}${intLatex(rest, ctx)}`,
            ...inner.steps,
          ],
        };
      }

      const repeatedByParts = tryRepeatedByPartsExpTrig(factors, ctx);
      if (repeatedByParts) return repeatedByParts;

      const reverse = tryReverseChainFromProduct(factors, ctx);
      if (reverse) return reverse;

      const polynomial = exprToPolynomial(text, ctx);
      if (polynomial) {
        const expanded = polyToExpr(polynomial, ctx.variable);
        if (expanded !== text) {
          const integrated = integrateNode(parse(expanded), {
            ...ctx,
            depth: ctx.depth + 1,
          });
          return {
            ...integrated,
            method: "expand polynomial then power rule",
            methodZh: "展開多項式後用冪次法則",
            steps: [
              `${toLatex(text)}=${toLatex(expanded)}`,
              ...integrated.steps,
            ],
          };
        }
      }
      const byParts = tryByParts(factors, ctx);
      if (byParts) return byParts;
    }

    if (op === "/") {
      const numerator = args[0].toString();
      const denominator = args[1].toString();
      if (!hasVariable(denominator, ctx)) {
        const inner = integrateNode(args[0], { ...ctx, depth: ctx.depth + 1 });
        const result = divideExpr(inner.expr, denominator);
        return {
          ...inner,
          expr: result,
          steps: [
            ...inner.steps,
            `${intLatex(text, ctx)}=${toLatex(result)}+C`,
          ],
        };
      }
      const denNode = unwrapNode(args[1]);
      const rootInner = sqrtOf(denNode);
      if (rootInner && !hasVariable(numerator, ctx)) {
        const root = trySquareRootQuadratic(rootInner, numerator, true, ctx);
        if (root) return root;
      }
      let reciprocal: string | null = null;
      if (rootInner) reciprocal = `(${rootInner})^(-1/2)`;
      else if (denNode.type === "OperatorNode" && (denNode as any).op === "^") {
        const [base, power] = (denNode as any).args as AnyNode[];
        if (constantValue(power.toString(), ctx) !== null)
          reciprocal = `(${base.toString()})^(-(${power.toString()}))`;
      }
      if (reciprocal) {
        try {
          const converted = simplifyExpr(`(${numerator})*(${reciprocal})`);
          const inner = integrateNode(parse(converted), {
            ...ctx,
            depth: ctx.depth + 1,
          });
          return {
            ...inner,
            steps: [`${toLatex(text)}=${toLatex(converted)}`, ...inner.steps],
          };
        } catch {}
      }
      const quadratic = tryQuadraticRational(numerator, denominator, ctx);
      if (quadratic) return quadratic;
      const quotientReverse = tryReverseChainFromProduct(
        [args[0], parse(`1/(${denominator})`)],
        ctx
      );
      if (quotientReverse) return quotientReverse;
      const longDivision = tryRationalLongDivision(numerator, denominator, ctx);
      if (longDivision) return longDivision;
      const denomDerivative = derivativeExpr(denominator, ctx);
      const reverseLogCoeff = proportionalTo(numerator, denomDerivative, ctx);
      if (reverseLogCoeff) {
        return {
          expr: multiplyExpr(reverseLogCoeff, `log(abs(${denominator}))`),
          method: "reverse chain logarithmic rule",
          methodZh: "反鏈式對數法則",
          steps: [
            `u=${toLatex(denominator)},\\quad du=${toLatex(denomDerivative)}\\,${dVar(ctx)}`,
            `${intLatex(`(${numerator})/(${denominator})`, ctx)}=${toLatex(reverseLogCoeff)}\\ln\\left|${toLatex(denominator)}\\right|+C`,
          ],
        };
      }
      if (!hasVariable(numerator, ctx)) {
        const denomDeriv = affineDerivative(denominator, ctx);
        if (denomDeriv) {
          const coeff = simplifyExpr(`(${numerator})/(${denomDeriv})`);
          return {
            expr: multiplyExpr(coeff, `log(abs(${denominator}))`),
            method: "logarithmic rule",
            methodZh: "對數積分法",
            steps: [
              `${intLatex(`(${numerator})/(${denominator})`, ctx)}=${toLatex(coeff)}\\ln\\left|${toLatex(denominator)}\\right|+C`,
            ],
          };
        }
      }
    }

    if (op === "^") {
      const base = args[0].toString();
      const exponent = args[1].toString();
      const expVal = constantValue(exponent, ctx);
      const baseConst = constantValue(base, ctx);
      const deriv = affineDerivative(base, ctx);

      if (
        baseConst !== null &&
        baseConst > 0 &&
        baseConst !== 1 &&
        hasVariable(exponent, ctx)
      ) {
        const expDeriv = affineDerivative(exponent, ctx);
        if (expDeriv) {
          const denom = simplifyExpr(`(${expDeriv})*log(${base})`);
          const naturalExponent = `(${exponent})*log(${base})`;
          return {
            expr: divideExpr(`${base}^(${exponent})`, denom),
            method: "exponential rule by conversion to base e",
            methodZh: "轉為自然指數後積分",
            steps: [
              `${toLatex(`${base}^(${exponent})`)}=e^{${toLatex(naturalExponent)}}`,
              `u=${toLatex(naturalExponent)},\\quad du=${toLatex(denom)}\\,${dVar(ctx)}`,
              `${intLatex(`${base}^(${exponent})`, ctx)}=\\frac{${toLatex(`${base}^(${exponent})`)}}{${toLatex(denom)}}+C`,
            ],
          };
        }
      }

      if (expVal !== null && deriv) {
        if (Math.abs(expVal + 1) < 1e-10) {
          return {
            expr: divideExpr(`log(abs(${base}))`, deriv),
            method: "logarithmic rule",
            methodZh: "對數積分法",
            steps: [
              `${intLatex(`(${base})^(-1)`, ctx)}=\\frac{1}{${toLatex(deriv)}}\\ln\\left|${toLatex(base)}\\right|+C`,
            ],
          };
        }
        const newExp = addOneToExponent(exponent);
        const denom = simplifyExpr(`(${deriv})*(${newExp})`);
        return {
          expr: divideExpr(`(${base})^(${newExp})`, denom),
          method: "power rule with affine substitution",
          methodZh: "一次式代換冪次法則",
          steps: [
            `u=${toLatex(base)},\\quad du=${toLatex(deriv)}\\,${dVar(ctx)}`,
            `${intLatex(`(${base})^(${exponent})`, ctx)}=\\frac{${toLatex(`(${base})^(${newExp})`)}}{${toLatex(denom)}}+C`,
          ],
        };
      }

      if (
        (isFunctionNode(args[0], "sec") || isFunctionNode(args[0], "csc")) &&
        expVal === 2
      ) {
        const arg = functionArg(args[0]);
        if (arg) {
          const inner = arg.toString();
          const d = affineDerivative(inner, ctx);
          if (d) {
            if (isFunctionNode(args[0], "sec")) {
              return {
                expr: divideExpr(`tan(${inner})`, d),
                method: "trigonometric rule",
                methodZh: "三角函數積分法",
                steps: [
                  `${intLatex(`sec(${inner})^2`, ctx)}=\\frac{${toLatex(`tan(${inner})`)}}{${toLatex(d)}}+C`,
                ],
              };
            }
            return {
              expr: simplifyExpr(`-(${divideExpr(`cot(${inner})`, d)})`),
              method: "trigonometric rule",
              methodZh: "三角函數積分法",
              steps: [
                `${intLatex(`csc(${inner})^2`, ctx)}=-\\frac{${toLatex(`cot(${inner})`)}}{${toLatex(d)}}+C`,
              ],
            };
          }
        }
      }
    }
  }

  if (node.type === "FunctionNode") {
    const fn = functionName(node) ?? "";
    const arg = functionArg(node);
    if (arg) {
      if (fn === "sqrt") {
        const root = trySquareRootQuadratic(arg.toString(), "1", false, ctx);
        if (root) return root;
      }
      const mixed = tryValidatedMixedFunctionTechnique(fn, arg, ctx);
      if (mixed) return mixed;
      const inner = arg.toString();
      const d = affineDerivative(inner, ctx);
      if (d) {
        if (fn === "sin")
          return {
            expr: simplifyExpr(`-cos(${inner})/(${d})`),
            method: "trigonometric rule",
            methodZh: "三角函數積分法",
            steps: [
              `${intLatex(`sin(${inner})`, ctx)}=-\\frac{\\cos\\left(${toLatex(inner)}\\right)}{${toLatex(d)}}+C`,
            ],
          };
        if (fn === "cos")
          return {
            expr: divideExpr(`sin(${inner})`, d),
            method: "trigonometric rule",
            methodZh: "三角函數積分法",
            steps: [
              `${intLatex(`cos(${inner})`, ctx)}=\\frac{\\sin\\left(${toLatex(inner)}\\right)}{${toLatex(d)}}+C`,
            ],
          };
        if (fn === "tan")
          return {
            expr: simplifyExpr(`-log(abs(cos(${inner})))/(${d})`),
            method: "trigonometric logarithmic rule",
            methodZh: "三角對數積分法",
            steps: [
              `${intLatex(`tan(${inner})`, ctx)}=-\\frac{1}{${toLatex(d)}}\\ln\\left|\\cos\\left(${toLatex(inner)}\\right)\\right|+C`,
            ],
          };
        if (fn === "exp")
          return {
            expr: divideExpr(`exp(${inner})`, d),
            method: "exponential rule",
            methodZh: "指數積分法",
            steps: [
              `${intLatex(`exp(${inner})`, ctx)}=\\frac{e^{${toLatex(inner)}}}{${toLatex(d)}}+C`,
            ],
          };
        if (fn === "sqrt")
          return {
            expr: divideExpr(`(${inner})^(3/2)`, `(${d})*(3/2)`),
            method: "power rule with affine substitution",
            methodZh: "一次式代換冪次法則",
            steps: [
              `\\sqrt{${toLatex(inner)}}=${toLatex(`(${inner})^(1/2)`)}`,
              `${intLatex(`(${inner})^(1/2)`, ctx)}=\\frac{${toLatex(`(${inner})^(3/2)`)}}{${toLatex(`(${d})*(3/2)`)}}+C`,
            ],
          };
        if (fn === "log" && (ctx.partsUsed ?? 0) < 2) {
          const base = logBase(node)!;
          const factor = base === "e" ? "1" : `log(${base})`;
          const result = divideExpr(
            `(${inner})*log(${inner})-(${inner})`,
            `(${d})*(${factor})`
          );
          return {
            expr: result,
            partsCost: 1,
            method: "affine substitution then integration by parts",
            methodZh: "一次式代換後分部積分",
            steps: [
              `u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`,
              `\\int\\ln u\\,du=u\\ln u-u+C`,
              `${intLatex(text, ctx)}=${toLatex(result)}+C`,
            ],
          };
        }
        if (fn === "cot") {
          const result = divideExpr(`log(abs(sin(${inner})))`, d);
          return {
            expr: result,
            method: "trigonometric logarithmic rule",
            methodZh: "三角對數積分法",
            steps: [`${intLatex(text, ctx)}=${toLatex(result)}+C`],
          };
        }
        if (fn === "sec" || fn === "csc") {
          const result = divideExpr(
            fn === "sec"
              ? `log(abs(sec(${inner})+tan(${inner})))`
              : `log(abs(csc(${inner})-cot(${inner})))`,
            d
          );
          return {
            expr: result,
            method: "substitution for a trigonometric logarithmic form",
            methodZh: "代換成三角對數型",
            steps: [`${intLatex(text, ctx)}=${toLatex(result)}+C`],
          };
        }
      }
    }
  }

  const trigSub = tryTrigSubstitution(node, ctx);
  if (trigSub) return trigSub;

  throw new UnsupportedIntegral(
    "The implemented DSE M2 methods cannot safely solve this expression yet; this does not necessarily mean the question is outside the syllabus. Integration by parts is limited to two uses. Try expanding brackets, splitting terms, rewriting radicals as powers, specifying a single variable, or checking whether the integrand needs integration by parts or a listed trigonometric substitution.",
    "此式暫未能以已實作的 DSE M2 方法安全求解（不代表題目一定超綱）。分部積分最多使用兩次。可嘗試先展開括號、拆項、把根號改寫成冪次、使用單一積分變數，或檢查是否需要分部積分或表內三角代換。"
  );
}

function tryReverseChainFromProduct(
  factors: AnyNode[],
  ctx: IntegrationContext
): Integrated | null {
  const total = combineFactors(factors);
  for (const candidate of factors) {
    if (functionName(candidate) !== "log") continue;
    const u = candidate.toString();
    const du = derivativeExpr(u, ctx);
    const k = proportionalTo(total, `(${u})*(${du})`, ctx);
    if (k) {
      const result = multiplyExpr(k, `(${u})^2/2`);
      return {
        expr: result,
        method: "logarithmic substitution",
        methodZh: "對數代換",
        steps: [
          `u=${toLatex(u)},\\quad du=${toLatex(du)}\\,${dVar(ctx)}`,
          `${intLatex(total, ctx)}=${toLatex(result)}+C`,
        ],
      };
    }
  }
  for (const candidate of factors) {
    if (!["sec", "csc"].includes(functionName(candidate) ?? "")) continue;
    const d = derivativeExpr(candidate.toString(), ctx);
    const k = proportionalTo(total, d, ctx);
    if (k) {
      const result = multiplyExpr(k, candidate.toString());
      return {
        expr: result,
        method: "reverse chain rule",
        methodZh: "反鏈式法則",
        steps: [
          `\\frac{d}{${dVar(ctx)}}${toLatex(candidate.toString())}=${toLatex(d)}`,
          `${intLatex(total, ctx)}=${toLatex(result)}+C`,
        ],
      };
    }
  }
  for (let i = 0; i < factors.length; i++) {
    const candidate = factors[i];
    const rest = combineFactors(factors.filter((_, idx) => idx !== i));

    if (candidate.type === "OperatorNode" && (candidate as any).op === "^") {
      const [baseNode, expNode] = (candidate as any).args as AnyNode[];
      const base = baseNode.toString();
      const exponent = expNode.toString();
      const expVal = constantValue(exponent, ctx);
      if (
        expVal === 2 &&
        ["sec", "csc"].includes(functionName(unwrapNode(baseNode)) ?? "")
      ) {
        const trig = unwrapNode(baseNode);
        const inner = functionArg(trig)!.toString();
        const d = derivativeExpr(inner, ctx);
        const k = proportionalTo(rest, d, ctx);
        if (k) {
          const result = multiplyExpr(
            k,
            functionName(trig) === "sec" ? `tan(${inner})` : `-cot(${inner})`
          );
          return {
            expr: result,
            method: "reverse chain rule",
            methodZh: "反鏈式法則",
            steps: [
              `u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`,
              `${intLatex(combineFactors(factors), ctx)}=${toLatex(result)}+C`,
            ],
          };
        }
      }
      if (expVal !== null) {
        const d = derivativeExpr(base, ctx);
        const k = proportionalTo(rest, d, ctx);
        if (k) {
          if (Math.abs(expVal + 1) < 1e-10) {
            return {
              expr: multiplyExpr(k, `log(abs(${base}))`),
              method: "reverse chain rule",
              methodZh: "反鏈式法則",
              steps: [
                `u=${toLatex(base)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`,
                `${intLatex(`${rest}*(${base})^(${exponent})`, ctx)}=${toLatex(k)}\\ln\\left|${toLatex(base)}\\right|+C`,
              ],
            };
          }
          const newExp = addOneToExponent(exponent);
          return {
            expr: multiplyExpr(k, divideExpr(`(${base})^(${newExp})`, newExp)),
            method: "reverse chain rule",
            methodZh: "反鏈式法則",
            steps: [
              `u=${toLatex(base)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`,
              `${intLatex(`${rest}*(${base})^(${exponent})`, ctx)}=${toLatex(k)}\\cdot\\frac{${toLatex(`(${base})^(${newExp})`)}}{${toLatex(newExp)}}+C`,
            ],
          };
        }
      }
    }

    if (candidate.type === "FunctionNode") {
      const fn = functionName(candidate) ?? "";
      const arg = functionArg(candidate);
      if (!arg) continue;
      const inner = arg.toString();
      const d = derivativeExpr(inner, ctx);
      const k = proportionalTo(rest, d, ctx);
      if (!k) continue;
      if (fn === "sqrt") {
        const result = multiplyExpr(k, `2*(${inner})^(3/2)/3`);
        return {
          expr: result,
          method: "reverse chain rule",
          methodZh: "反鏈式法則",
          steps: [
            `u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`,
            `${intLatex(combineFactors(factors), ctx)}=${toLatex(result)}+C`,
          ],
        };
      }
      if (fn === "exp")
        return {
          expr: multiplyExpr(k, `exp(${inner})`),
          method: "reverse chain rule",
          methodZh: "反鏈式法則",
          steps: [
            `u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`,
            `${intLatex(`${rest}*exp(${inner})`, ctx)}=${toLatex(k)}e^{${toLatex(inner)}}+C`,
          ],
        };
      if (fn === "sin")
        return {
          expr: multiplyExpr(k, `-cos(${inner})`),
          method: "reverse chain rule",
          methodZh: "反鏈式法則",
          steps: [
            `u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`,
            `${intLatex(`${rest}*sin(${inner})`, ctx)}=-${toLatex(k)}\\cos(${toLatex(inner)})+C`,
          ],
        };
      if (fn === "cos")
        return {
          expr: multiplyExpr(k, `sin(${inner})`),
          method: "reverse chain rule",
          methodZh: "反鏈式法則",
          steps: [
            `u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`,
            `${intLatex(`${rest}*cos(${inner})`, ctx)}=${toLatex(k)}\\sin(${toLatex(inner)})+C`,
          ],
        };
    }
  }
  return null;
}

function tryBaseLogByParts(ctx: IntegrationContext, base: string): Integrated {
  const v = ctx.variable;
  const vl = variableLatex(v);
  const display = logBaseDisplay(base, v);
  const isNatural = base === "e";
  const result = isNatural
    ? `${v}*log(${v})-${v}`
    : `${v}*log(${v},${base})-${v}/log(${base})`;
  return {
    expr: result,
    method: isNatural
      ? "integration by parts"
      : "integration by parts with change of base",
    methodZh: isNatural ? "分部積分法" : "換底後分部積分法",
    steps: [
      ...display.setup,
      `u=${display.latex},\\quad dv=1\\,${dVar(ctx)}`,
      `du=${display.du}\\,${dVar(ctx)},\\quad v=${vl}`,
      `${intLatex(display.expr, ctx)}=${vl}${display.latex}-${intLatex(isNatural ? "1" : `1/log(${base})`, ctx)}`,
      isNatural
        ? `${intLatex(display.expr, ctx)}=${vl}\\ln ${vl}-${vl}+C`
        : `${intLatex(display.expr, ctx)}=${vl}${display.latex}-\\frac{${vl}}{\\ln ${toLatex(base)}}+C`,
    ],
  };
}

function tryNaturalLogByParts(ctx: IntegrationContext): Integrated {
  return tryBaseLogByParts(ctx, "e");
}

function tryCommonLogByParts(ctx: IntegrationContext): Integrated {
  return tryBaseLogByParts(ctx, "10");
}

function tryByParts(
  factors: AnyNode[],
  ctx: IntegrationContext
): Integrated | null {
  if (factors.length < 2 || ctx.depth > 7 || (ctx.partsUsed ?? 0) >= 2)
    return null;

  const logIndex = factors.findIndex(factor =>
    isFixedBaseLogOfVariable(factor, ctx)
  );
  if (logIndex >= 0) {
    const logFactor = factors[logIndex];
    const base = logBase(logFactor)!;
    const isNatural = base === "e";
    const dvExpr = combineFactors(factors.filter((_, idx) => idx !== logIndex));
    const degree = algebraicDegree(dvExpr, ctx);
    if (degree !== null || dvExpr === "1") {
      const n = degree ?? 0;
      const denom = n + 1;
      const power = `${ctx.variable}^${denom}`;
      const display = logBaseDisplay(base, ctx.variable);
      const logExpr = display.expr;
      const first = `(${power})*(${logExpr})/${denom}`;
      const second = isNatural
        ? `(${power})/(${denom * denom})`
        : `(${power})/(${denom * denom}*log(${base}))`;
      const result = simplifyExpr(`(${first})-(${second})`);
      const vl = variableLatex(ctx.variable);
      const logLatex = display.latex;
      const duLatex = display.du;
      const method = isNatural
        ? "integration by parts"
        : "integration by parts with change of base";
      const methodZh = isNatural ? "分部積分法" : "換底後分部積分法";
      const setup = display.setup;
      return {
        expr: result,
        method,
        methodZh,
        steps: [
          ...setup,
          `u=${logLatex},\\quad dv=${toLatex(dvExpr)}\\,${dVar(ctx)}`,
          `du=${duLatex}\\,${dVar(ctx)},\\quad v=\\frac{${vl}^{${denom}}}{${denom}}`,
          `${intLatex(combineFactors(factors), ctx)}=\\frac{${vl}^{${denom}}}{${denom}}${logLatex}-${intLatex(isNatural ? `(${ctx.variable}^${denom}/${denom})/${ctx.variable}` : `(${ctx.variable}^${denom}/${denom})/(${ctx.variable}*log(${base}))`, ctx)}`,
          `${intLatex(combineFactors(factors), ctx)}=${toLatex(result)}+C`,
        ],
      };
    }
  }

  const ranked = factors
    .map((factor, index) => ({
      factor,
      index,
      priority: byPartsPriority(factor, ctx),
    }))
    .filter(item => item.priority > 0)
    .sort((a, b) => b.priority - a.priority);

  for (const item of ranked) {
    const u = item.factor.toString();
    const du = simplifyExpr(derivativeExpr(u, ctx));
    if (!du || isZeroExpr(du, ctx)) continue;
    const dvExpr = combineFactors(
      factors.filter((_, idx) => idx !== item.index)
    );
    try {
      const vIntegral = integrateNode(parse(dvExpr), {
        ...ctx,
        depth: ctx.depth + 1,
        partsUsed: (ctx.partsUsed ?? 0) + 1,
      });
      const vExpr = vIntegral.expr;
      const remainingIntegrand = multiplyExpr(vExpr, du);
      const remainingIntegral = integrateNode(parse(remainingIntegrand), {
        ...ctx,
        depth: ctx.depth + 1,
        partsUsed: (ctx.partsUsed ?? 0) + 1 + (vIntegral.partsCost ?? 0),
      });
      const result = simplifyExpr(
        `(${u})*(${vExpr})-(${remainingIntegral.expr})`
      );
      return {
        expr: result,
        partsCost:
          1 + (vIntegral.partsCost ?? 0) + (remainingIntegral.partsCost ?? 0),
        method: "integration by parts",
        methodZh: "分部積分法",
        steps: [
          ...vIntegral.steps,
          `u=${toLatex(u)},\\quad dv=${toLatex(dvExpr)}\\,${dVar(ctx)}`,
          `du=${toLatex(du)}\\,${dVar(ctx)},\\quad v=${toLatex(vExpr)}`,
          `${intLatex(combineFactors(factors), ctx)}=${toLatex(u)}${toLatex(vExpr)}-${intLatex(remainingIntegrand, ctx)}`,
          ...remainingIntegral.steps,
          `${intLatex(combineFactors(factors), ctx)}=${toLatex(result)}+C`,
        ],
      };
    } catch {
      continue;
    }
  }
  return null;
}

function structuralZero(expr: string): boolean {
  try {
    return simplify(expr).toString() === "0";
  } catch {
    return false;
  }
}

function matches(expr: string, pattern: string): boolean {
  return structuralZero(`(${expr})-(${pattern})`);
}

function detectSquareConstant(
  inner: string,
  patternFactory: (a2: number) => string
): number | null {
  const vars = Array.from(collectVariables(parse(inner)));
  const ctx = { variable: vars[0] ?? "x", depth: 0 };
  const p = exprToPolynomial(inner, ctx);
  if (!p || polyDegree(p) !== 2 || p[0] <= 0) return null;
  return matches(inner, patternFactory(p[0])) ? p[0] : null;
}

function sqrtOf(node: AnyNode): string | null {
  if (isFunctionNode(node, "sqrt")) {
    const arg = functionArg(node);
    return arg ? arg.toString() : null;
  }
  if (node.type === "OperatorNode" && (node as any).op === "^") {
    const [baseNode, expNode] = (node as any).args as AnyNode[];
    if (matches(expNode.toString(), "1/2")) return baseNode.toString();
  }
  return null;
}

function sqrtExpr(inner: string): string {
  return `sqrt(${inner})`;
}

function isPerfectSquareInteger(n: number): boolean {
  const root = Math.sqrt(n);
  return Number.isInteger(root);
}

function exactSqrtExpr(n: number): string {
  return isPerfectSquareInteger(n)
    ? String(Math.sqrt(n))
    : `sqrt(${rationalNumberString(n)})`;
}

function exactSqrtLatex(n: number): string {
  return isPerfectSquareInteger(n)
    ? toLatex(String(Math.sqrt(n)))
    : `\\sqrt{${toLatex(String(n))}}`;
}

function substitutionAngle(ctx: IntegrationContext): string {
  return ctx.variable === "θ" || ctx.variable === "theta" ? "φ" : "θ";
}

function tryTrigSubstitution(
  node: AnyNode,
  ctx: IntegrationContext
): Integrated | null {
  const v = ctx.variable;
  const vl = variableLatex(v);
  const expr = node.toString();
  const angle = substitutionAngle(ctx);
  const angleLatex = variableLatex(angle);

  const divisionNode =
    node.type === "OperatorNode" && (node as any).op === "/"
      ? (node as any)
      : null;
  const reciprocalNumerator = divisionNode
    ? divisionNode.args[0].toString()
    : "1";
  const reciprocalDenominator =
    divisionNode && !hasVariable(reciprocalNumerator, ctx)
      ? (divisionNode.args[1] as AnyNode)
      : null;

  if (reciprocalDenominator) {
    const denomText = reciprocalDenominator.toString();
    const sqrtInner = sqrtOf(reciprocalDenominator);

    const a2ForAtan = detectSquareConstant(denomText, a2 => `${a2}+(${v})^2`);
    if (a2ForAtan !== null) {
      const numerator = simplifyExpr(reciprocalNumerator);
      const aExpr = exactSqrtExpr(a2ForAtan);
      const aLatex = exactSqrtLatex(a2ForAtan);
      const numeratorLatex = toLatex(numerator);
      const coefficientLatex = isOne(numerator)
        ? ""
        : `${numeratorLatex}\\cdot `;
      const result = isOne(numerator)
        ? `atan((${v})/(${aExpr}))/(${aExpr})`
        : `(${numerator})*atan((${v})/(${aExpr}))/(${aExpr})`;
      const exactLatex = `\\frac{${isOne(numerator) ? "1" : numeratorLatex}}{${aLatex}}\\tan^{-1}\\left(\\frac{${vl}}{${aLatex}}\\right)`;
      return {
        expr: result,
        method: "trigonometric substitution / arctangent rule",
        methodZh: "三角代換法／反正切公式",
        exactLatex,
        steps: [
          `${vl}=${aLatex}\\tan ${angleLatex},\\quad ${dVar(ctx)}=${aLatex}\\sec^2 ${angleLatex}\\,d${angleLatex}`,
          `${toLatex(`${a2ForAtan}+(${v})^2`)}=${toLatex(String(a2ForAtan))}\\sec^2 ${angleLatex}`,
          `${intLatex(expr, ctx)}=\\int\\frac{${coefficientLatex}${aLatex}\\sec^2 ${angleLatex}}{${toLatex(String(a2ForAtan))}\\sec^2 ${angleLatex}}\\,d${angleLatex}`,
          `${intLatex(expr, ctx)}=\\frac{${isOne(numerator) ? "1" : numeratorLatex}}{${aLatex}}${angleLatex}+C`,
          `${angleLatex}=\\tan^{-1}\\left(\\frac{${vl}}{${aLatex}}\\right)`,
          `${intLatex(expr, ctx)}=${exactLatex}+C`,
        ],
      };
    }

    if (sqrtInner) {
      const a2ForAsin = detectSquareConstant(sqrtInner, a2 => `${a2}-(${v})^2`);
      if (a2ForAsin !== null) {
        const a = exactSqrtExpr(a2ForAsin);
        const aLatex = toLatex(a);
        const result = `asin((${v})/${a})`;
        return {
          expr: result,
          method: "trigonometric substitution",
          methodZh: "三角代換法",
          steps: [
            `${vl}=${aLatex}\\sin ${angleLatex},\\quad ${dVar(ctx)}=${aLatex}\\cos ${angleLatex}\\,d${angleLatex}`,
            `\\sqrt{${toLatex(`${a2ForAsin}-(${v})^2`)}}=${aLatex}\\cos ${angleLatex}`,
            `${intLatex(expr, ctx)}=\\int\\frac{${aLatex}\\cos ${angleLatex}}{${aLatex}\\cos ${angleLatex}}\\,d${angleLatex}`,
            `${intLatex(expr, ctx)}=${angleLatex}+C`,
            `${angleLatex}=\\sin^{-1}\\left(\\frac{${vl}}{${aLatex}}\\right)`,
            `${intLatex(expr, ctx)}=${toLatex(result)}+C`,
          ],
        };
      }
    }
  }

  const sqrtInner = sqrtOf(node);
  if (sqrtInner) {
    const a2Minus = detectSquareConstant(sqrtInner, a2 => `${a2}-(${v})^2`);
    if (a2Minus !== null) {
      const a = exactSqrtExpr(a2Minus);
      const aLatex = toLatex(a);
      const result = simplifyExpr(
        `(${v})*sqrt(${a2Minus}-(${v})^2)/2+(${a2Minus})*asin((${v})/${a})/2`
      );
      return {
        expr: result,
        method: "trigonometric substitution",
        methodZh: "三角代換法",
        steps: [
          `${vl}=${aLatex}\\sin ${angleLatex},\\quad ${dVar(ctx)}=${aLatex}\\cos ${angleLatex}\\,d${angleLatex}`,
          `\\sqrt{${toLatex(`${a2Minus}-(${v})^2`)}}=${aLatex}\\cos ${angleLatex}`,
          `${intLatex(expr, ctx)}=\\int ${toLatex(String(a2Minus))}\\cos^2 ${angleLatex}\\,d${angleLatex}`,
          `\\cos^2 ${angleLatex}=\\frac{1+\\cos 2${angleLatex}}{2}`,
          `${intLatex(expr, ctx)}=\\frac{${toLatex(String(a2Minus))}}{2}${angleLatex}+\\frac{${toLatex(String(a2Minus))}}{4}\\sin 2${angleLatex}+C`,
          `${angleLatex}=\\sin^{-1}\\left(\\frac{${vl}}{${aLatex}}\\right),\\quad \\sin 2${angleLatex}=\\frac{2${vl}\\sqrt{${toLatex(`${a2Minus}-(${v})^2`)}}}{${toLatex(String(a2Minus))}}`,
          `${intLatex(expr, ctx)}=${toLatex(result)}+C`,
        ],
      };
    }

    const a2Plus = detectSquareConstant(sqrtInner, a2 => `${a2}+(${v})^2`);
    if (a2Plus !== null) {
      const a = exactSqrtExpr(a2Plus);
      const aLatex = toLatex(a);
      const result = simplifyExpr(
        `(${v})*sqrt((${v})^2+${a2Plus})/2+(${a2Plus})*log(abs(${v}+sqrt((${v})^2+${a2Plus})))/2`
      );
      return {
        expr: result,
        partsCost: 1,
        method: "trigonometric substitution",
        methodZh: "三角代換法",
        steps: [
          `${vl}=${aLatex}\\tan ${angleLatex},\\quad ${dVar(ctx)}=${aLatex}\\sec^2 ${angleLatex}\\,d${angleLatex}`,
          `\\sqrt{${toLatex(`${a2Plus}+(${v})^2`)}}=${aLatex}\\sec ${angleLatex}`,
          `${intLatex(expr, ctx)}=\\int ${toLatex(String(a2Plus))}\\sec^3 ${angleLatex}\\,d${angleLatex}`,
          `\\int\\sec^3 ${angleLatex}\\,d${angleLatex}=\\frac{1}{2}\\sec ${angleLatex}\\tan ${angleLatex}+\\frac{1}{2}\\ln|\\sec ${angleLatex}+\\tan ${angleLatex}|`,
          `${angleLatex}=\\tan^{-1}\\left(\\frac{${vl}}{${aLatex}}\\right)`,
          `${intLatex(expr, ctx)}=${toLatex(result)}+C`,
        ],
      };
    }
  }

  return null;
}

export function calculateIntegral(
  input: string,
  preferredVariable?: string
): IntegralResult {
  const normalized = preprocess(input);
  if (!normalized) {
    return {
      input,
      normalized,
      status: "invalid",
      integrandLatex: "",
      method: "invalid input",
      methodZh: "輸入無效",
      stepsLatex: [],
      hintEn:
        "Please enter an expression, for example x^2 + sin(2*x), t^2, or sin(θ).",
      hintZh: "請輸入式子，例如 x^2 + sin(2*x)、t^2 或 sin(θ)。",
    };
  }

  try {
    const node = parse(normalized);
    const detected = detectVariable(
      node,
      preferredVariable ? preprocess(preferredVariable) : undefined
    );
    if (detected === "__multiple__" || !detected) {
      return {
        input,
        normalized,
        status: "unsupported",
        integrandLatex: toLatex(normalized),
        method: "ambiguous variable",
        methodZh: "積分變數不明確",
        stepsLatex: [],
        hintEn:
          "The expression contains more than one variable. Please use a single integration variable, such as x, t, y, α, β, θ, or φ.",
        hintZh:
          "此式含有多於一個變數。請使用單一積分變數，例如 x、t、y、α、β、θ 或 φ。",
      };
    }
    const ctx: IntegrationContext = { variable: detected, depth: 0 };
    let outOfScope = false;
    node.traverse((n: any) => {
      if (
        n.type === "FunctionNode" &&
        ["asin", "acos", "atan"].includes(n.fn?.name)
      )
        outOfScope = true;
    });
    if (outOfScope)
      throw new UnsupportedIntegral(
        "Integrands containing inverse trigonometric functions are not required in the HKDSE M2 curriculum. Inverse trig functions may still appear in answers to trigonometric substitutions.",
        "含反三角函數的被積函數並非 HKDSE M2 必須課程內容；但三角代換的答案可包含反三角函數。"
      );
    let integrated: Integrated;
    try {
      integrated = integrateNode(node, ctx);
    } catch (error) {
      const simplified = simplifyExpr(normalized);
      if (simplified === normalized) throw error;
      try {
        integrated = integrateNode(parse(simplified), ctx);
        integrated.steps.unshift(
          `${toLatex(normalized)}=${toLatex(simplified)}`
        );
      } catch {
        throw error;
      }
    }
    const preserveExactForm = integrated.method.includes("arctangent rule");
    const simplifiedAnswer = preserveExactForm
      ? integrated.expr
      : simplifyExpr(integrated.expr);
    return {
      input,
      normalized,
      status: "ok",
      integrandLatex: toLatex(normalized),
      answerLatex: `${integrated.exactLatex ?? toLatex(simplifiedAnswer)}+C`,
      antiderivative: simplifiedAnswer,
      method: integrated.method,
      methodZh: integrated.methodZh,
      stepsLatex: integrated.steps,
      variable: detected,
      variableLatex: variableLatex(detected),
    };
  } catch (error) {
    if (error instanceof UnsupportedIntegral) {
      return {
        input,
        normalized,
        status: "unsupported",
        integrandLatex: toLatex(normalized),
        method: "unsupported HKDSE M2 pattern",
        methodZh: "暫未支援的 HKDSE M2 模式",
        stepsLatex: [],
        hintEn: error.hintEn,
        hintZh: error.hintZh,
      };
    }
    return {
      input,
      normalized,
      status: "invalid",
      integrandLatex: input,
      method: "invalid input",
      methodZh: "輸入無效",
      stepsLatex: [],
      hintEn:
        "The expression could not be parsed. Use * for multiplication, ^ for powers, and function brackets such as sin(x), sin(t), or sin(θ).",
      hintZh:
        "系統未能讀取此表達式。請使用 * 表示乘法、^ 表示冪次，函數請寫成 sin(x)、sin(t) 或 sin(θ) 等格式。",
    };
  }
}

function intervalIssue(
  node: AnyNode,
  ctx: IntegrationContext,
  lower: number,
  upper: number
): string | null {
  const lo = Math.min(lower, upper),
    hi = Math.max(lower, upper);
  let issue: string | null = null;
  const argumentRange = (arg: AnyNode): [number, number] | null => {
    try {
      const text = arg.toString();
      const points = [lo, hi];
      if (hasVariable(text, ctx)) {
        const d1 = derivativeExpr(text, ctx);
        const d2 = derivativeExpr(d1, ctx);
        if (hasVariable(d2, ctx)) return null;
        const curvature = constantValue(d2, ctx);
        if (curvature === null) return null;
        if (Math.abs(curvature) > 1e-12) {
          const vertex = -evalExpr(d1, ctx.variable, 0) / curvature;
          if (vertex > lo && vertex < hi) points.push(vertex);
        } else if (hasVariable(d1, ctx)) return null;
      }
      const values = points.map(x => evalExpr(text, ctx.variable, x));
      if (!values.every(Number.isFinite)) return null;
      return [Math.min(...values), Math.max(...values)];
    } catch {
      return null;
    }
  };
  const crossesTrigZero = (arg: AnyNode, offset: number): boolean => {
    const range = argumentRange(arg);
    if (!range) {
      issue = "unverified-domain";
      return false;
    }
    return (
      Math.ceil((range[0] - offset) / Math.PI - 1e-10) <=
      Math.floor((range[1] - offset) / Math.PI + 1e-10)
    );
  };
  const containsRoot = (raw: AnyNode): boolean => {
    const n = unwrapNode(raw) as any;
    if (n.type === "FunctionNode") {
      const fn = functionName(n);
      if (fn === "sqrt" || fn === "abs") return containsRoot(n.args[0]);
      if (fn === "exp" || fn === "sec" || fn === "csc") return false;
      if (fn === "log")
        return containsRoot(parse(`(${n.args[0].toString()})-1`));
      if (["sin", "cos", "tan", "cot"].includes(fn ?? ""))
        return crossesTrigZero(
          n.args[0],
          fn === "cos" || fn === "cot" ? Math.PI / 2 : 0
        );
    }
    if (n.type === "OperatorNode" && n.op === "*")
      return n.args.some(containsRoot);
    if (n.type === "OperatorNode" && n.op === "^") {
      const power = constantValue(n.args[1].toString(), ctx);
      if (power !== null) return power !== 0 && containsRoot(n.args[0]);
      if (!hasVariable(n.args[0].toString(), ctx)) return false;
    }
    const p = nodeToPolynomial(n, ctx);
    if (p) {
      if (polyDegree(p) === 0) return p[0] === 0;
      if (polyDegree(p) === 1) {
        const r = -p[0] / p[1];
        return r >= lo - 1e-10 && r <= hi + 1e-10;
      }
      if (polyDegree(p) === 2) {
        const [c, b, a] = p,
          discriminant = b * b - 4 * a * c;
        return (
          discriminant >= 0 &&
          [
            (-b + Math.sqrt(discriminant)) / (2 * a),
            (-b - Math.sqrt(discriminant)) / (2 * a),
          ].some(r => r >= lo - 1e-10 && r <= hi + 1e-10)
        );
      }
    }
    return false;
  };
  node.traverse((n: any) => {
    if (issue) return;
    if (n.type === "OperatorNode" && n.op === "/" && containsRoot(n.args[1]))
      issue = "singularity";
    if (
      n.type === "OperatorNode" &&
      n.op === "^" &&
      Number(constantValue(n.args[1].toString(), ctx) ?? 0) < 0 &&
      containsRoot(n.args[0])
    )
      issue = "singularity";
    if (
      n.type === "FunctionNode" &&
      ["tan", "sec", "cot", "csc"].includes(n.fn?.name)
    ) {
      if (
        crossesTrigZero(
          n.args[0],
          ["tan", "sec"].includes(n.fn.name) ? Math.PI / 2 : 0
        )
      )
        issue = "singularity";
    }
    if (n.type === "FunctionNode" && ["log", "sqrt"].includes(n.fn?.name)) {
      const arg = n.args[0];
      const p = nodeToPolynomial(arg, ctx);
      const points = [lo, hi];
      if (p && polyDegree(p) === 2) {
        const vertex = -p[1] / (2 * p[2]);
        if (vertex > lo && vertex < hi) points.push(vertex);
      } else
        for (let i = 1; i < 32; i++) points.push(lo + ((hi - lo) * i) / 32);
      if (
        points.some(x => {
          const y = evalExpr(arg.toString(), ctx.variable, x);
          return (
            !Number.isFinite(y) || (n.fn.name === "log" ? y <= 0 : y < -1e-10)
          );
        })
      )
        issue = "real-domain";
    }
  });
  // Also reject non-real interiors (e.g. a fractional power of a negative number).
  if (!issue)
    for (let i = 1; i < 32; i++) {
      try {
        const y = evalExpr(
          node.toString(),
          ctx.variable,
          lo + ((hi - lo) * i) / 32
        );
        if (!Number.isFinite(y)) {
          issue = "real-domain";
          break;
        }
      } catch {
        issue = "real-domain";
        break;
      }
    }
  return issue;
}

function tryAbsoluteSymmetry(
  node: AnyNode,
  ctx: IntegrationContext,
  lower: string,
  upper: string
): DefiniteIntegralResult | null {
  let absolute = false,
    eligible = true;
  node.traverse((n: any) => {
    if (n.type === "FunctionNode") {
      if (
        n.fn?.name === "abs" &&
        unwrapNode(n.args[0]).toString() === ctx.variable
      )
        absolute = true;
      else eligible = false;
    }
  });
  if (!absolute || !eligible) return null;
  const a = constantValue(lower),
    b = constantValue(upper);
  if (a === null || b === null || Math.abs(a + b) > 1e-10 || a === b)
    return null;
  const text = node.toString();
  const odd = [0.3, 0.7, 1.2].every(
    x =>
      Math.abs(
        evalExpr(text, ctx.variable, x) + evalExpr(text, ctx.variable, -x)
      ) < 1e-9
  );
  const even = [0.3, 0.7, 1.2].every(
    x =>
      Math.abs(
        evalExpr(text, ctx.variable, x) - evalExpr(text, ctx.variable, -x)
      ) < 1e-9
  );
  if (!odd && !even) return null;
  let value = "0",
    steps = [
      `f(-${variableLatex(ctx.variable)})=-f(${variableLatex(ctx.variable)})`,
      `\\int_{${toLatex(lower)}}^{${toLatex(upper)}}${toLatex(text)}\\,${dVar(ctx)}=0`,
    ];
  if (even) {
    const positive = (node as any)
      .transform((n: any) =>
        n.type === "FunctionNode" && n.fn?.name === "abs" ? n.args[0] : n
      )
      .toString();
    const limit = b > 0 ? upper : lower;
    const result = calculateDefiniteIntegral(
      positive,
      "0",
      limit,
      ctx.variable
    );
    if (result.status !== "ok" || !result.valueExpr) return null;
    value = multiplyExpr(b > 0 ? "2" : "-2", result.valueExpr);
    steps = [
      `f(-${variableLatex(ctx.variable)})=f(${variableLatex(ctx.variable)})`,
      `\\int_{${toLatex(lower)}}^{${toLatex(upper)}}${toLatex(text)}\\,${dVar(ctx)}=${b > 0 ? "2" : "-2"}\\int_0^{${toLatex(limit)}}${toLatex(positive)}\\,${dVar(ctx)}`,
      ...result.stepsLatex,
      `=${toLatex(value)}`,
    ];
  }
  return {
    input: text,
    normalized: text,
    lower,
    upper,
    lowerLatex: toLatex(lower),
    upperLatex: toLatex(upper),
    integrandLatex: toLatex(text),
    status: "ok",
    valueExpr: value,
    valueLatex: toLatex(value),
    method: odd ? "odd-function symmetry" : "even-function symmetry",
    methodZh: odd ? "奇函數對稱性" : "偶函數對稱性",
    stepsLatex: steps,
    variable: ctx.variable,
    variableLatex: variableLatex(ctx.variable),
  };
}

export function calculateDefiniteIntegral(
  input: string,
  lowerInput: string,
  upperInput: string,
  preferredVariable?: string
): DefiniteIntegralResult {
  const normalized = preprocess(input);
  const lower = preprocess(lowerInput);
  const upper = preprocess(upperInput);
  const invalidBase = {
    input,
    normalized,
    lower,
    upper,
    lowerLatex: lower ? toLatex(lower) : "",
    upperLatex: upper ? toLatex(upper) : "",
    integrandLatex: normalized ? toLatex(normalized) : "",
    stepsLatex: [] as string[],
  };

  if (!normalized || !lower || !upper) {
    return {
      ...invalidBase,
      status: "invalid",
      method: "invalid input",
      methodZh: "輸入無效",
      hintEn: "Please enter an integrand, a lower limit, and an upper limit.",
      hintZh: "請輸入被積函數、下限及上限。",
    };
  }

  try {
    const node = parse(normalized);
    const detected = detectVariable(
      node,
      preferredVariable ? preprocess(preferredVariable) : undefined
    );
    if (detected === "__multiple__" || !detected) {
      return {
        ...invalidBase,
        status: "unsupported",
        method: "ambiguous variable",
        methodZh: "積分變數不明確",
        hintEn:
          "The integrand contains more than one variable. Please use a single integration variable, such as x, t, y, α, β, θ, or φ.",
        hintZh:
          "被積函數含有多於一個變數。請使用單一積分變數，例如 x、t、y、α、β、θ 或 φ。",
      };
    }

    const ctx: IntegrationContext = { variable: detected, depth: 0 };
    if (hasVariable(lower, ctx) || hasVariable(upper, ctx)) {
      return {
        ...invalidBase,
        status: "unsupported",
        method: "variable limits are not supported",
        methodZh: "暫不支援含積分變數的上下限",
        variable: detected,
        variableLatex: variableLatex(detected),
        hintEn:
          "For this student version, the limits should be constants, for example 0, 1, 2, pi/2, or e.",
        hintZh: "學生版定積分上下限請使用常數，例如 0、1、2、pi/2 或 e。",
      };
    }

    const low = constantValue(lower),
      high = constantValue(upper);
    if (low === null || high === null)
      return {
        ...invalidBase,
        status: "invalid",
        method: "invalid limits",
        methodZh: "上下限無效",
        hintEn: "Use finite real constant limits, such as 0, pi/2 or sqrt(3).",
        hintZh: "上下限請使用有限實數常數，例如 0、pi/2 或 sqrt(3)。",
      };
    const issue = intervalIssue(node, ctx, low, high);
    if (issue)
      return {
        ...invalidBase,
        status: "unsupported",
        method: "check interval and real domain",
        methodZh: "請檢查區間及實數定義域",
        hintEn:
          issue === "singularity"
            ? "The interval contains a point where the integrand is undefined. Directly subtracting endpoint values is not valid; improper integrals are outside this calculator's DSE M2 scope."
            : issue === "unverified-domain"
              ? "The calculator cannot yet verify that this nonlinear trigonometric argument avoids every pole on the interval. Please check the domain; this is not an automatic claim that the question is outside the syllabus."
              : "The integrand is not real and defined throughout this interval. Check logarithm and square-root domains.",
        hintZh:
          issue === "singularity"
            ? "此區間含有被積函數未定義的點，不能直接用上下限相減；瑕積分不在本計算器的 DSE M2 範圍內。"
            : issue === "unverified-domain"
              ? "計算器暫未能確認此非一次三角內函數在區間內避開所有極點。請先檢查定義域；這不代表題目一定超綱。"
              : "被積函數在此區間並非處處為已定義的實數；請檢查對數與根號的定義域。",
      };
    const absoluteSymmetry = tryAbsoluteSymmetry(node, ctx, lower, upper);
    if (absoluteSymmetry) return { ...absoluteSymmetry, input };
    const indefinite = calculateIntegral(input, detected);
    if (indefinite.status !== "ok" || !indefinite.antiderivative) {
      return {
        ...invalidBase,
        status: indefinite.status,
        method: indefinite.method,
        methodZh: indefinite.methodZh,
        stepsLatex: indefinite.stepsLatex,
        hintEn:
          indefinite.hintEn ??
          "The corresponding indefinite integral is not supported yet, so the definite integral cannot be evaluated automatically.",
        hintZh:
          indefinite.hintZh ??
          "系統暫未支援相應的不定積分，因此未能自動計算此定積分。",
        variable: detected,
        variableLatex: variableLatex(detected),
        indefinite,
      };
    }

    const F = indefinite.antiderivative;
    const preserveExactArctan = false;
    const upperSub = preserveExactArctan
      ? substituteVariable(F, detected, `(${upper})`)
      : simplifyExpr(substituteVariable(F, detected, `(${upper})`));
    const lowerSub = preserveExactArctan
      ? substituteVariable(F, detected, `(${lower})`)
      : simplifyExpr(substituteVariable(F, detected, `(${lower})`));
    const valueExpr = preserveExactArctan
      ? `(${upperSub})-(${lowerSub})`
      : simplifyExpr(`(${upperSub})-(${lowerSub})`);
    const vLatex = variableLatex(detected);
    const valueLatex = toLatex(valueExpr);
    const antiderivativeLatex =
      preserveExactArctan && indefinite.answerLatex
        ? indefinite.answerLatex.replace(/\+C$/, "")
        : toLatex(F);
    const stepsLatex = [
      `F(${vLatex})=${antiderivativeLatex}`,
      `\\int_{${toLatex(lower)}}^{${toLatex(upper)}} ${toLatex(normalized)}\\,d${vLatex}=F\\left(${toLatex(upper)}\\right)-F\\left(${toLatex(lower)}\\right)`,
      `=${toLatex(upperSub)}-\\left(${toLatex(lowerSub)}\\right)`,
      `=${valueLatex}`,
    ];

    return {
      input,
      normalized,
      lower,
      upper,
      lowerLatex: toLatex(lower),
      upperLatex: toLatex(upper),
      status: "ok",
      integrandLatex: toLatex(normalized),
      antiderivativeLatex,
      valueExpr,
      valueLatex,
      method: `definite integral using ${indefinite.method}`,
      methodZh: `利用「${indefinite.methodZh}」先求原函數，再代入上下限`,
      stepsLatex,
      variable: detected,
      variableLatex: vLatex,
      indefinite,
    };
  } catch {
    return {
      ...invalidBase,
      status: "invalid",
      method: "invalid input",
      methodZh: "輸入無效",
      hintEn:
        "The definite integral could not be parsed. Use * for multiplication, ^ for powers, and constant limits such as 0, 1, 2 or pi/2.",
      hintZh:
        "系統未能讀取此定積分。請使用 * 表示乘法、^ 表示冪次，並使用常數上下限如 0、1、2 或 pi/2。",
    };
  }
}

export const definiteIntegralExamples = [
  { expression: "x^2", lower: "0", upper: "2" },
  { expression: "sin(x)", lower: "0", upper: "pi" },
  { expression: "cos(2*x)", lower: "0", upper: "pi/4" },
  { expression: "sec(x)^2", lower: "0", upper: "pi/4" },
  { expression: "2^x", lower: "0", upper: "3" },
  { expression: "log(x,2)", lower: "1", upper: "2" },
  { expression: "θ*sin(θ)", lower: "0", upper: "pi" },
];

export const integralExamples = [
  "x^2 + 3*x - 1",
  "sin(2*x+1)",
  "t^2 + 3*t",
  "sin(θ)",
  "x*sin(x)",
  "x*exp(x)",
  "x^2*ln(x)",
  "x^2*log(x)",
  "log(x,2)",
  "2^x",
  "10^t",
  "exp(x)*sin(x)",
  "exp(x)*cos(x)",
  "sin(ln(x))",
  "cos(sqrt(x))",
  "(x^3+1)/(x+1)",
  "log(y)",
  "1/(4+x^2)",
  "1/sqrt(9-x^2)",
  "sqrt(9-x^2)",
  "sqrt(4+x^2)",
  "(3*x+2)^5",
  "2*x/(x^2+1)",
  "sec(x)^2",
];

export function latexOfExpression(input: string): string {
  try {
    return toLatex(preprocess(input));
  } catch {
    return input;
  }
}

export function checkAntiderivative(
  integrand: string,
  proposedAnswer: string
): {
  correct: boolean;
  messageEn: string;
  messageZh: string;
  derivativeLatex?: string;
  variable?: string;
  variableLatex?: string;
} {
  try {
    const cleanAnswer = preprocess(proposedAnswer).replace(/\+?C$/i, "");
    const cleanIntegrand = preprocess(integrand);
    const integrandNode = parse(cleanIntegrand);
    const detected = detectVariable(integrandNode);
    if (!detected || detected === "__multiple__") {
      return {
        correct: false,
        messageEn:
          "The practice question contains more than one possible variable, so the answer cannot be checked automatically.",
        messageZh: "此練習題含有多於一個可能變數，系統未能自動檢查答案。",
      };
    }
    const ctx: IntegrationContext = { variable: detected, depth: 0 };
    const d = simplify(derivative(cleanAnswer, detected)).toString();
    const difference = `(${d})-(${cleanIntegrand})`;
    const correct = isZeroExpr(difference, ctx);
    return {
      correct,
      derivativeLatex: toLatex(d),
      variable: detected,
      variableLatex: variableLatex(detected),
      messageEn: correct
        ? "Correct. The derivative of your answer matches the integrand."
        : "Not quite. Differentiate your answer and compare it with the integrand.",
      messageZh: correct
        ? "正確。你的答案微分後與被積函數相同。"
        : "未完全正確。請把你的答案微分後與被積函數比較。",
    };
  } catch {
    return {
      correct: false,
      messageEn:
        "The answer could not be parsed. Use one variable such as x, t, y, α or θ; use *, ^ and function brackets; omit or write +C at the end only.",
      messageZh:
        "系統未能讀取你的答案。請使用單一變數如 x、t、y、α 或 θ，並使用 *、^ 及函數括號；+C 可省略或只放在最後。",
    };
  }
}
