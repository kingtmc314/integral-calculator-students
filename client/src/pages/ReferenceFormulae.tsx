import type { ComponentProps, ReactNode } from "react";
import { BookMarked, Calculator, Compass, FunctionSquare, Layers, ListChecks, Sigma } from "lucide-react";
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
  { categoryEn: "Input conventions", categoryZh: "輸入約定", titleEn: "Variable and notation", titleZh: "變數與記號", latex: "x,t,y,\\alpha,\\beta,\\theta,\\phi\\quad \\text{may be used as the single integration variable}", noteEn: "Use one integration variable in each expression. Multiplication should be written with * and powers with ^ in the input box.", noteZh: "每條式子使用一個積分變數。輸入時乘法請用 *，冪次請用 ^。" },
  { categoryEn: "Input conventions", categoryZh: "輸入約定", titleEn: "Natural and common logarithms", titleZh: "自然對數與常用對數", latex: "\\ln u=\\log_e u,\\qquad \\log u=\\log_{10}u", noteEn: "In this app, ln means natural logarithm and bare log means common logarithm base 10.", noteZh: "本工具中，ln 表示自然對數；沒有寫底的 log 表示常用對數底 10。" },
  { categoryEn: "Input conventions", categoryZh: "輸入約定", titleEn: "Change of base", titleZh: "換底公式", latex: "\\log_a u=\\frac{\\ln u}{\\ln a},\\qquad \\log u=\\frac{\\ln u}{\\ln 10}", noteEn: "Use log(u,a) for a fixed base a. The calculator rewrites fixed-base logarithms by change of base.", noteZh: "可用 log(u,a) 輸入固定底數 a 的對數；計算器會以換底處理。" },
  { categoryEn: "Input conventions", categoryZh: "輸入約定", titleEn: "Function-power placement", titleZh: "函數次方擺位", latex: "\\sec^2 u=(\\sec u)^2,\\qquad \\sec(u^2)\\text{ is a different function}", noteEn: "Write sec(x)^2 for (sec x)^2. Writing sec(x^2) means the secant function is applied to x².", noteZh: "請寫 sec(x)^2 表示 (sec x)^2；sec(x^2) 表示把 x² 放入 sec 函數。" },

  { categoryEn: "Basic indefinite rules", categoryZh: "不定積分基本公式", titleEn: "Constant multiple and linearity", titleZh: "常數倍與線性性質", latex: "\\int [af(u)+bg(u)]\\,du=a\\int f(u)\\,du+b\\int g(u)\\,du", noteEn: "Split sums and constant multiples before choosing a special technique.", noteZh: "先拆開加減項及提出常數倍，再判斷是否需要其他技巧。" },
  { categoryEn: "Basic indefinite rules", categoryZh: "不定積分基本公式", titleEn: "Power rule", titleZh: "冪次法則", latex: "\\int u^n\\,du=\\frac{u^{n+1}}{n+1}+C,\\quad n\\ne -1", noteEn: "Use directly when the derivative of the inner expression differs only by a constant factor.", noteZh: "若內層式子的導數只差常數倍，可直接使用。" },
  { categoryEn: "Basic indefinite rules", categoryZh: "不定積分基本公式", titleEn: "Logarithmic integral", titleZh: "對數積分", latex: "\\int \\frac{1}{au+b}\\,du=\\frac{1}{a}\\ln|au+b|+C", noteEn: "This is the standard affine logarithmic form.", noteZh: "這是一次式分母的標準對數型。" },
  { categoryEn: "Basic indefinite rules", categoryZh: "不定積分基本公式", titleEn: "Reverse-chain logarithmic form", titleZh: "對數型反鏈式法則", latex: "\\int \\frac{f'(u)}{f(u)}\\,du=\\ln|f(u)|+C", noteEn: "Use when the numerator is the derivative of the denominator up to a constant factor.", noteZh: "當分子是分母的導數，只差常數倍時使用。" },
  { categoryEn: "Basic indefinite rules", categoryZh: "不定積分基本公式", titleEn: "Reverse-chain power form", titleZh: "冪次型反鏈式法則", latex: "\\int f'(u)[f(u)]^n\\,du=\\frac{[f(u)]^{n+1}}{n+1}+C,\\quad n\\ne -1", noteEn: "This covers many substitution-style M2 questions without requiring manual substitution input.", noteZh: "這涵蓋不少 M2 代換型題目，學生毋須手動輸入代換變數。" },

  { categoryEn: "Exponential and trigonometric rules", categoryZh: "指數及三角公式", titleEn: "Exponential with base e", titleZh: "自然指數", latex: "\\int e^{au+b}\\,du=\\frac{1}{a}e^{au+b}+C", noteEn: "The coefficient a must be non-zero.", noteZh: "其中 a 必須不等於 0。" },
  { categoryEn: "Exponential and trigonometric rules", categoryZh: "指數及三角公式", titleEn: "General exponential", titleZh: "一般指數", latex: "a^{ku+b}=e^{(ku+b)\\ln a},\\qquad \\int a^{ku+b}\\,du=\\frac{a^{ku+b}}{k\\ln a}+C", noteEn: "For a positive fixed base a not equal to 1.", noteZh: "適用於正固定底數 a，且 a 不等於 1。" },
  { categoryEn: "Exponential and trigonometric rules", categoryZh: "指數及三角公式", titleEn: "Sine", titleZh: "正弦", latex: "\\int \\sin(au+b)\\,du=-\\frac{1}{a}\\cos(au+b)+C", noteEn: "Affine inner expressions are supported.", noteZh: "支援一次式作為內層函數。" },
  { categoryEn: "Exponential and trigonometric rules", categoryZh: "指數及三角公式", titleEn: "Cosine", titleZh: "餘弦", latex: "\\int \\cos(au+b)\\,du=\\frac{1}{a}\\sin(au+b)+C", noteEn: "Affine inner expressions are supported.", noteZh: "支援一次式作為內層函數。" },
  { categoryEn: "Exponential and trigonometric rules", categoryZh: "指數及三角公式", titleEn: "Secant squared", titleZh: "正割平方", latex: "\\int \\sec^2(au+b)\\,du=\\frac{1}{a}\\tan(au+b)+C", noteEn: "Use sec(x)^2 in the input box.", noteZh: "輸入時請使用 sec(x)^2。" },
  { categoryEn: "Exponential and trigonometric rules", categoryZh: "指數及三角公式", titleEn: "Tangent-related logarithmic form", titleZh: "正切相關對數型", latex: "\\int \\tan u\\,du=-\\ln|\\cos u|+C", noteEn: "Supported when it can be reduced to a standard reverse-chain form.", noteZh: "當題目可化為標準反鏈式形式時支援。" },

  { categoryEn: "Rational functions and substitutions", categoryZh: "有理函數及代換", titleEn: "Rational long division", titleZh: "有理函數長除法", latex: "\\frac{P(u)}{Q(u)}=S(u)+\\frac{R(u)}{Q(u)},\\quad \\deg R<\\deg Q", noteEn: "Use before integrating improper rational functions.", noteZh: "處理假分式有理函數時，先做多項式長除法。" },
  { categoryEn: "Rational functions and substitutions", categoryZh: "有理函數及代換", titleEn: "Arctangent rational form", titleZh: "反正切有理函數型", latex: "\\int \\frac{A}{u^2+a^2}\\,du=\\frac{A}{a}\\tan^{-1}\\left(\\frac{u}{a}\\right)+C,\\quad a>0", noteEn: "This includes exact forms such as 2/(x^2+3), keeping radicals exact.", noteZh: "例如 2/(x^2+3) 會保留根號的精確反正切答案。" },
  { categoryEn: "Rational functions and substitutions", categoryZh: "有理函數及代換", titleEn: "Trigonometric substitution: difference of squares", titleZh: "三角代換：平方差", latex: "\\sqrt{a^2-u^2}:\\quad u=a\\sin\\theta", noteEn: "Use the HKDSE M2 substitution form when the expression matches the standard pattern.", noteZh: "當式子符合標準型時，使用 HKDSE M2 的三角代換形式。" },
  { categoryEn: "Rational functions and substitutions", categoryZh: "有理函數及代換", titleEn: "Trigonometric substitution: sum of squares", titleZh: "三角代換：平方和", latex: "a^2+u^2:\\quad u=a\\tan\\theta", noteEn: "The calculator keeps the final result in exact symbolic form.", noteZh: "計算器會以精確符號形式保留答案。" },

  { categoryEn: "Integration by parts and mixed methods", categoryZh: "分部積分及混合技巧", titleEn: "Integration by parts", titleZh: "分部積分", latex: "\\int p(u)q'(u)\\,du=p(u)q(u)-\\int q(u)p'(u)\\,du", noteEn: "Useful for products such as x sin x, x e^x, and polynomial-logarithm products.", noteZh: "常用於 x sin x、x e^x 及多項式乘對數等乘積。" },
  { categoryEn: "Integration by parts and mixed methods", categoryZh: "分部積分及混合技巧", titleEn: "Repeated integration by parts", titleZh: "兩次分部積分", latex: "I=\\int e^u\\sin u\\,du\\Rightarrow 2I=e^u(\\sin u-\\cos u)", noteEn: "Cyclic by-parts problems are simplified algebraically after the repeated step.", noteZh: "循環式分部積分會在重複步驟後以代數方式整理。" },
  { categoryEn: "Integration by parts and mixed methods", categoryZh: "分部積分及混合技巧", titleEn: "Mixed substitutions", titleZh: "混合代換", latex: "\\sin(\\ln u),\\quad \\cos(\\sqrt{u})\\Rightarrow \\text{substitute first, then check the standard form}", noteEn: "For composed functions, substitute only when the transformed expression becomes a supported M2 standard form.", noteZh: "複合函數只在代換後化成已支援 M2 標準型時才使用代換。" },
  { categoryEn: "Integration by parts and mixed methods", categoryZh: "分部積分及混合技巧", titleEn: "Method-selection principle", titleZh: "方法選擇原則", latex: "\\text{Try direct rules and rational simplification first; substitute only after recognising a standard form.}", noteEn: "This keeps calculator behaviour aligned with student-facing HKDSE M2 methods.", noteZh: "先試直接公式與有理化簡；只有辨認到標準型後才代換，以符合學生使用的 M2 方法。" },

  { categoryEn: "Definite integrals", categoryZh: "定積分", titleEn: "Newton–Leibniz formula", titleZh: "牛頓—萊布尼茲公式", latex: "\\int_a^b f(u)\\,du=F(b)-F(a),\\quad F'(u)=f(u)", noteEn: "The definite-integral calculator first finds an antiderivative and then substitutes the limits exactly.", noteZh: "定積分計算器會先求原函數，再精確代入上下限。" },
  { categoryEn: "Definite integrals", categoryZh: "定積分", titleEn: "Reversed limits", titleZh: "上下限互換", latex: "\\int_a^b f(u)\\,du=-\\int_b^a f(u)\\,du", noteEn: "This follows automatically from F(b) − F(a).", noteZh: "這會由 F(b)−F(a) 自動反映。" },
  { categoryEn: "Definite integrals", categoryZh: "定積分", titleEn: "Zero-width interval", titleZh: "相同上下限", latex: "\\int_a^a f(u)\\,du=0", noteEn: "If both limits are the same, the exact value is zero.", noteZh: "若上下限相同，定積分值為零。" },
  { categoryEn: "Definite integrals", categoryZh: "定積分", titleEn: "Exact-value policy", titleZh: "精確值原則", latex: "\\text{Answers are displayed as exact LaTeX values, not decimal approximations.}", noteEn: "Constants such as π, e and radicals are preserved symbolically whenever supported.", noteZh: "支援的 π、e 及根號等常數會以符號形式保留，不以小數近似取代。" },

  { categoryEn: "Multi-problem mode", categoryZh: "多題處理模式", titleEn: "Indefinite by default", titleZh: "預設為不定積分", latex: "\\int f(u)\\,du", noteEn: "In Multi-Problem Mode, leave both lower and upper limits blank to calculate an indefinite integral.", noteZh: "在多題處理模式中，若上下限均留空，該題會按不定積分計算。" },
  { categoryEn: "Multi-problem mode", categoryZh: "多題處理模式", titleEn: "Definite when both limits are entered", titleZh: "輸入上下限即為定積分", latex: "\\int_a^b f(u)\\,du", noteEn: "Fill in both limits for a part to calculate a definite integral. Each part can independently be definite or indefinite.", noteZh: "每個 part 如同時輸入下限與上限，便會按定積分計算；不同 part 可各自是不定或定積分。" },
];

const HIGHLIGHTS = [
  { icon: FunctionSquare, textEn: "Indefinite rules", textZh: "不定積分公式" },
  { icon: Calculator, textEn: "Definite integral rules", textZh: "定積分公式" },
  { icon: Compass, textEn: "Method choice", textZh: "方法選擇" },
  { icon: Layers, textEn: "Multi-problem rules", textZh: "多題模式規則" },
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
            {lang === "zh" ? "公式及方法整理" : "Reference Formulae"}
          </h1>
          <p className="text-[#C8A45D] text-xs sm:text-sm font-semibold tracking-[0.28em] uppercase mb-4">HKDSE M2 Integration Reference</p>
          <p className="text-[#F4EDE0]/68 text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
            {lang === "zh" ? "本頁集中整理計算器使用的所有公式、輸入約定、方法選擇原則、定積分規則及多題模式規則。計算器頁面只保留計算功能，學生可先在此判斷應用哪一種技巧。" : "This page centralises all formulae, input conventions, method-selection principles, definite-integral rules, and multi-problem rules used by the calculators. Calculator pages now keep only calculation controls."}
          </p>
        </div>

        <Card className="p-5 sm:p-6 mb-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            {HIGHLIGHTS.map(({ icon: Icon, textEn, textZh }) => (
              <div key={textEn} className="rounded-2xl border border-[#F4EDE0]/10 bg-[#080B13]/55 p-4 text-center shadow-inner">
                <Icon className="w-5 h-5 text-[#C8A45D] mx-auto mb-2" />
                <p className="text-[#F4EDE0]/78 text-sm font-semibold">{lang === "zh" ? textZh : textEn}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#7CA7D9]/20 bg-[#7CA7D9]/8 p-4 mb-8 shadow-inner">
            <div className="flex items-start gap-3">
              <ListChecks className="w-5 h-5 text-[#7CA7D9] mt-0.5 flex-shrink-0" />
              <p className="text-[#F4EDE0]/70 text-sm leading-relaxed">
                {lang === "zh" ? "使用建議：先檢查輸入約定，再辨認題型；若是不定積分，答案包括任意常數 C；若是定積分，先求原函數再代入上下限；若在第 04 頁處理多題，留空上下限代表不定積分。" : "Suggested use: check the input conventions first, then identify the problem type. Indefinite answers include the arbitrary constant C; definite integrals find an antiderivative before substituting limits; in page 04, blank limits mean an indefinite integral."}
              </p>
            </div>
          </div>

          <div className="space-y-9">
            {categories.map((category) => {
              const items = FORMULAE.filter((item) => (lang === "zh" ? item.categoryZh : item.categoryEn) === category);
              return (
                <section key={category}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-[#C8A45D]/40 to-transparent" />
                    <h2 className="text-[#C8A45D] text-sm font-bold uppercase tracking-[0.2em] text-center">{category}</h2>
                    <div className="h-px flex-1 bg-gradient-to-l from-[#C8A45D]/40 to-transparent" />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((item) => (
                      <article key={`${item.categoryEn}-${item.titleEn}`} className="rounded-2xl border border-[#F4EDE0]/10 bg-[#0B1020]/72 p-4 shadow-inner shadow-white/[0.02] hover:border-[#C8A45D]/25 transition-colors">
                        <p className="text-[#C8A45D] text-sm font-semibold mb-2">{lang === "zh" ? item.titleZh : item.titleEn}</p>
                        <div className="overflow-x-auto rounded-xl formula-surface border border-[#F4EDE0]/8 p-3 mb-3 min-h-[4rem] flex items-center">
                          <div className="min-w-full"><KaTeXRenderer latex={item.latex} displayMode /></div>
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

void CalculatorIcon;
