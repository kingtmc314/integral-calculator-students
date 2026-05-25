import type { ComponentProps, ReactNode } from "react";
import { BookMarked, Compass, FunctionSquare, Sigma } from "lucide-react";
import Navbar from "@/components/Navbar";
import KaTeXRenderer from "@/components/KaTeXRenderer";
import { useLang } from "@/contexts/LangContext";

type FormulaItem = {
  categoryEn: string;
  categoryZh: string;
  titleEn: string;
  titleZh: string;
  latex: string;
  noteEn: string;
  noteZh: string;
};

const FORMULAE: FormulaItem[] = [
  { categoryEn: "Basic rules", categoryZh: "基本公式", titleEn: "Power rule", titleZh: "冪次法則", latex: "\\int u^n\\,du=\\frac{u^{n+1}}{n+1}+C,\\quad n\\ne -1", noteEn: "Use directly when the derivative of the inner expression is a constant factor.", noteZh: "若內層式子的導數只差常數倍，可直接使用。" },
  { categoryEn: "Basic rules", categoryZh: "基本公式", titleEn: "Logarithmic form", titleZh: "對數形式", latex: "\\int \\frac{f'(x)}{f(x)}\\,dx=\\ln|f(x)|+C", noteEn: "This is the reverse-chain rule for logarithmic integrals.", noteZh: "這是對數型反鏈式法則。" },
  { categoryEn: "Conventions", categoryZh: "輸入約定", titleEn: "Natural and common logarithms", titleZh: "自然對數與常用對數", latex: "\\ln x=\\log_e x,\\qquad \\log x=\\log_{10}x", noteEn: "In this app, bare log means base 10; use ln for base e.", noteZh: "本工具中，沒有寫底的 log 表示底 10；自然對數請寫 ln。" },
  { categoryEn: "Conventions", categoryZh: "輸入約定", titleEn: "Change of base", titleZh: "換底公式", latex: "\\log_a x=\\frac{\\ln x}{\\ln a}", noteEn: "Use log(x,a) or log_a(x). Fixed bases are handled by change of base.", noteZh: "可輸入 log(x,a) 或 log_a(x)；固定底數會以換底處理。" },
  { categoryEn: "Exponential", categoryZh: "指數函數", titleEn: "Exponential with base e", titleZh: "自然指數", latex: "\\int e^{ax+b}\\,dx=\\frac{1}{a}e^{ax+b}+C", noteEn: "The coefficient a must be non-zero.", noteZh: "其中 a 必須不等於 0。" },
  { categoryEn: "Exponential", categoryZh: "指數函數", titleEn: "General exponential", titleZh: "一般指數", latex: "\\int a^{kx+b}\\,dx=\\frac{a^{kx+b}}{k\\ln a}+C", noteEn: "For a positive fixed base a not equal to 1.", noteZh: "適用於正固定底數 a，且 a 不等於 1。" },
  { categoryEn: "Trigonometric", categoryZh: "三角函數", titleEn: "Sine and cosine", titleZh: "正弦與餘弦", latex: "\\int \\sin(ax+b)\\,dx=-\\frac{1}{a}\\cos(ax+b)+C,\\quad \\int \\cos(ax+b)\\,dx=\\frac{1}{a}\\sin(ax+b)+C", noteEn: "Affine inner expressions are supported.", noteZh: "支援一次式作為內層函數。" },
  { categoryEn: "Trigonometric", categoryZh: "三角函數", titleEn: "Secant squared", titleZh: "正割平方", latex: "\\int \\sec^2 x\\,dx=\\tan x+C", noteEn: "Write sec(x)^2 for (sec x)^2; sec(x^2) means sec of x squared.", noteZh: "請寫 sec(x)^2 表示 (sec x)^2；sec(x^2) 則表示 sec(x²)。" },
  { categoryEn: "Techniques", categoryZh: "積分技巧", titleEn: "Linearity", titleZh: "線性性質", latex: "\\int [af(x)+bg(x)]\\,dx=a\\int f(x)\\,dx+b\\int g(x)\\,dx", noteEn: "Split sums and constant multiples before choosing a method.", noteZh: "先拆開加減項及提出常數倍，再選擇方法。" },
  { categoryEn: "Techniques", categoryZh: "積分技巧", titleEn: "Integration by parts", titleZh: "分部積分", latex: "\\int u\\,dv=uv-\\int v\\,du", noteEn: "Useful for products such as x sin x, x e^x, and x^n log x.", noteZh: "常用於 x sin x、x e^x 及 x^n log x 等乘積。" },
  { categoryEn: "Techniques", categoryZh: "積分技巧", titleEn: "Rational long division", titleZh: "有理函數長除法", latex: "\\frac{P(x)}{Q(x)}=S(x)+\\frac{R(x)}{Q(x)},\\quad \\deg R<\\deg Q", noteEn: "Use before integrating improper rational functions.", noteZh: "處理假分式有理函數時，先做多項式長除法。" },
  { categoryEn: "Techniques", categoryZh: "積分技巧", titleEn: "Trigonometric substitution", titleZh: "三角代換", latex: "\\sqrt{a^2-x^2}:x=a\\sin\\theta,\\quad \\sqrt{a^2+x^2}:x=a\\tan\\theta", noteEn: "The supported patterns follow the HKDSE M2 standard forms.", noteZh: "支援模式依照 HKDSE M2 標準題型。" },
  { categoryEn: "Definite integrals", categoryZh: "定積分", titleEn: "Newton–Leibniz formula", titleZh: "牛頓—萊布尼茲公式", latex: "\\int_a^b f(x)\\,dx=F(b)-F(a),\\quad F'(x)=f(x)", noteEn: "The definite-integral page applies this after finding F using the same symbolic engine.", noteZh: "定積分頁面會先用同一符號引擎求 F，再代入上下限。" },
  { categoryEn: "Definite integrals", categoryZh: "定積分", titleEn: "Reversed limits", titleZh: "上下限互換", latex: "\\int_a^b f(x)\\,dx=-\\int_b^a f(x)\\,dx", noteEn: "This follows automatically from F(b) − F(a).", noteZh: "這會由 F(b)−F(a) 自動反映。" },
  { categoryEn: "Definite integrals", categoryZh: "定積分", titleEn: "Zero width interval", titleZh: "相同上下限", latex: "\\int_a^a f(x)\\,dx=0", noteEn: "If both limits are the same, the value is zero.", noteZh: "若上下限相同，定積分值為零。" },
];

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.75rem] border border-[#F4EDE0]/12 bg-[#111827]/82 shadow-[0_26px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl calculus-card ${className}`}>{children}</section>;
}

export default function ReferenceFormulae() {
  const { lang } = useLang();
  const categories = Array.from(new Set(FORMULAE.map((item) => lang === "zh" ? item.categoryZh : item.categoryEn)));

  return (
    <div className="min-h-screen calculus-page text-[#F4EDE0]">
      <Navbar activeSection="formulae" onNavigate={() => undefined} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-10 pb-6 sm:pt-16 sm:pb-8 text-center relative">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-[1.6rem] bg-gradient-to-br from-[#F4EDE0] via-[#C8A45D] to-[#7CA7D9] mb-5 shadow-[0_20px_60px_rgba(200,164,93,0.22)] ring-1 ring-white/25">
            <BookMarked className="w-8 h-8 sm:w-10 sm:h-10 text-[#080B13]" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#F4EDE0] mb-3 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {lang === "zh" ? "參考公式" : "Reference Formulae"}
          </h1>
          <p className="text-[#C8A45D] text-xs sm:text-sm font-semibold tracking-[0.28em] uppercase mb-4">HKDSE M2 Integration Reference</p>
          <p className="text-[#F4EDE0]/68 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
            {lang === "zh" ? "本頁集中整理與計算器一致的公式、輸入約定和方法選擇原則，方便學生在計算前先判斷應用哪一種 M2 技巧。" : "This page collects the formulae, input conventions, and method-selection principles used by the calculator, helping students choose the appropriate M2 technique before calculating."}
          </p>
        </div>

        <Card className="p-5 sm:p-6 mb-8">
          <div className="grid gap-3 sm:grid-cols-3 mb-6">
            {[{ icon: FunctionSquare, textEn: "Indefinite rules", textZh: "不定積分規則" }, { icon: CalculatorIcon, textEn: "Definite integral rules", textZh: "定積分規則" }, { icon: Compass, textEn: "Method choice", textZh: "方法選擇" }].map(({ icon: Icon, textEn, textZh }) => (
              <div key={textEn} className="rounded-2xl border border-[#F4EDE0]/10 bg-[#080B13]/55 p-4 text-center shadow-inner">
                <Icon className="w-5 h-5 text-[#C8A45D] mx-auto mb-2" />
                <p className="text-[#F4EDE0]/78 text-sm font-semibold">{lang === "zh" ? textZh : textEn}</p>
              </div>
            ))}
          </div>

          <div className="space-y-8">
            {categories.map((category) => {
              const items = FORMULAE.filter((item) => (lang === "zh" ? item.categoryZh : item.categoryEn) === category);
              return (
                <section key={category}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-[#C8A45D]/40 to-transparent" />
                    <h2 className="text-[#C8A45D] text-sm font-bold uppercase tracking-[0.2em]">{category}</h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-[#C8A45D]/40 to-transparent" />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((item) => (
                      <article key={`${item.categoryEn}-${item.titleEn}`} className="rounded-2xl border border-[#F4EDE0]/10 bg-[#0B1020]/72 p-4 shadow-inner shadow-white/[0.02] hover:border-[#C8A45D]/25 transition-colors">
                        <p className="text-[#C8A45D] text-sm font-semibold mb-2">{lang === "zh" ? item.titleZh : item.titleEn}</p>
                        <div className="overflow-x-auto rounded-xl formula-surface border border-[#F4EDE0]/8 p-3 mb-3">
                          <KaTeXRenderer latex={item.latex} displayMode />
                        </div>
                        <p className="text-[#F4EDE0]/58 text-sm leading-relaxed">{lang === "zh" ? item.noteZh : item.noteEn}</p>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}

function CalculatorIcon(props: ComponentProps<typeof Sigma>) {
  return <Sigma {...props} />;
}
