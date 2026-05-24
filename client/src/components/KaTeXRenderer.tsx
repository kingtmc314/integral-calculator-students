// ============================================================
// KaTeXRenderer — renders LaTeX strings using KaTeX
// Design: Dark Academic / Chalkboard
// ============================================================
import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

interface Props {
  latex: string;
  displayMode?: boolean;
  className?: string;
  errorColor?: string;
}

export default function KaTeXRenderer({
  latex,
  displayMode = false,
  className = "",
  errorColor = "#ff6b6b",
}: Props) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        errorColor,
        trust: false,
        strict: false,
        macros: {
          "\\text": "\\textrm",
        },
      });
    } catch {
      return `<span style="color:${errorColor}">${latex}</span>`;
    }
  }, [latex, displayMode, errorColor]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
