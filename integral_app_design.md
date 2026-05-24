# HKDSE M2 Indefinite Integral WebApp Design

The new application will replace the current series-focused landing page with an indefinite integral calculator while preserving the existing **Dark Academic / Chalkboard** teaching style, bilingual Traditional Chinese and English interface, exact LaTeX rendering, and GitHub Pages-friendly hash routing.

## Scope

The calculator is intentionally limited to HKDSE M2-style indefinite integration methods. It will accept general expression input and return a supported exact antiderivative when the input matches a DSE-appropriate method. If the expression cannot be handled, the app will not invent an answer; it will return a diagnostic hint explaining which DSE method may apply or how the student can rewrite the expression.

| Area | Implementation |
|---|---|
| Input | Text expressions using `x`, with `^`, `*`, `/`, functions such as `sin(x)`, `cos(x)`, `exp(x)`, `ln(x)` or `log(x)`. |
| Output | Exact antiderivative in LaTeX with `+C`, method name, and worked steps. |
| Supported methods | Linearity, power rule, logarithmic form, exponential form, trigonometric reverse derivatives, affine-chain reverse derivatives, and selected reverse-chain patterns. |
| Unsupported handling | Preserve input, show LaTeX preview if possible, and provide hints rather than approximate or non-DSE methods. |
| Image page | Allow uploading a question image for preview, add multiple parts manually, and calculate every part separately with labelled results. |
| Deployment | Static build suitable for GitHub Pages; no server dependency for calculation. |

## Page Structure

| Section | Purpose |
|---|---|
| Calculator | Main single-integral calculator with examples and exact worked solution. |
| Formulae / Methods | Collapsible HKDSE M2 integration formula reference in LaTeX. |
| Image / Multi-part | Upload image, enter many sub-questions, and render all answers in separate cards. |

## Mathematical Policy

The engine will prefer correctness over coverage. All recognised expressions will be simplified with `mathjs` where suitable and rendered by KaTeX. For patterns beyond the implemented HKDSE M2 rules, the result will be marked unsupported with a hint such as expansion, splitting fractions, checking reverse chain rule, or using a standard formula.
