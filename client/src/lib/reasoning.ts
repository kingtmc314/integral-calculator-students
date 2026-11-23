import type { DefiniteIntegralResult, IntegralResult } from "./integralEngine";
export type Calculation = IntegralResult | DefiniteIntegralResult;
export type Scene = {
  titleZh: string;
  titleEn: string;
  thoughtZh: string;
  thoughtEn: string;
  latex: string;
  stage: number;
};
export function isDefinite(r: Calculation): r is DefiniteIntegralResult {
  return "lowerLatex" in r;
}
export function reasoningScenes(result: Calculation): Scene[] {
  const definite = isDefinite(result);
  const source = definite && result.indefinite ? result.indefinite : result;
  const method = source.method;
  let whyZh = "先看能否拆項或提出常數，再將各項配對到基本積分公式。";
  let whyEn =
    "First split sums and take out constant factors. Match each term to a basic integration rule.";
  if (/parts|cycle/.test(method)) {
    whyZh =
      "這是乘積型。選擇微分後會變簡單的部分作 u，另一部分作 dv。M2 最多使用兩次分部積分。";
    whyEn =
      "This is a product. Choose a part that becomes simpler on differentiation as u, and the other part as dv. M2 allows at most two uses of integration by parts.";
  } else if (/trigonometric substitution|quadratic/.test(method)) {
    whyZh =
      "先辨認二次式或平方差結構。完成平方後，選擇正弦或正切代換，令根號或分母可以消去。";
    whyEn =
      "Look for a quadratic or a difference of squares. Complete the square, then choose sine or tangent substitution to simplify the root or denominator.";
  } else if (/identities/.test(method)) {
    whyZh =
      "三角函數的平方或乘積不能直接套用基本公式。先用倍角或積化和差公式，轉成可以直接積分的項。";
    whyEn =
      "A trigonometric square or product is not a direct-rule form. Use double-angle or product-to-sum identities first.";
  } else if (/chain|substitution/.test(method)) {
    whyZh =
      "找出內層函數，並比較外面的因子是否是它的導數。若只差常數倍，就用代換／反鏈式法則。";
    whyEn =
      "Identify the inner function and compare its derivative with the outside factor. A constant multiple indicates a substitution or reverse-chain rule.";
  } else if (/division|expand/.test(method)) {
    whyZh =
      "先做代數整理：展開乘積，或用長除法降低分式的次數，讓每一項變成熟悉的積分型。";
    whyEn =
      "Simplify the algebra first: expand products or use polynomial long division to turn each term into a familiar form.";
  } else if (/symmetry/.test(method)) {
    whyZh =
      "上下限關於 0 對稱。先判斷函數的奇偶性，並確認區間沒有未定義點，再使用對稱性。";
    whyEn =
      "The interval is symmetric about zero. Check odd or even symmetry and ensure there are no undefined points before using it.";
  }
  const integral = definite
    ? `\\int_{${result.lowerLatex}}^{${result.upperLatex}}${result.integrandLatex}\\,d${result.variableLatex ?? "x"}`
    : `\\int ${result.integrandLatex}\\,d${result.variableLatex ?? "x"}`;
  const scenes: Scene[] = [
    {
      titleZh: "先看結構，選擇方法",
      titleEn: "Recognise the structure",
      thoughtZh: whyZh,
      thoughtEn: whyEn,
      latex: integral,
      stage: 0,
    },
  ];
  const lines =
    definite && result.indefinite
      ? [...result.indefinite.stepsLatex, ...result.stepsLatex]
      : result.stepsLatex;
  lines.forEach((latex, index) => {
    let titleZh = "沿着變形，逐步計算",
      titleEn = "Work through the transformation";
    let thoughtZh =
        "這一步只使用前一步的等式和 DSE M2 積分法則。留意係數、負號及內層函數。",
      thoughtEn =
        "Use the preceding equality and a DSE M2 integration rule. Watch the coefficient, sign and inner function.";
    let stage = 2;
    if (
      /dv=|du=|u=|\\theta.*sin|\\theta.*tan/.test(latex) &&
      !/\\int/.test(latex)
    ) {
      ((titleZh = "設定代換或分部積分"), (titleEn = "Set up the substitution"));
      thoughtZh = /dv=/.test(latex)
        ? "把 u 微分得到 du，把 dv 積分得到 v；接着使用 uv−∫v du。"
        : "同時寫出新變數及微分關係，不能只換函數而忘記 dx。";
      thoughtEn = /dv=/.test(latex)
        ? "Differentiate u to find du and integrate dv to find v. Then use uv − ∫v du."
        : "Write both the new variable and the differential relation. Do not change the function and forget dx.";
      stage = 1;
    }
    if (/sin\^|cos\^|sec\^/.test(latex) && !/\\int/.test(latex)) {
      ((titleZh = "先化成可積分的形式"),
        (titleEn = "Rewrite into an integrable form"));
      thoughtZh = "利用三角恆等式化簡。恆等式只是變形，沒有改變原來函數。";
      thoughtEn =
        "Use a trigonometric identity. This transformation preserves the original function.";
      stage = 1;
    }
    if (/F\\left|F\(/.test(latex) && definite) {
      ((titleZh = "代入上下限：上減下"),
        (titleEn = "Substitute: upper minus lower"));
      thoughtZh =
        "原函數已回到原來的積分變數，現在代入原上下限，按 F(b)−F(a) 計算；定積分不加 C。";
      thoughtEn =
        "The antiderivative is back in the original variable. Substitute the original limits as F(b) − F(a). Do not add C to a definite value.";
      stage = 3;
    }
    if (/^=/.test(latex)) {
      ((titleZh = "整理精確結果"), (titleEn = "Simplify the exact value"));
      thoughtZh =
        "保留分數、π、e、對數及根號；使用特殊角的精確值，不轉成小數。";
      thoughtEn =
        "Keep fractions, π, e, logs and radicals. Evaluate standard angles exactly, without decimals.";
      stage = 3;
    }
    scenes.push({ titleZh, titleEn, thoughtZh, thoughtEn, latex, stage });
  });
  scenes.push({
    titleZh: definite ? "完成：確認結果與區間" : "完成：加上 C，微分核對",
    titleEn: definite
      ? "Finish: check the value and interval"
      : "Finish: add C and differentiate",
    thoughtZh: definite
      ? "確認已按「上減下」計算，結果是精確值。定積分是有向累積量，並不一定等於面積。"
      : "不定積分必須包括任意常數 C。把原函數微分，應回到被積函數。",
    thoughtEn: definite
      ? "Check upper minus lower and keep the value exact. A definite integral is signed accumulation, not always area."
      : "Include the arbitrary constant C. Differentiate the antiderivative to recover the integrand.",
    latex: definite
      ? `${integral}=${result.valueLatex}`
      : `${integral}=${result.answerLatex}`,
    stage: 3,
  });
  return scenes;
}
