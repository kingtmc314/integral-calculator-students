import { describe, expect, it } from "vitest";
import { derivative, parse } from "mathjs";
import katex from "katex";
import { exactSimplify } from "./exactMath";
import {
  calculateIntegral as I,
  calculateDefiniteIntegral as D,
  type IntegralResult,
  type DefiniteIntegralResult,
} from "./integralEngine";
import { getSolutionPaths, type SolutionPathComparison } from "./solutionPaths";
import { reasoningScenes } from "./reasoning";

function isDefinite(
  r: IntegralResult | DefiniteIntegralResult
): r is DefiniteIntegralResult {
  return "lowerLatex" in r;
}
function validate(comparison: SolutionPathComparison) {
  expect(comparison.paths.length).toBeGreaterThanOrEqual(1);
  expect(comparison.paths.length).toBeLessThanOrEqual(3);
  expect(new Set(comparison.paths.map(p => p.id)).size).toBe(
    comparison.paths.length
  );
  expect(comparison.noteZh).toBeTruthy();
  expect(comparison.noteEn).toBeTruthy();
  for (const path of comparison.paths) {
    expect(path.titleZh).toBeTruthy();
    expect(path.titleEn).toBeTruthy();
    expect(path.rationaleZh).toBeTruthy();
    expect(path.rationaleEn).toBeTruthy();
    expect(path.rationaleZh + path.rationaleEn).not.toContain("$");
    const r = path.result;
    if (r.status !== "ok") continue;
    expect([0, 1, 2]).toContain(r.partsCost);
    const source = isDefinite(r) ? r.indefinite : r;
    const latex = [r.integrandLatex, ...r.stepsLatex];
    if (isDefinite(r)) {
      latex.push(r.valueLatex!, r.antiderivativeLatex ?? "");
      expect(r.valueLatex).not.toContain("+C");
      if (source) expect(r.partsCost).toBe(source.partsCost);
    } else {
      latex.push(r.answerLatex!);
      expect(r.answerLatex).toMatch(/\+C$/);
    }
    if (source) latex.push(...source.stepsLatex, source.answerLatex!);
    for (const line of latex) {
      expect(line).not.toMatch(/\d\.\d{5}/);
      expect(() =>
        katex.renderToString(line, {
          throwOnError: true,
          strict: false,
          trust: false,
        })
      ).not.toThrow();
    }
    const scenes = reasoningScenes(r);
    expect(scenes.length).toBeGreaterThan(3);
    for (const scene of scenes) {
      expect(scene.thoughtZh).toBeTruthy();
      expect(scene.thoughtEn).toBeTruthy();
      expect(scene.detailsZh.length).toBeGreaterThan(0);
      expect(scene.detailsEn.length).toBeGreaterThan(0);
      for (const line of [
        scene.latex,
        scene.focusLatex,
        scene.highlightedLatex,
      ])
        expect(() =>
          katex.renderToString(line, {
            throwOnError: true,
            strict: false,
            trust: false,
          })
        ).not.toThrow();
    }
  }
}

const rationalCases = [
  "x/(x^4+4)",
  "7*x/(x^4+4)",
  "3*x^2/(x^6+9)",
  "(x+1)/((x+1)^4+4)",
  "(2*x+1)/((2*x+1)^4+4)",
  "x/(2*x^4+3)",
  "5*t^2/(t^6+7)",
  "θ/(θ^4+4)",
  "u/(u^4+4)",
  "sin(x)*cos(x)/(cos(x)^4+4)",
  "sin(x)/(cos(x)^2+4)",
  "exp(x)/(exp(x)^2+3)",
  "2*x/((x^2+1)^2+4)",
  "(3*x^2+2*x)/((x^3+x^2)^2+4)",
  "1/(x^2+4)",
  "1/(2*x^2+3)",
  "1/(x^2+x+2)",
  "(2*x+3)/(x^2+x+2)",
  "(2*y+1)/(y^2+2*y+3)",
];
const trigCases = [
  "sin(x)^2",
  "cos(x)^2",
  "sin(2*x+1)^2",
  "cos(3*y-2)^2",
  "sin(-2*t+1)^2",
  "cos(u)^2",
  "sin(v)^2",
  "sin(I)^2",
  "cos(θ)^2",
];
const semicircleCases = [
  "sqrt(4-x^2)",
  "sqrt(3-x^2)",
  "sqrt(9-t^2)",
  "sqrt(1/4-y^2)",
  "sqrt(7-φ^2)",
  "sqrt(4-θ^2)",
];

describe("Genuinely distinct core DSE M2 solution paths", () => {
  it.each([...rationalCases, ...trigCases, ...semicircleCases])(
    "preserves and compares %s",
    input => {
      const original = I(input),
        snapshot = JSON.stringify(original);
      expect(original.status, original.hintEn).toBe("ok");
      Object.freeze(original.stepsLatex);
      Object.freeze(original);
      const comparison = getSolutionPaths(original);
      expect(comparison.paths).toHaveLength(2);
      expect(comparison.paths[0].result).toBe(original);
      expect(comparison.paths[0].titleZh).toBe(original.methodZh);
      expect(comparison.paths[0].titleEn).toBe(original.method);
      expect(comparison.verification).toBe("constant-difference");
      const other = comparison.paths[1].result as IntegralResult;
      expect(other.input).toBe(original.input);
      expect(other.normalized).toBe(original.normalized);
      expect(other.variable).toBe(original.variable);
      expect(other.stepsLatex).not.toEqual(original.stepsLatex);
      expect(other.method).not.toBe(original.method);
      expect(JSON.stringify(original)).toBe(snapshot);
      validate(comparison);
    }
  );

  it("arctangent formula replaces the theta integration, not merely the title", () => {
    const comparison = getSolutionPaths(I("x/(x^4+4)"));
    const original = comparison.paths[0].result as IntegralResult;
    const other = comparison.paths[1].result as IntegralResult;
    expect(original.stepsLatex.join("\n")).toContain("\\tan\\theta");
    const steps = other.stepsLatex.join("\n");
    expect(steps).toMatch(/u=.*x.*\^\{2\}/);
    expect(steps).toMatch(/du=2.*x.*dx/);
    expect(steps).toContain("\\frac{d}{du}\\tan^{-1}");
    expect(steps).not.toMatch(/\\(?:theta|phi)|\\sec|\\int 1/);
    expect(other.partsCost).toBe(0);
  });

  it.each(["sin(x)^2", "cos(x)^2"])(
    "uses one real by-parts step and identity rearrangement for %s",
    input => {
      const other = getSolutionPaths(I(input)).paths[1]
        .result as IntegralResult;
      const steps = other.stepsLatex.join("\n");
      expect(steps).toContain("\\int u\\,dv=uv-\\int v\\,du");
      expect(steps.match(/\\int u\\,dv=uv-\\int v\\,du/g)).toHaveLength(1);
      expect(steps).toContain("2I=");
      expect(steps).not.toContain("2\\cdot x");
      expect(other.partsCost).toBe(1);
      expect(other.antiderivative).toContain("sin(x)*cos(x)");
    }
  );

  it("cosine substitution has its own branch, negative differential and constant difference", () => {
    const original = I("sqrt(4-x^2)"),
      other = getSolutionPaths(original).paths[1].result as IntegralResult;
    const steps = other.stepsLatex.join("\n");
    expect(steps).toContain("x=2\\cos\\theta");
    expect(steps).toContain("0\\leq\\theta\\leq\\pi");
    expect(steps).toContain("dx=-2\\sin\\theta");
    expect(steps).toContain("\\sin\\theta\\geq0");
    expect(steps).toContain("\\cos^{-1}");
    expect(other.antiderivative).toContain("acos(x/(2))");
    expect(other.partsCost).toBe(0);
    // Independent exact named endpoint proves the nonzero representative offset.
    const F0 = parse(other.antiderivative!)
      .transform(n =>
        n.type === "SymbolNode" && n.toString() === "x" ? parse("0") : n
      )
      .toString();
    expect(exactSimplify(exactSimplify(`(${F0})+pi`))).toBe("0");
  });

  it("does not shadow u, v, I, theta or phi", () => {
    for (const input of [
      "u/(u^4+4)",
      "cos(u)^2",
      "sin(v)^2",
      "sin(I)^2",
      "sqrt(4-θ^2)",
      "sqrt(7-φ^2)",
    ]) {
      const original = I(input),
        other = getSolutionPaths(original).paths[1].result as IntegralResult;
      expect(other.variable).toBe(original.variable);
      expect(other.stepsLatex.join("\n")).not.toContain(
        `${original.variable}=0`
      );
      if (input === "u/(u^4+4)") expect(other.stepsLatex[0]).toMatch(/^v=/);
      if (input === "sin(I)^2") expect(other.stepsLatex[0]).toMatch(/^J=/);
      if (input === "sqrt(4-θ^2)")
        expect(other.stepsLatex.join("\n")).toContain("\\cos\\phi");
    }
  });
});

const definiteCases = [
  ["x/(x^4+4)", "0", "sqrt(2)", "pi/16"],
  ["x/(x^4+4)", "sqrt(2)", "0", "-pi/16"],
  ["x/(x^4+4)", "-sqrt(2)", "sqrt(2)", "0"],
  ["x/(x^4+4)", "1", "1", "0"],
  ["1/(x^2+4)", "0", "2", "pi/8"],
  ["3*t^2/(t^6+9)", "0", "3^(1/3)", "pi/12"],
  ["sin(x)^2", "0", "pi", "pi/2"],
  ["cos(x)^2", "pi", "0", "-pi/2"],
  ["sin(x)^2", "1/3", "2/3", "1/6+sin(2/3)/4-sin(4/3)/4"],
  ["sin(2*x+1)^2", "0", "1", "1/2+(sin(2)-sin(6))/8"],
  ["sqrt(4-x^2)", "0", "2", "pi"],
  ["sqrt(4-x^2)", "2", "-2", "-2*pi"],
  ["sqrt(4-x^2)", "1", "1", "0"],
  ["sqrt(3-x^2)", "0", "sqrt(3)", "3*pi/4"],
  ["sqrt(4-θ^2)", "-1/2", "1/2", "sqrt(15)/4+4*asin(1/4)"],
] as const;
describe("Each definite path evaluates its own F at the original directed endpoints", () => {
  it.each(definiteCases)(
    "%s from %s to %s",
    (input, lower, upper, expected) => {
      const original = D(input, lower, upper),
        comparison = getSolutionPaths(original);
      expect(original.status, original.hintEn).toBe("ok");
      expect(comparison.paths).toHaveLength(2);
      expect(comparison.paths[0].result).toBe(original);
      expect(comparison.verification).toBe("same-value");
      const other = comparison.paths[1].result as DefiniteIntegralResult;
      expect(other.input).toBe(original.input);
      expect(other.variable).toBe(original.variable);
      expect(other.lower).toBe(original.lower);
      expect(other.upper).toBe(original.upper);
      expect(other.lowerLatex).toBe(original.lowerLatex);
      expect(other.upperLatex).toBe(original.upperLatex);
      expect(other.stepsLatex).not.toEqual(original.stepsLatex);
      expect(other.stepsLatex[0]).toBe(
        `F(${original.variableLatex})=${other.antiderivativeLatex}`
      );
      expect(other.stepsLatex.join("\n")).toContain(
        `F\\left(${original.upperLatex}\\right)-F\\left(${original.lowerLatex}\\right)`
      );
      expect(other.indefinite?.antiderivative).toBeTruthy();
      // Numeric check here is additional smoke only: production already symbolically
      // differentiated both primitives and certified equality of exact endpoint values.
      expect(Number(parse(other.valueExpr!).evaluate())).toBeCloseTo(
        Number(parse(expected).evaluate()),
        10
      );
      validate(comparison);
    }
  );

  it("has route-specific acos F and endpoint values, not cloned default asin steps", () => {
    const original = D("sqrt(4-x^2)", "0", "2"),
      other = getSolutionPaths(original).paths[1]
        .result as DefiniteIntegralResult;
    expect(other.antiderivativeLatex).toContain("\\cos^{-1}");
    expect(original.antiderivativeLatex).toContain("\\sin^{-1}");
    expect(other.stepsLatex.join("\n")).toContain("F\\left(0\\right)=-");
    expect(exactSimplify(`(${other.valueExpr})-pi`)).toBe("0");
    expect(other.indefinite?.partsCost).toBe(0);
  });
});

describe("Fail-closed exact verification, domain and syllabus safeguards", () => {
  it.each([
    "x*sin(x)",
    "x^2*exp(x)",
    "sqrt(x^2+4)",
    "x/(x^4-2)",
    "1/(x^2-1)",
    "1/x",
    "x^2",
    "sin(x)^4",
    "sqrt(4-(2*x-1)^2)",
    "2*x*sqrt(4-x^4)",
  ])("does not invent cosmetic alternatives for %s", input => {
    const original = I(input),
      comparison = getSolutionPaths(original);
    expect(comparison.paths).toHaveLength(1);
    expect(comparison.paths[0].result).toBe(original);
    expect(comparison.verification).toBe("single");
    expect(comparison.noteZh).toContain("目前未找到");
    expect(comparison.noteEn).toContain("does not mean");
  });

  it.each([
    "sin(x^2)",
    "exp(-x^2)",
    "x^3*exp(x)",
    "x^2*exp(x)+sqrt(x^2+4)",
    "x+y",
    "sin(",
    "",
  ])("retains actual unsupported / invalid hint for %s", input => {
    const original = I(input),
      comparison = getSolutionPaths(original);
    expect(original.status).not.toBe("ok");
    expect(comparison.paths).toHaveLength(1);
    expect(comparison.paths[0].result).toBe(original);
    expect(comparison.paths[0].result.hintZh).toBe(original.hintZh);
    expect(comparison.noteZh).toContain(original.hintZh);
    expect(comparison.noteEn).toContain(original.hintEn);
  });

  it.each([
    ["sqrt(4-x^2)", "0", "3"],
    ["sqrt(4-x^2)", "3", "0"],
    ["1/(x^2-1)", "0", "2"],
    ["x/(x^4-2)", "0", "2"],
    ["1/x", "0", "0"],
    ["sqrt(4-x^2)", "", "2"],
    ["sin(x)^2", "x", "1"],
    ["sin(x)^2", "0", "Infinity"],
  ])("never bypasses engine interval gate for %s [%s,%s]", (input, a, b) => {
    const original = D(input, a, b),
      comparison = getSolutionPaths(original);
    expect(original.status).not.toBe("ok");
    expect(comparison.paths).toHaveLength(1);
    expect(comparison.paths[0].result).toBe(original);
    expect(comparison.noteZh).toContain(original.hintZh);
  });

  it.each([
    ...rationalCases.slice(0, 3),
    "sin(x)^2",
    "cos(x)^2",
    "sqrt(4-x^2)",
  ])(
    "rejects incorrect original primitives even if many numeric samples would agree: %s",
    input => {
      const original = I(input);
      const forged = {
        ...original,
        antiderivative: `(${original.antiderivative})+${original.variable}/1000000000000000`,
      };
      expect(getSolutionPaths(forged).verification).toBe("single");
      expect(getSolutionPaths(forged).paths[0].result).toBe(forged);
    }
  );

  it("requires equal exact endpoint values and matching input/variables", () => {
    const original = D("x/(x^4+4)", "0", "sqrt(2)");
    expect(
      getSolutionPaths({
        ...original,
        valueExpr: `(${original.valueExpr})+1/1000000000000000`,
      }).verification
    ).toBe("single");
    expect(getSolutionPaths({ ...original, variable: "t" }).verification).toBe(
      "single"
    );
    expect(
      getSolutionPaths({ ...original, normalized: "x+y" }).verification
    ).toBe("single");
    expect(
      getSolutionPaths({ ...original, indefinite: undefined }).verification
    ).toBe("single");
    expect(
      getSolutionPaths({ ...I("sin(x)^2"), normalized: "sin(x)^2+y" })
        .verification
    ).toBe("single");
  });

  it("rejects any fabricated over-budget result and proof-size exhaustion", () => {
    const original = I("sin(x)^2");
    expect(getSolutionPaths({ ...original, partsCost: 3 }).verification).toBe(
      "single"
    );
    expect(
      getSolutionPaths({
        ...original,
        normalized: `sin(x)^2${"+0".repeat(900)}`,
      }).verification
    ).toBe("single");
  });

  it("does not compare an alternative to itself", () => {
    for (const input of ["sin(x)^2", "sqrt(4-x^2)", "x/(x^4+4)"]) {
      const other = getSolutionPaths(I(input)).paths[1].result;
      expect(getSolutionPaths(other).verification).toBe("single");
    }
  });
});

// Numerical derivatives are deliberately separate from production's symbolic proof.
describe("Additional derivative smoke (not a global certificate)", () => {
  it.each([
    "x/(x^4+4)",
    "1/(2*x^2+3)",
    "(2*x+3)/(x^2+x+2)",
    "sin(-2*t+1)^2",
    "cos(y)^2",
    "sqrt(4-x^2)",
  ])("differentiates the alternative for %s", input => {
    const other = getSolutionPaths(I(input)).paths[1].result as IntegralResult;
    const d = derivative(other.antiderivative!, other.variable!).compile(),
      f = parse(other.normalized).compile();
    for (const value of [-1.2, -0.5, 0, 0.3, 1.1]) {
      const scope = { [other.variable!]: value };
      expect(Number(d.evaluate(scope))).toBeCloseTo(
        Number(f.evaluate(scope)),
        10
      );
    }
  });
});
