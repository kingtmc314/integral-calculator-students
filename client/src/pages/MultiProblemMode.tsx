import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, FileImage, Image as ImageIcon, Layers, Plus, Trash2, Upload } from "lucide-react";
import Navbar from "@/components/Navbar";
import KaTeXRenderer from "@/components/KaTeXRenderer";
import { useLang } from "@/contexts/LangContext";
import { calculateDefiniteIntegral, calculateIntegral, latexOfExpression, type DefiniteIntegralResult, type IntegralResult } from "@/lib/integralEngine";

interface PartInput {
  id: number;
  label: string;
  expression: string;
  lower: string;
  upper: string;
  result: IntegralResult | DefiniteIntegralResult | null;
  mode: "indefinite" | "definite" | null;
}

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

function differential(variableLatex?: string): string {
  return `d${variableLatex ?? "x"}`;
}

function isDefiniteResult(result: IntegralResult | DefiniteIntegralResult): result is DefiniteIntegralResult {
  return "valueLatex" in result || "lowerLatex" in result;
}

function ProblemResult({ result, mode, lang }: { result: IntegralResult | DefiniteIntegralResult; mode: "indefinite" | "definite"; lang: "en" | "zh" }) {
  const ok = result.status === "ok";
  const method = lang === "zh" ? result.methodZh : result.method;
  const hint = lang === "zh" ? result.hintZh : result.hintEn;
  const title = mode === "definite" ? (lang === "zh" ? "定積分" : "Definite integral") : (lang === "zh" ? "不定積分" : "Indefinite integral");

  return (
    <div className={`rounded-2xl border ${ok ? "border-[#9AD7B7]/30 bg-[#9AD7B7]/8" : "border-[#C8A45D]/30 bg-[#C8A45D]/8"} p-4 shadow-inner shadow-white/[0.02]`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="rounded-full bg-[#7CA7D9]/12 text-[#D5E7FA] border border-[#7CA7D9]/25 px-2.5 py-1 text-xs font-semibold">{title}</span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-[#9AD7B7]/15 text-[#9AD7B7]" : "bg-[#C8A45D]/15 text-[#C8A45D]"}`}>
          {ok && <CheckCircle2 className="w-3.5 h-3.5" />}
          {ok ? (lang === "zh" ? "可計算" : "Supported") : (lang === "zh" ? "需要提示" : "Hint needed")}
        </span>
      </div>
      <p className="text-[#7CA7D9] text-xs uppercase tracking-widest mb-1">{lang === "zh" ? "方法" : "Method"}</p>
      <p className="text-[#F4EDE0]/82 text-sm mb-3">{method}</p>
      {ok ? (
        <div className="space-y-3">
          <div className="rounded-xl formula-surface border border-[#F4EDE0]/10 p-3 overflow-x-auto shadow-inner">
            {mode === "definite" && isDefiniteResult(result) ? (
              <KaTeXRenderer latex={alignedLatex([`\\int_{${result.lowerLatex}}^{${result.upperLatex}} ${result.integrandLatex}\\,d${result.variableLatex ?? "x"}=${result.valueLatex}`])} displayMode />
            ) : (
              <KaTeXRenderer latex={alignedLatex([`\\int ${result.integrandLatex}\\,${differential(result.variableLatex)}=${(result as IntegralResult).answerLatex}`])} displayMode />
            )}
          </div>
          {result.stepsLatex.length > 0 && (
            <div className="rounded-xl formula-surface border border-[#F4EDE0]/8 p-3 overflow-x-auto shadow-inner">
              <KaTeXRenderer latex={alignedLatex(result.stepsLatex)} displayMode />
            </div>
          )}
        </div>
      ) : (
        <p className="text-[#F4EDE0]/70 text-sm leading-relaxed">{hint}</p>
      )}
    </div>
  );
}

export default function MultiProblemMode() {
  const { lang } = useLang();
  const [image, setImage] = useState<string | null>(null);
  const [parts, setParts] = useState<PartInput[]>([
    { id: 1, label: "a", expression: "x^2", lower: "", upper: "", result: null, mode: null },
    { id: 2, label: "b", expression: "sin(x)", lower: "0", upper: "pi", result: null, mode: null },
  ]);

  const ruleText = lang === "zh"
    ? "每題可獨立處理：上下限均留空代表不定積分；同時輸入下限和上限代表定積分。若只填其中一格，系統會提示你補齊或清空。"
    : "Each part is handled independently: leave both limits blank for an indefinite integral; enter both lower and upper limits for a definite integral. If only one limit is filled, the app asks you to complete or clear the pair.";

  const imageHint = lang === "zh"
    ? "上載題目圖片作視覺參考，然後在下方逐題輸入。此靜態版本不強制 OCR，以保持 GitHub Pages 兼容。"
    : "Upload a question image as a visual reference, then type each part below. OCR is not required in this static GitHub Pages version.";

  const previewLatex = useMemo(() => parts.map((part) => {
    const exprLatex = latexOfExpression(part.expression || "?");
    if (part.lower.trim() && part.upper.trim()) return { id: part.id, latex: `\\int_{${latexOfExpression(part.lower)}}^{${latexOfExpression(part.upper)}} ${exprLatex}\\,dx` };
    return { id: part.id, latex: `\\int ${exprLatex}\\,dx` };
  }), [parts]);

  const handleImageUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const updatePart = (id: number, field: keyof Pick<PartInput, "label" | "expression" | "lower" | "upper">, value: string) => {
    setParts((current) => current.map((part) => part.id === id ? { ...part, [field]: value, result: null, mode: null } : part));
  };

  const addPart = () => setParts((current) => {
    const nextId = current.length ? Math.max(...current.map((part) => part.id)) + 1 : 1;
    return [...current, { id: nextId, label: String.fromCharCode(96 + Math.min(nextId, 26)), expression: "", lower: "", upper: "", result: null, mode: null }];
  });

  const removePart = (id: number) => setParts((current) => current.length === 1 ? current : current.filter((part) => part.id !== id));

  const calculatePart = (part: PartInput): PartInput => {
    const hasLower = part.lower.trim().length > 0;
    const hasUpper = part.upper.trim().length > 0;
    if (hasLower !== hasUpper) {
      const incomplete: IntegralResult = {
        input: part.expression,
        normalized: part.expression,
        status: "invalid",
        integrandLatex: latexOfExpression(part.expression || "?"),
        method: "incomplete limits",
        methodZh: "上下限未填完整",
        stepsLatex: [],
        hintEn: "Please either fill in both lower and upper limits for a definite integral, or leave both blank for an indefinite integral.",
        hintZh: "請同時填寫下限及上限以計算定積分，或把兩格都留空以計算不定積分。",
      };
      return { ...part, result: incomplete, mode: "indefinite" };
    }
    if (hasLower && hasUpper) return { ...part, result: calculateDefiniteIntegral(part.expression, part.lower, part.upper), mode: "definite" };
    return { ...part, result: calculateIntegral(part.expression), mode: "indefinite" };
  };

  const calculateAll = () => setParts((current) => current.map(calculatePart));

  return (
    <div className="min-h-screen calculus-page text-[#F4EDE0]">
      <Navbar activeSection="part4" onNavigate={() => undefined} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-10 pb-6 sm:pt-16 sm:pb-8 text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-[1.6rem] bg-gradient-to-br from-[#F4EDE0] via-[#C8A45D] to-[#7CA7D9] mb-5 shadow-[0_20px_60px_rgba(200,164,93,0.22)] ring-1 ring-white/25">
            <Layers className="w-8 h-8 sm:w-10 sm:h-10 text-[#080B13]" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#F4EDE0] mb-3 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {lang === "zh" ? "多題處理模式" : "Multi-Problem Mode"}
          </h1>
          <p className="text-[#C8A45D] text-xs sm:text-sm font-semibold tracking-[0.28em] uppercase mb-4">04 · HKDSE M2 Integration</p>
          <p className="text-[#F4EDE0]/68 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">{ruleText}</p>
        </div>

        <Card className="p-5 sm:p-6 mb-8">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C8A45D]/24 to-[#7CA7D9]/10 border border-[#C8A45D]/35 flex items-center justify-center text-[#C8A45D] flex-shrink-0 shadow-lg shadow-[#C8A45D]/10">
                  <FileImage className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#F4EDE0] leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{lang === "zh" ? "圖片參考" : "Image reference"}</h2>
                  <p className="text-[#F4EDE0]/55 text-sm sm:text-base mt-1 leading-relaxed">{imageHint}</p>
                </div>
              </div>

              <label className="block rounded-2xl border border-dashed border-[#F4EDE0]/18 bg-[#080B13]/48 p-4 cursor-pointer hover:border-[#C8A45D]/45 hover:bg-[#C8A45D]/6 transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                <div className="flex items-center gap-3 text-[#F4EDE0]/70 text-sm">
                  <Upload className="w-5 h-5 text-[#C8A45D]" />
                  {lang === "zh" ? "上載圖片" : "Upload image"}
                </div>
              </label>

              <div className="rounded-2xl border border-[#F4EDE0]/10 bg-[#080B13]/48 min-h-[16rem] flex items-center justify-center overflow-hidden shadow-inner">
                {image ? <img src={image} alt="Question reference" className="max-h-[30rem] w-full object-contain" /> : (
                  <div className="text-center text-[#F4EDE0]/38 p-8">
                    <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-60" />
                    <p className="text-sm">{lang === "zh" ? "尚未上載圖片" : "No image uploaded yet"}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#F4EDE0] leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{lang === "zh" ? "多題輸入" : "Multi-part input"}</h2>
                  <p className="text-[#F4EDE0]/55 text-sm mt-1">{ruleText}</p>
                </div>
                <button onClick={addPart} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#7CA7D9]/32 bg-[#7CA7D9]/10 text-[#D5E7FA] px-4 py-2 text-sm hover:bg-[#7CA7D9]/18 hover:border-[#C8A45D]/35 transition-colors">
                  <Plus className="w-4 h-4" />{lang === "zh" ? "新增 part" : "Add part"}
                </button>
              </div>

              <div className="space-y-4">
                {parts.map((part) => {
                  const preview = previewLatex.find((item) => item.id === part.id)?.latex ?? "";
                  return (
                    <article key={part.id} className="rounded-2xl border border-[#F4EDE0]/10 bg-[#080B13]/45 p-4 shadow-inner">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[#7CA7D9] text-xs uppercase tracking-widest">{lang === "zh" ? "Part" : "Part"}</span>
                          <input value={part.label} onChange={(e) => updatePart(part.id, "label", e.target.value)} className="w-16 rounded-xl bg-[#111827]/80 border border-[#F4EDE0]/10 px-3 py-1.5 text-sm text-[#F4EDE0] focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/50" />
                        </div>
                        <button onClick={() => removePart(part.id)} disabled={parts.length === 1} className="inline-flex items-center gap-1.5 rounded-full border border-[#F4EDE0]/12 text-[#F4EDE0]/55 px-3 py-1.5 text-xs hover:bg-white/7 disabled:opacity-35 disabled:cursor-not-allowed">
                          <Trash2 className="w-3.5 h-3.5" />{lang === "zh" ? "移除" : "Remove"}
                        </button>
                      </div>

                      <label className="block mb-3">
                        <span className="block text-[#F4EDE0]/70 text-sm font-semibold mb-2">{lang === "zh" ? "被積函數" : "Integrand"}</span>
                        <input value={part.expression} onChange={(e) => updatePart(part.id, "expression", e.target.value)} placeholder="e.g. x^2, sin(x), log(x,2)" className="w-full rounded-2xl bg-[#111827]/80 border border-[#F4EDE0]/12 px-4 py-3 text-[#F4EDE0] placeholder:text-[#F4EDE0]/28 focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/55 focus:border-[#C8A45D]/45 shadow-inner" />
                      </label>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <label className="block">
                          <span className="block text-[#F4EDE0]/70 text-sm font-semibold mb-2">{lang === "zh" ? "下限（可留空）" : "Lower limit (optional)"}</span>
                          <input value={part.lower} onChange={(e) => updatePart(part.id, "lower", e.target.value)} placeholder={lang === "zh" ? "留空＝不定" : "blank = indefinite"} className="w-full rounded-2xl bg-[#111827]/80 border border-[#F4EDE0]/12 px-4 py-3 text-[#F4EDE0] placeholder:text-[#F4EDE0]/28 focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/55 shadow-inner" />
                        </label>
                        <label className="block">
                          <span className="block text-[#F4EDE0]/70 text-sm font-semibold mb-2">{lang === "zh" ? "上限（可留空）" : "Upper limit (optional)"}</span>
                          <input value={part.upper} onChange={(e) => updatePart(part.id, "upper", e.target.value)} placeholder={lang === "zh" ? "留空＝不定" : "blank = indefinite"} className="w-full rounded-2xl bg-[#111827]/80 border border-[#F4EDE0]/12 px-4 py-3 text-[#F4EDE0] placeholder:text-[#F4EDE0]/28 focus:outline-none focus:ring-2 focus:ring-[#C8A45D]/55 shadow-inner" />
                        </label>
                      </div>

                      <div className="rounded-xl formula-surface border border-[#F4EDE0]/8 p-3 mb-3 overflow-x-auto">
                        <KaTeXRenderer latex={preview} displayMode />
                      </div>

                      {part.result && part.mode && <ProblemResult result={part.result} mode={part.mode} lang={lang} />}
                    </article>
                  );
                })}
              </div>

              <button onClick={calculateAll} className="w-full rounded-2xl bg-gradient-to-r from-[#C8A45D] to-[#D8B86A] text-[#080B13] px-5 py-3 text-sm font-bold hover:brightness-110 shadow-lg shadow-[#C8A45D]/18 transition-all">
                {lang === "zh" ? "計算全部" : "Calculate all parts"}
              </button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
