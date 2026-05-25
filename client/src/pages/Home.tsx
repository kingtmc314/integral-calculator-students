// ============================================================
// Home — HKDSE M2 Indefinite Integral Calculator
// Calculator-only page. Formulae and multi-problem tools live on
// their own dedicated pages.
// ============================================================
import { useMemo, useState } from "react";
import { CheckCircle2, FunctionSquare, Wand2 } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import Navbar from "@/components/Navbar";
import KaTeXRenderer from "@/components/KaTeXRenderer";
import { calculateIntegral, integralExamples, latexOfExpression, type IntegralResult } from "@/lib/integralEngine";

function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-[1.75rem] border border-[#F4EDE0]/12 bg-[#111827]/82 shadow-[0_26px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl calculus-card ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C8A45D]/24 to-[#7CA7D9]/10 border border-[#C8A45D]/35 flex items-center justify-center text-[#C8A45D] flex-shrink-0 shadow-lg shadow-[#C8A45D]/10">
        {icon}
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#F4EDE0] leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          {title}
        </h2>
        <p className="text-[#F4EDE0]/55 text-sm sm:text-base mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function alignAtEquals(line: string): string {
  const firstEquals = line.indexOf("=");
  if (firstEquals === -1) return `${line}&`;
  return `${line.slice(0, firstEquals)}&=${line.slice(firstEquals + 1)}`;
}

function alignedLatex(lines: string[]): string {
  return `\\begin{aligned}${lines.map(alignAtEquals).join("\\\\")}\\end{aligned}`;
}

function differential(variableLatex?: string): string {
  return `d${variableLatex ?? "x"}`;
}

function ResultCard({ result, lang }: { result: IntegralResult; lang: "en" | "zh" }) {
  const ok = result.status === "ok";
  const label = lang === "zh" ? {
    method: "方法",
    answer: "答案",
    working: "步驟",
    hint: "提示",
    input: "題目",
  } : {
    method: "Method",
    answer: "Answer",
    working: "Working",
    hint: "Hint",
    input: "Input",
  };

  return (
    <div className={`rounded-2xl border ${ok ? "border-[#9AD7B7]/30 bg-[#9AD7B7]/8" : "border-[#C8A45D]/30 bg-[#C8A45D]/8"} p-4 sm:p-5 shadow-inner shadow-white/[0.02] animate-in fade-in slide-in-from-bottom-3`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-[#9AD7B7]/15 text-[#9AD7B7]" : "bg-[#C8A45D]/15 text-[#C8A45D]"}`}>
          {ok && <CheckCircle2 className="w-3.5 h-3.5" />}
          {ok ? (lang === "zh" ? "可計算" : "Supported") : (lang === "zh" ? "需要提示" : "Hint needed")}
        </span>
        <span className="text-xs text-[#F4EDE0]/45 font-mono break-all">{label.input}: {result.normalized}</span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-1">{label.method}</p>
          <p className="text-[#F4EDE0]/85 text-sm">{lang === "zh" ? result.methodZh : result.method}</p>
        </div>

        {ok && result.answerLatex ? (
          <div>
            <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-2">{label.answer}</p>
            <div className="rounded-xl formula-surface border border-[#F4EDE0]/10 p-3 overflow-x-auto shadow-inner">
              <KaTeXRenderer latex={alignedLatex([`\\int ${result.integrandLatex}\\,${differential(result.variableLatex)}=${result.answerLatex}`])} displayMode />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[#C8A45D] text-xs uppercase tracking-widest mb-1">{label.hint}</p>
            <p className="text-[#F4EDE0]/75 text-sm leading-relaxed">{lang === "zh" ? result.hintZh : result.hintEn}</p>
          </div>
        )}

        {ok && result.stepsLatex.length > 0 && (
          <div>
            <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-2">{label.working}</p>
            <div className="rounded-xl formula-surface border border-[#F4EDE0]/8 p-3 overflow-x-auto shadow-inner">
              <KaTeXRenderer latex={alignedLatex(result.stepsLatex)} displayMode />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { t, lang } = useLang();
  const [expression, setExpression] = useState("x^2 + 3*x - 1");
  const [result, setResult] = useState<IntegralResult | null>(null);

  const previewLatex = useMemo(() => latexOfExpression(expression), [expression]);
  const previewResult = useMemo(() => calculateIntegral(expression), [expression]);
  const previewDifferential = differential(previewResult.variableLatex);

  const calculateMain = () => setResult(calculateIntegral(expression));

  return (
    <div className="min-h-screen calculus-page text-[#F4EDE0]">
      <Navbar activeSection="part1" onNavigate={() => undefined} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-10 pb-6 sm:pt-16 sm:pb-8 text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-[1.6rem] bg-gradient-to-br from-[#F4EDE0] via-[#C8A45D] to-[#7CA7D9] mb-5 shadow-[0_20px_60px_rgba(200,164,93,0.22)] ring-1 ring-white/25">
            <FunctionSquare className="w-8 h-8 sm:w-10 sm:h-10 text-[#080B13]" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#F4EDE0] mb-3 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {t.appTitle}
          </h1>
          <p className="text-[#C8A45D] text-xs sm:text-sm font-semibold tracking-[0.28em] uppercase mb-4">{t.appSubtitle}</p>
          <p className="text-[#F4EDE0]/62 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            {lang === "zh" ? "此頁只保留不定積分計算器。公式、方法說明及多題模式已移至獨立頁面。" : "This page keeps only the indefinite-integral calculator. Formulae, method notes, and multi-problem mode are on their dedicated pages."}
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#C8A45D]/30 to-transparent my-6" />

        <Card id="part1" className="scroll-mt-24 p-5 sm:p-6 mb-8">
          <SectionHeader icon={<Wand2 className="w-5 h-5" />} title={t.integralInputTitle} desc={t.integralInputDesc} />
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <label className="block">
                <span className="block text-[#F4EDE0]/75 text-sm font-semibold mb-2">{t.integrand}</span>
                <input value={expression} onChange={(e) => setExpression(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") calculateMain(); }} placeholder={t.integrandHint} className="w-full rounded-2xl bg-[#080B13]/70 border border-[#F4EDE0]/12 px-4 py-3 text-[#F4EDE0] placeholder:text-[#F4EDE0]/28 focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/55 focus:border-[#C8A45D]/45 shadow-inner" />
              </label>
              <div className="rounded-2xl formula-surface border border-[#F4EDE0]/10 p-4 overflow-x-auto min-h-16 shadow-inner">
                <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-2">{t.preview}</p>
                <KaTeXRenderer latex={`\\int ${previewLatex}\\,${previewDifferential}`} displayMode />
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={calculateMain} className="rounded-2xl bg-gradient-to-r from-[#C8A45D] to-[#D8B86A] text-[#080B13] px-5 py-2.5 text-sm font-bold hover:brightness-110 shadow-lg shadow-[#C8A45D]/18 transition-all">{t.calculate}</button>
                <button onClick={() => { setExpression(""); setResult(null); }} className="rounded-2xl border border-[#F4EDE0]/15 text-[#F4EDE0]/78 px-5 py-2.5 text-sm hover:bg-white/7 hover:border-[#F4EDE0]/28 transition-colors">{t.clear}</button>
              </div>
              <div>
                <p className="text-[#F4EDE0]/45 text-xs uppercase tracking-widest mb-2">{t.examplesIntegral}</p>
                <div className="flex flex-wrap gap-2">
                  {integralExamples.map((ex) => (
                    <button key={ex} onClick={() => { setExpression(ex); setResult(calculateIntegral(ex)); }} className="rounded-full border border-[#7CA7D9]/32 bg-[#7CA7D9]/10 text-[#D5E7FA] px-3 py-1.5 text-xs hover:bg-[#7CA7D9]/18 hover:border-[#C8A45D]/35 transition-colors font-mono">{ex}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {result ? <ResultCard result={result} lang={lang} /> : (
                <div className="rounded-2xl border border-dashed border-[#F4EDE0]/16 bg-[#080B13]/42 p-6 text-center text-[#F4EDE0]/48 text-sm shadow-inner">
                  {lang === "zh" ? "輸入式子後按「計算」，答案與步驟會在此顯示。" : "Enter an expression and press Calculate. The answer and working will appear here."}
                </div>
              )}
            </div>
          </div>
        </Card>
      </main>

      <footer className="border-t border-[#F4EDE0]/8 py-7 mt-6 bg-[#080B13]/35">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[#F4EDE0]/30 text-xs">{t.footer}</p>
          <p className="text-[#F4EDE0]/20 text-xs mt-1">{t.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}
