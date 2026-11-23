import { describe, expect, it } from "vitest";
import katex from "katex";
import {
  calculateIntegral as I,
  calculateDefiniteIntegral as D,
  type IntegralResult,
} from "./integralEngine";
import { isDefinite, reasoningScenes, type Scene } from "./reasoning";

const prefix = "\\boxed{\\color{#2f6d3e}{";
function assertScene(scene: Scene) {
  for (const value of [
    scene.titleZh,
    scene.titleEn,
    scene.thoughtZh,
    scene.thoughtEn,
    scene.pitfallZh,
    scene.pitfallEn,
    scene.focusLabelZh,
    scene.focusLabelEn,
    scene.focusLatex,
  ])
    expect(value.trim()).not.toBe("");
  expect(scene.detailsZh.length).toBeGreaterThanOrEqual(2);
  expect(scene.detailsZh.length).toBe(scene.detailsEn.length);
  for (const detail of [...scene.detailsZh, ...scene.detailsEn])
    expect(detail.trim()).not.toBe("");
  for (const latex of [scene.focusLatex, scene.highlightedLatex]) {
    expect(
      () =>
        katex.renderToString(latex, {
          throwOnError: true,
          trust: false,
          strict: false,
        }),
      latex
    ).not.toThrow();
  }
  expect(scene.highlightedLatex).not.toMatch(
    /\\(?:htmlClass|htmlStyle|htmlId|def|newcommand)/
  );
  // Removing just the inserted wrapper must recover the exact original string.
  for (const text of [
    scene.thoughtZh,
    scene.thoughtEn,
    ...scene.detailsZh,
    ...scene.detailsEn,
  ]) {
    for (const match of text.matchAll(/\$([^$]+)\$/g)) {
      expect(
        () =>
          katex.renderToString(match[1], {
            throwOnError: true,
            trust: false,
            strict: false,
          }),
        match[1]
      ).not.toThrow();
    }
  }
  const boxed = `${prefix}${scene.focusLatex}}}`;
  expect(scene.highlightedLatex.replace(boxed, scene.focusLatex)).toBe(
    scene.latex
  );
}

function fixture(stepsLatex: string[]): IntegralResult {
  return {
    input: "x",
    normalized: "x",
    status: "ok",
    integrandLatex: "x",
    answerLatex: "\\frac{x^2}{2}+C",
    antiderivative: "x^2/2",
    method: "substitution",
    methodZh: "代換",
    stepsLatex,
    variable: "x",
    variableLatex: "x",
  };
}

describe("bilingual reasoning metadata from actual engine steps", () => {
  it.each([
    "x^2+3*x-1",
    "(3*x+2)^5",
    "2*x/(x^2+1)",
    "sin(x)^2",
    "x^2*ln(x)",
    "exp(2*x)*sin(3*x)",
    "sin(ln(x))",
    "cos(sqrt(x))",
    "sqrt(3-x^2)",
    "sqrt(4+x^2)",
    "x/(x^4+4)",
    "θ*sin(θ)",
  ])("renders all highlights securely: %s", expression => {
    const result = I(expression);
    expect(result.status, result.hintEn).toBe("ok");
    expect(isDefinite(result)).toBe(false);
    const snapshot = JSON.stringify(result);
    const scenes = reasoningScenes(result);
    scenes.forEach(assertScene);
    expect(JSON.stringify(result)).toBe(snapshot);
    expect(scenes.at(-1)?.latex).toContain(result.answerLatex);
  });

  it.each([
    ["cos(x)", "0", "pi/3"],
    ["ln(x)", "1", "e"],
    ["θ*sin(θ)", "0", "pi"],
    ["sqrt(3-x^2)", "0", "sqrt(3)"],
    ["x^2", "2", "0"],
    ["x^2", "2", "2"],
    ["abs(x)", "-2", "2"],
    ["x*abs(x)", "-3", "3"],
  ])("renders F/bounds and signed values: %s [%s,%s]", (expression, a, b) => {
    const result = D(expression, a, b);
    expect(result.status, result.hintEn).toBe("ok");
    expect(isDefinite(result)).toBe(true);
    const scenes = reasoningScenes(result);
    scenes.forEach(assertScene);
    expect(scenes[0].detailsZh.join(" ")).toContain(result.lowerLatex);
    expect(scenes[0].detailsEn.join(" ")).toContain(result.upperLatex);
    expect(scenes.at(-1)?.latex).toContain(result.valueLatex);
    expect(scenes.at(-1)?.latex).not.toContain("+C");
  });

  it("explains u/dv/du/v without calling the selected u an unknown", () => {
    const scenes = reasoningScenes(I("x^2*ln(x)"));
    const setup = scenes.find(s => s.latex.startsWith("u="))!;
    expect(setup.thoughtZh).toContain("選定要微分的函數");
    expect(setup.detailsEn.join(" ")).toContain("not automatically an unknown");
    expect(setup.detailsEn.join(" ")).toContain("du is the differential of u");
    expect(setup.detailsEn.join(" ")).toContain(
      "v is one antiderivative of dv"
    );
    expect(setup.focusLatex).toBe("\\ln x");
    const differential = scenes.find(s => s.latex.startsWith("du="))!;
    expect(differential.focusLatex).toBe("\\frac{1}{x}\\,dx");
  });

  it("distinguishes substitution, identity angle, and original theta", () => {
    const substitution = reasoningScenes(I("2*x/(x^2+1)")).find(s =>
      s.latex.startsWith("u=")
    )!;
    expect(substitution.detailsZh.join(" ")).toContain("新變數");
    expect(substitution.detailsEn.join(" ")).toContain("Transform dx");
    const identity = reasoningScenes(I("sin(x)^2")).find(s =>
      s.latex.startsWith("\\sin^2")
    )!;
    expect(identity.thoughtZh).toContain("沒有改變原來函數");
    expect(identity.detailsEn.join(" ")).toContain(
      "does not by itself mean a variable substitution"
    );
    const theta = reasoningScenes(I("θ*sin(θ)"));
    expect(
      theta.every(s => s.detailsZh[0].startsWith("θ 是原來的積分變數"))
    ).toBe(true);
    theta.forEach(assertScene);
  });

  it("defines F separately from actual endpoint substitution", () => {
    const result = D("cos(x)", "0", "pi/3");
    const scenes = reasoningScenes(result);
    const definition = scenes.find(s => s.latex.startsWith("F(x)="))!;
    expect(definition.stage).toBe(2);
    expect(definition.thoughtEn).toContain("not another unknown");
    const bounds = scenes.find(s => s.latex.includes("F\\left"))!;
    expect(bounds.stage).toBe(3);
    expect(bounds.thoughtZh).toContain(
      `$F\\left(${result.upperLatex}\\right)-F\\left(${result.lowerLatex}\\right)$`
    );
    expect(bounds.detailsEn.join(" ")).toContain(`x=${result.upperLatex}`);
    expect(bounds.detailsEn.join(" ")).toContain(`x=${result.lowerLatex}`);
  });

  it("uses half-interval F endpoints after symmetry, but retains original bounds", () => {
    const result = D("abs(x)", "-2", "2");
    const scene = reasoningScenes(result).find(s =>
      s.latex.includes("F\\left")
    )!;
    expect(scene.thoughtEn).toContain("$F\\left(2\\right)-F\\left(0\\right)$");
    expect(scene.detailsEn.join(" ")).toContain("x=-2");
    expect(scene.detailsEn.join(" ")).toContain("lower endpoint is $x=0$");
  });

  it("explains a shared budget for substitution followed by two by-parts uses", () => {
    const result = I("sin(ln(x))");
    expect(result.partsCost).toBe(2);
    const scenes = reasoningScenes(result);
    expect(scenes[0].thoughtEn).toContain("substitution does not reset");
    expect(scenes[0].detailsZh.join(" ")).toContain("2 / 2");
    expect(scenes.at(-1)!.detailsEn.join(" ")).toContain(
      "whole-question total"
    );
    scenes.forEach(assertScene);
  });

  it("distinguishes an intermediate substitution variable from the introduced angle", () => {
    const result = fixture([
      "w=x^2,\\quad dw=2x\\,dx",
      "w=2\\tan\\theta,\\quad dw=2\\sec^2\\theta\\,d\\theta",
    ]);
    const scenes = reasoningScenes(result);
    expect(scenes[1].detailsEn.join(" ")).toContain(
      "w is the new substitution variable"
    );
    expect(scenes[2].detailsEn.join(" ")).toContain("earlier substitution");
    expect(scenes[2].detailsZh.join(" ")).toContain("前一次代換");
    scenes.forEach(assertScene);
  });

  it("explains p/dq/dp/q after substitution without counting rearrangement as another use", () => {
    const result = I("2*x*sqrt(x^4+4)");
    expect(result.status).toBe("ok");
    expect(result.partsCost).toBe(1);
    const scenes = reasoningScenes(result);
    const setup = scenes.find(s => s.latex.startsWith("p="))!;
    expect(setup.titleEn).toContain("four roles");
    expect(setup.thoughtEn).toContain("p is the function chosen");
    expect(setup.detailsEn.join(" ")).toContain(
      "q is one antiderivative of dq"
    );
    expect(setup.detailsZh.join(" ")).toContain("避免與前一次代換");
    const rearrange = scenes.find(s => s.latex.startsWith("2I="))!;
    expect(rearrange.thoughtEn).toContain("not another integration by parts");
    scenes.forEach(assertScene);
  });

  it("does not mistake a substitution named v for a by-parts antiderivative", () => {
    const scenes = reasoningScenes(fixture(["v=x^2,\\quad dv=2x\\,dx"]));
    expect(scenes[1].titleEn).toContain("new variable");
    expect(scenes[1].detailsEn.join(" ")).toContain(
      "v is the new substitution variable"
    );
    expect(scenes[1].detailsEn.join(" ")).not.toContain(
      "antiderivative v obtained"
    );
    scenes.forEach(assertScene);
  });

  it.each(["I", "J"])("names %s before any by-parts rearrangement", name => {
    const result = fixture([
      `${name}=\\int\\sin^2x\\,dx`,
      `2${name}=x-\\sin x\\cos x`,
    ]);
    result.method = "integration by parts";
    const scenes = reasoningScenes(result);
    expect(scenes[1].stage).toBe(1);
    expect(scenes[1].titleEn).toContain("Name the integral");
    expect(scenes[1].detailsEn.join(" ")).toContain(
      "has not yet performed integration by parts"
    );
    expect(scenes[1].thoughtZh).toContain(`${name} 是`);
    expect(scenes[2].stage).toBe(2);
    expect(scenes[2].thoughtEn).toContain("not another integration by parts");
    scenes.forEach(assertScene);
  });
});

describe("balanced focus extraction and duplicate suppression", () => {
  it.each([
    [
      "u=\\frac{\\sin\\left(x^2+1\\right)}{\\sqrt{1+x^2}},\\quad du=dx",
      "\\frac{\\sin\\left(x^2+1\\right)}{\\sqrt{1+x^2}}",
    ],
    [
      "u=\\left\\{\\frac{x}{2}\\right\\},\\quad du=dx",
      "\\left\\{\\frac{x}{2}\\right\\}",
    ],
    [
      "du=\\frac{1}{\\left(x+1\\right)^2}\\,dx,\\quad v=x",
      "\\frac{1}{\\left(x+1\\right)^2}\\,dx",
    ],
    ["dx=x\\,du=e^u\\,du", "e^u\\,du"],
    [
      "y=\\left(\\frac{1}{\\sqrt{1+x^2}}\\right)",
      "\\left(\\frac{1}{\\sqrt{1+x^2}}\\right)",
    ],
    ["\\int x\\,dx", "\\int x\\,dx"],
    [
      "\\begin{aligned}x&=1\\\\y&=2\\end{aligned}",
      "\\begin{aligned}x&=1\\\\y&=2\\end{aligned}",
    ],
  ])("selects complete fragments: %s", (line, expected) => {
    const scene = reasoningScenes(fixture([line])).find(s => s.latex === line)!;
    expect(scene.focusLatex).toBe(expected);
    assertScene(scene);
  });

  it("does not slice uncertain unbalanced input", () => {
    const line = "u=\\frac{x}{1+x";
    const scene = reasoningScenes(fixture([line])).find(s => s.latex === line)!;
    expect(scene.focusLatex).toBe(line);
    expect(scene.highlightedLatex).toBe(`${prefix}${line}}}`);
    // An invalid engine line cannot be repaired by metadata; no math is invented.
  });

  it("removes repeated complete and consecutive steps without mutating results", () => {
    const result = D("ln(x)", "1", "e");
    const originals = [...result.indefinite!.stepsLatex];
    result.stepsLatex = [...originals, originals[0], ...result.stepsLatex];
    const snapshot = JSON.stringify(result);
    const scenes = reasoningScenes(result);
    const lines = scenes.slice(1, -1).map(s => s.latex);
    expect(new Set(lines).size).toBe(lines.length);
    const positions = originals.map(line => lines.indexOf(line));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(JSON.stringify(result)).toBe(snapshot);
    scenes.forEach(assertScene);
  });

  it("retains the calculation and the distinct final verification scene", () => {
    const result = fixture([]);
    const final = `\\int x\\,dx=${result.answerLatex}`;
    result.stepsLatex = [final, "u=x,\\quad du=dx", final];
    const scenes = reasoningScenes(result);
    expect(scenes.slice(1, -1).filter(s => s.latex === final)).toHaveLength(1);
    expect(scenes.filter(s => s.latex === final)).toHaveLength(2);
    expect(scenes.at(-1)?.latex).toBe(final);
    expect(scenes.at(-1)?.detailsEn.join(" ")).toContain("any constant");
  });

  it("keeps an actual formula step for a single-step cosine integral", () => {
    const result = I("cos(3*x)");
    const scenes = reasoningScenes(result);
    expect(scenes.length).toBeGreaterThan(2);
    expect(scenes[1].latex).toBe(result.stepsLatex[0]);
    expect(scenes[1].titleEn).toBe("Find the antiderivative of this term");
    expect(scenes.at(-1)?.titleEn).toBe("Finish: add C and differentiate");
    scenes.forEach(assertScene);
  });
});
