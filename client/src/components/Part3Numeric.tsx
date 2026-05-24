// ============================================================
// Part3Numeric — Numeric evaluator using closed-form result
// Uses LLM backend via tRPC for exact value computation
// Design: Dark Academic / Chalkboard
// ============================================================
import { useState, useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { SeriesResult, NumericResult, termToLatexPreview } from "@/lib/seriesTypes";
import { trpc } from "@/lib/trpc";
import KaTeXRenderer from "./KaTeXRenderer";
import MixedMathRenderer from "./MixedMathRenderer";
import { Hash, ClipboardPaste, Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  closedFormResult: SeriesResult | null;
  copiedTerm: string;
  part1Lower?: string; // Part 1 symbolic lower bound, e.g. "1"
  part1Upper?: string; // Part 1 symbolic upper bound, e.g. "n"
}

export default function Part3Numeric({ closedFormResult, copiedTerm, part1Lower, part1Upper }: Props) {
  const { t, lang } = useLang();
  const [lower, setLower] = useState("1");
  const [upper, setUpper] = useState("10");
  const [term, setTerm] = useState("");
  const [result, setResult] = useState<NumericResult | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const evaluateMutation = trpc.series.evaluate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    },
    onError: (err) => {
      console.error("Evaluate error:", err);
      toast.error(lang === "zh" ? "計算失敗，請重試。" : "Evaluation failed. Please try again.");
    },
  });

  const handlePaste = () => {
    if (copiedTerm) {
      setTerm(copiedTerm);
    }
  };

  const handleEvaluate = () => {
    const lo = parseInt(lower.trim(), 10);
    const hi = parseInt(upper.trim(), 10);
    if (!term.trim() || isNaN(lo) || isNaN(hi)) return;

    evaluateMutation.mutate({
      lower: lo,
      upper: hi,
      term: term.trim(),
      closedFormLatex: closedFormResult?.closedFormLatex,
      simplifiedLatex: closedFormResult?.simplifiedLatex,
      part1Lower: part1Lower,
      part1Upper: part1Upper,
      lang,
    });
  };

  const loading = evaluateMutation.isPending;

  const isInteger = (s: string) => /^-?\d+$/.test(s.trim());

  return (
    <section id="part3" className="py-8 sm:py-12 pb-16">
      {/* Section header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[#6B9BD2] font-mono text-sm font-bold">03</span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#6B9BD2]/40 to-transparent" />
        </div>
        <h2
          className="text-2xl sm:text-3xl font-bold text-[#E8DFC8] mb-2"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {t.part3Title}
        </h2>
        <p className="text-[#E8DFC8]/60 text-sm sm:text-base leading-relaxed max-w-2xl">
          {t.part3Desc}
        </p>
      </div>

      {/* Input card */}
      <div className="bg-[#252D3D] rounded-xl border border-white/8 p-5 sm:p-7 mb-5">
        {/* Closed-form status banner */}
        {closedFormResult?.isValid ? (
          <div className="mb-5 flex items-start gap-3 p-3 rounded-lg bg-[#7EC8A4]/10 border border-[#7EC8A4]/25">
            <Hash className="w-4 h-4 text-[#7EC8A4] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[#7EC8A4]">
              {t.usingFormula}
              <span className="ml-1 font-mono text-xs opacity-80">
                {closedFormResult.simplifiedLatex.slice(0, 40)}
                {closedFormResult.simplifiedLatex.length > 40 ? "…" : ""}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex items-start gap-3 p-3 rounded-lg bg-[#E88B5A]/10 border border-[#E88B5A]/25">
            <Hash className="w-4 h-4 text-[#E88B5A] mt-0.5 flex-shrink-0" />
            <div className="text-sm text-[#E88B5A]">{t.noFormulaWarning}</div>
          </div>
        )}

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[#E8DFC8]/80 text-xs font-semibold mb-1.5 uppercase tracking-wider">
              {t.numLower}
            </label>
            <input
              type="text"
              value={lower}
              onChange={(e) => setLower(e.target.value)}
              placeholder="1"
              className="w-full bg-[#1E2433] border border-white/15 rounded-lg px-3 py-2.5 text-[#E8DFC8] placeholder-[#E8DFC8]/25 text-sm font-mono focus:outline-none focus:border-[#D4A843]/60 focus:ring-1 focus:ring-[#D4A843]/30 transition-all duration-200"
            />
            {lower && !isInteger(lower) && (
              <p className="text-[#ff6b6b] text-xs mt-1">{lang === "zh" ? "必須為整數" : "Must be an integer"}</p>
            )}
          </div>
          <div>
            <label className="block text-[#E8DFC8]/80 text-xs font-semibold mb-1.5 uppercase tracking-wider">
              {t.numUpper}
            </label>
            <input
              type="text"
              value={upper}
              onChange={(e) => setUpper(e.target.value)}
              placeholder="100"
              className="w-full bg-[#1E2433] border border-white/15 rounded-lg px-3 py-2.5 text-[#E8DFC8] placeholder-[#E8DFC8]/25 text-sm font-mono focus:outline-none focus:border-[#D4A843]/60 focus:ring-1 focus:ring-[#D4A843]/30 transition-all duration-200"
            />
            {upper && !isInteger(upper) && (
              <p className="text-[#ff6b6b] text-xs mt-1">{lang === "zh" ? "必須為整數" : "Must be an integer"}</p>
            )}
          </div>
        </div>

        {/* Term input with paste button */}
        <div className="mb-5">
          <label className="block text-[#E8DFC8]/80 text-xs font-semibold mb-1.5 uppercase tracking-wider">
            {t.numTerm}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t.numTermHint}
              className="flex-1 bg-[#1E2433] border border-white/15 rounded-lg px-3 py-2.5 text-[#E8DFC8] placeholder-[#E8DFC8]/25 text-sm font-mono focus:outline-none focus:border-[#D4A843]/60 focus:ring-1 focus:ring-[#D4A843]/30 transition-all duration-200"
            />
            <button
              onClick={handlePaste}
              disabled={!copiedTerm}
              title={t.pasteFromPart1}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-[#6B9BD2]/40 text-[#6B9BD2] hover:bg-[#6B9BD2]/10 rounded-lg transition-all duration-150 text-sm disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span className="hidden sm:inline">{t.pasteFromPart1}</span>
            </button>
          </div>
        </div>

        {/* Live preview */}
        {lower && upper && term && isInteger(lower) && isInteger(upper) && (
          <div className="mb-5 p-3 rounded-lg bg-[#1E2433] border border-[#D4A843]/20 overflow-x-auto">
            <div className="text-[#D4A843]/60 text-xs mb-1.5 font-mono">Preview</div>
            <div className="text-center py-1">
              <KaTeXRenderer
                latex={`\\displaystyle \\sum_{r=${lower}}^{${upper}} ${termToLatexPreview(term)}`}
                displayMode
                className="text-[#E8DFC8]"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleEvaluate}
          disabled={loading || !isInteger(lower) || !isInteger(upper) || !term.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#D4A843] hover:bg-[#D4A843]/90 active:scale-[0.97] text-[#1E2433] font-bold rounded-lg transition-all duration-150 disabled:opacity-50 text-sm"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Calculator className="w-4 h-4" />
          )}
          {loading ? t.calculating : t.evaluate}
        </button>

        {/* LLM loading state */}
        {loading && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-[#D4A843]/10 border border-[#D4A843]/20">
            <Loader2 className="w-4 h-4 text-[#D4A843] animate-spin flex-shrink-0" />
            <span className="text-[#D4A843]/80 text-sm">
              {lang === "zh"
                ? "正在使用 AI 計算精確值…（約需 5-15 秒）"
                : "Using AI to compute the exact value… (may take 5–15 s)"}
            </span>
          </div>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div ref={resultRef} className="bg-[#252D3D] rounded-xl border border-white/8 p-5 sm:p-7 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="text-[#E8DFC8]/50 text-xs font-mono mb-4 uppercase tracking-wider">
            {t.numResult}
          </div>

          {/* Summation = result */}
          <div className="overflow-x-auto p-4 rounded-lg bg-[#1E2433] border border-[#D4A843]/25 mb-4">
            <KaTeXRenderer
              latex={`\\displaystyle ${result.sumLatex} = ${result.exactLatex}`}
              displayMode
              className="text-[#E8DFC8]"
            />
          </div>

          {/* Decimal */}
          {result.decimalValue !== null && !isNaN(result.decimalValue) && !Number.isInteger(result.decimalValue) && (
            <div className="mb-4 text-[#E8DFC8]/60 text-sm">
              <span className="text-[#E8DFC8]/40 mr-2">{t.decimalValue}:</span>
              <span className="font-mono text-[#D4A843]">{result.decimalValue.toFixed(8)}</span>
            </div>
          )}

          {/* Method badge */}
          <div className="flex items-center gap-2 text-xs">
            {result.method === "split_sum" ? (
              <span className="px-2 py-0.5 rounded-full border text-xs text-[#C97ED8] border-[#C97ED8]/30 bg-[#C97ED8]/10">
                {lang === "zh" ? "分拆求和法" : "Split-sum"}
              </span>
            ) : result.usedClosedForm ? (
              <span className="px-2 py-0.5 rounded-full border text-xs text-[#7EC8A4] border-[#7EC8A4]/30 bg-[#7EC8A4]/10">
                {lang === "zh" ? "封閉式公式" : "Closed-form"}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full border text-xs text-[#E88B5A] border-[#E88B5A]/30 bg-[#E88B5A]/10">
                {lang === "zh" ? "直接求和" : "Direct summation"}
              </span>
            )}
          </div>

          {/* Steps */}
          {result.stepsLatex.length > 0 && (
            <div className="mt-5">
              <div className="text-[#E8DFC8]/50 text-xs font-mono uppercase tracking-wider mb-2">
                {t.substituting}
              </div>
              {/* Render as single aligned block if it contains \begin{aligned} */}
              {result.stepsLatex.length === 1 && result.stepsLatex[0].includes("\\begin{aligned}") ? (
                <div className="overflow-x-auto p-4 rounded-lg bg-[#1E2433] border border-white/6 text-[#E8DFC8]/80">
                  <MixedMathRenderer
                    content={result.stepsLatex[0]}
                    className="text-[#E8DFC8]/80"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {result.stepsLatex.map((line, i) => (
                    <div
                      key={i}
                      className="overflow-x-auto p-3 rounded-lg bg-[#1E2433] border border-white/6 text-[#E8DFC8]/80"
                    >
                      <MixedMathRenderer
                        content={line}
                        className="text-[#E8DFC8]/80"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
