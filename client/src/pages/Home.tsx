// ============================================================
// Home — HKDSE M2 Indefinite Integral Calculator
// Design: Dark Academic / Chalkboard
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, FileImage, FunctionSquare, Plus, Trash2, Upload, Wand2 } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import Navbar from "@/components/Navbar";
import KaTeXRenderer from "@/components/KaTeXRenderer";
import { calculateIntegral, checkAntiderivative, integralExamples, latexOfExpression, type IntegralResult } from "@/lib/integralEngine";

interface PartInput {
  id: number;
  label: string;
  expression: string;
  result: IntegralResult | null;
}

function Card({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`rounded-2xl border border-white/10 bg-[#252D3D]/95 shadow-xl shadow-black/20 dot-grid ${className}`}>
      {children}
    </section>
  );
}

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
      <div className="w-11 h-11 rounded-xl bg-[#D4A843]/15 border border-[#D4A843]/30 flex items-center justify-center text-[#D4A843] flex-shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-[#E8DFC8] leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          {title}
        </h2>
        <p className="text-[#E8DFC8]/55 text-sm sm:text-base mt-1 leading-relaxed">{desc}</p>
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
    <div className={`rounded-xl border ${ok ? "border-[#7EC8A4]/25 bg-[#7EC8A4]/7" : "border-[#D4A843]/25 bg-[#D4A843]/7"} p-4 animate-in fade-in slide-in-from-bottom-3`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-[#7EC8A4]/15 text-[#7EC8A4]" : "bg-[#D4A843]/15 text-[#D4A843]"}`}>
          {ok && <CheckCircle2 className="w-3.5 h-3.5" />}
          {ok ? (lang === "zh" ? "可計算" : "Supported") : (lang === "zh" ? "需要提示" : "Hint needed")}
        </span>
        <span className="text-xs text-[#E8DFC8]/45 font-mono break-all">{label.input}: {result.normalized}</span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[#6B9BD2] text-xs uppercase tracking-widest mb-1">{label.method}</p>
          <p className="text-[#E8DFC8]/85 text-sm">{lang === "zh" ? result.methodZh : result.method}</p>
        </div>

        {ok && result.answerLatex ? (
          <div>
            <p className="text-[#6B9BD2] text-xs uppercase tracking-widest mb-2">{label.answer}</p>
            <div className="rounded-lg bg-[#1E2433]/80 border border-white/10 p-3 overflow-x-auto">
              <KaTeXRenderer latex={alignedLatex([`\\int ${result.integrandLatex}\\,dx=${result.answerLatex}`])} displayMode />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[#D4A843] text-xs uppercase tracking-widest mb-1">{label.hint}</p>
            <p className="text-[#E8DFC8]/75 text-sm leading-relaxed">{lang === "zh" ? result.hintZh : result.hintEn}</p>
          </div>
        )}

        {ok && result.stepsLatex.length > 0 && (
          <div>
            <p className="text-[#6B9BD2] text-xs uppercase tracking-widest mb-2">{label.working}</p>
            <div className="rounded-lg bg-[#1E2433]/60 border border-white/8 p-3 overflow-x-auto">
              <KaTeXRenderer latex={alignedLatex(result.stepsLatex)} displayMode />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormulaReferenceIntegral({ lang }: { lang: "en" | "zh" }) {
  const formulae = lang === "zh" ? [
    ["冪次法則", "\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C,\\quad n\\ne -1"],
    ["對數形式", "\\int \\frac{1}{ax+b}\\,dx=\\frac{1}{a}\\ln|ax+b|+C"],
    ["指數函數", "\\int e^{ax+b}\\,dx=\\frac{1}{a}e^{ax+b}+C"],
    ["一般指數", "\\int a^{kx+b}\\,dx=\\frac{a^{kx+b}}{k\\ln a}+C"],
    ["三角函數", "\\int \\sin(ax+b)\\,dx=-\\frac{1}{a}\\cos(ax+b)+C"],
    ["三角函數", "\\int \\cos(ax+b)\\,dx=\\frac{1}{a}\\sin(ax+b)+C"],
    ["反鏈式法則", "\\int f'(x)[f(x)]^n\\,dx=\\frac{[f(x)]^{n+1}}{n+1}+C"],
    ["反鏈式法則", "\\int \\frac{f'(x)}{f(x)}\\,dx=\\ln|f(x)|+C"],
  ] : [
    ["Power rule", "\\int x^n\\,dx=\\frac{x^{n+1}}{n+1}+C,\\quad n\\ne -1"],
    ["Logarithmic form", "\\int \\frac{1}{ax+b}\\,dx=\\frac{1}{a}\\ln|ax+b|+C"],
    ["Exponential", "\\int e^{ax+b}\\,dx=\\frac{1}{a}e^{ax+b}+C"],
    ["General exponential", "\\int a^{kx+b}\\,dx=\\frac{a^{kx+b}}{k\\ln a}+C"],
    ["Trigonometric", "\\int \\sin(ax+b)\\,dx=-\\frac{1}{a}\\cos(ax+b)+C"],
    ["Trigonometric", "\\int \\cos(ax+b)\\,dx=\\frac{1}{a}\\sin(ax+b)+C"],
    ["Reverse chain rule", "\\int f'(x)[f(x)]^n\\,dx=\\frac{[f(x)]^{n+1}}{n+1}+C"],
    ["Reverse chain rule", "\\int \\frac{f'(x)}{f(x)}\\,dx=\\ln|f(x)|+C"],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {formulae.map(([name, formula], index) => (
        <div key={index} className="rounded-xl border border-white/10 bg-[#1E2433]/70 p-4">
          <p className="text-[#D4A843] text-sm font-semibold mb-2">{name}</p>
          <div className="overflow-x-auto">
            <KaTeXRenderer latex={formula} displayMode />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const { t, lang } = useLang();
  const [activeSection, setActiveSection] = useState("part1");
  const [expression, setExpression] = useState("x^2 + 3*x - 1");
  const [result, setResult] = useState<IntegralResult | null>(null);
  const [practiceExpression, setPracticeExpression] = useState(integralExamples[0]);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceFeedback, setPracticeFeedback] = useState<ReturnType<typeof checkAntiderivative> | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [parts, setParts] = useState<PartInput[]>([
    { id: 1, label: "a", expression: "x^2", result: null },
    { id: 2, label: "b", expression: "sin(2*x)", result: null },
  ]);
  const nextId = useRef(3);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    ["part1", "part2", "part3"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const previewLatex = useMemo(() => latexOfExpression(expression), [expression]);

  const handleNavigate = (section: string) => {
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(section);
  };

  const calculateMain = () => setResult(calculateIntegral(expression));

  const generatePractice = () => {
    const next = integralExamples[Math.floor(Math.random() * integralExamples.length)];
    setPracticeExpression(next);
    setPracticeAnswer("");
    setPracticeFeedback(null);
  };

  const checkPractice = () => {
    setPracticeFeedback(checkAntiderivative(practiceExpression, practiceAnswer));
  };

  const uploadImage = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const updatePart = (id: number, patch: Partial<PartInput>) => {
    setParts((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const addPart = () => {
    const id = nextId.current++;
    setParts((current) => [...current, { id, label: String.fromCharCode(96 + Math.min(id, 26)), expression: "", result: null }]);
  };

  const calculateAllParts = () => {
    setParts((current) => current.map((p) => ({ ...p, result: calculateIntegral(p.expression) })));
  };

  return (
    <div className="min-h-screen bg-[#1E2433]" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(107,155,210,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(212,168,67,0.04) 0%, transparent 50%)" }}>
      <Navbar activeSection={activeSection} onNavigate={handleNavigate} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-8 pb-4 sm:pt-12 sm:pb-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#D4A843] to-[#B8860B] mb-4 shadow-lg shadow-[#D4A843]/20">
            <FunctionSquare className="w-7 h-7 sm:w-8 sm:h-8 text-[#1E2433]" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#E8DFC8] mb-2 leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {t.appTitle}
          </h1>
          <p className="text-[#D4A843] text-sm sm:text-base font-medium tracking-widest uppercase mb-3">{t.appSubtitle}</p>
          <p className="text-[#E8DFC8]/55 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">{t.integralHeroDesc}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {[
              { id: "part1", label: t.navPart1, num: "01" },
              { id: "part2", label: t.navPart2, num: "02" },
              { id: "part3", label: t.navPart3, num: "03" },
            ].map((s) => (
              <button key={s.id} onClick={() => handleNavigate(s.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 text-[#E8DFC8]/60 hover:text-[#E8DFC8] hover:border-white/30 text-xs transition-all duration-200">
                <span className="text-[#6B9BD2] font-mono">{s.num}</span>{s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />

        <Card id="part1" className="scroll-mt-24 p-5 sm:p-6 mb-8">
          <SectionHeader icon={<Wand2 className="w-5 h-5" />} title={t.integralInputTitle} desc={t.integralInputDesc} />
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <label className="block">
                <span className="block text-[#E8DFC8]/75 text-sm font-semibold mb-2">{t.integrand}</span>
                <input value={expression} onChange={(e) => setExpression(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") calculateMain(); }} placeholder={t.integrandHint} className="w-full rounded-xl bg-[#1E2433] border border-white/12 px-4 py-3 text-[#E8DFC8] placeholder:text-[#E8DFC8]/25 focus:outline-none focus:ring-2 focus:ring-[#D4A843]/60" />
              </label>
              <div className="rounded-xl bg-[#1E2433]/80 border border-white/10 p-3 overflow-x-auto min-h-16">
                <p className="text-[#6B9BD2] text-xs uppercase tracking-widest mb-2">{t.preview}</p>
                <KaTeXRenderer latex={`\\int ${previewLatex}\\,dx`} displayMode />
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={calculateMain} className="rounded-xl bg-[#D4A843] text-[#1E2433] px-5 py-2.5 text-sm font-bold hover:bg-[#E4BC55] transition-colors">{t.calculate}</button>
                <button onClick={() => { setExpression(""); setResult(null); }} className="rounded-xl border border-white/15 text-[#E8DFC8]/75 px-5 py-2.5 text-sm hover:bg-white/5 transition-colors">{t.clear}</button>
              </div>
              <div>
                <p className="text-[#E8DFC8]/45 text-xs uppercase tracking-widest mb-2">{t.examplesIntegral}</p>
                <div className="flex flex-wrap gap-2">
                  {integralExamples.map((ex) => (
                    <button key={ex} onClick={() => { setExpression(ex); setResult(calculateIntegral(ex)); }} className="rounded-full border border-[#6B9BD2]/30 bg-[#6B9BD2]/8 text-[#B9D5F2] px-3 py-1.5 text-xs hover:bg-[#6B9BD2]/15 transition-colors font-mono">{ex}</button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#7EC8A4]/20 bg-[#7EC8A4]/7 p-4">
                <p className="text-[#7EC8A4] text-sm font-semibold mb-2">{lang === "zh" ? "隨機練習與即時檢查" : "Random practice with instant checking"}</p>
                <div className="rounded-lg bg-[#1E2433]/80 border border-white/10 p-2 mb-3 overflow-x-auto">
                  <KaTeXRenderer latex={`\\int ${latexOfExpression(practiceExpression)}\\,dx`} displayMode />
                </div>
                <input value={practiceAnswer} onChange={(e) => setPracticeAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") checkPractice(); }} placeholder={lang === "zh" ? "輸入你的不定積分答案，例如 x^3/3+C" : "Enter your antiderivative, e.g. x^3/3+C"} className="w-full rounded-lg bg-[#252D3D] border border-white/12 px-3 py-2 text-[#E8DFC8] placeholder:text-[#E8DFC8]/25 focus:outline-none focus:ring-2 focus:ring-[#7EC8A4]/50" />
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={checkPractice} className="rounded-lg bg-[#7EC8A4] text-[#1E2433] px-4 py-2 text-xs font-bold hover:bg-[#94D7B6] transition-colors">{lang === "zh" ? "檢查答案" : "Check answer"}</button>
                  <button onClick={generatePractice} className="rounded-lg border border-white/15 text-[#E8DFC8]/75 px-4 py-2 text-xs hover:bg-white/5 transition-colors">{lang === "zh" ? "換一題" : "New question"}</button>
                </div>
                {practiceFeedback && (
                  <div className={`mt-3 rounded-lg border p-3 ${practiceFeedback.correct ? "border-[#7EC8A4]/35 bg-[#7EC8A4]/10" : "border-[#D4A843]/35 bg-[#D4A843]/10"}`}>
                    <p className="text-[#E8DFC8]/75 text-sm">{lang === "zh" ? practiceFeedback.messageZh : practiceFeedback.messageEn}</p>
                    {practiceFeedback.derivativeLatex && <div className="mt-2 overflow-x-auto"><KaTeXRenderer latex={alignedLatex([`\\frac{d}{dx}(${latexOfExpression(practiceAnswer)})=${practiceFeedback.derivativeLatex}`])} displayMode /></div>}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {result ? <ResultCard result={result} lang={lang} /> : (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#1E2433]/55 p-6 text-center text-[#E8DFC8]/45 text-sm">
                  {lang === "zh" ? "輸入式子後按「計算」，答案與步驟會在此顯示。" : "Enter an expression and press Calculate. The answer and working will appear here."}
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-[#1E2433]/60 p-4">
                <p className="text-[#D4A843] text-sm font-semibold mb-2">{t.supportedScope}</p>
                <p className="text-[#E8DFC8]/60 text-sm leading-relaxed">
                  {lang === "zh" ? "支援線性拆項、常數倍、冪次、一次式代換、對數型、指數型、三角函數及部分反鏈式法則。若題目需要超出 M2 或尚未實作的技巧，系統會回傳提示。" : "Supports linearity, constant multiples, powers, affine substitution, logarithmic forms, exponentials, trigonometric rules, and selected reverse-chain patterns. If a question requires methods beyond M2 or not yet implemented, the app returns a hint."}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card id="part2" className="scroll-mt-24 p-5 sm:p-6 mb-8">
          <SectionHeader icon={<BookOpen className="w-5 h-5" />} title={t.formulaTitle} desc={t.formulaDesc} />
          <FormulaReferenceIntegral lang={lang} />
        </Card>

        <Card id="part3" className="scroll-mt-24 p-5 sm:p-6 mb-8">
          <SectionHeader icon={<FileImage className="w-5 h-5" />} title={t.imageTitle} desc={t.imageDesc} />
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              <label className="flex flex-col items-center justify-center min-h-48 rounded-2xl border border-dashed border-[#D4A843]/35 bg-[#1E2433]/60 text-center p-4 hover:bg-[#1E2433]/80 transition-colors">
                <Upload className="w-7 h-7 text-[#D4A843] mb-2" />
                <span className="text-[#E8DFC8] text-sm font-semibold">{t.uploadImage}</span>
                <span className="text-[#E8DFC8]/45 text-xs mt-1">PNG, JPG, WebP</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0] ?? null)} />
              </label>
              <div className="rounded-2xl border border-white/10 bg-[#1E2433]/70 p-3 min-h-44 flex items-center justify-center overflow-hidden">
                {imageUrl ? <img src={imageUrl} alt="uploaded question" className="max-h-[420px] w-full object-contain rounded-xl" /> : <p className="text-[#E8DFC8]/35 text-sm">{t.noImage}</p>}
              </div>
              <p className="text-[#E8DFC8]/45 text-xs leading-relaxed">{t.imageNote}</p>
            </div>

            <div className="space-y-4">
              {parts.map((part, index) => (
                <div key={part.id} className="rounded-xl border border-white/10 bg-[#1E2433]/60 p-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-3">
                    <label className="w-full sm:w-24">
                      <span className="block text-[#E8DFC8]/60 text-xs mb-1">{t.partLabel}</span>
                      <input value={part.label} onChange={(e) => updatePart(part.id, { label: e.target.value })} className="w-full rounded-lg bg-[#252D3D] border border-white/12 px-3 py-2 text-[#E8DFC8] focus:outline-none focus:ring-2 focus:ring-[#D4A843]/50" />
                    </label>
                    <label className="flex-1">
                      <span className="block text-[#E8DFC8]/60 text-xs mb-1">{t.integrand}</span>
                      <input value={part.expression} onChange={(e) => updatePart(part.id, { expression: e.target.value, result: null })} placeholder={`${index + 1}. ${t.integrandHint}`} className="w-full rounded-lg bg-[#252D3D] border border-white/12 px-3 py-2 text-[#E8DFC8] placeholder:text-[#E8DFC8]/25 focus:outline-none focus:ring-2 focus:ring-[#D4A843]/50" />
                    </label>
                    <button onClick={() => setParts((current) => current.filter((p) => p.id !== part.id))} className="rounded-lg border border-red-400/25 text-red-200/80 px-3 py-2 hover:bg-red-400/10 transition-colors" aria-label={t.removePart}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {part.result && <ResultCard result={part.result} lang={lang} />}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button onClick={addPart} className="inline-flex items-center gap-2 rounded-xl border border-white/15 text-[#E8DFC8]/80 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"><Plus className="w-4 h-4" />{t.addPart}</button>
                <button onClick={calculateAllParts} className="rounded-xl bg-[#D4A843] text-[#1E2433] px-5 py-2.5 text-sm font-bold hover:bg-[#E4BC55] transition-colors">{t.calculateAll}</button>
              </div>
            </div>
          </div>
        </Card>
      </main>

      <footer className="border-t border-white/8 py-6 mt-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-[#E8DFC8]/30 text-xs">{t.footer}</p>
          <p className="text-[#E8DFC8]/20 text-xs mt-1">{t.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}
