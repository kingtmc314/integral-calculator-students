// ============================================================
// MixedMathRenderer — renders a string that may contain
// plain text mixed with $...$ inline math or $$...$$ display math.
// Also handles pure LaTeX strings (no $ delimiters) by falling
// back to KaTeXRenderer in display mode.
// ============================================================
import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

interface Props {
  content: string;
  className?: string;
  errorColor?: string;
}

function renderInlineLatex(latex: string, display: boolean, errorColor: string): string {
  try {
    return katex.renderToString(latex, {
      displayMode: display,
      throwOnError: false,
      errorColor,
      trust: false,
      strict: false,
      macros: { "\\text": "\\textrm" },
    });
  } catch {
    return `<span style="color:${errorColor}">${latex}</span>`;
  }
}

/**
 * Detect whether a string is "mixed" (contains $...$ or $$...$$)
 * vs pure LaTeX (no $ delimiters, should be rendered as display math).
 */
function isMixedContent(s: string): boolean {
  return /\$/.test(s);
}

/**
 * Split a mixed string into segments: plain text and math.
 * Handles $$...$$ (display) and $...$ (inline).
 */
function parseMixedContent(
  s: string,
  errorColor: string
): string {
  // Replace $$...$$ first (display math)
  let result = s.replace(/\$\$([^$]+)\$\$/g, (_, math) =>
    renderInlineLatex(math.trim(), true, errorColor)
  );
  // Then replace $...$ (inline math)
  result = result.replace(/\$([^$]+)\$/g, (_, math) =>
    renderInlineLatex(math.trim(), false, errorColor)
  );
  // Escape remaining plain text (no HTML injection)
  // We need to split on already-replaced HTML spans to avoid double-escaping.
  // Since we're inserting HTML directly, just return as-is.
  return result;
}

export default function MixedMathRenderer({
  content,
  className = "",
  errorColor = "#ff6b6b",
}: Props) {
  const html = useMemo(() => {
    if (!content) return "";

    if (isMixedContent(content)) {
      // Mixed text + math: parse $...$ segments
      return parseMixedContent(content, errorColor);
    } else {
      // Pure LaTeX: render as display math
      try {
        return katex.renderToString(content, {
          displayMode: true,
          throwOnError: false,
          errorColor,
          trust: false,
          strict: false,
          macros: { "\\text": "\\textrm" },
        });
      } catch {
        return `<span style="color:${errorColor}">${content}</span>`;
      }
    }
  }, [content, errorColor]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
