# HKDSE M2 integration scope

Verified against EDB's Explanatory Notes to Senior Secondary Mathematics Curriculum, Module 2, printed pages 19–23 (learning units 9 and 10).

Official source: https://www.edb.gov.hk/attachment/en/curriculum-development/kla/ma/curr/EN_M2_e.pdf

The curriculum includes algebraic, trigonometric and exponential integration, substitution, trigonometric substitutions involving sqrt(a²−x²), 1/sqrt(a²−x²), and 1/(x²+a²), and integration by parts. Integration by parts is limited to at most two times when finding an integral. The same limit applies to definite integrals.

Inverse trigonometric functions may occur as answers and their principal values are required. Integrands containing inverse trigonometric functions are not required by the curriculum. Definite-integral substitution requires corresponding changes in upper and lower limits. Returning to the original variable and then using the original limits is also valid.

For absolute-value integrands on symmetric intervals, odd/even properties are included. Finding other definite integrals with absolute-value integrands is not required. The calculator supports selected symmetric polynomial multiples of abs(x); it does not claim general absolute-value integration.

Official HKEAA formula sheet: https://www.hkeaa.edu.hk/DocLibrary/HKDSE/Subject_Information/math/M2-Formulas-E.pdf

This sheet supplies identities for the examination; the app's library is a broader learning reference and must not imply every library formula is supplied in the examination.

## Implementation policy

Unsupported means the implemented method recogniser cannot safely handle an expression. It must not automatically claim that a question is outside the syllabus. No special functions, numerical quadrature, or improper integrals are used to fill symbolic-method gaps. Exact fractions, radicals, logarithms, e and pi are preserved. Selected denominator roots and trigonometric poles are checked before applying F(b)−F(a); domain checks are safeguards, not a general formal proof for arbitrary expressions.

Methods may be composed, not restricted to a single technique per question. The entire successful derivation has a shared integration-by-parts budget of at most two uses; substitutions, changed variables, splitting terms and recursive remainder integrations do not reset it. Failed candidate routes do not consume the budget of a subsequently selected valid route. General substitutions and algebraic/trigonometric identities do not themselves count as integration by parts.

As requested for this tool, trigonometric substitutions use only a sin(theta), a cos(theta) or a tan(theta), with a>0 and an appropriate angle domain. Any introduced variables and differential relationships must be explained, and the antiderivative must return to the original variable before the original definite limits are applied. For x/(x^4+4), u=x^2 followed by u=2 tan(theta) is a valid composition requiring zero integrations by parts.
