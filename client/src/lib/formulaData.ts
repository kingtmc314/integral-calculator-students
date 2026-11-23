type FormulaItem = {
  categoryEn: string;
  categoryZh: string;
  titleEn: string;
  titleZh: string;
  latex: string;
  noteEn: string;
  noteZh: string;
};

export const FORMULAE: FormulaItem[] = [
  {
    categoryEn: "Input conventions",
    categoryZh: "輸入約定",
    titleEn: "Variable and notation",
    titleZh: "變數與記號",
    latex: "x,t,y,\\alpha,\\beta,\\theta,\\phi",
    noteEn:
      "Use one integration variable in each expression. Multiplication should be written with * and powers with ^ in the input box.",
    noteZh: "每條式子使用一個積分變數。輸入時乘法請用 *，冪次請用 ^。",
  },
  {
    categoryEn: "Input conventions",
    categoryZh: "輸入約定",
    titleEn: "Natural and common logarithms",
    titleZh: "自然對數與常用對數",
    latex: "\\ln u=\\log_e u,\\qquad \\log u=\\log_{10}u",
    noteEn:
      "In this app, ln means natural logarithm and bare log means common logarithm base 10.",
    noteZh: "本工具中，ln 表示自然對數；沒有寫底的 log 表示常用對數底 10。",
  },
  {
    categoryEn: "Input conventions",
    categoryZh: "輸入約定",
    titleEn: "Change of base",
    titleZh: "換底公式",
    latex:
      "\\log_a u=\\frac{\\ln u}{\\ln a},\\qquad \\log u=\\frac{\\ln u}{\\ln 10}",
    noteEn:
      "Use log(u,a) for a fixed base a. The calculator rewrites fixed-base logarithms by change of base.",
    noteZh: "可用 log(u,a) 輸入固定底數 a 的對數；計算器會以換底處理。",
  },
  {
    categoryEn: "Input conventions",
    categoryZh: "輸入約定",
    titleEn: "Function-power placement",
    titleZh: "函數次方擺位",
    latex: "\\sec^2 u=(\\sec u)^2,\\qquad \\sec(u^2)",
    noteEn:
      "Write sec(x)^2 for (sec x)^2. Writing sec(x^2) means the secant function is applied to x².",
    noteZh: "請寫 sec(x)^2 表示 (sec x)^2；sec(x^2) 表示把 x² 放入 sec 函數。",
  },

  {
    categoryEn: "Basic indefinite rules",
    categoryZh: "不定積分基本公式",
    titleEn: "Constant multiple and linearity",
    titleZh: "常數倍與線性性質",
    latex: "\\int [af(u)+bg(u)]\\,du=a\\int f(u)\\,du+b\\int g(u)\\,du",
    noteEn:
      "Split sums and constant multiples before choosing a special technique.",
    noteZh: "先拆開加減項及提出常數倍，再判斷是否需要其他技巧。",
  },
  {
    categoryEn: "Basic indefinite rules",
    categoryZh: "不定積分基本公式",
    titleEn: "Power rule",
    titleZh: "冪次法則",
    latex: "\\int u^n\\,du=\\frac{u^{n+1}}{n+1}+C,\\quad n\\ne -1",
    noteEn:
      "Use directly when the derivative of the inner expression differs only by a constant factor.",
    noteZh: "若內層式子的導數只差常數倍，可直接使用。",
  },
  {
    categoryEn: "Basic indefinite rules",
    categoryZh: "不定積分基本公式",
    titleEn: "Logarithmic integral",
    titleZh: "對數積分",
    latex: "\\int \\frac{1}{au+b}\\,du=\\frac{1}{a}\\ln|au+b|+C",
    noteEn: "This is the standard affine logarithmic form.",
    noteZh: "這是一次式分母的標準對數型。",
  },
  {
    categoryEn: "Basic indefinite rules",
    categoryZh: "不定積分基本公式",
    titleEn: "Reverse-chain logarithmic form",
    titleZh: "對數型反鏈式法則",
    latex: "\\int \\frac{f'(u)}{f(u)}\\,du=\\ln|f(u)|+C",
    noteEn:
      "Use when the numerator is the derivative of the denominator up to a constant factor.",
    noteZh: "當分子是分母的導數，只差常數倍時使用。",
  },
  {
    categoryEn: "Basic indefinite rules",
    categoryZh: "不定積分基本公式",
    titleEn: "Reverse-chain power form",
    titleZh: "冪次型反鏈式法則",
    latex:
      "\\int f'(u)[f(u)]^n\\,du=\\frac{[f(u)]^{n+1}}{n+1}+C,\\quad n\\ne -1",
    noteEn:
      "This covers many substitution-style M2 questions without requiring manual substitution input.",
    noteZh: "這涵蓋不少 M2 代換型題目，學生毋須手動輸入代換變數。",
  },

  {
    categoryEn: "Exponential and trigonometric rules",
    categoryZh: "指數及三角公式",
    titleEn: "Exponential with base e",
    titleZh: "自然指數",
    latex: "\\int e^{au+b}\\,du=\\frac{1}{a}e^{au+b}+C",
    noteEn: "The coefficient a must be non-zero.",
    noteZh: "其中 a 必須不等於 0。",
  },
  {
    categoryEn: "Exponential and trigonometric rules",
    categoryZh: "指數及三角公式",
    titleEn: "General exponential",
    titleZh: "一般指數",
    latex:
      "a^{ku+b}=e^{(ku+b)\\ln a},\\qquad \\int a^{ku+b}\\,du=\\frac{a^{ku+b}}{k\\ln a}+C",
    noteEn: "For a positive fixed base a not equal to 1.",
    noteZh: "適用於正固定底數 a，且 a 不等於 1。",
  },
  {
    categoryEn: "Exponential and trigonometric rules",
    categoryZh: "指數及三角公式",
    titleEn: "Sine",
    titleZh: "正弦",
    latex: "\\int \\sin(au+b)\\,du=-\\frac{1}{a}\\cos(au+b)+C",
    noteEn: "Affine inner expressions are supported.",
    noteZh: "支援一次式作為內層函數。",
  },
  {
    categoryEn: "Exponential and trigonometric rules",
    categoryZh: "指數及三角公式",
    titleEn: "Cosine",
    titleZh: "餘弦",
    latex: "\\int \\cos(au+b)\\,du=\\frac{1}{a}\\sin(au+b)+C",
    noteEn: "Affine inner expressions are supported.",
    noteZh: "支援一次式作為內層函數。",
  },
  {
    categoryEn: "Exponential and trigonometric rules",
    categoryZh: "指數及三角公式",
    titleEn: "Secant squared",
    titleZh: "正割平方",
    latex: "\\int \\sec^2(au+b)\\,du=\\frac{1}{a}\\tan(au+b)+C",
    noteEn: "Use sec(x)^2 in the input box.",
    noteZh: "輸入時請使用 sec(x)^2。",
  },
  {
    categoryEn: "Exponential and trigonometric rules",
    categoryZh: "指數及三角公式",
    titleEn: "Tangent-related logarithmic form",
    titleZh: "正切相關對數型",
    latex: "\\int \\tan u\\,du=-\\ln|\\cos u|+C",
    noteEn:
      "Supported when it can be reduced to a standard reverse-chain form.",
    noteZh: "當題目可化為標準反鏈式形式時支援。",
  },

  {
    categoryEn: "Rational functions and substitutions",
    categoryZh: "有理函數及代換",
    titleEn: "Rational long division",
    titleZh: "有理函數長除法",
    latex: "\\frac{P(u)}{Q(u)}=S(u)+\\frac{R(u)}{Q(u)},\\quad \\deg R<\\deg Q",
    noteEn: "Use before integrating improper rational functions.",
    noteZh: "處理假分式有理函數時，先做多項式長除法。",
  },
  {
    categoryEn: "Rational functions and substitutions",
    categoryZh: "有理函數及代換",
    titleEn: "Arctangent rational form",
    titleZh: "反正切有理函數型",
    latex:
      "\\int \\frac{A}{u^2+a^2}\\,du=\\frac{A}{a}\\tan^{-1}\\left(\\frac{u}{a}\\right)+C,\\quad a>0",
    noteEn:
      "This includes exact forms such as 2/(x^2+3), keeping radicals exact.",
    noteZh: "例如 2/(x^2+3) 會保留根號的精確反正切答案。",
  },
  {
    categoryEn: "Rational functions and substitutions",
    categoryZh: "有理函數及代換",
    titleEn: "Trigonometric substitution: difference of squares",
    titleZh: "三角代換：平方差",
    latex: "\\sqrt{a^2-u^2}:\\quad u=a\\sin\\theta",
    noteEn:
      "Use the HKDSE M2 substitution form when the expression matches the standard pattern.",
    noteZh: "當式子符合標準型時，使用 HKDSE M2 的三角代換形式。",
  },
  {
    categoryEn: "Rational functions and substitutions",
    categoryZh: "有理函數及代換",
    titleEn: "Trigonometric substitution: sum of squares",
    titleZh: "三角代換：平方和",
    latex: "a^2+u^2:\\quad u=a\\tan\\theta",
    noteEn: "The calculator keeps the final result in exact symbolic form.",
    noteZh: "計算器會以精確符號形式保留答案。",
  },

  {
    categoryEn: "Integration by parts and mixed methods",
    categoryZh: "分部積分及混合技巧",
    titleEn: "Integration by parts",
    titleZh: "分部積分",
    latex: "\\int p(u)q'(u)\\,du=p(u)q(u)-\\int q(u)p'(u)\\,du",
    noteEn:
      "Useful for products such as x sin x, x e^x, and polynomial-logarithm products.",
    noteZh: "常用於 x sin x、x e^x 及多項式乘對數等乘積。",
  },
  {
    categoryEn: "Integration by parts and mixed methods",
    categoryZh: "分部積分及混合技巧",
    titleEn: "Repeated integration by parts",
    titleZh: "兩次分部積分",
    latex: "I=\\int e^u\\sin u\\,du\\Rightarrow 2I=e^u(\\sin u-\\cos u)",
    noteEn:
      "Cyclic by-parts problems are simplified algebraically after the repeated step.",
    noteZh: "循環式分部積分會在重複步驟後以代數方式整理。",
  },
  {
    categoryEn: "Integration by parts and mixed methods",
    categoryZh: "分部積分及混合技巧",
    titleEn: "Mixed substitutions",
    titleZh: "混合代換",
    latex: "\\sin(\\ln u),\\quad \\cos(\\sqrt{u})\\Rightarrow u=f(x)",
    noteEn:
      "For composed functions, substitute only when the transformed expression becomes a supported M2 standard form.",
    noteZh: "複合函數只在代換後化成已支援 M2 標準型時才使用代換。",
  },
  {
    categoryEn: "Integration by parts and mixed methods",
    categoryZh: "分部積分及混合技巧",
    titleEn: "Substitution followed by trigonometric substitution",
    titleZh: "一般代換後再作三角代換",
    latex:
      "\\int\\frac{x}{x^4+4}\\,dx=\\frac14\\tan^{-1}\\!\\left(\\frac{x^2}{2}\\right)+C",
    noteEn:
      "First set u=x², du=2x dx; then set u=2 tan θ. u is the new variable and θ the introduced angle. This route uses no integration by parts.",
    noteZh:
      "先令 u=x²、du=2x dx，再令 u=2 tan θ。u 是新變數，θ 是引入的角；這條路線毋須分部積分。",
  },
  {
    categoryEn: "Integration by parts and mixed methods",
    categoryZh: "分部積分及混合技巧",
    titleEn: "Method-selection principle",
    titleZh: "方法選擇原則",
    latex: "\\int f(x)\\,dx",
    noteEn:
      "Combine supported M2 methods as the structure requires, rather than choosing only one. Count integration by parts across the whole derivation, including substituted and split integrals: at most two uses. Prefer a simpler valid route when no by-parts step is needed.",
    noteZh:
      "可按結構組合已支援的 M2 方法，不限只選一種。代換及拆項後仍共用整條推導的分部積分預算，累計最多兩次；毋須分部時，優先使用較簡單的合法路線。",
  },

  {
    categoryEn: "Definite integrals",
    categoryZh: "定積分",
    titleEn: "Newton–Leibniz formula",
    titleZh: "牛頓—萊布尼茲公式",
    latex: "\\int_a^b f(u)\\,du=F(b)-F(a),\\quad F'(u)=f(u)",
    noteEn:
      "The definite-integral calculator first finds an antiderivative and then substitutes the limits exactly.",
    noteZh: "定積分計算器會先求原函數，再精確代入上下限。",
  },
  {
    categoryEn: "Definite integrals",
    categoryZh: "定積分",
    titleEn: "Reversed limits",
    titleZh: "上下限互換",
    latex: "\\int_a^b f(u)\\,du=-\\int_b^a f(u)\\,du",
    noteEn: "This follows automatically from F(b) − F(a).",
    noteZh: "這會由 F(b)−F(a) 自動反映。",
  },
  {
    categoryEn: "Definite integrals",
    categoryZh: "定積分",
    titleEn: "Zero-width interval",
    titleZh: "相同上下限",
    latex: "\\int_a^a f(u)\\,du=0",
    noteEn: "If both limits are the same, the exact value is zero.",
    noteZh: "若上下限相同，定積分值為零。",
  },
  {
    categoryEn: "Definite integrals",
    categoryZh: "定積分",
    titleEn: "Exact-value policy",
    titleZh: "精確值原則",
    latex: "\\pi,\\quad e,\\quad \\sqrt{2},\\quad \\ln 2",
    noteEn:
      "Constants such as π, e and radicals are preserved symbolically whenever supported.",
    noteZh: "支援的 π、e 及根號等常數會以符號形式保留，不以小數近似取代。",
  },

  {
    categoryEn: "Multi-problem mode",
    categoryZh: "多題處理模式",
    titleEn: "Indefinite by default",
    titleZh: "預設為不定積分",
    latex: "\\int f(u)\\,du",
    noteEn:
      "In Multi-Problem Mode, leave both lower and upper limits blank to calculate an indefinite integral.",
    noteZh: "在多題處理模式中，若上下限均留空，該題會按不定積分計算。",
  },
  {
    categoryEn: "Multi-problem mode",
    categoryZh: "多題處理模式",
    titleEn: "Definite when both limits are entered",
    titleZh: "輸入上下限即為定積分",
    latex: "\\int_a^b f(u)\\,du",
    noteEn:
      "Fill in both limits for a part to calculate a definite integral. Each part can independently be definite or indefinite.",
    noteZh:
      "每個 part 如同時輸入下限與上限，便會按定積分計算；不同 part 可各自是不定或定積分。",
  },
];
