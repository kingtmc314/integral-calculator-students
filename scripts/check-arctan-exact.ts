import { calculateIntegral, calculateDefiniteIntegral } from "../client/src/lib/integralEngine";

const indefiniteCases = ["2/(x^2+3)", "1/(x^2+3)", "5/(9+x^2)"];
for (const expression of indefiniteCases) {
  const result = calculateIntegral(expression);
  console.log(JSON.stringify({
    type: "indefinite",
    expression,
    status: result.status,
    method: result.method,
    answerLatex: result.answerLatex,
    hasDecimal: /\d+\.\d+/.test(result.answerLatex ?? ""),
  }, null, 2));
}

const definiteCases = [
  { expression: "2/(x^2+3)", lower: "0", upper: "sqrt(3)" },
  { expression: "5/(9+x^2)", lower: "0", upper: "3" },
];
for (const item of definiteCases) {
  const result = calculateDefiniteIntegral(item.expression, item.lower, item.upper);
  console.log(JSON.stringify({
    type: "definite",
    ...item,
    status: result.status,
    method: result.method,
    antiderivativeLatex: result.antiderivativeLatex,
    valueLatex: result.valueLatex,
    hasDecimal: /\d+\.\d+/.test(`${result.antiderivativeLatex ?? ""} ${result.valueLatex ?? ""}`),
  }, null, 2));
}
