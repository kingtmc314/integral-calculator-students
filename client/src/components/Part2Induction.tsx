// ============================================================
// Part2Induction — Mathematical induction proof generator
// Uses LLM backend via tRPC for full step-by-step proofs
// Design: Dark Academic / Chalkboard
// ============================================================
import { useState, useRef } from "react";
import { useLang } from "@/contexts/LangContext";
import { SeriesResult, InductionProof } from "@/lib/seriesTypes";
import { trpc } from "@/lib/trpc";
import KaTeXRenderer from "./KaTeXRenderer";
import MixedMathRenderer from "./MixedMathRenderer";
import { BookOpen, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  seriesResult: SeriesResult | null;
  term: string;
  lower: string;
  upper: string;
}

export default function Part2Induction({ seriesResult, term, lower, upper }: Props) {
  const { t, lang } = useLang();
  const [proof, setProof] = useState<InductionProof | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    0: true, 1: true, 2: true, 3: true, 4: true,
  });
  const proofRef = useRef<HTMLDivElement>(null);

  const inductionMutation = trpc.series.induction.useMutation({
    onSuccess: (data) => {
      setProof(data);
      setTimeout(() => proofRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    },
    onError: (err) => {
      console.error("Induction proof error:", err);
      toast.error(lang === "zh" ? "生成證明失敗，請重試。" : "Failed to generate proof. Please try again.");
    },
  });

  const handleGenerate = () => {
    if (!seriesResult?.isValid) return;
    inductionMutation.mutate({
      lower,
      upper,
      term,
      closedForm: seriesResult.simplifiedLatex,
      lang,
    });
  };

  const toggleStep = (i: number) =>
    setExpandedSteps((s) => ({ ...s, [i]: !s[i] }));

  const loading = inductionMutation.isPending;

  const canGenerate =
    seriesResult?.isValid &&
    (upper.toLowerCase() === "n" || upper.toLowerCase() === "2n");

  return (
    <section id="part2" className="py-8 sm:py-12">
      {/* Section header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[#6B9BD2] font-mono text-sm font-bold">02</span>
          <div className="h-px flex-1 bg-gradient-to-r from-[#6B9BD2]/40 to-transparent" />
        </div>
        <h2
          className="text-2xl sm:text-3xl font-bold text-[#E8DFC8] mb-2"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {t.part2Title}
        </h2>
        <p className="text-[#E8DFC8]/60 text-sm sm:text-base leading-relaxed max-w-2xl">
          {t.part2Desc}
        </p>
      </div>

      {/* Status / generate card */}
      <div className="bg-[#252D3D] rounded-xl border border-white/8 p-5 sm:p-7 mb-5">
        {!seriesResult?.isValid ? (
          <div className="flex items-center gap-3 text-[#E8DFC8]/50 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{lang === "zh" ? "請先完成第一部分以生成歸納法證明。" : "Complete Part 1 first to generate the induction proof."}</span>
          </div>
        ) : !canGenerate ? (
          <div className="flex items-center gap-3 text-[#E88B5A] text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              {lang === "zh"
                ? "歸納法證明要求上限為 n 或 2n。"
                : "Induction proof requires upper limit to be "}
              {lang !== "zh" && <><strong>n</strong> or <strong>2n</strong>.</>}
            </span>
          </div>
        ) : (
          <>
            {/* Proposition preview */}
            <div className="mb-5">
              <div className="text-[#E8DFC8]/50 text-xs font-mono mb-2 uppercase tracking-wider">
                {t.proofFor}
              </div>
              <div className="overflow-x-auto p-4 rounded-lg bg-[#1E2433] border border-[#D4A843]/20">
                <KaTeXRenderer
                  latex={`\\displaystyle \\sum_{r=${lower}}^{${upper}} (${term}) = ${seriesResult.simplifiedLatex}`}
                  displayMode
                  className="text-[#E8DFC8]"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#6B9BD2] hover:bg-[#6B9BD2]/90 active:scale-[0.97] text-[#1E2433] font-bold rounded-lg transition-all duration-150 disabled:opacity-60 text-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BookOpen className="w-4 h-4" />
              )}
              {loading ? (lang === "zh" ? "生成中…" : "Generating…") : t.generateProof}
            </button>

            {/* LLM loading state */}
            {loading && (
              <div className="mt-4 flex items-center gap-3 p-3 rounded-lg bg-[#6B9BD2]/10 border border-[#6B9BD2]/20">
                <Loader2 className="w-4 h-4 text-[#6B9BD2] animate-spin flex-shrink-0" />
                <span className="text-[#6B9BD2]/80 text-sm">
                  {lang === "zh"
                    ? "正在使用 AI 生成完整歸納法證明…（約需 10-20 秒）"
                    : "Using AI to generate the full induction proof… (may take 10–20 s)"}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Proof steps */}
      {proof && (
        <div ref={proofRef} className="space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {/* Step 0 — Proposition */}
          <ProofStep
            stepNum={0}
            title={t.step0}
            color="#D4A843"
            expanded={expandedSteps[0]}
            onToggle={() => toggleStep(0)}
          >
            <div className="overflow-x-auto p-4 rounded-lg bg-[#1E2433] border border-[#D4A843]/20">
              <KaTeXRenderer
                latex={`\\displaystyle P(n): \\quad ${proof.propositionLatex}`}
                displayMode
                className="text-[#E8DFC8]"
              />
            </div>
          </ProofStep>

          {/* Step 1 — Base case */}
          <ProofStep
            stepNum={1}
            title={t.step1}
            color="#7EC8A4"
            expanded={expandedSteps[1]}
            onToggle={() => toggleStep(1)}
          >
            <p className="text-[#E8DFC8]/70 text-sm mb-3">{t.step1Desc}</p>
            <div className="space-y-3">
              <div className="overflow-x-auto p-3 rounded-lg bg-[#1E2433] border border-white/8">
                <div className="text-[#E8DFC8]/50 text-xs font-mono mb-1">{t.lhsLabel} (n = {proof.baseCaseN})</div>
                <KaTeXRenderer
                  latex={`\\displaystyle ${proof.baseCaseLHSLatex}`}
                  displayMode
                  className="text-[#E8DFC8]"
                />
              </div>
              <div className="overflow-x-auto p-3 rounded-lg bg-[#1E2433] border border-white/8">
                <div className="text-[#E8DFC8]/50 text-xs font-mono mb-1">{t.rhsLabel} (n = {proof.baseCaseN})</div>
                <KaTeXRenderer
                  latex={`\\displaystyle ${proof.baseCaseRHSLatex}`}
                  displayMode
                  className="text-[#E8DFC8]"
                />
              </div>
              <div className={`flex items-center gap-2 text-sm font-semibold ${proof.baseCaseVerified ? "text-[#7EC8A4]" : "text-[#ff6b6b]"}`}>
                <CheckCircle2 className="w-4 h-4" />
                {proof.baseCaseVerified
                  ? t.baseCaseVerified
                  : (lang === "zh" ? "基礎步驟驗證失敗 — 請檢查公式。" : "Base case failed — check your formula.")}
              </div>
            </div>
          </ProofStep>

          {/* Step 2 — Inductive hypothesis */}
          <ProofStep
            stepNum={2}
            title={t.step2}
            color="#6B9BD2"
            expanded={expandedSteps[2]}
            onToggle={() => toggleStep(2)}
          >
            <p className="text-[#E8DFC8]/70 text-sm mb-3">{t.step2Desc}</p>
            <div className="overflow-x-auto p-4 rounded-lg bg-[#1E2433] border border-[#6B9BD2]/20">
              <KaTeXRenderer
                latex={`\\displaystyle P(k): \\quad ${proof.hypothesisLatex}`}
                displayMode
                className="text-[#E8DFC8]"
              />
            </div>
          </ProofStep>

          {/* Step 3 — Inductive step */}
          <ProofStep
            stepNum={3}
            title={t.step3}
            color="#C97ED8"
            expanded={expandedSteps[3]}
            onToggle={() => toggleStep(3)}
          >
            <p className="text-[#E8DFC8]/70 text-sm mb-3">{t.step3Desc}</p>

            {/* Goal */}
            <div className="mb-3">
              <div className="text-[#E8DFC8]/50 text-xs font-mono mb-2">{t.step3Goal}</div>
              <div className="overflow-x-auto p-3 rounded-lg bg-[#1E2433] border border-[#C97ED8]/20">
                <KaTeXRenderer
                  latex={`\\displaystyle P(k+1): \\quad ${proof.inductiveStepGoalLatex}`}
                  displayMode
                  className="text-[#E8DFC8]"
                />
              </div>
            </div>

            {/* Working lines */}
            <div className="text-[#E8DFC8]/50 text-xs font-mono mb-2">{t.step3LHS}</div>
            {/* Render as single aligned block if it contains \begin{aligned} */}
            {proof.inductiveStepWorkingLines.length === 1 &&
            proof.inductiveStepWorkingLines[0].includes("\\begin{aligned}") ? (
              <div className="overflow-x-auto p-4 rounded-lg bg-[#1E2433] border border-[#C97ED8]/20 text-[#E8DFC8]">
                <MixedMathRenderer
                  content={proof.inductiveStepWorkingLines[0]}
                  className="text-[#E8DFC8]"
                />
              </div>
            ) : (
              <div className="space-y-2 pl-2 border-l-2 border-[#C97ED8]/30">
                {proof.inductiveStepWorkingLines.map((line, i) => (
                  <div
                    key={i}
                    className="overflow-x-auto p-3 rounded-lg bg-[#1E2433] border border-white/6 text-[#E8DFC8]"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <MixedMathRenderer
                      content={line}
                      className="text-[#E8DFC8]"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-[#7EC8A4] text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              {t.step3Conclude}
            </div>
          </ProofStep>

          {/* Step 4 — Conclusion */}
          <ProofStep
            stepNum={4}
            title={t.step4}
            color="#D4A843"
            expanded={expandedSteps[4]}
            onToggle={() => toggleStep(4)}
          >
            <div className="overflow-x-auto p-4 rounded-lg bg-[#1E2433] border border-[#D4A843]/20 mb-3 text-[#E8DFC8]">
              <MixedMathRenderer
                content={proof.conclusionLatex}
                className="text-[#E8DFC8]"
              />
            </div>
            <p className="text-[#E8DFC8]/60 text-sm">{t.step4Text}</p>
          </ProofStep>
        </div>
      )}
    </section>
  );
}

// ── Collapsible proof step ────────────────────────────────────────────────────

function ProofStep({
  stepNum,
  title,
  color,
  expanded,
  onToggle,
  children,
}: {
  stepNum: number;
  title: string;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-[#252D3D] rounded-xl border border-white/8 overflow-hidden"
      style={{ borderLeftWidth: "3px", borderLeftColor: color }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {stepNum}
          </span>
          <span className="text-[#E8DFC8] font-semibold text-sm sm:text-base text-left">
            {title}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[#E8DFC8]/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#E8DFC8]/40 flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-white/6">
          {children}
        </div>
      )}
    </div>
  );
}
