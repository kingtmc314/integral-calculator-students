import { useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import StudioLayout, { PageHeading } from "@/components/StudioLayout";
import CalculationResult from "@/components/CalculationResult";
import KaTeXRenderer from "@/components/KaTeXRenderer";
import { previewIntegral } from "@/components/IntegralCalculator";
import { useLang } from "@/contexts/LangContext";
import {
  calculateDefiniteIntegral,
  calculateIntegral,
  latexOfExpression,
  type IntegralResult,
} from "@/lib/integralEngine";
import { type Calculation } from "@/lib/reasoning";
type Part = {
  id: number;
  label: string;
  expression: string;
  lower: string;
  upper: string;
  result: Calculation | null;
};
export default function MultiProblemMode() {
  const { lang } = useLang();
  const [parts, setParts] = useState<Part[]>([
    {
      id: 1,
      label: "a",
      expression: "x^2",
      lower: "",
      upper: "",
      result: null,
    },
    {
      id: 2,
      label: "b",
      expression: "sin(x)",
      lower: "0",
      upper: "pi",
      result: null,
    },
  ]);
  const [image, setImage] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(3);
  function update(
    id: number,
    field: "label" | "expression" | "lower" | "upper",
    value: string
  ) {
    setParts(old =>
      old.map(p => (p.id === id ? { ...p, [field]: value, result: null } : p))
    );
  }
  function calculate(p: Part): Part {
    if (Boolean(p.lower.trim()) !== Boolean(p.upper.trim())) {
      const error: IntegralResult = {
        input: p.expression,
        normalized: p.expression,
        status: "invalid",
        integrandLatex: latexOfExpression(p.expression),
        method: "incomplete limits",
        methodZh: "上下限未填完整",
        stepsLatex: [],
        hintZh:
          "請同時填寫下限及上限以計算定積分，或把兩格都留空以計算不定積分。",
        hintEn:
          "Enter both limits for a definite integral, or leave both blank for an indefinite integral.",
      };
      return { ...p, result: error };
    }
    return {
      ...p,
      result:
        p.lower.trim() && p.upper.trim()
          ? calculateDefiniteIntegral(p.expression, p.lower, p.upper)
          : calculateIntegral(p.expression),
    };
  }
  function calculateAll() {
    setBusy(true);
    setTimeout(() => {
      setParts(old => old.map(calculate));
      setBusy(false);
    }, 20);
  }
  const success = parts.filter(p => p.result?.status === "ok").length;
  return (
    <StudioLayout active="part4">
      <PageHeading
        number="04"
        title="多題處理模式"
        english="Multi-Problem Mode"
        symbol="∫∫"
        description={
          lang === "zh"
            ? "一組題目，各自判斷；圖片、輸入與推導集中處理。"
            : "One worksheet. Independent modes, exact answers and clear reasoning."
        }
      />
      <div className="batch-rules">
        <span>
          <CheckCircle2 size={14} />
          {lang === "zh"
            ? "上下限均留空 → 不定積分"
            : "Both limits blank → indefinite"}
        </span>
        <span>
          <CheckCircle2 size={14} />
          {lang === "zh"
            ? "上下限均填寫 → 定積分"
            : "Both limits entered → definite"}
        </span>
        <span>
          <TriangleAlert size={14} />
          {lang === "zh"
            ? "只填一格 → 請補齊或清空"
            : "Only one entered → complete or clear"}
        </span>
      </div>
      <div className="batch-layout">
        <aside className="image-reference">
          <span className="eyebrow">YOUR WORKSHEET</span>
          <h2 className="mt-3">
            {lang === "zh" ? "圖片參考" : "Image reference"}
          </h2>
          <p>
            {lang === "zh"
              ? "上載圖片作參考，再逐題輸入。圖片只在你的瀏覽器顯示，不上傳至伺服器；本版本不提供自動 OCR。"
              : "Upload a reference and type each part. Images stay in your browser; this version does not offer automatic OCR."}
          </p>
          {image && (
            <img
              src={image}
              alt={
                lang === "zh"
                  ? "已上載的題目參考"
                  : "Uploaded question reference"
              }
              className="reference-image"
            />
          )}
          <label className="image-dropzone">
            <ImagePlus size={28} />
            <span>
              {lang === "zh"
                ? image
                  ? "更換圖片"
                  : "選擇題目圖片"
                : image
                  ? "Replace image"
                  : "Choose a question image"}
            </span>
            <small>PNG / JPG / WEBP · ≤ 10 MB</small>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={
                lang === "zh" ? "上載题目圖片" : "Upload question image"
              }
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (
                  !["image/png", "image/jpeg", "image/webp"].includes(
                    file.type
                  ) ||
                  file.size > 10 * 1024 * 1024
                ) {
                  setImageError(
                    lang === "zh"
                      ? "請選擇不超過 10 MB 的 PNG、JPG 或 WEBP 圖片。"
                      : "Choose a PNG, JPG or WEBP image up to 10 MB."
                  );
                  return;
                }
                setImageError("");
                const reader = new FileReader();
                reader.onload = () => setImage(String(reader.result));
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {imageError && <p role="alert">{imageError}</p>}
          {image && (
            <button className="image-remove" onClick={() => setImage(null)}>
              <Trash2 size={12} />
              {lang === "zh" ? "移除圖片" : "Remove image"}
            </button>
          )}
        </aside>
        <section>
          <div className="batch-toolbar">
            <h2>
              {lang === "zh" ? "逐題輸入" : "Your questions"}{" "}
              <span className="muted text-xs">({parts.length})</span>
            </h2>
            <button
              className="outline-button"
              onClick={() => {
                const id = nextId.current++;
                setParts(old => [
                  ...old,
                  {
                    id,
                    label: String.fromCharCode(97 + ((id - 1) % 26)),
                    expression: "",
                    lower: "",
                    upper: "",
                    result: null,
                  },
                ]);
              }}
            >
              <Plus size={14} />
              {lang === "zh" ? "新增題目" : "Add a part"}
            </button>
          </div>
          <div className="batch-parts">
            {parts.map(p => {
              const incomplete =
                Boolean(p.lower.trim()) !== Boolean(p.upper.trim());
              const definite =
                Boolean(p.lower.trim()) && Boolean(p.upper.trim());
              return (
                <article className="batch-part" key={p.id}>
                  <div className="part-header">
                    <label className="part-label">
                      PART{" "}
                      <input
                        value={p.label}
                        maxLength={8}
                        aria-label={lang === "zh" ? "題號" : "Part label"}
                        onChange={e => update(p.id, "label", e.target.value)}
                      />
                    </label>
                    <span
                      className={`mode-badge ${incomplete ? "incomplete" : ""}`}
                    >
                      {lang === "zh"
                        ? incomplete
                          ? "上下限未完整"
                          : definite
                            ? "定積分"
                            : "不定積分"
                        : incomplete
                          ? "Incomplete limits"
                          : definite
                            ? "Definite"
                            : "Indefinite"}
                    </span>
                    <button
                      className="icon-button"
                      disabled={parts.length === 1}
                      aria-label={`${lang === "zh" ? "移除題目" : "Remove part"} ${p.label}`}
                      onClick={() =>
                        setParts(old => old.filter(item => item.id !== p.id))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <label>
                    <span className="field-label">
                      {lang === "zh" ? "被積函數" : "Integrand"}
                    </span>
                    <input
                      className="math-input"
                      value={p.expression}
                      onChange={e => update(p.id, "expression", e.target.value)}
                      placeholder="e.g. x*sin(x)"
                      spellCheck={false}
                    />
                  </label>
                  <div className="limits-grid">
                    <label>
                      <span className="field-label">
                        {lang === "zh"
                          ? "下限（可留空）"
                          : "Lower limit (optional)"}
                      </span>
                      <input
                        className="math-input"
                        value={p.lower}
                        onChange={e => update(p.id, "lower", e.target.value)}
                        placeholder={
                          lang === "zh"
                            ? "留空＝不定積分"
                            : "blank = indefinite"
                        }
                      />
                    </label>
                    <label>
                      <span className="field-label">
                        {lang === "zh"
                          ? "上限（可留空）"
                          : "Upper limit (optional)"}
                      </span>
                      <input
                        className="math-input"
                        value={p.upper}
                        onChange={e => update(p.id, "upper", e.target.value)}
                        placeholder={
                          lang === "zh"
                            ? "留空＝不定積分"
                            : "blank = indefinite"
                        }
                      />
                    </label>
                  </div>
                  <div className="question-preview">
                    <KaTeXRenderer
                      latex={previewIntegral(
                        p.expression,
                        definite ? p.lower : undefined,
                        definite ? p.upper : undefined
                      )}
                      displayMode
                    />
                  </div>
                  <button
                    className="primary-button"
                    onClick={() =>
                      setParts(old =>
                        old.map(item =>
                          item.id === p.id ? calculate(item) : item
                        )
                      )
                    }
                  >
                    {lang === "zh" ? "計算此題" : "Calculate this part"}
                    <ArrowRight size={13} />
                  </button>
                  {p.result ? (
                    <div className="mt-5">
                      <CalculationResult
                        result={p.result}
                        collapsibleReasoning
                      />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
          <button
            className="primary-button batch-calculate"
            onClick={calculateAll}
            disabled={busy}
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {lang === "zh" ? "計算全部題目" : "Calculate all parts"}
            <ArrowRight size={15} />
          </button>
          {parts.some(p => p.result) && (
            <p className="batch-summary" role="status">
              {lang === "zh"
                ? `已完成 ${success} / ${parts.length} 題；其餘題目請查看提示。`
                : `${success} of ${parts.length} parts solved. Check hints for the others.`}
            </p>
          )}
        </section>
      </div>
    </StudioLayout>
  );
}
