import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import StudioLayout, { PageHeading } from "@/components/StudioLayout";
import KaTeXRenderer from "@/components/KaTeXRenderer";
import { useLang } from "@/contexts/LangContext";
import { FORMULAE } from "@/lib/formulaData";
const EXTRA = [
  {
    categoryEn: "Exponential and trigonometric rules",
    categoryZh: "指數及三角公式",
    titleEn: "Double-angle identities",
    titleZh: "倍角與降次",
    latex: "\\sin^2u=\\frac{1-\\cos2u}{2},\\quad\\cos^2u=\\frac{1+\\cos2u}{2}",
    noteEn:
      "Rewrite a trigonometric square before integrating. The calculator supports sine and cosine powers 2, 3 and 4.",
    noteZh:
      "先把三角平方降次，再直接積分。計算器支援 sin／cos 的 2、3、4 次方。",
  },
  {
    categoryEn: "Exponential and trigonometric rules",
    categoryZh: "指數及三角公式",
    titleEn: "Product-to-sum",
    titleZh: "積化和差",
    latex: "\\sin A\\cos B=\\tfrac12[\\sin(A+B)+\\sin(A-B)]",
    noteEn:
      "Use a product-to-sum identity for products of sine and cosine with affine arguments.",
    noteZh: "對一次式內層的正弦、餘弦乘積，可先用積化和差。",
  },
  {
    categoryEn: "Rational functions and substitutions",
    categoryZh: "有理函數及代換",
    titleEn: "Complete the square",
    titleZh: "完成平方",
    latex:
      "ax^2+bx+c=a\\left[\\left(x+\\frac{b}{2a}\\right)^2+\\frac{c}{a}-\\frac{b^2}{4a^2}\\right]",
    noteEn:
      "A shifted quadratic can be reduced to a standard arctangent, logarithmic or power form.",
    noteZh: "帶一次項的二次分母可先完成平方，再化為反正切、對數或冪次型。",
  },
  {
    categoryEn: "Rational functions and substitutions",
    categoryZh: "有理函數及代換",
    titleEn: "Partial fractions: difference of squares",
    titleZh: "平方差的部分分式",
    latex:
      "\\frac{1}{u^2-a^2}=\\frac{1}{2a}\\left(\\frac1{u-a}-\\frac1{u+a}\\right)",
    noteEn:
      "Algebraic decomposition gives two logarithmic integrals. Check that the interval does not cross a pole.",
    noteZh: "代數分拆後變成兩個對數積分。定積分區間不可跨越分母為零的點。",
  },
  {
    categoryEn: "Definite integrals",
    categoryZh: "定積分",
    titleEn: "Odd and even symmetry",
    titleZh: "奇偶對稱性",
    latex:
      "\\int_{-a}^a f_{\\mathrm{odd}}(x)\\,dx=0,\\quad\\int_{-a}^a f_{\\mathrm{even}}(x)\\,dx=2\\int_0^a f_{\\mathrm{even}}(x)\\,dx",
    noteEn:
      "Check the domain before applying symmetry. Supported absolute-value examples include abs(x), x*abs(x), and polynomial multiples on symmetric intervals.",
    noteZh:
      "使用對稱性前先檢查定義域。對稱區間支援 abs(x)、x*abs(x) 及其多項式倍數等例子。",
  },
  {
    categoryEn: "Definite integrals",
    categoryZh: "定積分",
    titleEn: "Change the substitution limits",
    titleZh: "代換時更改上下限",
    latex:
      "u=g(x):\\quad\\int_a^b f(g(x))g'(x)\\,dx=\\int_{g(a)}^{g(b)}f(u)\\,du",
    noteEn:
      "If you integrate in u, use u-limits. This calculator returns to the original variable before substituting the original limits.",
    noteZh:
      "若以 u 積分，就要用 u 的上下限。本計算器會先代回原變數，才代入原上下限。",
  },
];
const ALL = [...FORMULAE, ...EXTRA];
const GROUPS = [
  ["Input conventions", "輸入約定", "輸入", "Input"],
  ["Basic indefinite rules", "不定積分基本公式", "基本", "Basic"],
  [
    "Exponential and trigonometric rules",
    "指數及三角公式",
    "三角／指數",
    "Trig / exp",
  ],
  [
    "Rational functions and substitutions",
    "有理函數及代換",
    "代換",
    "Substitution",
  ],
  [
    "Integration by parts and mixed methods",
    "分部積分及混合技巧",
    "分部",
    "By parts",
  ],
  ["Definite integrals", "定積分", "定積分", "Definite"],
  ["Multi-problem mode", "多題處理模式", "多題", "Multi-part"],
];
export default function ReferenceFormulae() {
  const { lang } = useLang();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const filtered = ALL.filter(
    f =>
      (category === "all" || f.categoryEn === category) &&
      [f.titleEn, f.titleZh, f.noteEn, f.noteZh, f.latex]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
  );
  return (
    <StudioLayout active="formulae">
      <PageHeading
        number="03"
        title="公式整理"
        english="Formula library"
        symbol="ƒ"
        description={
          lang === "zh"
            ? "公式、方法與輸入規則，都在這裏。先辨認，再計算。"
            : "Your formulae, methods and notation. Recognise first, then calculate."
        }
      />
      <div className="library-controls">
        <label className="search-box">
          <Search size={15} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={
              lang === "zh"
                ? "搜尋公式、方法或關鍵字…"
                : "Search a formula, method or keyword…"
            }
            aria-label={lang === "zh" ? "搜尋公式" : "Search formulae"}
          />
        </label>
        <span className="muted text-xs">
          {filtered.length} {lang === "zh" ? "項參考" : "references"}
        </span>
      </div>
      <div className="category-filter">
        <button
          className={category === "all" ? "active" : ""}
          onClick={() => setCategory("all")}
        >
          {lang === "zh" ? "全部" : "All"}
        </button>
        {GROUPS.map(g => (
          <button
            key={g[0]}
            className={category === g[0] ? "active" : ""}
            onClick={() => setCategory(g[0])}
          >
            {lang === "zh" ? g[2] : g[3]}
          </button>
        ))}
      </div>
      <section className="curriculum-card">
        <div className="flex items-center justify-between gap-3">
          <h2>
            {lang === "zh"
              ? "以 DSE M2 課程為界。"
              : "Within the DSE M2 curriculum."}
          </h2>
          <span className="scope-chip">M2 · 9–10</span>
        </div>
        <div className="scope-columns">
          <div>
            <strong>
              {lang === "zh" ? "課程內的方法" : "Curriculum methods"}
            </strong>
            <p>
              {lang === "zh"
                ? "代數、三角及指數積分，代換、指定三角代換、分部積分與定積分的性質。分部積分最多使用兩次。"
                : "Algebraic, trigonometric and exponential integration; substitution, specified trigonometric substitutions, integration by parts, and definite-integral properties. By parts is limited to two uses."}
            </p>
          </div>
          <div>
            <strong>{lang === "zh" ? "明確的限制" : "Clear boundaries"}</strong>
            <p>
              {lang === "zh"
                ? "含反三角函數的被積函數並非必須課程內容；瑕積分不在本工具範圍內。不能計算的題目會給提示，不會直接當作超綱。絕對值題型僅限已支援的對稱區間模式。"
                : "Inverse-trig integrands are not required by the curriculum. Improper integrals are outside this tool. Unsupported does not automatically mean outside the syllabus. Absolute-value problems are limited to supported symmetric-interval patterns."}
            </p>
          </div>
        </div>
        <a
          href="https://www.edb.gov.hk/attachment/en/curriculum-development/kla/ma/curr/EN_M2_e.pdf"
          target="_blank"
          rel="noreferrer"
        >
          {lang === "zh"
            ? "教育局 M2 課程解說（第 19–23 頁）"
            : "EDB M2 curriculum notes, pp. 19–23"}
          <ArrowUpRight size={12} />
        </a>
        <a
          href="https://www.hkeaa.edu.hk/DocLibrary/HKDSE/Subject_Information/math/M2-Formulas-E.pdf"
          target="_blank"
          rel="noreferrer"
        >
          {lang === "zh" ? "考評局 M2 提供公式表" : "HKEAA M2 formula sheet"}
          <ArrowUpRight size={12} />
        </a>
      </section>
      {GROUPS.map((g, index) => {
        const items = filtered.filter(f => f.categoryEn === g[0]);
        return items.length ? (
          <section className="library-section" key={g[0]}>
            <div className="library-section-title">
              <span>0{index + 1}</span>
              <h2>{lang === "zh" ? g[1] : g[0]}</h2>
              <i>
                {items.length} {lang === "zh" ? "項" : "items"}
              </i>
            </div>
            <div className="formula-grid">
              {items.map(item => (
                <article className="formula-card" key={item.titleEn}>
                  <h3>{lang === "zh" ? item.titleZh : item.titleEn}</h3>
                  <div className="formula-box">
                    <KaTeXRenderer latex={item.latex} displayMode />
                  </div>
                  <p>{lang === "zh" ? item.noteZh : item.noteEn}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null;
      })}
      {!filtered.length && (
        <div className="error-result">
          <h2>{lang === "zh" ? "找不到相符公式。" : "No matching formula."}</h2>
          <p>
            {lang === "zh"
              ? "試試「代換」、「sin」或「分部」。"
              : "Try “substitution”, “sin” or “by parts”."}
          </p>
        </div>
      )}
    </StudioLayout>
  );
}
