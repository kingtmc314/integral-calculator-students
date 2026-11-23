import { describe, expect, it } from "vitest";
import { derivative, parse } from "mathjs";
import katex from "katex";
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
        katex.renderToString(line, { throwOnError: true, strict: false })
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
    expect(
      Math.abs(
        Number(parse(r.valueExpr!).evaluate()) -
          Number(parse(expected).evaluate())
      )
    ).toBeLessThan(1e-8);
    expect(() =>
      katex.renderToString(r.valueLatex!, { throwOnError: true })
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
