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
}

interface Integrated {
  expr: string;
  method: string;
  methodZh: string;
  steps: string[];
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

function preprocess(input: string): string {
  return input
    .trim()
    .replace(/\u2212/g, "-")
    .replace(/\bln\s*\(/gi, "log(")
    .replace(/\be\s*\^\s*\(/gi, "exp(")
    .replace(/(\d)(x)/gi, "$1*$2")
    .replace(/(x)(\d)/gi, "$1*$2")
    .replace(/\)\s*(x|\d)/gi, ")*$1")
    .replace(/(x|\d)\s*\(/gi, "$1*(")
    .replace(/\s+/g, "");
}

function toLatex(expr: string): string {
  try {
    return parse(expr).toTex({ parenthesis: "keep", implicit: "hide" });
  } catch {
    return expr;
  }
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

function isZeroExpr(expr: string): boolean {
  try {
    const s = simplify(expr).toString();
    if (s === "0") return true;
    return SAMPLE_POINTS.every((x) => Math.abs(evalExpr(expr, x)) < 1e-8);
  } catch {
    return false;
  }
}

function evalExpr(expr: string, x: number): number {
  const value = parse(expr).compile().evaluate({ x });
  if (typeof value === "number") return value;
  return Number(value);
}

function hasVariable(expr: string): boolean {
  return /(^|[^A-Za-z])x([^A-Za-z]|$)/.test(expr);
}

function isConstantNode(node: AnyNode): boolean {
  try {
    return !hasVariable(node.toString());
  } catch {
    return false;
  }
}

function constantValue(expr: string): number | null {
  try {
    if (hasVariable(expr)) return null;
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
  if (/^[A-Za-z]+\(.+\)$/.test(s)) return s;
  return `(${s})`;
}

function reciprocal(expr: string): string {
  return simplifyExpr(`1/(${expr})`);
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

function affineDerivative(inner: string): string | null {
  try {
    const d = simplify(derivative(inner, "x")).toString();
    if (!hasVariable(d) && !isZeroExpr(d)) return d;
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

function functionArg(node: AnyNode): AnyNode | null {
  const args = (node as any).args as AnyNode[] | undefined;
  return args && args.length === 1 ? args[0] : null;
}

function proportionalTo(expr: string, target: string): string | null {
  const ratios: number[] = [];
  for (const x of SAMPLE_POINTS) {
    try {
      const t = evalExpr(target, x);
      const e = evalExpr(expr, x);
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

function integrateNode(node: AnyNode): Integrated {
  const text = node.toString();

  if (!hasVariable(text)) {
    return {
      expr: simplifyExpr(`(${text})*x`),
      method: "constant rule",
      methodZh: "常數積分法",
      steps: [`\\int ${toLatex(text)}\\,dx=${toLatex(text)}x+C`],
    };
  }

  if (node.type === "SymbolNode" && text === "x") {
    return {
      expr: "x^2/2",
      method: "power rule",
      methodZh: "冪次法則",
      steps: ["\\int x\\,dx=\\frac{x^2}{2}+C"],
    };
  }

  if (node.type === "ParenthesisNode") {
    return integrateNode((node as any).content);
  }

  if (node.type === "OperatorNode") {
    const op = (node as any).op as string;
    const args = (node as any).args as AnyNode[];

    if (op === "+") {
      const left = integrateNode(args[0]);
      const right = integrateNode(args[1]);
      return {
        expr: simplifyExpr(`(${left.expr})+(${right.expr})`),
        method: "linearity",
        methodZh: "線性法則",
        steps: [
          `\\int\\left(${toLatex(args[0].toString())}+${toLatex(args[1].toString())}\\right)\\,dx`,
          ...left.steps,
          ...right.steps,
        ],
      };
    }

    if (op === "-") {
      const left = integrateNode(args[0]);
      const right = integrateNode(args[1]);
      return {
        expr: simplifyExpr(`(${left.expr})-(${right.expr})`),
        method: "linearity",
        methodZh: "線性法則",
        steps: [
          `\\int\\left(${toLatex(args[0].toString())}-${toLatex(args[1].toString())}\\right)\\,dx`,
          ...left.steps,
          ...right.steps,
        ],
      };
    }

    if (op === "*") {
      const factors = flattenOperator(node, "*");
      const constants = factors.filter(isConstantNode).map((f) => f.toString());
      const variableFactors = factors.filter((f) => !isConstantNode(f));
      if (constants.length > 0 && variableFactors.length > 0) {
        const c = simplifyExpr(constants.join("*"));
        const rest = variableFactors.map((f) => maybeParenthesize(f.toString())).join("*");
        const inner = integrateNode(parse(rest));
        return {
          expr: multiplyExpr(c, inner.expr),
          method: `constant multiple + ${inner.method}`,
          methodZh: `常數倍法則 + ${inner.methodZh}`,
          steps: [`\\int ${toLatex(c)}\\left(${toLatex(rest)}\\right)\\,dx=${toLatex(c)}\\int ${toLatex(rest)}\\,dx`, ...inner.steps],
        };
      }

      const reverse = tryReverseChainFromProduct(factors);
      if (reverse) return reverse;
    }

    if (op === "/") {
      const numerator = args[0].toString();
      const denominator = args[1].toString();
      const denomDerivative = simplify(derivative(denominator, "x")).toString();
      const reverseLogCoeff = proportionalTo(numerator, denomDerivative);
      if (reverseLogCoeff) {
        return {
          expr: multiplyExpr(reverseLogCoeff, `log(abs(${denominator}))`),
          method: "reverse chain logarithmic rule",
          methodZh: "反鏈式對數法則",
          steps: [`u=${toLatex(denominator)},\\quad du=${toLatex(denomDerivative)}\\,dx`, `\\int\\frac{${toLatex(numerator)}}{${toLatex(denominator)}}\\,dx=${toLatex(reverseLogCoeff)}\\ln\\left|${toLatex(denominator)}\\right|+C`],
        };
      }
      if (!hasVariable(numerator)) {
        const denomDeriv = affineDerivative(denominator);
        if (denomDeriv) {
          const coeff = simplifyExpr(`(${numerator})/(${denomDeriv})`);
          return {
            expr: multiplyExpr(coeff, `log(abs(${denominator}))`),
            method: "logarithmic rule",
            methodZh: "對數積分法",
            steps: [`\\int\\frac{${toLatex(numerator)}}{${toLatex(denominator)}}\\,dx=${toLatex(coeff)}\\ln\\left|${toLatex(denominator)}\\right|+C`],
          };
        }
      }
    }

    if (op === "^") {
      const base = args[0].toString();
      const exponent = args[1].toString();
      const expVal = constantValue(exponent);
      const baseConst = constantValue(base);
      const deriv = affineDerivative(base);

      if (baseConst !== null && baseConst > 0 && baseConst !== 1 && hasVariable(exponent)) {
        const expDeriv = affineDerivative(exponent);
        if (expDeriv) {
          const denom = simplifyExpr(`(${expDeriv})*log(${base})`);
          return {
            expr: divideExpr(`${base}^(${exponent})`, denom),
            method: "exponential rule",
            methodZh: "指數積分法",
            steps: [`\\int ${toLatex(`${base}^(${exponent})`)}\\,dx=\\frac{${toLatex(`${base}^(${exponent})`)}}{${toLatex(denom)}}+C`],
          };
        }
      }

      if (expVal !== null && deriv) {
        if (Math.abs(expVal + 1) < 1e-10) {
          return {
            expr: divideExpr(`log(abs(${base}))`, deriv),
            method: "logarithmic rule",
            methodZh: "對數積分法",
            steps: [`\\int ${toLatex(`(${base})^(-1)`)}\\,dx=\\frac{1}{${toLatex(deriv)}}\\ln\\left|${toLatex(base)}\\right|+C`],
          };
        }
        const newExp = addOneToExponent(exponent);
        const denom = simplifyExpr(`(${deriv})*(${newExp})`);
        return {
          expr: divideExpr(`(${base})^(${newExp})`, denom),
          method: "power rule with affine substitution",
          methodZh: "一次式代換冪次法則",
          steps: [`u=${toLatex(base)},\\quad du=${toLatex(deriv)}\\,dx`, `\\int ${toLatex(`(${base})^(${exponent})`)}\\,dx=\\frac{${toLatex(`(${base})^(${newExp})`)}}{${toLatex(denom)}}+C`],
        };
      }

      if ((isFunctionNode(args[0], "sec") || isFunctionNode(args[0], "csc")) && expVal === 2) {
        const arg = functionArg(args[0]);
        if (arg) {
          const inner = arg.toString();
          const d = affineDerivative(inner);
          if (d) {
            if (isFunctionNode(args[0], "sec")) {
              return { expr: divideExpr(`tan(${inner})`, d), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`\\int ${toLatex(`sec(${inner})^2`)}\\,dx=\\frac{${toLatex(`tan(${inner})`)}}{${toLatex(d)}}+C`] };
            }
            return { expr: simplifyExpr(`-(${divideExpr(`cot(${inner})`, d)})`), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`\\int ${toLatex(`csc(${inner})^2`)}\\,dx=-\\frac{${toLatex(`cot(${inner})`)}}{${toLatex(d)}}+C`] };
          }
        }
      }
    }
  }

  if (node.type === "FunctionNode") {
    const fn = ((node as any).fn?.name || (node as any).name) as string;
    const arg = functionArg(node);
    if (arg) {
      const inner = arg.toString();
      const d = affineDerivative(inner);
      if (d) {
        if (fn === "sin") return { expr: simplifyExpr(`-cos(${inner})/(${d})`), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`\\int\\sin\\left(${toLatex(inner)}\\right)\\,dx=-\\frac{\\cos\\left(${toLatex(inner)}\\right)}{${toLatex(d)}}+C`] };
        if (fn === "cos") return { expr: divideExpr(`sin(${inner})`, d), method: "trigonometric rule", methodZh: "三角函數積分法", steps: [`\\int\\cos\\left(${toLatex(inner)}\\right)\\,dx=\\frac{\\sin\\left(${toLatex(inner)}\\right)}{${toLatex(d)}}+C`] };
        if (fn === "tan") return { expr: simplifyExpr(`-log(abs(cos(${inner})))/(${d})`), method: "trigonometric logarithmic rule", methodZh: "三角對數積分法", steps: [`\\int\\tan\\left(${toLatex(inner)}\\right)\\,dx=-\\frac{1}{${toLatex(d)}}\\ln\\left|\\cos\\left(${toLatex(inner)}\\right)\\right|+C`] };
        if (fn === "exp") return { expr: divideExpr(`exp(${inner})`, d), method: "exponential rule", methodZh: "指數積分法", steps: [`\\int e^{${toLatex(inner)}}\\,dx=\\frac{e^{${toLatex(inner)}}}{${toLatex(d)}}+C`] };
        if (fn === "sqrt") return { expr: divideExpr(`(${inner})^(3/2)`, `(${d})*(3/2)`), method: "power rule with affine substitution", methodZh: "一次式代換冪次法則", steps: [`\\sqrt{${toLatex(inner)}}=${toLatex(`(${inner})^(1/2)`)}`, `\\int ${toLatex(`(${inner})^(1/2)`)}\\,dx=\\frac{${toLatex(`(${inner})^(3/2)`)}}{${toLatex(`(${d})*(3/2)`)}}+C`] };
        if (fn === "log") {
          if (simplifyExpr(inner) === "x") {
            return { expr: "x*log(x)-x", method: "integration by parts", methodZh: "分部積分法", steps: ["\\int\\ln x\\,dx=x\\ln x-x+C"] };
          }
        }
      }
    }
  }

  throw new UnsupportedIntegral(
    "This expression is outside the currently implemented HKDSE M2 patterns. Try expanding brackets, splitting terms, rewriting radicals as powers, or checking whether the integrand is a reverse-chain-rule form.",
    "此表達式超出目前已實作的 HKDSE M2 模式。可嘗試先展開括號、拆項、把根號改寫成冪次，或檢查是否屬於反鏈式法則形式。"
  );
}

function tryReverseChainFromProduct(factors: AnyNode[]): Integrated | null {
  for (let i = 0; i < factors.length; i++) {
    const candidate = factors[i];
    const rest = factors.filter((_, idx) => idx !== i).map((f) => maybeParenthesize(f.toString())).join("*") || "1";

    if (candidate.type === "OperatorNode" && (candidate as any).op === "^") {
      const [baseNode, expNode] = (candidate as any).args as AnyNode[];
      const base = baseNode.toString();
      const exponent = expNode.toString();
      const expVal = constantValue(exponent);
      if (expVal !== null) {
        const d = simplify(derivative(base, "x")).toString();
        const k = proportionalTo(rest, d);
        if (k) {
          if (Math.abs(expVal + 1) < 1e-10) {
            return {
              expr: multiplyExpr(k, `log(abs(${base}))`),
              method: "reverse chain rule",
              methodZh: "反鏈式法則",
              steps: [`u=${toLatex(base)},\\quad du=${toLatex(d)}\\,dx`, `\\int ${toLatex(rest)}${toLatex(`(${base})^(${exponent})`)}\\,dx=${toLatex(k)}\\ln\\left|${toLatex(base)}\\right|+C`],
            };
          }
          const newExp = addOneToExponent(exponent);
          return {
            expr: multiplyExpr(k, divideExpr(`(${base})^(${newExp})`, newExp)),
            method: "reverse chain rule",
            methodZh: "反鏈式法則",
            steps: [`u=${toLatex(base)},\\quad du=${toLatex(d)}\\,dx`, `\\int ${toLatex(rest)}${toLatex(`(${base})^(${exponent})`)}\\,dx=${toLatex(k)}\\cdot\\frac{${toLatex(`(${base})^(${newExp})`)}}{${toLatex(newExp)}}+C`],
          };
        }
      }
    }

    if (candidate.type === "FunctionNode") {
      const fn = ((candidate as any).fn?.name || (candidate as any).name) as string;
      const arg = functionArg(candidate);
      if (!arg) continue;
      const inner = arg.toString();
      const d = simplify(derivative(inner, "x")).toString();
      const k = proportionalTo(rest, d);
      if (!k) continue;
      if (fn === "exp") return { expr: multiplyExpr(k, `exp(${inner})`), method: "reverse chain rule", methodZh: "反鏈式法則", steps: [`u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,dx`, `\\int ${toLatex(rest)}e^{${toLatex(inner)}}\\,dx=${toLatex(k)}e^{${toLatex(inner)}}+C`] };
      if (fn === "sin") return { expr: multiplyExpr(k, `-cos(${inner})`), method: "reverse chain rule", methodZh: "反鏈式法則", steps: [`u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,dx`, `\\int ${toLatex(rest)}\\sin(${toLatex(inner)})\\,dx=-${toLatex(k)}\\cos(${toLatex(inner)})+C`] };
      if (fn === "cos") return { expr: multiplyExpr(k, `sin(${inner})`), method: "reverse chain rule", methodZh: "反鏈式法則", steps: [`u=${toLatex(inner)},\\quad du=${toLatex(d)}\\,dx`, `\\int ${toLatex(rest)}\\cos(${toLatex(inner)})\\,dx=${toLatex(k)}\\sin(${toLatex(inner)})+C`] };
    }
  }
  return null;
}

export function calculateIntegral(input: string): IntegralResult {
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
      hintEn: "Please enter an expression in x, for example x^2 + sin(2x).",
      hintZh: "請輸入以 x 表示的式子，例如 x^2 + sin(2x)。",
    };
  }

  try {
    const node = parse(normalized);
    const integrated = integrateNode(node);
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
      hintEn: "The expression could not be parsed. Use * for multiplication, ^ for powers, and function brackets such as sin(x).",
      hintZh: "系統未能讀取此表達式。請使用 * 表示乘法、^ 表示冪次，函數請寫成 sin(x) 等格式。",
    };
  }
}

export const integralExamples = [
  "x^2 + 3*x - 1",
  "sin(2*x+1)",
  "cos(3*x)",
  "exp(2*x-5)",
  "1/(2*x+1)",
  "(3*x+2)^5",
  "x*(x^2+1)^4",
  "2*x/(x^2+1)",
  "2^x",
  "sec(x)^2",
];

export function latexOfExpression(input: string): string {
  try {
    return toLatex(preprocess(input));
  } catch {
    return input;
  }
}

export function checkAntiderivative(integrand: string, proposedAnswer: string): { correct: boolean; messageEn: string; messageZh: string; derivativeLatex?: string } {
  try {
    const cleanAnswer = preprocess(proposedAnswer).replace(/\+?C$/i, "");
    const cleanIntegrand = preprocess(integrand);
    const d = simplify(derivative(cleanAnswer, "x")).toString();
    const difference = `(${d})-(${cleanIntegrand})`;
    const correct = isZeroExpr(difference);
    return {
      correct,
      derivativeLatex: toLatex(d),
      messageEn: correct ? "Correct. The derivative of your answer matches the integrand." : "Not quite. Differentiate your answer and compare it with the integrand.",
      messageZh: correct ? "正確。你的答案微分後與被積函數相同。" : "未完全正確。請把你的答案微分後與被積函數比較。",
    };
  } catch {
    return {
      correct: false,
      messageEn: "The answer could not be parsed. Use x, *, ^ and function brackets; omit or write +C at the end only.",
      messageZh: "系統未能讀取你的答案。請使用 x、*、^ 及函數括號；+C 可省略或只放在最後。",
    };
  }
}
