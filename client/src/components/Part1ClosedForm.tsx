// ============================================================
// Part1ClosedForm — Series closed-form derivation
// Uses LLM backend via tRPC for any series expression
// Design: Dark Academic / Chalkboard
// ============================================================
import { useState, useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { SeriesResult, termToLatexPreview } from "@/lib/seriesTypes";
import { trpc } from "@/lib/trpc";
import KaTeXRenderer from "./KaTeXRenderer";
import { Copy, Check, ChevronDown, ChevronUp, Calculator, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onResultReady: (result: SeriesResult, term: string, lower: string, upper: string) => void;
  onCopyTerm: (term: string) => void;
}

export default function Part1ClosedForm({ onResultReady, onCopyTerm }: Props) {
  const { t, lang } = useLang();
  const [lower, setLower] = useState("1");
  const [upper, setUpper] = useState("n");
  const [term, setTerm] = useState("r");
  const [result, setResult] = useState<SeriesResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const computeMutation = trpc.series.compute.useMutation({
    onSuccess: (data) => {
      setResult(data);
      onResultReady(data, term.trim(), lower.trim(), upper.trim());
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    },
    onError: (err) => {
      console.error("Series compute error:", err);
      setResult({
        sumLatex: "",
        closedFormLatex: "",
        simplifiedLatex: "",
        seriesType: "unsupported",
        isValid: false,
        errorMsg: "computation_failed",
      });
      toast.error("Computation failed. Please try again.");
    },
  });

  const handleCalculate = () => {
    if (!lower.trim() || !upper.trim() || !term.trim()) return;
    computeMutation.mutate({
      lower: lower.trim(),
      upper: upper.trim(),
      term: term.trim(),
      lang,
    });
  };

  const handleCopy = () => {
    onCopyTerm(term.trim());
    setCopied(true);
    toast.success(t.copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExample = (ex: { lower: string; upper: string; term: string }) => {
    setLower(ex.lower);
    setUpper(ex.upper);
    setTerm(ex.term);
    setResult(null);
    setShowExamples(false);
  };

  const loading = computeMutation.isPending;

  const seriesTypeColor: Record<string, string> = {
    linear: "#6B9BD2",
    quadratic: "#7EC8A4",
    cubic: "#C97ED8",
    geometric: "#E88B5A",
    telescoping: "#E8C55A",
    partial_fraction: "#E8C55A",
    polynomial: "#6B9BD2",
    exponential: "#E88B5A",
    mixed: "#C97ED8",
    unsupported: "#ff6b6b",
  };

  return (
    <section id="part1" className="py-8 sm:py-12">
      {/* Section header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[#6B9BD2] font-mono text-sm font-bold">01</span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#6B9BD2]/40 to-transparent" />
        </div>
        <h2
          className="text-2xl sm:text-3xl font-bold text-[#E8DFC8] mb-2"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {t.part1Title}
        </h2>
        <p className="text-[#E8DFC8]/60 text-sm sm:text-base leading-relaxed max-w-2xl">
          {t.part1Desc}
        </p>
      </div>

      {/* Input card */}
      <div className="bg-[#252D3D] rounded-xl border border-white/8 p-5 sm:p-7 mb-5">
        {/* Grid: 3 inputs side by side on md+, stacked on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <InputField
            label={t.lowerLimit}
            hint={t.lowerLimitHint}
            value={lower}
            onChange={setLower}
            placeholder="1"
          />
          <InputField
            label={t.upperLimit}
            hint={t.upperLimitHint}
            value={upper}
            onChange={setUpper}
            placeholder="n"
          />
          <InputField
            label={t.generalTerm}
            hint={t.generalTermHint}
            value={term}
            onChange={setTerm}
            placeholder="r"
          />
        </div>

        {/* Live preview */}
        {lower && upper && term && (
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

        {/* Action row */}
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleCalculate}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#D4A843] hover:bg-[#D4A843]/90 active:scale-[0.97] text-[#1E2433] font-bold rounded-lg transition-all duration-150 disabled:opacity-60 text-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            {loading ? t.calculating : t.calculate}
          </button>

          <button
            onClick={() => setShowExamples((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 border border-white/15 text-[#E8DFC8]/70 hover:text-[#E8DFC8] hover:border-white/30 rounded-lg transition-all duration-150 text-sm"
          >
            <Lightbulb className="w-4 h-4" />
            {t.exampleLabel}
            {showExamples ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Examples dropdown */}
        {showExamples && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {([...(t.examples as unknown as { label: string; lower: string; upper: string; term: string }[])]).map((ex, i) => (
              <button
                key={i}
                onClick={() => handleExample(ex)}
                className="text-left p-3 rounded-lg bg-[#1E2433] border border-white/8 hover:border-[#D4A843]/40 transition-all duration-150 group"
              >
                <div className="text-[#D4A843] text-xs font-semibold mb-1 group-hover:text-[#D4A843]">
                  {ex.label}
                </div>
                <div className="text-[#E8DFC8]/50 text-xs font-mono">
                  Σ {ex.term}, r={ex.lower}..{ex.upper}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* LLM loading state */}
        {loading && (
          <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-[#D4A843]/10 border border-[#D4A843]/20">
            <Loader2 className="w-4 h-4 text-[#D4A843] animate-spin flex-shrink-0" />
            <span className="text-[#D4A843]/80 text-sm">
              {lang === "zh" ? "正在使用 AI 計算級數…（約需 5-15 秒）" : "Using AI to compute the series… (may take 5–15 s)"}
            </span>
          </div>
        )}
      </div>

      {/* Result card */}
      {result && (
        <div ref={resultRef} className="bg-[#252D3D] rounded-xl border border-white/8 p-5 sm:p-7 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {result.isValid ? (
            <>
              {/* Series type badge */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold border"
                  style={{
                    color: seriesTypeColor[result.seriesType] ?? "#6B9BD2",
                    borderColor: `${seriesTypeColor[result.seriesType] ?? "#6B9BD2"}40`,
                    backgroundColor: `${seriesTypeColor[result.seriesType] ?? "#6B9BD2"}15`,
                  }}
                >
                  {result.seriesType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} Series
                </span>
              </div>

              {/* Summation */}
              <div className="mb-4">
                <div className="text-[#E8DFC8]/50 text-xs font-mono mb-2 uppercase tracking-wider">
                  {t.result}
                </div>
                <div className="overflow-x-auto p-4 rounded-lg bg-[#1E2433] border border-white/8">
                  <KaTeXRenderer
                    latex={`\\displaystyle ${result.sumLatex} = ${result.simplifiedLatex}`}
                    displayMode
                    className="text-[#E8DFC8]"
                  />
                </div>
              </div>

              {/* Sample values for verification */}
              {result.sampleValues && result.sampleValues.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-[#1E2433] border border-white/6">
                  <div className="text-[#E8DFC8]/40 text-xs font-mono mb-2 uppercase tracking-wider">
                    {lang === "zh" ? "驗證（前5個值）" : "Verification (first 5 values)"}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {result.sampleValues.map((v, i) => (
                      <span key={i} className="text-xs font-mono text-[#E8DFC8]/60">
                        n={i + 1}: <span className="text-[#D4A843]">{typeof v === "number" && !isNaN(v) ? (Number.isInteger(v) ? v : v.toFixed(6)) : "?"}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#6B9BD2]/40 text-[#6B9BD2] hover:bg-[#6B9BD2]/10 transition-all duration-150 text-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t.copied : t.copyTerm}
              </button>
            </>
          ) : (
            <div className="text-[#ff6b6b] text-sm">
              {result.errorMsg === "invalid"
                ? t.errorInvalid
                : result.errorMsg === "computation_failed"
                ? (lang === "zh" ? "計算失敗，請重試。" : "Computation failed. Please try again.")
                : t.errorUnsupported}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Reusable input field ──────────────────────────────────────────────────────

function InputField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-[#E8DFC8]/80 text-xs font-semibold mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#1E2433] border border-white/15 rounded-lg px-3 py-2.5 text-[#E8DFC8] placeholder-[#E8DFC8]/25 text-sm font-mono focus:outline-none focus:border-[#D4A843]/60 focus:ring-1 focus:ring-[#D4A843]/30 transition-all duration-200"
      />
      <p className="text-[#E8DFC8]/35 text-xs mt-1.5 leading-tight">{hint}</p>
    </div>
  );
}
