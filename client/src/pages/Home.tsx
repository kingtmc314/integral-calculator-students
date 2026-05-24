// ============================================================
// Home — HKDSE M2 Indefinite Integral Calculator
// Design: Elegant Calculus / Professional Mathematical Studio
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

function derivativeOperator(variableLatex?: string): string {
  return `\\frac{d}{d${variableLatex ?? "x"}}`;
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

function FormulaReferenceIntegral({ lang }: { lang: "en" | "zh" }) {
  const formulae = lang === "zh" ? [
    ["冪次法則", "\\int u^n\\,du=\\frac{u^{n+1}}{n+1}+C,\\quad n\\ne -1"],
    ["對數形式", "\\int \\frac{1}{au+b}\\,du=\\frac{1}{a}\\ln|au+b|+C"],
    ["指數函數", "\\int e^{au+b}\\,du=\\frac{1}{a}e^{au+b}+C"],
    ["一般指數", "\\int a^{ku+b}\\,du=\\frac{a^{ku+b}}{k\\ln a}+C"],
    ["三角函數", "\\int \\sin(au+b)\\,du=-\\frac{1}{a}\\cos(au+b)+C"],
    ["三角函數", "\\int \\cos(au+b)\\,du=\\frac{1}{a}\\sin(au+b)+C"],
    ["反鏈式法則", "\\int f'(u)[f(u)]^n\\,du=\\frac{[f(u)]^{n+1}}{n+1}+C"],
    ["反鏈式法則", "\\int \\frac{f'(u)}{f(u)}\\,du=\\ln|f(u)|+C"],
    ["有理函數：長除法", "\\frac{P(u)}{Q(u)}=S(u)+\\frac{R(u)}{Q(u)},\\quad \\deg R<\\deg Q"],
    ["方法選擇", "\\text{先試直接公式／有理函數；只在代換後化成已支援標準型時才代換}"],
    ["分部積分", "\\int p(u)q'(u)\\,du=p(u)q(u)-\\int q(u)p'(u)\\,du"],
    ["兩次分部積分", "I=\\int e^u\\sin u\\,du\\Rightarrow 2I=e^u(\\sin u-\\cos u)"],
    ["混合技巧", "\\sin(\\ln u),\\ \\cos(\\sqrt{u})\\Rightarrow \\text{先作合適代換，再判斷標準型}"],
    ["三角代換", "\\sqrt{a^2-u^2}:\\ u=a\\sin\\theta,\\quad a^2+u^2:\\ u=a\\tan\\theta"],
  ] : [
    ["Power rule", "\\int u^n\\,du=\\frac{u^{n+1}}{n+1}+C,\\quad n\\ne -1"],
    ["Logarithmic form", "\\int \\frac{1}{au+b}\\,du=\\frac{1}{a}\\ln|au+b|+C"],
    ["Exponential", "\\int e^{au+b}\\,du=\\frac{1}{a}e^{au+b}+C"],
    ["General exponential", "\\int a^{ku+b}\\,du=\\frac{a^{ku+b}}{k\\ln a}+C"],
    ["Trigonometric", "\\int \\sin(au+b)\\,du=-\\frac{1}{a}\\cos(au+b)+C"],
    ["Trigonometric", "\\int \\cos(au+b)\\,du=\\frac{1}{a}\\sin(au+b)+C"],
    ["Reverse chain rule", "\\int f'(u)[f(u)]^n\\,du=\\frac{[f(u)]^{n+1}}{n+1}+C"],
    ["Reverse chain rule", "\\int \\frac{f'(u)}{f(u)}\\,du=\\ln|f(u)|+C"],
    ["Rational functions: long division", "\\frac{P(u)}{Q(u)}=S(u)+\\frac{R(u)}{Q(u)},\\quad \\deg R<\\deg Q"],
    ["Method choice", "\\text{Try direct rules/rational functions first; substitute only if it becomes a supported standard form}"],
    ["Integration by parts", "\\int p(u)q'(u)\\,du=p(u)q(u)-\\int q(u)p'(u)\\,du"],
    ["Repeated by parts", "I=\\int e^u\\sin u\\,du\\Rightarrow 2I=e^u(\\sin u-\\cos u)"],
    ["Mixed techniques", "\\sin(\\ln u),\\ \\cos(\\sqrt{u})\\Rightarrow \\text{substitute first, then check the standard form}"],
    ["Trig substitution", "\\sqrt{a^2-u^2}:\\ u=a\\sin\\theta,\\quad a^2+u^2:\\ u=a\\tan\\theta"],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {formulae.map(([name, formula], index) => (
        <div key={index} className="rounded-2xl border border-[#F4EDE0]/10 bg-[#0B1020]/72 p-4 shadow-inner shadow-white/[0.02] hover:border-[#C8A45D]/25 transition-colors">
          <p className="text-[#C8A45D] text-sm font-semibold mb-2">{name}</p>
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
  const previewResult = useMemo(() => calculateIntegral(expression), [expression]);
  const previewDifferential = differential(previewResult.variableLatex);
  const practicePreviewResult = useMemo(() => calculateIntegral(practiceExpression), [practiceExpression]);
  const practiceDifferential = differential(practicePreviewResult.variableLatex);

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
    <div className="min-h-screen calculus-page text-[#F4EDE0]">
      <Navbar activeSection={activeSection} onNavigate={handleNavigate} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-10 pb-6 sm:pt-16 sm:pb-8 text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-[1.6rem] bg-gradient-to-br from-[#F4EDE0] via-[#C8A45D] to-[#7CA7D9] mb-5 shadow-[0_20px_60px_rgba(200,164,93,0.22)] ring-1 ring-white/25">
            <FunctionSquare className="w-8 h-8 sm:w-10 sm:h-10 text-[#080B13]" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#F4EDE0] mb-3 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {t.appTitle}
          </h1>
          <p className="text-[#C8A45D] text-xs sm:text-sm font-semibold tracking-[0.28em] uppercase mb-4">{t.appSubtitle}</p>
          <p className="text-[#F4EDE0]/68 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">{t.integralHeroDesc}</p>
          <div className="mt-6 mx-auto max-w-3xl rounded-2xl border border-[#F4EDE0]/10 bg-[#080B13]/45 backdrop-blur-md p-3 sm:p-4 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
            <div className="grid gap-2 sm:grid-cols-3 text-center">
              {["\\frac{d}{du}F(u)=f(u)", "\\int f(u)\\,du=F(u)+C", "\\text{HKDSE M2 methods}"].map((formula, index) => (
                <div key={index} className="rounded-xl border border-[#F4EDE0]/8 bg-white/[0.025] px-3 py-2 overflow-x-auto">
                  <KaTeXRenderer latex={formula} displayMode />
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {[
              { id: "part1", label: t.navPart1, num: "01" },
              { id: "part2", label: t.navPart2, num: "02" },
              { id: "part3", label: t.navPart3, num: "03" },
            ].map((s) => (
              <button key={s.id} onClick={() => handleNavigate(s.id)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#F4EDE0]/14 bg-white/[0.025] text-[#F4EDE0]/68 hover:text-[#F4EDE0] hover:border-[#C8A45D]/45 hover:bg-[#C8A45D]/8 text-xs transition-all duration-200">
                <span className="text-[#7CA7D9] font-mono">{s.num}</span>{s.label}
              </button>
            ))}
          </div>
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

              <div className="rounded-2xl border border-[#9AD7B7]/24 bg-[#9AD7B7]/8 p-4 shadow-inner shadow-[#9AD7B7]/5">
                <p className="text-[#9AD7B7] text-sm font-semibold mb-2">{lang === "zh" ? "隨機練習與即時檢查" : "Random practice with instant checking"}</p>
                <div className="rounded-xl formula-surface border border-[#F4EDE0]/10 p-3 mb-3 overflow-x-auto">
                  <KaTeXRenderer latex={`\\int ${latexOfExpression(practiceExpression)}\\,${practiceDifferential}`} displayMode />
                </div>
                <input value={practiceAnswer} onChange={(e) => setPracticeAnswer(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") checkPractice(); }} placeholder={lang === "zh" ? "輸入你的不定積分答案，例如 x^3/3+C" : "Enter your antiderivative, e.g. x^3/3+C"} className="w-full rounded-xl bg-[#080B13]/70 border border-[#F4EDE0]/12 px-3 py-2 text-[#F4EDE0] placeholder:text-[#F4EDE0]/28 focus:outline-none focus:ring-2 focus:ring-[#9AD7B7]/50 shadow-inner" />
                <div className="flex flex-wrap gap-2 mt-3">
                  <button onClick={checkPractice} className="rounded-xl bg-gradient-to-r from-[#9AD7B7] to-[#B2E4C8] text-[#080B13] px-4 py-2 text-xs font-bold hover:brightness-110 transition-all">{lang === "zh" ? "檢查答案" : "Check answer"}</button>
                  <button onClick={generatePractice} className="rounded-xl border border-[#F4EDE0]/15 text-[#F4EDE0]/78 px-4 py-2 text-xs hover:bg-white/7 hover:border-[#F4EDE0]/28 transition-colors">{lang === "zh" ? "換一題" : "New question"}</button>
                </div>
                {practiceFeedback && (
                  <div className={`mt-3 rounded-lg border p-3 ${practiceFeedback.correct ? "border-[#9AD7B7]/35 bg-[#9AD7B7]/10" : "border-[#C8A45D]/35 bg-[#C8A45D]/10"}`}>
                    <p className="text-[#F4EDE0]/75 text-sm">{lang === "zh" ? practiceFeedback.messageZh : practiceFeedback.messageEn}</p>
                    {practiceFeedback.derivativeLatex && <div className="mt-2 overflow-x-auto"><KaTeXRenderer latex={alignedLatex([`${derivativeOperator(practiceFeedback.variableLatex)}(${latexOfExpression(practiceAnswer)})=${practiceFeedback.derivativeLatex}`])} displayMode /></div>}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              {result ? <ResultCard result={result} lang={lang} /> : (
                <div className="rounded-2xl border border-dashed border-[#F4EDE0]/16 bg-[#080B13]/42 p-6 text-center text-[#F4EDE0]/48 text-sm shadow-inner">
                  {lang === "zh" ? "輸入式子後按「計算」，答案與步驟會在此顯示。" : "Enter an expression and press Calculate. The answer and working will appear here."}
                </div>
              )}
              <div className="rounded-2xl border border-[#F4EDE0]/10 bg-[#080B13]/48 p-4 shadow-inner">
                <p className="text-[#C8A45D] text-sm font-semibold mb-2">{t.supportedScope}</p>
                <p className="text-[#F4EDE0]/60 text-sm leading-relaxed">
                  {lang === "zh" ? "支援線性拆項、常數倍、冪次、一次式代換、對數型、指數型、三角函數、反鏈式法則、基本分部積分，以及表列的三角代換。系統會自動偵測單一積分變數，可用英文字母或 α、β、θ、φ 等小寫希臘字母。若題目需要超出 M2 或尚未實作的技巧，系統會回傳提示。" : "Supports linearity, constant multiples, powers, affine substitution, logarithmic forms, exponentials, trigonometric rules, reverse-chain patterns, basic integration by parts, and listed trigonometric substitutions. The app auto-detects one integration variable, including Latin letters and lowercase Greek letters such as α, β, θ and φ. If a question requires methods beyond M2 or not yet implemented, the app returns a hint."}
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
              <label className="flex flex-col items-center justify-center min-h-48 rounded-[1.5rem] border border-dashed border-[#C8A45D]/38 bg-[#080B13]/46 text-center p-4 hover:bg-[#080B13]/62 hover:border-[#C8A45D]/55 transition-colors shadow-inner">
                <Upload className="w-7 h-7 text-[#C8A45D] mb-2" />
                <span className="text-[#F4EDE0] text-sm font-semibold">{t.uploadImage}</span>
                <span className="text-[#F4EDE0]/45 text-xs mt-1">PNG, JPG, WebP</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0] ?? null)} />
              </label>
              <div className="rounded-[1.5rem] border border-[#F4EDE0]/10 bg-[#080B13]/48 p-3 min-h-44 flex items-center justify-center overflow-hidden shadow-inner">
                {imageUrl ? <img src={imageUrl} alt="uploaded question" className="max-h-[420px] w-full object-contain rounded-xl" /> : <p className="text-[#F4EDE0]/35 text-sm">{t.noImage}</p>}
              </div>
              <p className="text-[#F4EDE0]/45 text-xs leading-relaxed">{t.imageNote}</p>
            </div>

            <div className="space-y-4">
              {parts.map((part, index) => (
                <div key={part.id} className="rounded-2xl border border-[#F4EDE0]/10 bg-[#080B13]/48 p-4 shadow-inner">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-3">
                    <label className="w-full sm:w-24">
                      <span className="block text-[#F4EDE0]/60 text-xs mb-1">{t.partLabel}</span>
                      <input value={part.label} onChange={(e) => updatePart(part.id, { label: e.target.value })} className="w-full rounded-xl bg-[#080B13]/70 border border-[#F4EDE0]/12 px-3 py-2 text-[#F4EDE0] focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/50 shadow-inner" />
                    </label>
                    <label className="flex-1">
                      <span className="block text-[#F4EDE0]/60 text-xs mb-1">{t.integrand}</span>
                      <input value={part.expression} onChange={(e) => updatePart(part.id, { expression: e.target.value, result: null })} placeholder={`${index + 1}. ${t.integrandHint}`} className="w-full rounded-lg bg-[#111827] border border-white/12 px-3 py-2 text-[#F4EDE0] placeholder:text-[#F4EDE0]/25 focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/50" />
                    </label>
                    <button onClick={() => setParts((current) => current.filter((p) => p.id !== part.id))} className="rounded-xl border border-red-300/25 text-red-100/82 px-3 py-2 hover:bg-red-400/10 transition-colors" aria-label={t.removePart}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {part.result && <ResultCard result={part.result} lang={lang} />}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button onClick={addPart} className="inline-flex items-center gap-2 rounded-2xl border border-[#F4EDE0]/15 text-[#F4EDE0]/82 px-4 py-2.5 text-sm hover:bg-white/7 hover:border-[#F4EDE0]/28 transition-colors"><Plus className="w-4 h-4" />{t.addPart}</button>
                <button onClick={calculateAllParts} className="rounded-2xl bg-gradient-to-r from-[#C8A45D] to-[#D8B86A] text-[#080B13] px-5 py-2.5 text-sm font-bold hover:brightness-110 shadow-lg shadow-[#C8A45D]/18 transition-all">{t.calculateAll}</button>
              </div>
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
