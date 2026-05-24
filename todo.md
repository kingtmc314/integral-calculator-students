# Series Calculator — Project TODO

## Core Features
- [x] Part 1: Closed-form derivation via LLM backend (tRPC series.compute)
- [x] Part 2: Mathematical induction proof via LLM backend (tRPC series.induction)
- [x] Part 3: Numeric evaluation via LLM backend (tRPC series.evaluate)
- [x] Bilingual support (EN/ZH) passed through to LLM prompts
- [x] Dark Academic / Chalkboard design theme
- [x] KaTeX rendering for all LaTeX output
- [x] Formula reference panel
- [x] Example series quick-fill buttons
- [x] Copy term from Part 1 to Part 3
- [x] Responsive mobile-first layout

## Backend / Infrastructure
- [x] tRPC server with seriesRouter (compute, induction, evaluate)
- [x] LLM integration via invokeLLM helper
- [x] TypeScript type safety for LLM response content
- [x] Vitest tests for series.compute and series.evaluate

## Bug Fixes
- [x] Fix fractions and index expressions (e.g. 1/(r*(r+1)), 2^r) — now handled by LLM (no mathjs limitations)
- [x] Fix __dirname not defined in vite.config.ts (ES module scope)
- [x] Install missing tRPC/tanstack packages
- [x] Fix LLM response content type (string | array union)

## Bug Fixes (Round 2)
- [x] Fix sample values computed by LLM (were wrong for partial fractions) — now computed by mathjs server-side
- [x] Fix mathjs scope-based evaluation (^ operator support for r^2, 2^r, etc.)
- [x] Fix evaluate procedure to use mathjs for numeric result (not LLM)
- [x] Strengthen LLM prompts for simplification and correctness
- [x] All 11 vitest tests passing

## Bug Fixes (Round 3)
- [x] Fix verifyFormula: move upper-bound check outside loop (was skipping verification for standard series)
- [x] Fix latexToMathjs: pre-strip \left and \right before \frac processing (fixes evalClosedForm null for \left( forms)
- [x] Fix retry: accept retry result even if verification is inconclusive (correct but non-factorable forms)
- [x] All 11 vitest tests passing, no false-positive retries for standard series

## Pending
- [x] GitHub code pushed to kingtmc314/series-calculator-students (main branch, force-push)

## Bug Fixes (Round 4)
- [x] Part 2: Rewrite induction prompt to follow HKDSE M2 marking scheme (L.H.S./R.H.S., P(k) assumption, P(k+1) goal)
- [x] Part 3: Add split-sum algorithm S(a,b) = F(b) - F(a-1) for limits differing from Part 1
- [x] Part 3: Pass part1Lower/part1Upper from Home.tsx to Part3Numeric and evaluate procedure
- [x] Part 3: Method badge shows 'Split-sum' / 'Closed-form' / 'Direct summation' correctly
- [x] seriesTypes.ts: Add method field to NumericResult
- [x] i18n.ts: Update Part 3 description to mention split-sum identity
- [x] All 12 vitest tests passing
- [x] Live test: S(3,10) for r = 52, S(5,20) for r^2 = 2840 (both correct)

## Bug Fixes (Round 5)
- [x] Fix raw LaTeX text displayed in Part 3 working steps (was showing \displaystyle prose instead of rendered math)
- [x] Create MixedMathRenderer component that handles both pure LaTeX and mixed $...$ text
- [x] Apply MixedMathRenderer to Part 3 step lines and Part 2 induction working lines + conclusion
- [x] Update LLM prompts to enforce pure LaTeX in stepsLatex and inductiveStepWorkingLines (no prose)
- [x] TypeScript: no errors; all 12 vitest tests passing
