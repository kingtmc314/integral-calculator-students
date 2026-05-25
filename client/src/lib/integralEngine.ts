import { derivative, parse, simplify, type MathNode } from "mathjs";

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
}

interface IntegrationContext {
  variable: string;
  depth: number;
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
const FUNCTION_NAMES = new Set(["sin", "cos", "tan", "sec", "csc", "cot", "asin", "acos", "atan", "sqrt", "log", "ln", "exp", "abs"]);

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
    const subscriptLog = startsName ? input.slice(i).match(/^log_\{?([A-Za-z0-9.]+)\}?\s*\(/i) : null;
    if (subscriptLog) {
      const openIndex = i + subscriptLog[0].lastIndexOf("(");
      const closeIndex = findMatchingParen(input, openIndex);
      if (closeIndex >= 0) {
        const inside = convertLogNotation(input.slice(openIndex + 1, closeIndex));
        out += `log(${inside},${subscriptLog[1]})`;
        i = closeIndex;
        continue;
      }
    }
    const isLn = startsName && lower.startsWith("ln") && /^\s*\(/.test(input.slice(i + 2));
    const isLog = startsName && lower.startsWith("log") && /^\s*\(/.test(input.slice(i + 3));
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
    else out += hasTopLevelComma(inside) ? `log(${inside})` : `log(${inside},10)`;
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
    .replace(/([a-zA-Z])(\d)/g, (match, letter, digit) => FUNCTION_NAMES.has(letter) ? match : `${letter}*${digit}`)
    .replace(new RegExp(`\\)\\s*([${letters}]|\\d)`, "g"), ")*$1")
    .replace(/(\d)\s*\(/g, "$1*(")
    .replace(new RegExp(`([${GREEK_LOWER}])\\s*\\(`, "g"), "$1*(")
    .replace(/\s+/g, "");
}

function formatCommonLogTex(tex: string): string {
  return tex.replace(/\\log_\{10\}\\left\((.*?)\\right\)/g, "\\log\\left($1\\right)");
}

function formatFunctionPowerTex(tex: string): string {
  return tex.replace(/\{(\\(?:sin|cos|tan|sec|csc|cot)\\left\((.*?)\\right\))\}\^\{([^{}]+)\}/g, (_match, fnWithArg: string, arg: string, power: string) => {
    const fn = fnWithArg.match(/^(\\(?:sin|cos|tan|sec|csc|cot))/)?.[1] ?? "";
    return `${fn}^{${power}}\\left(${arg}\\right)`;
  });
}

function toLatex(expr: string): string {
  try {
    return formatFunctionPowerTex(formatCommonLogTex(parse(expr).toTex({ parenthesis: "keep", implicit: "hide" })));
  } catch {
    return expr;
  }
}

function variableLatex(variable: string): string {
  return GREEK_LATEX[variable] ?? toLatex(variable).replace(/[{}]/g, "");
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
  try {
    // Keep logarithms of numeric constants symbolic, e.g. 2^x / ln 2, because
    // exact answers are preferred over decimal approximations in this app.
    if (/log\(\s*\d/.test(expr)) return expr;
    const firstPass = simplify(expr).toString();
    const exactTrigPass = simplifyTrigConstants(firstPass);
    return simplify(exactTrigPass).toString();
  } catch {
    return expr;
  }
}

function derivativeExpr(expr: string, ctx: IntegrationContext): string {
  return simplify(derivative(expr, ctx.variable)).toString();
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

function collectVariables(node: AnyNode, output = new Set<string>()): Set<string> {
  if (node.type === "SymbolNode") {
    const name = node.toString();
    if (!CONSTANT_SYMBOLS.has(name) && !FUNCTION_NAMES.has(name)) output.add(name);
  }
  const children = (node as any).args as AnyNode[] | undefined;
  if (children) children.forEach((child) => collectVariables(child, output));
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

function substituteVariable(expr: string, variable: string, replacement: string): string {
  const replacementNode = parse(replacement);
  return (parse(expr) as any).transform((node: AnyNode) => {
    if (node.type === "SymbolNode" && (node as any).name === variable) return replacementNode;
    return node;
  }).toString();
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

function affineDerivative(inner: string, ctx: IntegrationContext): string | null {
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
    return [...flattenOperator((node as any).args[0], op), ...flattenOperator((node as any).args[1], op)];
  }
  return [node];
}

function isFunctionNode(node: AnyNode, name: string): boolean {
  return node.type === "FunctionNode" && ((node as any).fn?.name === name || (node as any).name === name);
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

function proportionalTo(expr: string, target: string, ctx: IntegrationContext): string | null {
  const ratios: number[] = [];
  for (const value of SAMPLE_POINTS) {
    try {
      const t = evalExpr(target, ctx.variable, value);
      const e = evalExpr(expr, ctx.variable, value);
      if (!Number.isFinite(t) || !Number.isFinite(e) || Math.abs(t) < 1e-9) continue;
      ratios.push(e / t);
    } catch {
      continue;
    }
  }
  if (ratios.length < 3) return null;
  const first = ratios[0];
  if (ratios.every((r) => Math.abs(r - first) < 1e-7)) {
    return Number.isInteger(first) ? String(first) : String(Number(first.toPrecision(10)));
  }
  return null;
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
  return factors.map((f) => maybeParenthesize(f.toString())).join("*") || "1";
}


type Polynomial = number[];

function trimPoly(poly: Polynomial): Polynomial {
  const result = [...poly];
  while (result.length > 1 && Math.abs(result[result.length - 1]) < 1e-10) result.pop();
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
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return trimPoly(out);
}

function polyScale(a: Polynomial, c: number): Polynomial {
  return trimPoly(a.map((v) => v * c));
}

function polyDivide(numerator: Polynomial, denominator: Polynomial): { quotient: Polynomial; remainder: Polynomial } | null {
  const den = trimPoly(denominator);
  if (den.length === 1 && Math.abs(den[0]) < 1e-10) return null;
  let rem = trimPoly(numerator);
  const quotient = Array(Math.max(1, polyDegree(rem) - polyDegree(den) + 1)).fill(0) as Polynomial;
  while (polyDegree(rem) >= polyDegree(den) && !(rem.length === 1 && Math.abs(rem[0]) < 1e-10)) {
    const power = polyDegree(rem) - polyDegree(den);
    const coeff = rem[rem.length - 1] / den[den.length - 1];
    quotient[power] += coeff;
    const subtractor = Array(power).fill(0).concat(polyScale(den, coeff)) as Polynomial;
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
  return String(Number(value.toPrecision(12)));
}

function polyToExpr(poly: Polynomial, variable: string): string {
  const terms: string[] = [];
  trimPoly(poly).forEach((coeff, degree) => {
    if (Math.abs(coeff) < 1e-10) return;
    const c = rationalNumberString(coeff);
    if (degree === 0) terms.push(c);
    else if (degree === 1) terms.push(isOne(c) ? variable : isMinusOne(c) ? `-${variable}` : `${c}*${variable}`);
    else terms.push(isOne(c) ? `${variable}^${degree}` : isMinusOne(c) ? `-${variable}^${degree}` : `${c}*${variable}^${degree}`);
  });
  return terms.length ? simplifyExpr(terms.join("+")) : "0";
}

function nodeToPolynomial(node: AnyNode, ctx: IntegrationContext): Polynomial | null {
  if (node.type === "ParenthesisNode") return nodeToPolynomial((node as any).content, ctx);
  if (node.type === "ConstantNode") {
    const value = constantValue(node.toString(), ctx);
    return value === null ? null : [value];
  }
  if (node.type === "SymbolNode") {
    const text = node.toString();
    if (text === ctx.variable) return [0, 1];
    if (!hasVariable(text, ctx)) {
      const value = constantValue(text, ctx);
      return value === null ? null : [value];
    }
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
    if (!left || !right || polyDegree(right) !== 0 || Math.abs(right[0]) < 1e-10) return null;
    return polyScale(left, 1 / right[0]);
  }
  if (op === "^") {
    const base = nodeToPolynomial(args[0], ctx);
    const exponent = constantValue(args[1].toString(), ctx);
    if (!base || exponent === null || !Number.isInteger(exponent) || exponent < 0 || exponent > 8) return null;
    let out: Polynomial = [1];
    for (let i = 0; i < exponent; i++) out = polyMul(out, base);
    return out;
  }
  return null;
}

function exprToPolynomial(expr: string, ctx: IntegrationContext): Polynomial | null {
  try {
    return nodeToPolynomial(parse(expr), ctx);
  } catch {
    return null;
  }
}

function tryRationalLongDivision(numerator: string, denominator: string, ctx: IntegrationContext): Integrated | null {
  const numeratorPoly = exprToPolynomial(numerator, ctx);
  const denominatorPoly = exprToPolynomial(denominator, ctx);
  if (!numeratorPoly || !denominatorPoly) return null;
  if (polyDegree(denominatorPoly) < 1 || polyDegree(numeratorPoly) < polyDegree(denominatorPoly)) return null;

  const divided = polyDivide(numeratorPoly, denominatorPoly);
  if (!divided) return null;
  const quotientExpr = polyToExpr(divided.quotient, ctx.variable);
  const denominatorExpr = polyToExpr(denominatorPoly, ctx.variable);
  const remainderExpr = polyToExpr(divided.remainder, ctx.variable);
  const hasRemainder = !(trimPoly(divided.remainder).length === 1 && Math.abs(divided.remainder[0]) < 1e-10);

  let quotientIntegral: Integrated;
  try {
    quotientIntegral = integrateNode(parse(quotientExpr), { ...ctx, depth: ctx.depth + 1 });
  } catch {
    return null;
  }

  if (!hasRemainder) {
    return {
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
    remainderIntegral = integrateNode(parse(remainderQuotient), { ...ctx, depth: ctx.depth + 1 });
  } catch {
    return null;
  }
  const result = simplifyExpr(`(${quotientIntegral.expr})+(${remainderIntegral.expr})`);
  return {
    expr: result,
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
  if (functionName(node) === "exp") return functionArg(node)?.toString() ?? null;
  if (node.type === "OperatorNode" && (node as any).op === "^") {
    const [baseNode, exponentNode] = (node as any).args as AnyNode[];
    const base = baseNode.toString();
    if (base === "e" || simplifyExpr(base) === "e") return exponentNode.toString();
  }
  return null;
}

function equivalentExpr(a: string, b: string, ctx: IntegrationContext): boolean {
  return simplifyExpr(a) === simplifyExpr(b) || isZeroExpr(`(${a})-(${b})`, ctx);
}

function tryRepeatedByPartsExpTrig(factors: AnyNode[], ctx: IntegrationContext): Integrated | null {
  if (factors.length !== 2 || ctx.depth > 5) return null;

  const expItem = factors
    .map((factor, index) => ({ factor, index, inner: exponentialInner(factor) }))
    .find((item) => item.inner !== null);
  if (!expItem || !expItem.inner) return null;

  const trigItem = factors
    .map((factor, index) => ({ factor, index, fn: functionName(factor), arg: functionArg(factor) }))
    .find((item) => item.index !== expItem.index && (item.fn === "sin" || item.fn === "cos") && item.arg);
  if (!trigItem || !trigItem.arg || (trigItem.fn !== "sin" && trigItem.fn !== "cos")) return null;

  const z = expItem.inner;
  const trigArg = trigItem.arg.toString();
  if (!equivalentExpr(z, trigArg, ctx)) return null;

  const dz = affineDerivative(z, ctx);
  if (!dz) return null;

  const original = combineFactors(factors);
  const expZ = `exp(${z})`;
  const sinZ = `sin(${z})`;
  const cosZ = `cos(${z})`;
  const sign = trigItem.fn === "sin" ? "-" : "+";
  const result = simplifyExpr(`(${expZ})*((${sinZ})${sign}(${cosZ}))/(2*(${dz}))`);
  const vl = variableLatex(ctx.variable);
  const zLatex = toLatex(z);
  const dLatex = toLatex(dz);
  const expLatex = `e^{${zLatex}}`;

  if (trigItem.fn === "sin") {
    const jIntegrand = `${expZ}*${cosZ}`;
    return {
      expr: result,
      method: "repeated integration by parts and solving for the original integral",
      methodZh: "連續兩次分部積分並移項求原積分",
      steps: [
        `I=${intLatex(original, ctx)}`,
        `\\text{First by parts: }u=\\sin(${zLatex}),\\quad dv=${expLatex}\\,${dVar(ctx)}`,
        `du=${dLatex}\\cos(${zLatex})\\,${dVar(ctx)},\\quad v=\\frac{${expLatex}}{${dLatex}}`,
        `I=\\frac{${expLatex}\\sin(${zLatex})}{${dLatex}}-${intLatex(jIntegrand, ctx)}`,
        `J=${intLatex(jIntegrand, ctx)}`,
        `\\text{Second by parts: }u=\\cos(${zLatex}),\\quad dv=${expLatex}\\,${dVar(ctx)}`,
        `du=-${dLatex}\\sin(${zLatex})\\,${dVar(ctx)},\\quad v=\\frac{${expLatex}}{${dLatex}}`,
        `J=\\frac{${expLatex}\\cos(${zLatex})}{${dLatex}}+I`,
        `I=\\frac{${expLatex}\\sin(${zLatex})}{${dLatex}}-\\left(\\frac{${expLatex}\\cos(${zLatex})}{${dLatex}}+I\\right)`,
        `2I=\\frac{${expLatex}\\left(\\sin(${zLatex})-\\cos(${zLatex})\\right)}{${dLatex}}`,
        `${intLatex(original, ctx)}=${toLatex(result)}+C`,
      ],
    };
  }

  const jIntegrand = `${expZ}*${sinZ}`;
  return {
    expr: result,
    method: "repeated integration by parts and solving for the original integral",
    methodZh: "連續兩次分部積分並移項求原積分",
    steps: [
      `I=${intLatex(original, ctx)}`,
      `\\text{First by parts: }u=\\cos(${zLatex}),\\quad dv=${expLatex}\\,${dVar(ctx)}`,
      `du=-${dLatex}\\sin(${zLatex})\\,${dVar(ctx)},\\quad v=\\frac{${expLatex}}{${dLatex}}`,
      `I=\\frac{${expLatex}\\cos(${zLatex})}{${dLatex}}+${intLatex(jIntegrand, ctx)}`,
      `J=${intLatex(jIntegrand, ctx)}`,
      `\\text{Second by parts: }u=\\sin(${zLatex}),\\quad dv=${expLatex}\\,${dVar(ctx)}`,
      `du=${dLatex}\\cos(${zLatex})\\,${dVar(ctx)},\\quad v=\\frac{${expLatex}}{${dLatex}}`,
      `J=\\frac{${expLatex}\\sin(${zLatex})}{${dLatex}}-I`,
      `I=\\frac{${expLatex}\\cos(${zLatex})}{${dLatex}}+\\left(\\frac{${expLatex}\\sin(${zLatex})}{${dLatex}}-I\\right)`,
      `2I=\\frac{${expLatex}\\left(\\sin(${zLatex})+\\cos(${zLatex})\\right)}{${dLatex}}`,
      `${intLatex(original, ctx)}=${toLatex(result)}+C`,
    ],
  };
}


function isVariableNode(node: AnyNode, ctx: IntegrationContext): boolean {
  return node.toString() === ctx.variable;
}

function isNaturalLogOfVariable(node: AnyNode, ctx: IntegrationContext): boolean {
  return isNaturalLogNode(node) && !!functionArg(node) && isVariableNode(functionArg(node)!, ctx);
}

function isCommonLogOfVariable(node: AnyNode, ctx: IntegrationContext): boolean {
  return isCommonLogNode(node) && !!functionArg(node) && isVariableNode(functionArg(node)!, ctx);
}

function isFixedBaseLogOfVariable(node: AnyNode, ctx: IntegrationContext): boolean {
  if (!isLogFunction(node) || !functionArg(node) || !isVariableNode(functionArg(node)!, ctx)) return false;
  const base = logBase(node);
  if (!base) return false;
  const baseValue = constantValue(base, ctx);
  return baseValue !== null && baseValue > 0 && Math.abs(baseValue - 1) > 1e-10;
}

function logBaseDisplay(base: string, v: string): { expr: string; latex: string; setup: string[]; du: string } {
  const vl = variableLatex(v);
  if (base === "e") {
    return { expr: `log(${v})`, latex: `\\ln ${vl}`, setup: [], du: `\\frac{1}{${vl}}` };
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
  if (functionName(node) === "sqrt" && functionArg(node)) return isVariableNode(functionArg(node)!, ctx);
  if (node.type === "OperatorNode" && (node as any).op === "^") {
    const [baseNode, expNode] = (node as any).args as AnyNode[];
    const expVal = constantValue(expNode.toString(), ctx);
    return isVariableNode(baseNode, ctx) && expVal !== null && Math.abs(expVal - 0.5) < 1e-10;
  }
  return false;
}

function tryTrigLogSubstitution(fn: string, arg: AnyNode, ctx: IntegrationContext): Integrated | null {
  if ((fn !== "sin" && fn !== "cos") || !isNaturalLogOfVariable(arg, ctx)) return null;
  const v = ctx.variable;
  const vl = variableLatex(v);
  const uLatex = `\\ln ${vl}`;
  const trigExpr = `${fn}(log(${v}))`;
  const result = fn === "sin"
    ? simplifyExpr(`${v}*(sin(log(${v}))-cos(log(${v})))/2`)
    : simplifyExpr(`${v}*(sin(log(${v}))+cos(log(${v})))/2`);
  const innerExp = fn === "sin" ? "exp(u)*sin(u)" : "exp(u)*cos(u)";
  const innerResult = fn === "sin" ? "e^u(sin(u)-cos(u))/2" : "e^u(sin(u)+cos(u))/2";
  return {
    expr: result,
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

function tryTrigSqrtSubstitution(fn: string, arg: AnyNode, ctx: IntegrationContext): Integrated | null {
  if ((fn !== "sin" && fn !== "cos") || !isSqrtOfVariable(arg, ctx)) return null;
  const v = ctx.variable;
  const vl = variableLatex(v);
  const sqrtV = `sqrt(${v})`;
  const sqrtLatex = `\\sqrt{${vl}}`;
  const trigExpr = `${fn}(${sqrtV})`;
  const result = fn === "sin"
    ? simplifyExpr(`2*(sin(${sqrtV})-${sqrtV}*cos(${sqrtV}))`)
    : simplifyExpr(`2*(${sqrtV}*sin(${sqrtV})+cos(${sqrtV}))`);
  const transformed = fn === "sin" ? "2*u*sin(u)" : "2*u*cos(u)";
  const transformedResult = fn === "sin" ? "2*(sin(u)-u*cos(u))" : "2*(u*sin(u)+cos(u))";
  return {
    expr: result,
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

function tryValidatedMixedFunctionTechnique(fn: string, arg: AnyNode, ctx: IntegrationContext): Integrated | null {
  return tryTrigLogSubstitution(fn, arg, ctx) ?? tryTrigSqrtSubstitution(fn, arg, ctx);
}

function integrateNode(node: AnyNode, ctx: IntegrationContext): Integrated {
  const text = node.toString();

  if (ctx.depth > 10) {
    throw new UnsupportedIntegral("The recursive method became too long for this expression.", "此題的遞迴計算過長，暫未能安全處理。");
  }

  if (!hasVariable(text, ctx)) {
    return {
      expr: simplifyExpr(`(${text})*(${ctx.variable})`),
      method: "constant rule",
      methodZh: "常數積分法",
      steps: [`${intLatex(text, ctx)}=${toLatex(text)}${variableLatex(ctx.variable)}+C`],
    };
  }

  if (node.type === "SymbolNode" && text === ctx.variable) {
    return {
      expr: `${ctx.variable}^2/2`,
      method: "power rule",
      methodZh: "冪次法則",
      steps: [`${intLatex(ctx.variable, ctx)}=\\frac{${variableLatex(ctx.variable)}^2}{2}+C`],
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
        expr: simplifyExpr(`-(${inner.expr})`),
        method: `constant multiple + ${inner.method}`,
        methodZh: `常數倍法則 + ${inner.methodZh}`,
        steps: [`${intLatex(`-(${args[0].toString()})`, ctx)}=-${intLatex(args[0].toString(), ctx)}`, ...inner.steps],
      };
    }

    if (op === "+") {
      const left = integrateNode(args[0], ctx);
      const right = integrateNode(args[1], ctx);
      return {
        expr: simplifyExpr(`(${left.expr})+(${right.expr})`),
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
      const right = integrateNode(args[1], ctx);
      return {
        expr: simplifyExpr(`(${left.expr})-(${right.expr})`),
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
      const factors = flattenOperator(node, "*");
      const constants = factors.filter((f) => isConstantNode(f, ctx)).map((f) => f.toString());
      const variableFactors = factors.filter((f) => !isConstantNode(f, ctx));
      if (constants.length > 0 && variableFactors.length > 0) {
        const c = simplifyExpr(constants.join("*"));
        const rest = combineFactors(variableFactors);
        const inner = integrateNode(parse(rest), { ...ctx, depth: ctx.depth + 1 });
        return {
          expr: multiplyExpr(c, inner.expr),
          method: `constant multiple + ${inner.method}`,
          methodZh: `常數倍法則 + ${inner.methodZh}`,
          steps: [`${intLatex(`${c}*(${rest})`, ctx)}=${toLatex(c)}${intLatex(rest, ctx)}`, ...inner.steps],
        };
      }

      const repeatedByParts = tryRepeatedByPartsExpTrig(factors, ctx);
      if (repeatedByParts) return repeatedByParts;

      const reverse = tryReverseChainFromProduct(factors, ctx);
      if (reverse) return reverse;

      const byParts = tryByParts(factors, ctx);
      if (byParts) return byParts;
    }

    if (op === "/") {
      const numerator = args[0].toString();
      const denominator = args[1].toString();
      const longDivision = tryRationalLongDivision(numerator, denominator, ctx);
      if (longDivision) return longDivision;
      const denomDerivative = derivativeExpr(denominator, ctx);
      const reverseLogCoeff = proportionalTo(numerator, denomDerivative, ctx);
      if (reverseLogCoeff) {
        return {
          expr: multiplyExpr(reverseLogCoeff, `log(abs(${denominator}))`),
          method: "reverse chain logarithmic rule",
          methodZh: "反鏈式對數法則",
          steps: [`u=${toLatex(denominator)},\\quad du=${toLatex(denomDerivative)}\\,${dVar(ctx)}`, `${intLatex(`(${numerator})/(${denominator})`, ctx)}=${toLatex(reverseLogCoeff)}\\ln\\left|${toLatex(denominator)}\\right|+C`],
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
            steps: [`${intLatex(`(${numerator})/(${denominator})`, ctx)}=${toLatex(coeff)}\\ln\\left|${toLatex(denominator)}\\right|+C`],
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

      if (baseConst !== null && baseConst > 0 && baseConst !== 1 && hasVariable(exponent, ctx)) {
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
            steps: [`${intLatex(`(${base})^(-1)`, ctx)}=\\frac{1}{${toLatex(deriv)}}\\ln\\left|${toLatex(base)}\\right|+C`],
          };
        }
        const newExp = addOneToExponent(exponent);
        const denom = simplifyExpr(`(${deriv})*(${newExp})`);
        return {
          expr: divideExpr(`(${base})^(${newExp})`, denom),
          method: "power rule with affine substitution",
          methodZh: "一次式代換冪次法則",
          steps: [`u=${toLatex(base)},\\quad du=${toLatex(deriv)}\\,${dVar(ctx)}`, `${intLatex(`(${base})^(${exponent})`, ctx)}=\\frac{${toLatex(`(${base})^(${newExp})`)}}{${toLatex(denom)}}+C`],
        };
      }

      if ((isFunctionNode(args[0], "sec") || isFunctionNode(args[0], "csc")) && expVal === 2) {
        const arg = functionArg(args[0]);
        if (arg) {
          const inner = arg.toString();
          const d = affineDerivative(inner, ctx);
          if (d) {
            if (isFunctionNode(args[0], "sec")) {
              return { expr: divideExpr(`tan(${inner})`, d), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`${intLatex(`sec(${inner})^2`, ctx)}=\\frac{${toLatex(`tan(${inner})`)}}{${toLatex(d)}}+C`] };
            }
            return { expr: simplifyExpr(`-(${divideExpr(`cot(${inner})`, d)})`), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`${intLatex(`csc(${inner})^2`, ctx)}=-\\frac{${toLatex(`cot(${inner})`)}}{${toLatex(d)}}+C`] };
          }
        }
      }
    }
  }

  if (node.type === "FunctionNode") {
    const fn = functionName(node) ?? "";
    const arg = functionArg(node);
    if (arg) {
      const mixed = tryValidatedMixedFunctionTechnique(fn, arg, ctx);
      if (mixed) return mixed;
      const inner = arg.toString();
      const d = affineDerivative(inner, ctx);
      if (d) {
        if (fn === "sin") return { expr: simplifyExpr(`-cos(${inner})/(${d})`), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`${intLatex(`sin(${inner})`, ctx)}=-\\frac{\\cos\\left(${toLatex(inner)}\\right)}{${toLatex(d)}}+C`] };
        if (fn === "cos") return { expr: divideExpr(`sin(${inner})`, d), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`${intLatex(`cos(${inner})`, ctx)}=\\frac{\\sin\\left(${toLatex(inner)}\\right)}{${toLatex(d)}}+C`] };
        if (fn === "tan") return { expr: simplifyExpr(`-log(abs(cos(${inner})))/(${d})`), method: "trigonometric logarithmic rule", methodZh: "三角對數積分法", steps: [`${intLatex(`tan(${inner})`, ctx)}=-\\frac{1}{${toLatex(d)}}\\ln\\left|\\cos\\left(${toLatex(inner)}\\right)\\right|+C`] };
        if (fn === "exp") return { expr: divideExpr(`exp(${inner})`, d), method: "exponential rule", methodZh: "指數積分法", steps: [`${intLatex(`exp(${inner})`, ctx)}=\\frac{e^{${toLatex(inner)}}}{${toLatex(d)}}+C`] };
        if (fn === "sqrt") return { expr: divideExpr(`(${inner})^(3/2)`, `(${d})*(3/2)`), method: "power rule with affine substitution", methodZh: "一次式代換冪次法則", steps: [`\\sqrt{${toLatex(inner)}}=${toLatex(`(${inner})^(1/2)`)}`, `${intLatex(`(${inner})^(1/2)`, ctx)}=\\frac{${toLatex(`(${inner})^(3/2)`)}}{${toLatex(`(${d})*(3/2)`)}}+C`] };
        if (fn === "log" && simplifyExpr(inner) === ctx.variable && isFixedBaseLogOfVariable(node, ctx)) {
          return tryBaseLogByParts(ctx, logBase(node)!);
        }
      }
    }
  }

  const trigSub = tryTrigSubstitution(node, ctx);
  if (trigSub) return trigSub;

  throw new UnsupportedIntegral(
    "This expression is outside the currently implemented HKDSE M2 patterns. Try expanding brackets, splitting terms, rewriting radicals as powers, specifying a single variable, or checking whether the integrand needs integration by parts or a listed trigonometric substitution.",
    "此表達式超出目前已實作的 HKDSE M2 模式。可嘗試先展開括號、拆項、把根號改寫成冪次、使用單一積分變數，或檢查是否需要分部積分或表內三角代換。"
  );
}

function tryReverseChainFromProduct(factors: AnyNode[], ctx: IntegrationContext): Integrated | null {
  for (let i = 0; i < factors.length; i++) {
    const candidate = factors[i];
    const rest = combineFactors(factors.filter((_, idx) => idx !== i));

    if (candidate.type === "OperatorNode" && (candidate as any).op === "^") {
      const [baseNode, expNode] = (candidate as any).args as AnyNode[];
      const base = baseNode.toString();
      const exponent = expNode.toString();
      const expVal = constantValue(exponent, ctx);
      if (expVal !== null) {
        const d = derivativeExpr(base, ctx);
        const k = proportionalTo(rest, d, ctx);
        if (k) {
          if (Math.abs(expVal + 1) < 1e-10) {
            return {
              expr: multiplyExpr(k, `log(abs(${base}))`),
              method: "reverse chain rule",
              methodZh: "反鏈式法則",
              steps: [`u=${toLatex(base)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`, `${intLatex(`${rest}*(${base})^(${exponent})`, ctx)}=${toLatex(k)}\\ln\\left|${toLatex(base)}\\right|+C`],
            };
          }
          const newExp = addOneToExponent(exponent);
          return {
            expr: multiplyExpr(k, divideExpr(`(${base})^(${newExp})`, newExp)),
            method: "reverse chain rule",
            methodZh: "反鏈式法則",
            steps: [`u=${toLatex(base)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`, `${intLatex(`${rest}*(${base})^(${exponent})`, ctx)}=${toLatex(k)}\\cdot\\frac{${toLatex(`(${base})^(${newExp})`)}}{${toLatex(newExp)}}+C`],
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
      if (fn === "exp") return { expr: multiplyExpr(k, `exp(${inner})`), method: "reverse chain rule", methodZh: "反鏈式法則", steps: [`u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`, `${intLatex(`${rest}*exp(${inner})`, ctx)}=${toLatex(k)}e^{${toLatex(inner)}}+C`] };
      if (fn === "sin") return { expr: multiplyExpr(k, `-cos(${inner})`), method: "reverse chain rule", methodZh: "反鏈式法則", steps: [`u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`, `${intLatex(`${rest}*sin(${inner})`, ctx)}=-${toLatex(k)}\\cos(${toLatex(inner)})+C`] };
      if (fn === "cos") return { expr: multiplyExpr(k, `sin(${inner})`), method: "reverse chain rule", methodZh: "反鏈式法則", steps: [`u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,${dVar(ctx)}`, `${intLatex(`${rest}*cos(${inner})`, ctx)}=${toLatex(k)}\\sin(${toLatex(inner)})+C`] };
    }
  }
  return null;
}

function tryBaseLogByParts(ctx: IntegrationContext, base: string): Integrated {
  const v = ctx.variable;
  const vl = variableLatex(v);
  const display = logBaseDisplay(base, v);
  const isNatural = base === "e";
  const result = isNatural ? `${v}*log(${v})-${v}` : `${v}*log(${v},${base})-${v}/log(${base})`;
  return {
    expr: result,
    method: isNatural ? "integration by parts" : "integration by parts with change of base",
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

function tryByParts(factors: AnyNode[], ctx: IntegrationContext): Integrated | null {
  if (factors.length < 2 || ctx.depth > 7) return null;

  const logIndex = factors.findIndex((factor) => isFixedBaseLogOfVariable(factor, ctx));
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
      const second = isNatural ? `(${power})/(${denom * denom})` : `(${power})/(${denom * denom}*log(${base}))`;
      const result = simplifyExpr(`(${first})-(${second})`);
      const vl = variableLatex(ctx.variable);
      const logLatex = display.latex;
      const duLatex = display.du;
      const method = isNatural ? "integration by parts" : "integration by parts with change of base";
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
    .map((factor, index) => ({ factor, index, priority: byPartsPriority(factor, ctx) }))
    .filter((item) => item.priority > 0)
    .sort((a, b) => b.priority - a.priority);

  for (const item of ranked) {
    const u = item.factor.toString();
    const du = simplifyExpr(derivativeExpr(u, ctx));
    if (!du || isZeroExpr(du, ctx)) continue;
    const dvExpr = combineFactors(factors.filter((_, idx) => idx !== item.index));
    try {
      const vIntegral = integrateNode(parse(dvExpr), { ...ctx, depth: ctx.depth + 1 });
      const vExpr = vIntegral.expr;
      const remainingIntegrand = multiplyExpr(vExpr, du);
      const remainingIntegral = integrateNode(parse(remainingIntegrand), { ...ctx, depth: ctx.depth + 1 });
      const result = simplifyExpr(`(${u})*(${vExpr})-(${remainingIntegral.expr})`);
      return {
        expr: result,
        method: "integration by parts",
        methodZh: "分部積分法",
        steps: [
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

function detectSquareConstant(inner: string, patternFactory: (a2: number) => string): number | null {
  for (let a2 = 1; a2 <= 144; a2++) {
    if (matches(inner, patternFactory(a2))) return a2;
  }
  return null;
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
  return isPerfectSquareInteger(n) ? String(Math.sqrt(n)) : `sqrt(${n})`;
}

function exactSqrtLatex(n: number): string {
  return isPerfectSquareInteger(n) ? toLatex(String(Math.sqrt(n))) : `\\sqrt{${toLatex(String(n))}}`;
}

function substitutionAngle(ctx: IntegrationContext): string {
  return ctx.variable === "θ" || ctx.variable === "theta" ? "φ" : "θ";
}

function tryTrigSubstitution(node: AnyNode, ctx: IntegrationContext): Integrated | null {
  const v = ctx.variable;
  const vl = variableLatex(v);
  const expr = node.toString();
  const angle = substitutionAngle(ctx);
  const angleLatex = variableLatex(angle);

  const divisionNode = node.type === "OperatorNode" && (node as any).op === "/" ? node as any : null;
  const reciprocalNumerator = divisionNode ? divisionNode.args[0].toString() : "1";
  const reciprocalDenominator = divisionNode && !hasVariable(reciprocalNumerator, ctx)
    ? (divisionNode.args[1] as AnyNode)
    : null;

  if (reciprocalDenominator) {
    const denomText = reciprocalDenominator.toString();
    const sqrtInner = sqrtOf(reciprocalDenominator);

    const a2ForAtan = detectSquareConstant(denomText, (a2) => `${a2}+(${v})^2`);
    if (a2ForAtan !== null) {
      const numerator = simplifyExpr(reciprocalNumerator);
      const aExpr = exactSqrtExpr(a2ForAtan);
      const aLatex = exactSqrtLatex(a2ForAtan);
      const numeratorLatex = toLatex(numerator);
      const coefficientLatex = isOne(numerator) ? "" : `${numeratorLatex}\\cdot `;
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
      const a2ForAsin = detectSquareConstant(sqrtInner, (a2) => `${a2}-(${v})^2`);
      if (a2ForAsin !== null) {
        const a = Math.sqrt(a2ForAsin);
        const aLatex = toLatex(String(a));
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
    const a2Minus = detectSquareConstant(sqrtInner, (a2) => `${a2}-(${v})^2`);
    if (a2Minus !== null) {
      const a = Math.sqrt(a2Minus);
      const aLatex = toLatex(String(a));
      const result = simplifyExpr(`(${v})*sqrt(${a2Minus}-(${v})^2)/2+(${a2Minus})*asin((${v})/${a})/2`);
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

    const a2Plus = detectSquareConstant(sqrtInner, (a2) => `${a2}+(${v})^2`);
    if (a2Plus !== null) {
      const a = Math.sqrt(a2Plus);
      const aLatex = toLatex(String(a));
      const result = simplifyExpr(`(${v})*sqrt((${v})^2+${a2Plus})/2+(${a2Plus})*log(abs(${v}+sqrt((${v})^2+${a2Plus})))/2`);
      return {
        expr: result,
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

export function calculateIntegral(input: string, preferredVariable?: string): IntegralResult {
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
      hintEn: "Please enter an expression, for example x^2 + sin(2*x), t^2, or sin(θ).",
      hintZh: "請輸入式子，例如 x^2 + sin(2*x)、t^2 或 sin(θ)。",
    };
  }

  try {
    const node = parse(normalized);
    const detected = detectVariable(node, preferredVariable ? preprocess(preferredVariable) : undefined);
    if (detected === "__multiple__" || !detected) {
      return {
        input,
        normalized,
        status: "unsupported",
        integrandLatex: toLatex(normalized),
        method: "ambiguous variable",
        methodZh: "積分變數不明確",
        stepsLatex: [],
        hintEn: "The expression contains more than one variable. Please use a single integration variable, such as x, t, y, α, β, θ, or φ.",
        hintZh: "此式含有多於一個變數。請使用單一積分變數，例如 x、t、y、α、β、θ 或 φ。",
      };
    }
    const ctx: IntegrationContext = { variable: detected, depth: 0 };
    const integrated = integrateNode(node, ctx);
    const preserveExactForm = integrated.method.includes("arctangent rule");
    const simplifiedAnswer = preserveExactForm ? integrated.expr : simplifyExpr(integrated.expr);
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
      hintEn: "The expression could not be parsed. Use * for multiplication, ^ for powers, and function brackets such as sin(x), sin(t), or sin(θ).",
      hintZh: "系統未能讀取此表達式。請使用 * 表示乘法、^ 表示冪次，函數請寫成 sin(x)、sin(t) 或 sin(θ) 等格式。",
    };
  }
}

export function calculateDefiniteIntegral(input: string, lowerInput: string, upperInput: string, preferredVariable?: string): DefiniteIntegralResult {
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
    const detected = detectVariable(node, preferredVariable ? preprocess(preferredVariable) : undefined);
    if (detected === "__multiple__" || !detected) {
      return {
        ...invalidBase,
        status: "unsupported",
        method: "ambiguous variable",
        methodZh: "積分變數不明確",
        hintEn: "The integrand contains more than one variable. Please use a single integration variable, such as x, t, y, α, β, θ, or φ.",
        hintZh: "被積函數含有多於一個變數。請使用單一積分變數，例如 x、t、y、α、β、θ 或 φ。",
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
        hintEn: "For this student version, the limits should be constants, for example 0, 1, 2, pi/2, or e.",
        hintZh: "學生版定積分上下限請使用常數，例如 0、1、2、pi/2 或 e。",
      };
    }

    const indefinite = calculateIntegral(normalized, detected);
    if (indefinite.status !== "ok" || !indefinite.antiderivative) {
      return {
        ...invalidBase,
        status: indefinite.status,
        method: indefinite.method,
        methodZh: indefinite.methodZh,
        stepsLatex: indefinite.stepsLatex,
        hintEn: indefinite.hintEn ?? "The corresponding indefinite integral is not supported yet, so the definite integral cannot be evaluated automatically.",
        hintZh: indefinite.hintZh ?? "系統暫未支援相應的不定積分，因此未能自動計算此定積分。",
        variable: detected,
        variableLatex: variableLatex(detected),
        indefinite,
      };
    }

    const F = indefinite.antiderivative;
    const preserveExactArctan = indefinite.method.includes("arctangent rule");
    const upperSub = preserveExactArctan
      ? substituteVariable(F, detected, `(${upper})`)
      : simplifyExpr(substituteVariable(F, detected, `(${upper})`));
    const lowerSub = preserveExactArctan
      ? substituteVariable(F, detected, `(${lower})`)
      : simplifyExpr(substituteVariable(F, detected, `(${lower})`));
    const valueExpr = preserveExactArctan ? `(${upperSub})-(${lowerSub})` : simplifyExpr(`(${upperSub})-(${lowerSub})`);
    const vLatex = variableLatex(detected);
    const valueLatex = toLatex(valueExpr);
    const antiderivativeLatex = preserveExactArctan && indefinite.answerLatex
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
      hintEn: "The definite integral could not be parsed. Use * for multiplication, ^ for powers, and constant limits such as 0, 1, 2 or pi/2.",
      hintZh: "系統未能讀取此定積分。請使用 * 表示乘法、^ 表示冪次，並使用常數上下限如 0、1、2 或 pi/2。",
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
  "sin(log(x))",
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

export function checkAntiderivative(integrand: string, proposedAnswer: string): { correct: boolean; messageEn: string; messageZh: string; derivativeLatex?: string; variable?: string; variableLatex?: string } {
  try {
    const cleanAnswer = preprocess(proposedAnswer).replace(/\+?C$/i, "");
    const cleanIntegrand = preprocess(integrand);
    const integrandNode = parse(cleanIntegrand);
    const detected = detectVariable(integrandNode);
    if (!detected || detected === "__multiple__") {
      return {
        correct: false,
        messageEn: "The practice question contains more than one possible variable, so the answer cannot be checked automatically.",
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
      messageEn: correct ? "Correct. The derivative of your answer matches the integrand." : "Not quite. Differentiate your answer and compare it with the integrand.",
      messageZh: correct ? "正確。你的答案微分後與被積函數相同。" : "未完全正確。請把你的答案微分後與被積函數比較。",
    };
  } catch {
    return {
      correct: false,
      messageEn: "The answer could not be parsed. Use one variable such as x, t, y, α or θ; use *, ^ and function brackets; omit or write +C at the end only.",
      messageZh: "系統未能讀取你的答案。請使用單一變數如 x、t、y、α 或 θ，並使用 *、^ 及函數括號；+C 可省略或只放在最後。",
    };
  }
}
