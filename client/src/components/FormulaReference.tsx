// ============================================================
// FormulaReference — collapsible reference panel of standard series identities
// Design: Dark Academic / Chalkboard
// ============================================================
import { useState } from "react";
import { useLang } from "@/contexts/LangContext";
import KaTeXRenderer from "./KaTeXRenderer";
import { BookMarked, ChevronDown, ChevronUp } from "lucide-react";

interface Formula {
  labelEn: string;
  labelZh: string;
  latex: string;
}

const FORMULAS: Formula[] = [
  {
    labelEn: "Sum of first n positive integers",
    labelZh: "前 n 個正整數之和",
    latex: "\\sum_{r=1}^{n} r = \\frac{n(n+1)}{2}",
  },
  {
    labelEn: "Sum of squares",
    labelZh: "平方和",
    latex: "\\sum_{r=1}^{n} r^2 = \\frac{n(n+1)(2n+1)}{6}",
  },
  {
    labelEn: "Sum of cubes",
    labelZh: "立方和",
    latex: "\\sum_{r=1}^{n} r^3 = \\frac{n^2(n+1)^2}{4}",
  },
  {
    labelEn: "Sum of r(r+1)",
    labelZh: "r(r+1) 之和",
    latex: "\\sum_{r=1}^{n} r(r+1) = \\frac{n(n+1)(n+2)}{3}",
  },
  {
    labelEn: "Sum of r(r+1)(r+2)",
    labelZh: "r(r+1)(r+2) 之和",
    latex: "\\sum_{r=1}^{n} r(r+1)(r+2) = \\frac{n(n+1)(n+2)(n+3)}{4}",
  },
  {
    labelEn: "Geometric series (|a| ≠ 1)",
    labelZh: "等比級數（|a| ≠ 1）",
    latex: "\\sum_{r=0}^{n-1} a^r = \\frac{a^n - 1}{a - 1}",
  },
  {
    labelEn: "Telescoping: 1/r(r+1)",
    labelZh: "望遠鏡式：1/r(r+1)",
    latex: "\\sum_{r=1}^{n} \\frac{1}{r(r+1)} = \\frac{n}{n+1}",
  },
  {
    labelEn: "Odd numbers",
    labelZh: "奇數之和",
    latex: "\\sum_{r=1}^{n} (2r-1) = n^2",
  },
];

export default function FormulaReference() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#252D3D] rounded-xl border border-white/8 overflow-hidden mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BookMarked className="w-4 h-4 text-[#D4A843]" />
          <span className="text-[#E8DFC8] font-semibold text-sm">
            {lang === "en" ? "Standard Series Identities" : "標準級數公式"}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-[#E8DFC8]/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[#E8DFC8]/40" />
        )}
      </button>

      {open && (
        <div className="border-t border-white/6 px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FORMULAS.map((f, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-[#1E2433] border border-white/6 hover:border-[#D4A843]/20 transition-colors"
              >
                <div className="text-[#D4A843]/70 text-xs mb-2 font-medium">
                  {lang === "en" ? f.labelEn : f.labelZh}
                </div>
                <div className="overflow-x-auto">
                  <KaTeXRenderer
                    latex={`\\displaystyle ${f.latex}`}
                    displayMode
                    className="text-[#E8DFC8]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
