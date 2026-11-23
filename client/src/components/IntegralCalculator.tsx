import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { parse } from "mathjs";
import { useLang } from "@/contexts/LangContext";
import {
  calculateDefiniteIntegral,
  calculateIntegral,
  integralExamples,
  latexOfExpression,
} from "@/lib/integralEngine";
import type { Calculation } from "@/lib/reasoning";
import StudioLayout, { PageHeading, ScopeNote } from "./StudioLayout";
import KaTeXRenderer from "./KaTeXRenderer";
import CalculationResult from "./CalculationResult";
export function previewIntegral(
  expression: string,
  lower?: string,
  upper?: string
) {
  let variable = "x";
  try {
    const symbols = new Set<string>();
    parse(expression || "x").traverse((n: any) => {
      if (
        n.type === "SymbolNode" &&
        ![
          "pi",
          "e",
          "sin",
          "cos",
          "tan",
          "sec",
          "csc",
          "cot",
          "exp",
          "ln",
          "log",
          "sqrt",
          "abs",
        ].includes(n.name)
      )
        symbols.add(n.name);
    });
    variable = Array.from(symbols)[0] ?? "x";
  } catch {}
  return `\\int${lower && upper ? `_{${latexOfExpression(lower)}}^{${latexOfExpression(upper)}}` : ""} ${expression.trim() ? latexOfExpression(expression) : "\\square"}\\,d${latexOfExpression(variable)}`;
}
const EXAMPLES = [
  { e: "x*sin(x)", lo: "0", hi: "pi", zh: "分部積分", en: "By parts" },
  { e: "sin(x)^2", lo: "0", hi: "pi", zh: "三角平方", en: "Trig square" },
  {
    e: "1/(1+x)^2",
    lo: "0",
    hi: "1",
    zh: "冪次與代換",
    en: "Power & substitution",
  },
  { e: "2*x/(x^2+1)", lo: "0", hi: "1", zh: "對數型", en: "Logarithmic form" },
  {
    e: "1/sqrt(4-x^2)",
    lo: "0",
    hi: "1",
    zh: "三角代換",
    en: "Trig substitution",
  },
  {
    e: "exp(2*x)*sin(3*x)",
    lo: "0",
    hi: "pi",
    zh: "兩次分部積分",
    en: "Two uses of parts",
  },
];
export default function IntegralCalculator({
  definite = false,
}: {
  definite?: boolean;
}) {
  const { lang } = useLang();
  const [expression, setExpression] = useState("x*sin(x)");
  const [lower, setLower] = useState("0");
  const [upper, setUpper] = useState("pi");
  const [result, setResult] = useState<Calculation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const output = useRef<HTMLDivElement>(null);
  const preview = useMemo(
    () =>
      previewIntegral(
        expression,
        definite ? lower : undefined,
        definite ? upper : undefined
      ),
    [expression, lower, upper, definite]
  );
  useEffect(() => {
    if (!result || window.innerWidth >= 951) return;
    output.current?.scrollIntoView({
      behavior: "auto",
      block: "start",
    });
  }, [result]);
  function compute(e = expression, a = lower, b = upper) {
    setBusy(true);
    window.setTimeout(() => {
      setResult(
        definite ? calculateDefiniteIntegral(e, a, b) : calculateIntegral(e)
      );
      setBusy(false);
    }, 20);
  }
  function insert(text: string) {
    const input = field.current;
    const pos = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? pos;
    setExpression(expression.slice(0, pos) + text + expression.slice(end));
    setResult(null);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(pos + text.length, pos + text.length);
    });
  }
  return (
    <StudioLayout active={definite ? "definite" : "part1"}>
      <PageHeading
        number={definite ? "02" : "01"}
        title={definite ? "定積分" : "不定積分"}
        english={definite ? "Definite integral" : "Indefinite integral"}
        description={
          lang === "zh"
            ? definite
              ? "由原函數到精確值，一步一步看清楚。"
              : "不只得到答案，也看見每一步的理由。"
            : definite
              ? "From antiderivative to exact value. One clear step at a time."
              : "Beyond the answer. Understand why each step works."
        }
      />
      <div className="calculator-grid">
        <section className="input-card">
          <div className="card-title-row">
            <span className="eyebrow">
              01 / {lang === "zh" ? "輸入題目" : "YOUR QUESTION"}
            </span>
            <span className="input-mode">
              {lang === "zh"
                ? definite
                  ? "定積分"
                  : "不定積分"
                : definite
                  ? "Definite"
                  : "Indefinite"}
            </span>
          </div>
          <h2>
            {lang === "zh" ? "你想計算甚麼？" : "What are we integrating?"}
          </h2>
          <form
            onSubmit={e => {
              e.preventDefault();
              compute();
            }}
          >
            <label className="field-label" htmlFor="integrand">
              {lang === "zh" ? "被積函數" : "Integrand"} <span>f(x)</span>
            </label>
            <input
              id="integrand"
              ref={field}
              className="math-input"
              value={expression}
              onChange={e => {
                setExpression(e.target.value);
                setResult(null);
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. x*sin(x)"
            />
            <div className="input-tools">
              {["^", "sqrt(", "sin(", "cos(", "pi"].map(text => (
                <button key={text} type="button" onClick={() => insert(text)}>
                  {text === "sqrt("
                    ? "√"
                    : text === "pi"
                      ? "π"
                      : text.replace("(", "")}
                </button>
              ))}
              <Link href="/formulae" className="ml-auto">
                {lang === "zh" ? "輸入說明 ↗" : "Input guide ↗"}
              </Link>
            </div>
            {definite && (
              <div className="limits-grid">
                <label>
                  <span className="field-label">
                    {lang === "zh" ? "下限" : "Lower limit"} <span>a</span>
                  </span>
                  <input
                    className="math-input"
                    value={lower}
                    onChange={e => {
                      setLower(e.target.value);
                      setResult(null);
                    }}
                    autoComplete="off"
                  />
                </label>
                <label>
                  <span className="field-label">
                    {lang === "zh" ? "上限" : "Upper limit"} <span>b</span>
                  </span>
                  <input
                    className="math-input"
                    value={upper}
                    onChange={e => {
                      setUpper(e.target.value);
                      setResult(null);
                    }}
                    autoComplete="off"
                  />
                </label>
              </div>
            )}
            <div className="question-preview">
              <span className="small-caps">
                {lang === "zh"
                  ? "你的題目 · 即時預覽"
                  : "YOUR QUESTION · LIVE PREVIEW"}
              </span>
              <KaTeXRenderer latex={preview} displayMode />
            </div>
            <div className="calculate-actions">
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? <Loader2 size={17} className="animate-spin" /> : null}
                {lang === "zh" ? "計算並查看推導" : "Calculate & explore"}
                <ArrowRight size={17} />
              </button>
              <button
                type="button"
                className="reset-button"
                onClick={() => {
                  setExpression("");
                  setResult(null);
                  setLower("0");
                  setUpper("1");
                }}
                aria-label={lang === "zh" ? "清空題目" : "Clear question"}
              >
                <RotateCcw size={17} />
              </button>
            </div>
          </form>
          <ScopeNote />
          <div className="example-section">
            <div className="flex items-center justify-between">
              <span className="eyebrow">
                {lang === "zh" ? "試一條例題" : "TRY AN EXAMPLE"}
              </span>
              <span className="muted text-xs">M2</span>
            </div>
            <div className="example-grid">
              {EXAMPLES.map(ex => (
                <button
                  className="example-card"
                  key={ex.e}
                  onClick={() => {
                    setExpression(ex.e);
                    setLower(ex.lo);
                    setUpper(ex.hi);
                    compute(ex.e, ex.lo, ex.hi);
                  }}
                >
                  <span>{lang === "zh" ? ex.zh : ex.en}</span>
                  <KaTeXRenderer latex={latexOfExpression(ex.e)} />
                </button>
              ))}
            </div>
            <button
              className="more-examples"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
            >
              {lang === "zh"
                ? expanded
                  ? "收起更多例題"
                  : "更多例題"
                : expanded
                  ? "Fewer examples"
                  : "More examples"}
              <ChevronDown size={13} className={expanded ? "rotate-180" : ""} />
            </button>
            {expanded && (
              <div className="additional-examples">
                {integralExamples.map(e => (
                  <button
                    key={e}
                    onClick={() => {
                      setExpression(e);
                      compute(e);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
        <div ref={output} className="calculation-output" aria-busy={busy}>
          <CalculationResult result={result} />
        </div>
      </div>
    </StudioLayout>
  );
}
