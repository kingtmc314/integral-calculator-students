import { useMemo, useState, type ReactNode } from "react";
import { Calculator, CheckCircle2, FunctionSquare, RotateCcw } from "lucide-react";
import Navbar from "@/components/Navbar";
import KaTeXRenderer from "@/components/KaTeXRenderer";
import { useLang } from "@/contexts/LangContext";
import { calculateDefiniteIntegral, definiteIntegralExamples, latexOfExpression, type DefiniteIntegralResult } from "@/lib/integralEngine";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.75rem] border border-[#F4EDE0]/12 bg-[#111827]/82 shadow-[0_26px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl calculus-card ${className}`}>{children}</section>;
}

function alignAtEquals(line: string): string {
  const firstEquals = line.indexOf("=");
  if (firstEquals === -1) return `${line}&`;
  return `${line.slice(0, firstEquals)}&=${line.slice(firstEquals + 1)}`;
}

function alignedLatex(lines: string[]): string {
  return `\\begin{aligned}${lines.map(alignAtEquals).join("\\\\")}\\end{aligned}`;
}

function ResultPanel({ result, lang }: { result: DefiniteIntegralResult; lang: "en" | "zh" }) {
  const ok = result.status === "ok";
  return (
    <div className={`rounded-2xl border ${ok ? "border-[#9AD7B7]/30 bg-[#9AD7B7]/8" : "border-[#C8A45D]/30 bg-[#C8A45D]/8"} p-4 sm:p-5 shadow-inner shadow-white/[0.02] animate-in fade-in slide-in-from-bottom-3`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-[#9AD7B7]/15 text-[#9AD7B7]" : "bg-[#C8A45D]/15 text-[#C8A45D]"}`}>
          {ok && <CheckCircle2 className="w-3.5 h-3.5" />}
          {ok ? (lang === "zh" ? "可計算" : "Supported") : (lang === "zh" ? "需要提示" : "Hint needed")}
        </span>
        <span className="text-xs text-[#F4EDE0]/45 font-mono break-all">{result.normalized}</span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-1">{lang === "zh" ? "方法" : "Method"}</p>
          <p className="text-[#F4EDE0]/85 text-sm">{lang === "zh" ? result.methodZh : result.method}</p>
        </div>

        {ok && result.valueLatex ? (
          <>
            <div>
              <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-2">{lang === "zh" ? "答案" : "Answer"}</p>
              <div className="rounded-xl formula-surface border border-[#F4EDE0]/10 p-3 overflow-x-auto shadow-inner">
                <KaTeXRenderer latex={alignedLatex([`\\int_{${result.lowerLatex}}^{${result.upperLatex}} ${result.integrandLatex}\\,d${result.variableLatex ?? "x"}=${result.valueLatex}`])} displayMode />
              </div>
            </div>
            <div>
              <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-2">{lang === "zh" ? "步驟" : "Working"}</p>
              <div className="rounded-xl formula-surface border border-[#F4EDE0]/8 p-3 overflow-x-auto shadow-inner">
                <KaTeXRenderer latex={alignedLatex(result.stepsLatex)} displayMode />
              </div>
            </div>
          </>
        ) : (
          <div>
            <p className="text-[#C8A45D] text-xs uppercase tracking-widest mb-1">{lang === "zh" ? "提示" : "Hint"}</p>
            <p className="text-[#F4EDE0]/75 text-sm leading-relaxed">{lang === "zh" ? result.hintZh : result.hintEn}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DefiniteIntegral() {
  const { lang } = useLang();
  const [expression, setExpression] = useState("x^2");
  const [lower, setLower] = useState("0");
  const [upper, setUpper] = useState("2");
  const [result, setResult] = useState<DefiniteIntegralResult | null>(null);

  const preview = useMemo(() => {
    const previewResult = calculateDefiniteIntegral(expression, lower, upper);
    return `\\int_{${previewResult.lowerLatex || latexOfExpression(lower)}}^{${previewResult.upperLatex || latexOfExpression(upper)}} ${latexOfExpression(expression)}\\,d${previewResult.variableLatex ?? "x"}`;
  }, [expression, lower, upper]);

  const calculate = () => setResult(calculateDefiniteIntegral(expression, lower, upper));

  return (
    <div className="min-h-screen calculus-page text-[#F4EDE0]">
      <Navbar activeSection="definite" onNavigate={() => undefined} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-10 pb-6 sm:pt-16 sm:pb-8 text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-[1.6rem] bg-gradient-to-br from-[#F4EDE0] via-[#C8A45D] to-[#7CA7D9] mb-5 shadow-[0_20px_60px_rgba(200,164,93,0.22)] ring-1 ring-white/25">
            <Calculator className="w-8 h-8 sm:w-10 sm:h-10 text-[#080B13]" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#F4EDE0] mb-3 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {lang === "zh" ? "定積分" : "Definite Integration"}
          </h1>
          <p className="text-[#C8A45D] text-xs sm:text-sm font-semibold tracking-[0.28em] uppercase mb-4">HKDSE M2 Student Tool</p>
          <p className="text-[#F4EDE0]/62 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            {lang === "zh" ? "此頁只保留定積分計算器。公式與計算原理已集中於公式整理頁。" : "This page keeps only the definite-integral calculator. Formulae and method principles are collected on the formulae page."}
          </p>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[#C8A45D]/30 to-transparent my-6" />

        <Card className="p-5 sm:p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C8A45D]/24 to-[#7CA7D9]/10 border border-[#C8A45D]/35 flex items-center justify-center text-[#C8A45D] flex-shrink-0 shadow-lg shadow-[#C8A45D]/10">
              <FunctionSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#F4EDE0] leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{lang === "zh" ? "輸入定積分" : "Enter a definite integral"}</h2>
              <p className="text-[#F4EDE0]/55 text-sm sm:text-base mt-1 leading-relaxed">{lang === "zh" ? "輸入被積函數、下限和上限，然後按計算。" : "Enter the integrand, lower limit, and upper limit, then calculate."}</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <label className="block">
                <span className="block text-[#F4EDE0]/75 text-sm font-semibold mb-2">{lang === "zh" ? "被積函數" : "Integrand"}</span>
                <input value={expression} onChange={(e) => setExpression(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") calculate(); }} placeholder="e.g. x^2, sin(x), log(x,2), sec(x)^2" className="w-full rounded-2xl bg-[#080B13]/70 border border-[#F4EDE0]/12 px-4 py-3 text-[#F4EDE0] placeholder:text-[#F4EDE0]/28 focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/55 focus:border-[#C8A45D]/45 shadow-inner" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[#F4EDE0]/75 text-sm font-semibold mb-2">{lang === "zh" ? "下限" : "Lower limit"}</span>
                  <input value={lower} onChange={(e) => setLower(e.target.value)} className="w-full rounded-2xl bg-[#080B13]/70 border border-[#F4EDE0]/12 px-4 py-3 text-[#F4EDE0] placeholder:text-[#F4EDE0]/28 focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/55 shadow-inner" />
                </label>
                <label className="block">
                  <span className="block text-[#F4EDE0]/75 text-sm font-semibold mb-2">{lang === "zh" ? "上限" : "Upper limit"}</span>
                  <input value={upper} onChange={(e) => setUpper(e.target.value)} className="w-full rounded-2xl bg-[#080B13]/70 border border-[#F4EDE0]/12 px-4 py-3 text-[#F4EDE0] placeholder:text-[#F4EDE0]/28 focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/55 shadow-inner" />
                </label>
              </div>
              <div className="rounded-2xl formula-surface border border-[#F4EDE0]/10 p-4 overflow-x-auto min-h-16 shadow-inner">
                <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-2">{lang === "zh" ? "LaTeX 預覽" : "LaTeX Preview"}</p>
                <KaTeXRenderer latex={preview} displayMode />
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={calculate} className="rounded-2xl bg-gradient-to-r from-[#C8A45D] to-[#D8B86A] text-[#080B13] px-5 py-2.5 text-sm font-bold hover:brightness-110 shadow-lg shadow-[#C8A45D]/18 transition-all">{lang === "zh" ? "計算" : "Calculate"}</button>
                <button onClick={() => { setExpression(""); setLower("0"); setUpper("1"); setResult(null); }} className="inline-flex items-center gap-2 rounded-2xl border border-[#F4EDE0]/15 text-[#F4EDE0]/78 px-5 py-2.5 text-sm hover:bg-white/7 hover:border-[#F4EDE0]/28 transition-colors"><RotateCcw className="w-4 h-4" />{lang === "zh" ? "重設" : "Reset"}</button>
              </div>
              <div>
                <p className="text-[#F4EDE0]/45 text-xs uppercase tracking-widest mb-2">{lang === "zh" ? "範例" : "Examples"}</p>
                <div className="flex flex-wrap gap-2">
                  {definiteIntegralExamples.map((ex) => (
                    <button key={`${ex.expression}-${ex.lower}-${ex.upper}`} onClick={() => { setExpression(ex.expression); setLower(ex.lower); setUpper(ex.upper); setResult(calculateDefiniteIntegral(ex.expression, ex.lower, ex.upper)); }} className="rounded-full border border-[#7CA7D9]/32 bg-[#7CA7D9]/10 text-[#D5E7FA] px-3 py-1.5 text-xs hover:bg-[#7CA7D9]/18 hover:border-[#C8A45D]/35 transition-colors font-mono">
                      {ex.expression}, [{ex.lower}, {ex.upper}]
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {result ? <ResultPanel result={result} lang={lang} /> : (
                <div className="rounded-2xl border border-dashed border-[#F4EDE0]/16 bg-[#080B13]/42 p-6 text-center text-[#F4EDE0]/48 text-sm shadow-inner">
                  {lang === "zh" ? "輸入被積函數和上下限後按「計算」，答案與步驟會在此顯示。" : "Enter the integrand and limits, then press Calculate. The answer and working will appear here."}
                </div>
              )}
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
