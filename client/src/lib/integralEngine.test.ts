import { describe, expect, it } from "vitest";
import { derivative, parse } from "mathjs";
import katex from "katex";
import { exactSimplify } from "./exactMath";
import {
  calculateIntegral as I,
  calculateDefiniteIntegral as D,
} from "./integralEngine";
import { reasoningScenes } from "./reasoning";
const cases = [
  "0",
  "x^2+3*x-1",
  "(3*x+2)^5",
  "sqrt(2*x+1)",
  "x^(-1)",
  "1/(1+x)^2",
  "(x+1)*(x+2)",
  "(x^3+1)/(x+1)",
  "sin(2*x+1)",
  "cos(3*x)",
  "sec(x)^2",
  "csc(x)^2",
  "sin(x)^2",
  "cos(x)^2",
  "sin(x)^3",
  "cos(x)^3",
  "sin(x)^4",
  "cos(x)^4",
  "tan(x)^2",
  "cot(x)^2",
  "sin(x)*cos(x)",
  "sin(2*x)*cos(3*x)",
  "sec(x)*tan(x)",
  "csc(x)*cot(x)",
  "exp(x)",
  "2^x",
  "10^t",
  "x*sin(x)",
  "x*cos(x)",
  "x*exp(x)",
  "x^2*exp(x)",
  "x^2*sin(x)",
  "exp(2*x)*sin(3*x)",
  "exp(2*x)*cos(3*x)",
  "ln(x)",
  "ln(2*x+1)",
  "log(x)",
  "log(x,2)",
  "x^2*ln(x)",
  "x^2*log(x)",
  "ln(x)/x",
  "2*x/(x^2+1)",
  "x/sqrt(1-x^2)",
  "2*x*sec(x^2)^2",
  "2*x*exp(x^2)",
  "1/(x^2+4)",
  "1/(2*x^2+3)",
  "1/(x^2-1)",
  "1/((x+1)*(x+2))",
  "(2*x+3)/(x^2+x+2)",
  "2/sqrt(3-x^2)",
  "sqrt(3-x^2)",
  "1/sqrt(9-x^2)",
  "sqrt(4+x^2)",
  "sqrt(4-(2*x-1)^2)",
  "sin(ln(x))",
  "cos(sqrt(x))",
  "θ*sin(θ)",
  "sin(sqrt(2)*x)",
  "sin(pi*x)",
  "2*x*sin(pi*x^2)",
  "sin(x+1)*sin(x-1)",
  "(2*pi)^2",
  "(1+pi)^2",
];
describe("DSE M2 antiderivatives", () => {
  it.each(cases)("computes and differentiates %s", expression => {
    const r = I(expression);
    expect(r.status, r.hintEn).toBe("ok");
    expect(r.antiderivative).toBeTruthy();
    expect(r.answerLatex).toMatch(/\+C$/);
    expect(r.answerLatex).not.toMatch(/\d\.\d{5}/);
    expect(r.partsCost).toBeGreaterThanOrEqual(0);
    expect(r.partsCost).toBeLessThanOrEqual(2);
    const d = derivative(r.antiderivative!, r.variable!).compile();
    const f = parse(r.normalized).compile();
    let checked = 0;
    for (const x of [-2, -0.5, 0.1, 0.2, 0.5, 0.7, 0.8, 1.3, 2.2, 4]) {
      try {
        const scope = { [r.variable!]: x };
        const a = d.evaluate(scope),
          b = f.evaluate(scope);
        if (
          typeof a !== "number" ||
          typeof b !== "number" ||
          !Number.isFinite(a) ||
          !Number.isFinite(b)
        )
          continue;
        expect(Math.abs(a - b)).toBeLessThan(1e-6 * (1 + Math.abs(b)));
        checked++;
      } catch (error) {
        if (error instanceof Error && error.message.includes("expected"))
          throw error;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3);
    for (const line of [r.answerLatex!, ...r.stepsLatex])
      expect(() =>
        katex.renderToString(line, {
          throwOnError: true,
          strict: false,
          trust: false,
        })
      ).not.toThrow();
    expect(reasoningScenes(r).length).toBeGreaterThan(2);
  });
});
const definiteCases = [
  ["x^2", "0", "2", "8/3"],
  ["sin(x)", "0", "pi", "2"],
  ["cos(x)", "0", "pi/3", "sqrt(3)/2"],
  ["sec(x)^2", "0", "pi/4", "1"],
  ["sin(x)^2", "0", "pi", "pi/2"],
  ["1/(1+x^2)", "0", "1", "pi/4"],
  ["2/sqrt(3-x^2)", "0", "1", "2*asin(1/sqrt(3))"],
  ["sqrt(3-x^2)", "0", "sqrt(3)", "3*pi/4"],
  ["ln(x)", "1", "e", "1"],
  ["log(x)", "1", "10", "10-9/log(10)"],
  ["ln(x)/x", "1", "e", "1/2"],
  ["x*abs(x)", "-3", "3", "0"],
  ["abs(x)", "-2", "2", "4"],
  ["x^2", "2", "0", "-8/3"],
  ["x^2", "2", "2", "0"],
  ["(2*pi)^2", "0", "1", "4*pi^2"],
  ["(1+pi)^2", "0", "1", "(1+pi)^2"],
  ["2*x*sec(x^2)^2", "0", "1", "tan(1)"],
  ["2*x*csc(x^2)^2", "1", "3/2", "cot(1)-cot(9/4)"],
];
describe("Exact definite values", () => {
  it.each(definiteCases)("%s from %s to %s", (expression, a, b, expected) => {
    const r = D(expression, a, b);
    expect(r.status, r.hintEn).toBe("ok");
    expect(r.valueLatex).not.toMatch(/\d\.\d{5}/);
    expect(r.valueLatex).not.toContain("+C");
    expect(r.partsCost).toBeGreaterThanOrEqual(0);
    expect(r.partsCost).toBeLessThanOrEqual(2);
    if (r.indefinite) expect(r.partsCost).toBe(r.indefinite.partsCost);
    expect(
      Math.abs(
        Number(parse(r.valueExpr!).evaluate()) -
          Number(parse(expected).evaluate())
      )
    ).toBeLessThan(1e-8);
    expect(() =>
      katex.renderToString(r.valueLatex!, { throwOnError: true, trust: false })
    ).not.toThrow();
  });
});
describe("Curriculum and domain limits", () => {
  it.each([
    "x^3*exp(x)",
    "asin(x)",
    "atan(x)",
    "exp(-x^2)",
    "sin(x^2)",
    "ln(x)*sin(ln(x))",
    "ln(x)*cos(ln(x))",
    "x*sin(ln(x))",
  ])("gives a hint for %s", e => {
    const r = I(e);
    expect(r.status).toBe("unsupported");
    expect(r.hintZh).toBeTruthy();
  });
  it.each([
    ["1/x", "-1", "1"],
    ["1/x", "0", "1"],
    ["tan(x)", "0", "pi"],
    ["sec(x)^2", "0", "pi/2"],
    ["1/(x^2-1)", "0", "2"],
    ["sqrt(1-x^2)", "0", "2"],
    ["ln(x)", "-1", "1"],
    ["2*x*sec(x^2)^2", "0", "2"],
    ["2*x*csc(x^2)^2", "1", "2"],
    ["1/sqrt(x)", "0", "1"],
    ["x^(-1/2)", "0", "1"],
    ["2/sqrt(3-x^2)", "0", "sqrt(3)"],
    ["sin(x)/cos(x)", "0", "pi"],
    ["sin(x^2)/cos(x^2)", "0", "2"],
  ])("rejects an invalid interval %s", (e, a, b) => {
    expect(D(e, a, b).status).not.toBe("ok");
  });
  it("rejects incomplete bounds and malformed input", () => {
    expect(D("x", "0", "").status).toBe("invalid");
    expect(I("sin(").status).toBe("invalid");
    expect(I("").status).toBe("invalid");
    expect(I("x+y").status).toBe("unsupported");
  });
});

// Independently check numerical derivatives, not merely a displayed formula.
function expectVerified(expression: string, expected: string, cost: number) {
  const r = I(expression);
  expect(r.status, r.hintEn).toBe("ok");
  expect(r.partsCost).toBe(cost);
  expect(r.antiderivative).toBeTruthy();
  expect(r.answerLatex).not.toMatch(/\d\.\d{5}/);
  const f = parse(r.normalized).compile();
  const F = parse(r.antiderivative!).compile();
  const reference = parse(expected).compile();
  const d = derivative(r.antiderivative!, r.variable!).compile();
  let checked = 0;
  for (const value of [-2.1, -1.2, -0.7, -0.3, 0.2, 0.4, 0.8, 1.1, 1.3, 2.2]) {
    const h = 1e-5 * (1 + Math.abs(value));
    const scope = { [r.variable!]: value };
    try {
      const y = f.evaluate(scope);
      const numerical =
        (F.evaluate({ [r.variable!]: value + h }) -
          F.evaluate({ [r.variable!]: value - h })) /
        (2 * h);
      const symbolic = d.evaluate(scope);
      const actual = F.evaluate(scope);
      const target = reference.evaluate(scope);
      if (
        ![y, numerical, symbolic, actual, target].every(
          n => typeof n === "number" && Number.isFinite(n)
        )
      )
        continue;
      expect(Math.abs(numerical - y)).toBeLessThan(2e-5 * (1 + Math.abs(y)));
      expect(Math.abs(symbolic - y)).toBeLessThan(1e-6 * (1 + Math.abs(y)));
      expect(Math.abs(actual - target)).toBeLessThan(
        1e-8 * (1 + Math.abs(target))
      );
      checked++;
    } catch (error) {
      if (error instanceof Error && error.message.includes("expected"))
        throw error;
    }
  }
  expect(checked).toBeGreaterThanOrEqual(3);
  for (const line of [r.answerLatex!, ...r.stepsLatex])
    expect(() =>
      katex.renderToString(line, {
        throwOnError: true,
        strict: false,
        trust: false,
      })
    ).not.toThrow();
  return r;
}

describe("Safe derivative-matched compositions", () => {
  it.each([
    ["x/(x^4+4)", "atan(x^2/2)/4"],
    ["7*x/(x^4+4)", "7*atan(x^2/2)/4"],
    ["3*x^2/(x^6+9)", "atan(x^3/3)/3"],
    ["(x+1)/((x+1)^4+4)", "atan((x+1)^2/2)/4"],
    ["(2*x+1)/((2*x+1)^4+4)", "atan((2*x+1)^2/2)/8"],
    ["sin(x)*cos(x)/(cos(x)^4+4)", "-atan(cos(x)^2/2)/4"],
    ["(3*x^2+2*x)/((x^3+x^2)^2+4)", "atan((x^3+x^2)/2)/2"],
    ["5*t^2/(t^6+7)", "5*atan(t^3/sqrt(7))/(3*sqrt(7))"],
    ["x/(2*x^4+3)", "atan(x^2/sqrt(3/2))/(4*sqrt(3/2))"],
    ["2*x/((x^2+1)^2+4)", "atan((x^2+1)/2)/2"],
    ["sin(x)/(cos(x)^2+4)", "-atan(cos(x)/2)/2"],
    ["exp(x)/(exp(x)^2+3)", "atan(exp(x)/sqrt(3))/sqrt(3)"],
    ["θ/(θ^4+4)", "atan(θ^2/2)/4"],
    ["u/(u^4+4)", "atan(u^2/2)/4"],
    ["2*x*cos(x^2)^2", "x^2/2+sin(2*x^2)/4"],
    ["2*x*sqrt(4-x^4)", "(x^2*sqrt(4-x^4)+4*asin(x^2/2))/2"],
    ["x/(x^4-2)", "log(abs((x^2-sqrt(2))/(x^2+sqrt(2))))/(4*sqrt(2))"],
  ])("transforms and differentiates %s", (expression, expected) => {
    expectVerified(expression, expected, 0);
  });

  it("shows u, its differential, the theta integral and both back substitutions", () => {
    const r = expectVerified("x/(x^4+4)", "atan(x^2/2)/4", 0);
    expect(r.method).toContain(
      "substitution + quadratic decomposition + trigonometric substitution"
    );
    const steps = r.stepsLatex.join("\n");
    expect(steps).toMatch(/u=.*x.*\^\{2\}/);
    expect(steps).toMatch(/du=2.*x.*dx/);
    expect(steps).toContain("u=2\\tan\\theta");
    expect(steps).toContain("du=2\\sec^2\\theta\\,d\\theta");
    expect(steps).toContain("\\frac{1}{4}\\int 1\\,d\\theta");
    expect(steps).toContain("\\theta=\\tan^{-1}\\left(\\frac{u}{2}\\right)");
    expect(steps).toMatch(/Substitute back:.*u=.*x/);
    expect(steps).not.toMatch(/u=\s*u\s*,/);
    expect(steps).not.toMatch(/u=.*0.*du=du/);
  });

  it("does not shadow the original u or theta variable", () => {
    const u = expectVerified("u/(u^4+4)", "atan(u^2/2)/4", 0);
    expect(u.stepsLatex[0]).toMatch(/^v=/);
    const theta = expectVerified("θ/(θ^4+4)", "atan(θ^2/2)/4", 0);
    expect(theta.stepsLatex.join("\n")).toContain("\\tan\\phi");
    expect(theta.stepsLatex.join("\n")).toContain("\\phi=\\tan^{-1}");
  });
});

describe("Composed methods share the whole derivation's parts budget", () => {
  it.each([
    ["sqrt(x^2+4)", "x*sqrt(x^2+4)/2+2*log(abs(x+sqrt(x^2+4)))", 1],
    ["sec(x)^3", "(sec(x)*tan(x)+log(abs(sec(x)+tan(x))))/2", 1],
    ["2*x*sqrt(x^4+4)", "x^2*sqrt(x^4+4)/2+2*log(abs(x^2+sqrt(x^4+4)))", 1],
    ["2*x^3*exp(x^2)", "exp(x^2)*(x^2-1)", 1],
    ["2*x^5*exp(x^2)", "exp(x^2)*(x^4-2*x^2+2)", 2],
    ["2*x*exp(x^2)*sin(x^2)", "exp(x^2)*(sin(x^2)-cos(x^2))/2", 2],
    ["sin(ln(x))", "x*(sin(log(x))-cos(log(x)))/2", 2],
    ["cos(sqrt(x))", "2*(sqrt(x)*sin(sqrt(x))+cos(sqrt(x)))", 1],
    [
      "2*x*sqrt(x^4+4)+x*exp(x)",
      "x^2*sqrt(x^4+4)/2+2*log(abs(x^2+sqrt(x^4+4)))+exp(x)*(x-1)",
      2,
    ],
    ["x/(x^4+4)+ln(x)", "atan(x^2/2)/4+x*log(x)-x", 1],
    [
      "x*sin(x)+x*cos(x)+x*exp(x)",
      "sin(x)-x*cos(x)+x*sin(x)+cos(x)+exp(x)*(x-1)",
      1,
    ],
  ] as const)("keeps actual cost for %s", (expression, expected, cost) => {
    expectVerified(expression, expected, cost);
  });

  it("makes the necessary secant by-parts step explicit, not an extra optional step", () => {
    const r = I("2*x*sqrt(x^4+4)");
    expect(r.partsCost).toBe(1);
    expect(r.method).toMatch(
      /substitution.*trigonometric substitution.*integration by parts/
    );
    const steps = r.stepsLatex.join("\n");
    expect(steps).toContain("\\sec^3");
    expect(steps).toMatch(/p=.*sec.*dq=.*sec/);
    expect(steps).toContain("\\int p\\,dq=pq-\\int q\\,dp");
    expect(steps).toContain("2I=");
    expect(steps).toContain("\\tan^{-1}");
    expect(steps).toContain("\\text{Substitute back: }u=");
    const noParts = I("2*x*sqrt(4-x^4)");
    expect(noParts.partsCost).toBe(0);
    expect(noParts.method).not.toContain("parts");
  });

  it.each([
    "2*x^7*exp(x^2)",
    "2*x*sqrt(x^4+4)+x^2*exp(x)",
    "x^2*exp(x)+2*x*sqrt(x^4+4)",
    "cos(sqrt(x))+x*exp(x)+ln(x)",
    "x*exp(x)+2*x*exp(x^2)*sin(x^2)",
    "2*x*exp(x^2)*sin(x^2)+x*exp(x)",
    "2*x*(x^2*exp(x^2)+exp(x^2)*sin(x^2))",
    "sqrt(x^2+4)+sqrt(x^2+9)+sqrt(x^2+16)",
  ])("refuses cumulative cost above two for %s", expression => {
    const r = I(expression);
    expect(r.status).toBe("unsupported");
    expect(r.antiderivative).toBeUndefined();
    expect(r.hintZh).toContain("兩次");
  });
});

describe("Exact definite compositions and interval safeguards", () => {
  it.each([
    ["x/(x^4+4)", "0", "sqrt(2)", "pi/16", 0],
    ["x/(x^4+4)", "sqrt(2)", "0", "-pi/16", 0],
    ["x/(x^4+4)", "-sqrt(2)", "sqrt(2)", "0", 0],
    ["3*t^2/(t^6+9)", "0", "3^(1/3)", "pi/12", 0],
    ["2*x/((x^2+1)^2+4)", "0", "1", "pi/8-atan(1/2)/2", 0],
    ["2*x^3*exp(x^2)", "0", "1", "1", 1],
    ["2*x^5*exp(x^2)", "0", "1", "e-2", 2],
    ["2*x*sqrt(x^4+4)", "0", "1", "sqrt(5)/2+2*log((1+sqrt(5))/2)", 1],
    ["x*abs(x)", "-3", "3", "0", 0],
    ["abs(x)", "-2", "2", "4", 0],
  ] as const)(
    "evaluates %s exactly",
    (expression, lower, upper, expected, cost) => {
      const r = D(expression, lower, upper);
      expect(r.status, r.hintEn).toBe("ok");
      expect(r.partsCost).toBe(cost);
      if (r.indefinite) expect(r.indefinite.partsCost).toBe(cost);
      expect(r.valueLatex).not.toMatch(/\d\.\d{5}/);
      expect(r.valueLatex).not.toContain("+C");
      expect(
        Math.abs(
          Number(parse(r.valueExpr!).evaluate()) -
            Number(parse(expected).evaluate())
        )
      ).toBeLessThan(1e-9);
      if (["pi/16", "-pi/16", "pi/12", "0", "1", "e-2", "4"].includes(expected))
        expect(exactSimplify(`(${r.valueExpr})-(${expected})`)).toBe("0");
      for (const line of [
        r.valueLatex!,
        ...r.stepsLatex,
        ...(r.indefinite?.stepsLatex ?? []),
      ])
        expect(() =>
          katex.renderToString(line, {
            throwOnError: true,
            strict: false,
            trust: false,
          })
        ).not.toThrow();
    }
  );

  it.each([
    ["x/(x^4-2)", "0", "2"],
    ["x/(x^4-2)", "2", "0"],
    ["exp(x)/(exp(x)^2-3)", "0", "2"],
    ["sin(x)/(cos(x)^2-1/2)", "0", "pi/2"],
    ["2*x/sqrt(4-x^4)", "0", "sqrt(2)"],
    ["2*x*sqrt(4-x^4)", "0", "2"],
    ["2*x/(x^2-1)", "0", "2"],
    ["x*exp(x)+2*x*exp(x^2)*sin(x^2)", "0", "1"],
  ])(
    "does not integrate through a pole, invalid domain or excess budget for %s",
    (expression, lower, upper) => {
      expect(D(expression, lower, upper).status).toBe("unsupported");
    }
  );

  it("allows certified regular high-degree denominators", () => {
    const r = D("x/(x^4-2)", "2", "3");
    expect(r.status, r.hintEn).toBe("ok");
    expect(r.partsCost).toBe(0);
  });

  it.each([
    "1/(x^4+4)",
    "sin(x^2)",
    "exp(-x^2)",
    "asinh(x)",
    "sinh(x)",
    "x/(x^5+4)",
  ])("still declines unimplemented or non-DSE forms %s", expression => {
    expect(I(expression).status).toBe("unsupported");
  });
});
