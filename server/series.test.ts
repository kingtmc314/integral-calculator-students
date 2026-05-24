// ============================================================
// series.test.ts — Unit tests for seriesRouter
// Tests schema validation and error handling without calling LLM.
// sampleValues are computed by mathjs (not LLM), so they are
// always present and accurate.
// ============================================================
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock invokeLLM to avoid real API calls in tests
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    id: "test",
    created: Date.now(),
    model: "test",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          // Note: sampleValues intentionally omitted — mathjs computes them
          content: JSON.stringify({
            sumLatex: "\\sum_{r=1}^{n} r",
            closedFormLatex: "\\frac{n(n+1)}{2}",
            simplifiedLatex: "\\frac{n(n+1)}{2}",
            seriesType: "linear",
            isValid: true,
            errorMsg: "",
          }),
        },
        finish_reason: "stop",
      },
    ],
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("series.compute", () => {
  it("returns a valid series result with correct schema", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.compute({
      lower: "1",
      upper: "n",
      term: "r",
      lang: "en",
    });

    expect(result.isValid).toBe(true);
    expect(result.sumLatex).toBeTruthy();
    expect(result.simplifiedLatex).toBeTruthy();
    expect(result.seriesType).toBeTruthy();
    // errorMsg should be undefined (not null) when isValid is true and errorMsg is ""
    expect(result.errorMsg).toBeUndefined();
  });

  it("computes correct sample values for sum r using mathjs (not LLM)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.compute({
      lower: "1",
      upper: "n",
      term: "r",
      lang: "en",
    });

    // mathjs computes: sum r=1..1=1, r=1..2=3, r=1..3=6, r=1..4=10, r=1..5=15
    expect(result.sampleValues).toEqual([1, 3, 6, 10, 15]);
  });

  it("computes correct sample values for r^2", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.compute({
      lower: "1",
      upper: "n",
      term: "r^2",
      lang: "en",
    });

    // sum r^2: 1, 5, 14, 30, 55
    expect(result.sampleValues).toEqual([1, 5, 14, 30, 55]);
  });

  it("computes correct sample values for 2^r (geometric, r=0 to n-1)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.compute({
      lower: "0",
      upper: "n-1",
      term: "2^r",
      lang: "en",
    });

    // sum 2^r from r=0 to n-1: n=1: 1, n=2: 3, n=3: 7, n=4: 15, n=5: 31
    expect(result.sampleValues).toEqual([1, 3, 7, 15, 31]);
  });

  it("computes correct sample values for telescoping 1/(r*(r+1))", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.compute({
      lower: "1",
      upper: "n",
      term: "1/(r*(r+1))",
      lang: "en",
    });

    expect(result.sampleValues).toBeDefined();
    expect(result.sampleValues![0]).toBeCloseTo(0.5, 5);
    expect(result.sampleValues![1]).toBeCloseTo(2 / 3, 5);
    expect(result.sampleValues![4]).toBeCloseTo(5 / 6, 5);
  });

  it("computes correct sample values for partial fraction 1/(r*(r+2))", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.compute({
      lower: "1",
      upper: "n",
      term: "1/(r*(r+2))",
      lang: "en",
    });

    // Expected: [1/3, 11/24, 21/40, 17/30, 25/42]
    expect(result.sampleValues).toBeDefined();
    expect(result.sampleValues![0]).toBeCloseTo(1 / 3, 5);
    expect(result.sampleValues![1]).toBeCloseTo(11 / 24, 5);
    expect(result.sampleValues![2]).toBeCloseTo(0.525, 5);
  });

  it("returns isValid: false and errorMsg when LLM fails", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("LLM unavailable"));

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.compute({
      lower: "1",
      upper: "n",
      term: "r",
      lang: "en",
    });

    expect(result.isValid).toBe(false);
    expect(result.errorMsg).toBe("computation_failed");
    // sampleValues should still be computed by mathjs even when LLM fails
    expect(result.sampleValues).toEqual([1, 3, 6, 10, 15]);
  });
});

describe("series.evaluate", () => {
  it("computes numeric value using mathjs for sum r=1..10 (direct substitution)", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              exactLatex: "55",
              stepsLatex: ["= \\frac{10 \\cdot 11}{2} = 55"],
            }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.evaluate({
      lower: 1,
      upper: 10,
      term: "r",
      simplifiedLatex: "\\frac{n(n+1)}{2}",
      part1Lower: "1",
      part1Upper: "n",
      lang: "en",
    });

    // mathjs computes the numeric value exactly
    expect(result.decimalValue).toBe(55);
    expect(result.usedClosedForm).toBe(true);
    expect(result.method).toBe("direct_substitution");
    expect(result.stepsLatex).toBeInstanceOf(Array);
  });

  it("uses split-sum identity when lower bound differs from Part 1", async () => {
    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      id: "test",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              exactLatex: "54",
              stepsLatex: [
                "= F(10) - F(1)",
                "= 55 - 1 = 54",
              ],
            }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.evaluate({
      lower: 2,
      upper: 10,
      term: "r",
      simplifiedLatex: "\\frac{n(n+1)}{2}",
      part1Lower: "1",
      part1Upper: "n",
      lang: "en",
    });

    // sum r from 2..10 = 54 (mathjs computes exactly)
    expect(result.decimalValue).toBe(54);
    expect(result.usedClosedForm).toBe(true);
    expect(result.method).toBe("split_sum");
  });

  it("computes numeric value for r^2 without closed form", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.evaluate({
      lower: 1,
      upper: 5,
      term: "r^2",
      lang: "en",
    });

    // sum r^2 from 1..5 = 55
    expect(result.decimalValue).toBe(55);
    expect(result.usedClosedForm).toBe(false);
  });

  it("computes numeric value for 2^r (geometric)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.series.evaluate({
      lower: 0,
      upper: 4,
      term: "2^r",
      lang: "en",
    });

    // sum 2^r from r=0 to 4 = 1+2+4+8+16 = 31
    expect(result.decimalValue).toBe(31);
  });
});
