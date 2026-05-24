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

interface Integrated {
  expr: string;
  method: string;
  methodZh: string;
  steps: string[];
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

function preprocess(input: string): string {
  const letters = `A-Za-z${GREEK_LOWER}`;
  return input
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/÷/g, "/")
    .replace(/\bln\s*\(/gi, "log(")
    .replace(/\be\s*\^\s*\(/gi, "exp(")
    .replace(new RegExp(`(\\d)([${letters}])`, "g"), "$1*$2")
    .replace(new RegExp(`([${GREEK_LOWER}])(\\d)`, "g"), "$1*$2")
    .replace(/([a-zA-Z])(\d)/g, (match, letter, digit) => FUNCTION_NAMES.has(letter) ? match : `${letter}*${digit}`)
    .replace(new RegExp(`\\)\\s*([${letters}]|\\d)`, "g"), ")*$1")
    .replace(/(\d)\s*\(/g, "$1*(")
    .replace(new RegExp(`([${GREEK_LOWER}])\\s*\\(`, "g"), "$1*(")
    .replace(/\s+/g, "");
}

function toLatex(expr: string): string {
  try {
    return parse(expr).toTex({ parenthesis: "keep", implicit: "hide" });
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

function simplifyExpr(expr: string): string {
  try {
    // Keep logarithms of numeric constants symbolic, e.g. 2^x / ln 2, because
    // exact answers are preferred over decimal approximations in this app.
    if (/log\(\s*\d/.test(expr)) return expr;
    return simplify(expr).toString();
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
  return args && args.length === 1 ? args[0] : null;
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

      const reverse = tryReverseChainFromProduct(factors, ctx);
      if (reverse) return reverse;

      const byParts = tryByParts(factors, ctx);
      if (byParts) return byParts;
    }

    if (op === "/") {
      const numerator = args[0].toString();
      const denominator = args[1].toString();
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
          return {
            expr: divideExpr(`${base}^(${exponent})`, denom),
            method: "exponential rule",
            methodZh: "指數積分法",
            steps: [`${intLatex(`${base}^(${exponent})`, ctx)}=\\frac{${toLatex(`${base}^(${exponent})`)}}{${toLatex(denom)}}+C`],
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
      const inner = arg.toString();
      const d = affineDerivative(inner, ctx);
      if (d) {
        if (fn === "sin") return { expr: simplifyExpr(`-cos(${inner})/(${d})`), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`${intLatex(`sin(${inner})`, ctx)}=-\\frac{\\cos\\left(${toLatex(inner)}\\right)}{${toLatex(d)}}+C`] };
        if (fn === "cos") return { expr: divideExpr(`sin(${inner})`, d), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`${intLatex(`cos(${inner})`, ctx)}=\\frac{\\sin\\left(${toLatex(inner)}\\right)}{${toLatex(d)}}+C`] };
        if (fn === "tan") return { expr: simplifyExpr(`-log(abs(cos(${inner})))/(${d})`), method: "trigonometric logarithmic rule", methodZh: "三角對數積分法", steps: [`${intLatex(`tan(${inner})`, ctx)}=-\\frac{1}{${toLatex(d)}}\\ln\\left|\\cos\\left(${toLatex(inner)}\\right)\\right|+C`] };
        if (fn === "exp") return { expr: divideExpr(`exp(${inner})`, d), method: "exponential rule", methodZh: "指數積分法", steps: [`${intLatex(`exp(${inner})`, ctx)}=\\frac{e^{${toLatex(inner)}}}{${toLatex(d)}}+C`] };
        if (fn === "sqrt") return { expr: divideExpr(`(${inner})^(3/2)`, `(${d})*(3/2)`), method: "power rule with affine substitution", methodZh: "一次式代換冪次法則", steps: [`\\sqrt{${toLatex(inner)}}=${toLatex(`(${inner})^(1/2)`)}`, `${intLatex(`(${inner})^(1/2)`, ctx)}=\\frac{${toLatex(`(${inner})^(3/2)`)}}{${toLatex(`(${d})*(3/2)`)}}+C`] };
        if (fn === "log" && simplifyExpr(inner) === ctx.variable) {
          return tryLogByParts(ctx);
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

function tryLogByParts(ctx: IntegrationContext): Integrated {
  const v = ctx.variable;
  return {
    expr: `${v}*log(${v})-${v}`,
    method: "integration by parts",
    methodZh: "分部積分法",
    steps: [
      `u=\\ln ${variableLatex(v)},\\quad dv=1\\,${dVar(ctx)}`,
      `du=\\frac{1}{${variableLatex(v)}}\\,${dVar(ctx)},\\quad v=${variableLatex(v)}`,
      `${intLatex(`log(${v})`, ctx)}=${variableLatex(v)}\\ln ${variableLatex(v)}-${intLatex("1", ctx)}`,
      `${intLatex(`log(${v})`, ctx)}=${variableLatex(v)}\\ln ${variableLatex(v)}-${variableLatex(v)}+C`,
    ],
  };
}

function tryByParts(factors: AnyNode[], ctx: IntegrationContext): Integrated | null {
  if (factors.length < 2 || ctx.depth > 7) return null;

  const logIndex = factors.findIndex((factor) => functionName(factor) === "log" && functionArg(factor)?.toString() === ctx.variable);
  if (logIndex >= 0) {
    const dvExpr = combineFactors(factors.filter((_, idx) => idx !== logIndex));
    const degree = algebraicDegree(dvExpr, ctx);
    if (degree !== null || dvExpr === "1") {
      const n = degree ?? 0;
      const denom = n + 1;
      const power = `${ctx.variable}^${denom}`;
      const first = `(${power})*log(${ctx.variable})/${denom}`;
      const second = `(${power})/(${denom * denom})`;
      const result = simplifyExpr(`(${first})-(${second})`);
      return {
        expr: result,
        method: "integration by parts",
        methodZh: "分部積分法",
        steps: [
          `u=\\ln ${variableLatex(ctx.variable)},\\quad dv=${toLatex(dvExpr)}\\,${dVar(ctx)}`,
          `du=\\frac{1}{${variableLatex(ctx.variable)}}\\,${dVar(ctx)},\\quad v=\\frac{${variableLatex(ctx.variable)}^{${denom}}}{${denom}}`,
          `${intLatex(combineFactors(factors), ctx)}=\\frac{${variableLatex(ctx.variable)}^{${denom}}}{${denom}}\\ln ${variableLatex(ctx.variable)}-${intLatex(`(${ctx.variable}^${denom}/${denom})/${ctx.variable}`, ctx)}`,
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

function substitutionAngle(ctx: IntegrationContext): string {
  return ctx.variable === "θ" || ctx.variable === "theta" ? "φ" : "θ";
}

function tryTrigSubstitution(node: AnyNode, ctx: IntegrationContext): Integrated | null {
  const v = ctx.variable;
  const vl = variableLatex(v);
  const expr = node.toString();
  const angle = substitutionAngle(ctx);
  const angleLatex = variableLatex(angle);

  const reciprocalDenominator = node.type === "OperatorNode" && (node as any).op === "/" && (node as any).args[0].toString() === "1"
    ? ((node as any).args[1] as AnyNode)
    : null;

  if (reciprocalDenominator) {
    const denomText = reciprocalDenominator.toString();
    const sqrtInner = sqrtOf(reciprocalDenominator);

    const a2ForAtan = detectSquareConstant(denomText, (a2) => `${a2}+(${v})^2`);
    if (a2ForAtan !== null) {
      const a = Math.sqrt(a2ForAtan);
      const aLatex = toLatex(String(a));
      const result = divideExpr(`atan((${v})/${a})`, String(a));
      return {
        expr: result,
        method: "trigonometric substitution",
        methodZh: "三角代換法",
        steps: [
          `${vl}=${aLatex}\\tan ${angleLatex},\\quad ${dVar(ctx)}=${aLatex}\\sec^2 ${angleLatex}\\,d${angleLatex}`,
          `${toLatex(`${a2ForAtan}+(${v})^2`)}=${toLatex(String(a2ForAtan))}\\sec^2 ${angleLatex}`,
          `${intLatex(expr, ctx)}=\\int\\frac{${aLatex}\\sec^2 ${angleLatex}}{${toLatex(String(a2ForAtan))}\\sec^2 ${angleLatex}}\\,d${angleLatex}`,
          `${intLatex(expr, ctx)}=\\frac{1}{${aLatex}}${angleLatex}+C`,
          `${angleLatex}=\\tan^{-1}\\left(\\frac{${vl}}{${aLatex}}\\right)`,
          `${intLatex(expr, ctx)}=${toLatex(result)}+C`,
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
    const simplifiedAnswer = simplifyExpr(integrated.expr);
    return {
      input,
      normalized,
      status: "ok",
      integrandLatex: toLatex(normalized),
      answerLatex: `${toLatex(simplifiedAnswer)}+C`,
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

export const integralExamples = [
  "x^2 + 3*x - 1",
  "sin(2*x+1)",
  "t^2 + 3*t",
  "sin(θ)",
  "x*sin(x)",
  "x*exp(x)",
  "x^2*log(x)",
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
