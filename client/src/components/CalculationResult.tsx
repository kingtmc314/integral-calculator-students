import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { isDefinite, type Calculation } from "@/lib/reasoning";
import KaTeXRenderer from "./KaTeXRenderer";
import ReasoningPlayer from "./ReasoningPlayer";
export default function CalculationResult({
  result,
}: {
  result: Calculation | null;
}) {
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);
  if (!result)
    return (
      <section className="empty-result">
        <div className="empty-illustration" aria-hidden="true">
          <span>∫</span>
          <div />
          <i>?</i>
        </div>
        <span className="eyebrow">YOUR NEXT DISCOVERY</span>
        <h2>
          {lang === "zh" ? "由一道題目開始。" : "It starts with a question."}
        </h2>
        <p>
          {lang === "zh"
            ? "輸入函數，或選一條例題。精確答案與逐步推導會在這裏出現。"
            : "Enter a function or choose an example. Your exact answer and step-by-step thinking will appear here."}
        </p>
        <div className="empty-tags">
          <span>
            <CheckCircle2 size={13} />
            {lang === "zh" ? "精確答案" : "Exact answers"}
          </span>
          <span>
            <Sparkles size={13} />
            {lang === "zh" ? "動畫推導" : "Animated steps"}
          </span>
        </div>
      </section>
    );
  if (result.status !== "ok")
    return (
      <section className="error-result" role="status">
        <TriangleAlert size={25} />
        <span className="eyebrow">LET’S CHECK THIS</span>
        <h2>
          {result.status === "invalid"
            ? lang === "zh"
              ? "先檢查輸入。"
              : "Check the input first."
            : lang === "zh"
              ? "這題需要再檢查。"
              : "This needs a closer look."}
        </h2>
        <p>{lang === "zh" ? result.hintZh : result.hintEn}</p>
        <Link href="/formulae" className="text-link">
          {lang === "zh"
            ? "查看輸入規則與課程範圍"
            : "Check notation and curriculum scope"}
          <ArrowRight size={15} />
        </Link>
      </section>
    );
  const definite = isDefinite(result);
  const answer = definite ? result.valueLatex : result.answerLatex;
  const partsCost =
    result.partsCost ?? (definite ? result.indefinite?.partsCost : undefined);
  const equation = definite
    ? `\\int_{${result.lowerLatex}}^{${result.upperLatex}}${result.integrandLatex}\\,d${result.variableLatex ?? "x"}=${answer}`
    : `\\int ${result.integrandLatex}\\,d${result.variableLatex ?? "x"}=${answer}`;
  return (
    <div className="result-stack">
      <section className="answer-card">
        <div className="flex items-center justify-between gap-3">
          <span className="answer-label">
            <CheckCircle2 size={15} />
            {lang === "zh" ? "精確答案" : "EXACT ANSWER"}
          </span>
          <button
            className="copy-button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(equation);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              } catch {
                setCopied(false);
              }
            }}
            aria-label={lang === "zh" ? "複製 LaTeX 答案" : "Copy LaTeX answer"}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? (lang === "zh" ? "已複製" : "Copied") : "LaTeX"}
          </button>
        </div>
        <div className="answer-formula">
          <KaTeXRenderer latex={answer ?? ""} displayMode />
        </div>
        <div className="answer-method">
          <span>{lang === "zh" ? "方法" : "METHOD"}</span>
          <p>{lang === "zh" ? result.methodZh : result.method}</p>
        </div>
        {typeof partsCost === "number" && (
          <p
            className="method-budget"
            title={
              lang === "zh"
                ? "可組合方法；代換及拆項不重設分部積分的累計次數。"
                : "Methods may be combined; substitutions and splitting terms do not reset the by-parts count."
            }
          >
            {lang === "zh"
              ? `本推導分部積分：${partsCost} / 2 次（整題累計）`
              : `Integration by parts: ${partsCost} / 2 uses (whole derivation)`}
          </p>
        )}
      </section>
      <ReasoningPlayer
        key={`${result.normalized}-${definite ? result.lower + result.upper : ""}`}
        result={result}
      />
    </div>
  );
}
