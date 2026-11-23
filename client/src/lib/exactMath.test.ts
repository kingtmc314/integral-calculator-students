import { describe, expect, it } from "vitest";
import { derivative, parse, type MathNode } from "mathjs";
import { exactSimplify } from "./exactMath";
import { calculateIntegral } from "./integralEngine";

const unparenthesize = (node: MathNode): MathNode => {
  while (node.type === "ParenthesisNode")
    node = (node as unknown as { content: MathNode }).content;
  return node;
};

const expectExact = (actual: string, expected: string) => {
  expect(actual).not.toMatch(/\d+\.\d/);
  expect(actual).not.toContain("exactconstant");
  expect(Number(parse(actual).evaluate())).toBeCloseTo(
    Number(parse(expected).evaluate()),
    12
  );
};

describe("exactSimplify: preserve the complete power base", () => {
  it.each([
    "(2*pi)^2",
    "(1+pi)^2",
    "(1+2*pi)^3",
    "(2*pi)^(-2)",
    "(1+pi)^(1/2)",
  ])("preserves the value and symbolic base of %s", expression => {
    const result = exactSimplify(expression);
    expectExact(result, expression);
    const root = unparenthesize(parse(result));
    expect(root.type).toBe("OperatorNode");
    expect((root as unknown as { op: string }).op).toBe("^");
    expect(result).toContain("pi");
  });
});

describe("exactSimplify: detect constant functions after argument cancellation", () => {
  it("keeps cos((x+1)-(x-1)) as cos(2), not a decimal", () => {
    const result = exactSimplify("cos((x+1)-(x-1))");
    expect(unparenthesize(parse(result)).toString()).toBe("cos(2)");
    expectExact(result, "cos(2)");
  });

  it.each([
    ["sqrt((x+2)-x)", "sqrt(2)", "sqrt"],
    ["asin((x+1/3)-x)", "asin(1/3)", "asin"],
    ["acos((x+1/3)-x)", "acos(1/3)", "acos"],
    ["atan((x+2)-x)", "atan(2)", "atan"],
    ["abs((x+1-pi)-x)", "abs(1-pi)", "abs"],
    ["log((x+2)-x)", "log(2)", "log"],
    ["sin(cos((x+1)-(x-1)))", "sin(cos(2))", "cos"],
    ["sqrt(cos((x+1)-(x-1))+2)", "sqrt(cos(2)+2)", "cos"],
  ])("safely protects %s", (expression, expected, symbol) => {
    const result = exactSimplify(expression);
    expectExact(result, expected);
    expect(result).toContain(`${symbol}(`);
    expect(result).not.toMatch(/\bx\b/);
  });

  it("does not treat a genuinely variable argument as a constant", () => {
    expect(exactSimplify("cos(x+1)")).toBe("cos(x + 1)");
  });
});

describe("exactSimplify: symbolic constant functions and radicals", () => {
  it.each([
    ["sqrt(2)", "sqrt(2)", "sqrt"],
    ["sqrt(8)", "2*sqrt(2)", "sqrt"],
    ["sqrt(1/2)", "sqrt(2)/2", "sqrt"],
    ["sqrt(1+pi)", "sqrt(1+pi)", "sqrt"],
    ["sqrt(sin(2)+2)", "sqrt(sin(2)+2)", "sin"],
    ["asin(1/3)", "asin(1/3)", "asin"],
    ["acos(1/3)", "acos(1/3)", "acos"],
    ["atan(2)", "atan(2)", "atan"],
    ["abs(1-pi)", "abs(1-pi)", "abs"],
    ["abs(sin(2))", "abs(sin(2))", "abs"],
    ["cos(2)", "cos(2)", "cos"],
    ["sin(2)", "sin(2)", "sin"],
    ["tan(2)", "tan(2)", "tan"],
    ["log(2)", "log(2)", "log"],
  ])("keeps %s exact", (expression, expected, symbol) => {
    const result = exactSimplify(expression);
    expectExact(result, expected);
    expect(result).toContain(`${symbol}(`);
  });

  it("keeps exponential constants symbolic", () => {
    const result = exactSimplify("exp(2)");
    expectExact(result, "e^2");
    expect(result).toMatch(/\be\b/);
  });

  it.each([
    ["sqrt(9)", "3"],
    ["sqrt(4/9)", "2/3"],
    ["sqrt(2)^2", "2"],
    ["abs(-3/2)", "3/2"],
    ["abs(pi)", "pi"],
  ])("still simplifies exact elementary values: %s", (expression, expected) => {
    const result = exactSimplify(expression);
    expectExact(result, expected);
    expect(result).not.toMatch(/\b(?:sqrt|abs)\(/);
  });
});

describe("exactSimplify: standard angles remain exact", () => {
  it.each([
    ["sin(pi/6)", "1/2"],
    ["cos(pi/3)", "1/2"],
    ["sin(pi/4)", "sqrt(2)/2"],
    ["cos(pi/6)", "sqrt(3)/2"],
    ["tan(pi/3)", "sqrt(3)"],
    ["sin(-pi/6)", "-1/2"],
    ["cos(pi)", "-1"],
    ["asin(1/2)", "pi/6"],
    ["acos(1/2)", "pi/3"],
    ["atan(1)", "pi/4"],
    ["asin(sqrt(2)/2)", "pi/4"],
    ["sin((x+pi/6)-x)", "1/2"],
    ["cos((x+pi/3)-x)", "1/2"],
  ])("evaluates %s exactly", (expression, expected) => {
    const result = exactSimplify(expression);
    expectExact(result, expected);
    expect(result).not.toMatch(/\b(?:sin|cos|tan|asin|acos|atan)\(/);
  });
});

describe("exactMath integration regressions", () => {
  it.each(["(2*pi)^2", "(1+pi)^2"])(
    "integrates the entire constant power %s without changing its value",
    expression => {
      const result = calculateIntegral(expression);
      expect(result.status, result.hintEn).toBe("ok");
      expect(result.antiderivative).toBeTruthy();
      expect(result.antiderivative).toContain("pi");
      expect(result.antiderivative).not.toMatch(/\d+\.\d/);
      const derived = derivative(result.antiderivative!, result.variable!);
      const expected = Number(parse(expression).evaluate());
      for (const x of [-1, 0, 1, 2])
        expect(Number(derived.evaluate({ [result.variable!]: x }))).toBeCloseTo(
          expected,
          10
        );
    }
  );

  it("preserves cos(2) in the product-to-sum antiderivative", () => {
    const expression = "sin(x+1)*sin(x-1)";
    const result = calculateIntegral(expression);
    expect(result.status, result.hintEn).toBe("ok");
    expect(result.antiderivative).toMatch(/cos\(2\)/);
    expect(result.antiderivative).not.toMatch(/\d+\.\d/);
    const derived = derivative(result.antiderivative!, result.variable!);
    const integrand = parse(expression);
    for (const x of [-2, -0.5, 0, 0.5, 1, 2]) {
      const scope = { [result.variable!]: x };
      expect(Number(derived.evaluate(scope))).toBeCloseTo(
        Number(integrand.evaluate(scope)),
        10
      );
    }
  });
});
