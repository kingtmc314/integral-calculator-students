import type { DefiniteIntegralResult, IntegralResult } from "./integralEngine";

export type Calculation = IntegralResult | DefiniteIntegralResult;
export type Scene = {
  titleZh: string;
  titleEn: string;
  thoughtZh: string;
  thoughtEn: string;
  latex: string;
  stage: number;
  detailsZh: string[];
  detailsEn: string[];
  pitfallZh: string;
  pitfallEn: string;
  focusLabelZh: string;
  focusLabelEn: string;
  focusLatex: string;
  highlightedLatex: string;
};

export function isDefinite(r: Calculation): r is DefiniteIntegralResult {
  return "lowerLatex" in r;
}

type Focus = { start: number; end: number; role?: string };
type Scan = { equals: number[]; commas: number[]; balanced: boolean };

function partsRoles(latex: string): "uv" | "pq" | undefined {
  const roles = Array.from(
    latex.matchAll(/(?:^\s*|,\s*\\quad\s*)(u|du|dv|v|p|dp|dq|q)\s*=/g),
    m => m[1]
  );
  if (
    (roles.includes("p") && roles.includes("dq")) ||
    (roles.includes("dp") && roles.includes("q"))
  )
    return "pq";
  if (
    (roles.includes("u") && roles.includes("dv")) ||
    (roles.includes("du") && roles.includes("v"))
  )
    return "uv";
  return undefined;
}

/** Locate only structural boundaries, never a character inside a TeX group.
 * Paired \\left/\\right delimiters are consumed as tokens, including escaped braces.
 * Unfamiliar environments/delimiters deliberately fall back to the whole line.
 */
function scanLatex(latex: string): Scan {
  const equals: number[] = [],
    commas: number[] = [];
  const stack: string[] = [];
  let safe = true;
  for (let i = 0; i < latex.length; i++) {
    const ch = latex[i];
    if (ch === "\\") {
      const sizing = latex
        .slice(i)
        .match(/^\\(left|right)\s*(\\[a-zA-Z]+|\\.|[()[\]{}|.])/);
      if (sizing) {
        if (sizing[1] === "left") stack.push("left");
        else if (stack.pop() !== "left") safe = false;
        i += sizing[0].length - 1;
        continue;
      }
      const command = latex.slice(i).match(/^\\([a-zA-Z]+|.)/);
      if (command) {
        if (/^(begin|end|middle|left|right)$/.test(command[1])) safe = false;
        i += command[0].length - 1;
      }
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === ")" || ch === "]") {
      const expected = ch === "}" ? "{" : ch === ")" ? "(" : "[";
      if (stack.pop() !== expected) safe = false;
    } else if (stack.length === 0) {
      if (ch === "=") equals.push(i);
      if (ch === ",") commas.push(i);
    }
  }
  return { equals, commas, balanced: safe && stack.length === 0 };
}

function trimmedRange(latex: string, start: number, end: number): Focus {
  while (start < end && /\s/.test(latex[start])) start++;
  while (end > start && /\s/.test(latex[end - 1])) end--;
  return { start, end };
}

function chooseFocus(latex: string): Focus {
  const whole = { start: 0, end: latex.length };
  const scan = scanLatex(latex);
  if (!scan.balanced || !scan.equals.length) return whole;
  // Prefer the chosen function / new variable, then its differential relation.
  for (const role of ["u", "p", "du", "dp", "dv", "dq", "v", "q"]) {
    for (const eq of scan.equals) {
      const previousComma = scan.commas.filter(i => i < eq).at(-1) ?? -1;
      const lhs = latex
        .slice(previousComma + 1, eq)
        .replace(/\\(?:quad|qquad|,|;|!)/g, "")
        .trim();
      if (lhs !== role) continue;
      const nextComma = scan.commas.find(i => i > eq) ?? latex.length;
      const range = trimmedRange(latex, eq + 1, nextComma);
      if (
        range.start < range.end &&
        scanLatex(latex.slice(range.start, range.end)).balanced
      )
        return { ...range, role };
    }
  }
  // An entire final RHS preserves fractions, functions and all paired delimiters.
  const lastEquals = scan.equals.at(-1)!;
  const range = trimmedRange(latex, lastEquals + 1, latex.length);
  return range.start < range.end &&
    scanLatex(latex.slice(range.start, range.end)).balanced
    ? range
    : whole;
}

function highlight(
  latex: string,
  labelZh: string,
  labelEn: string
): Pick<
  Scene,
  "focusLatex" | "highlightedLatex" | "focusLabelZh" | "focusLabelEn"
> {
  const focus = chooseFocus(latex);
  const focusLatex = latex.slice(focus.start, focus.end);
  const wholeLine = focus.start === 0 && focus.end === latex.length;
  const parts = partsRoles(latex);
  const labels: Record<string, [string, string]> = {
    u: ["u 的選定表達式", "The expression chosen for u"],
    du: ["du 的微分關係", "The differential relation for du"],
    dv: parts
      ? [
          "dv：待積分的部分連同微分",
          "dv: the part to integrate, including the differential",
        ]
      : ["dv 的微分關係", "The differential relation for dv"],
    v: parts
      ? ["v：dv 的一個原函數", "v: an antiderivative of dv"]
      : ["v 的設定表達式", "The expression defined for v"],
    p: ["p：選定要微分的函數", "p: the function chosen to differentiate"],
    dp: ["dp 的微分關係", "The differential relation for dp"],
    dq: [
      "dq：待積分的部分連同微分",
      "dq: the part to integrate, including the differential",
    ],
    q: ["q：dq 的一個原函數", "q: an antiderivative of dq"],
  };
  const labelsForRole = focus.role ? labels[focus.role] : undefined;
  return {
    focusLatex,
    highlightedLatex: `${latex.slice(0, focus.start)}\\boxed{\\color{#2f6d3e}{${focusLatex}}}${latex.slice(focus.end)}`,
    focusLabelZh:
      labelsForRole?.[0] ?? (wholeLine ? `${labelZh}（整行重點）` : labelZh),
    focusLabelEn:
      labelsForRole?.[1] ??
      (wholeLine ? `${labelEn} (whole-line focus)` : labelEn),
  };
}

function assignmentDetails(latex: string): [string[], string[]] {
  const scan = scanLatex(latex);
  const zh: string[] = [],
    en: string[] = [];
  if (!scan.balanced) return [zh, en];
  const parts = partsRoles(latex);
  const meanings: Record<string, [string, string]> = {
    u: ["本步定義的 u", "u as defined in this step"],
    du: ["本步 u 的微分 du", "the differential du of u in this step"],
    dv: parts
      ? ["本步待積分的 dv", "dv to integrate in this step"]
      : ["本步 v 的微分 dv", "the differential dv of v in this step"],
    v: parts
      ? [
          "本步由 dv 得到的原函數 v",
          "the antiderivative v obtained from dv in this step",
        ]
      : ["本步定義的 v", "v as defined in this step"],
    p: ["本步選定要微分的 p", "p chosen to differentiate in this step"],
    dp: ["本步 p 的微分 dp", "the differential dp of p in this step"],
    dq: ["本步待積分的 dq", "dq to integrate in this step"],
    q: [
      "本步由 dq 得到的原函數 q",
      "the antiderivative q obtained from dq in this step",
    ],
  };
  const assignments: [string[], string[]] = [[], []];
  for (const eq of scan.equals) {
    const start = (scan.commas.filter(i => i < eq).at(-1) ?? -1) + 1;
    const role = latex
      .slice(start, eq)
      .replace(/\\(?:quad|qquad|,|;|!)/g, "")
      .trim();
    if (!meanings[role]) continue;
    const end = scan.commas.find(i => i > eq) ?? latex.length;
    const rhs = latex.slice(eq + 1, end).trim();
    assignments[0].push(`${meanings[role][0]}：$${role}=${rhs}$`);
    assignments[1].push(`${meanings[role][1]}: $${role}=${rhs}$`);
  }
  if (assignments[0].length) {
    zh.push(assignments[0].join("；") + "。");
    en.push(assignments[1].join("; ") + ".");
  }
  return [zh, en];
}

// Read integral-bound atoms without regex-truncating nested fractions/radicals.
function readAtom(latex: string, offset: number): [string, number] | undefined {
  while (/\s/.test(latex[offset] ?? "") && offset < latex.length) offset++;
  if (latex[offset] === "{") {
    let depth = 1;
    for (let i = offset + 1; i < latex.length; i++) {
      if (latex[i] === "\\") {
        i++;
        continue;
      }
      if (latex[i] === "{") depth++;
      if (latex[i] === "}" && --depth === 0)
        return [latex.slice(offset + 1, i), i + 1];
    }
  } else {
    const token = latex.slice(offset).match(/^(\\[a-zA-Z]+|[^\s])/);
    if (token) return [token[0], offset + token[0].length];
  }
  return undefined;
}

function explicitBounds(latex: string): [string, string] | undefined {
  const match = /\\int\s*_/.exec(latex);
  if (!match) return undefined;
  const lower = readAtom(latex, match.index + match[0].length);
  if (!lower) return undefined;
  let offset = lower[1];
  while (/\s/.test(latex[offset] ?? "") && offset < latex.length) offset++;
  if (latex[offset] !== "^") return undefined;
  const upper = readAtom(latex, offset + 1);
  return upper ? [lower[0], upper[0]] : undefined;
}

function methodReason(method: string): [string, string] {
  if (/parts|cycle/.test(method) && /substitution/.test(method))
    return [
      "先作適合的代換，把積分化成較簡單的形式，再按需要用分部積分；可以組合方法，但分部積分的整題累計最多兩次，代換後不重新計數。",
      "Use a suitable substitution to simplify the integral, then integration by parts if needed. Methods can be combined, but the whole derivation has at most two by-parts uses; substitution does not reset the count.",
    ];
  if (/parts|cycle/.test(method))
    return [
      "乘積可用分部積分：選容易微分的函數作 u，另一部分連同微分作 dv；可配合其他方法，但整題分部積分累計最多兩次。",
      "For a product, choose a function convenient to differentiate as u and the remaining factor with its differential as dv. Combine other methods as needed, with at most two by-parts uses across the whole derivation.",
    ];
  if (/substitution.*(?:quadratic|trigonometric substitution)/.test(method))
    return [
      "先找內層函數，檢查其導數是否與外面因子只差常數倍；一般代換後，才對新變數的二次式作三角代換或代數分拆。",
      "Identify an inner function whose derivative matches the outside factor up to a constant. First substitute; then use trigonometric substitution or algebraic decomposition on the quadratic in the new variable.",
    ];
  if (/trigonometric substitution|quadratic/.test(method))
    return [
      "辨認二次式、平方和或平方差；需要時先完成平方，再按實際步驟作代換或分拆。",
      "Recognise a quadratic, sum of squares or difference of squares. Complete the square when needed, then follow the substitution or decomposition shown.",
    ];
  if (/identities/.test(method))
    return [
      "先用倍角或積化和差恆等式，將三角函數的冪次或乘積改寫成可直接積分的項。",
      "Use double-angle or product-to-sum identities to rewrite trigonometric powers or products as directly integrable terms.",
    ];
  if (/chain|substitution/.test(method))
    return [
      "找內層函數，檢查其導數與外面因子的常數倍關係，再作代換或使用反鏈式法則。",
      "Identify the inner function and check whether its derivative matches the outside factor up to a constant, then substitute or use the reverse-chain rule.",
    ];
  if (/division|expand/.test(method))
    return [
      "先展開或做多項式長除法，把原式改寫成可逐項積分的等值形式。",
      "Expand or use polynomial long division to obtain an equivalent expression that can be integrated term by term.",
    ];
  if (/symmetry/.test(method))
    return [
      "先確認區間內函數有定義，再用關於零的奇偶對稱性；有向積分須保留上下限方向。",
      "Check the function is defined on the interval before using odd/even symmetry about zero. Preserve the direction of the limits.",
    ];
  return [
    "先拆項或提出常數，按每項的冪次、指數、三角或對數結構配對基本積分法則。",
    "Split sums or take out constants, then match each power, exponential, trigonometric or logarithmic term to a basic rule.",
  ];
}

export function reasoningScenes(result: Calculation): Scene[] {
  const definite = isDefinite(result);
  const source = definite && result.indefinite ? result.indefinite : result;
  const variable = result.variable ?? source.variable ?? "x";
  const vl = result.variableLatex ?? source.variableLatex ?? "x";
  const variableZh = `${variable} 是原來的積分變數；d${variable} 表示對此變數積分的微分。`;
  const variableEn = `${variable} is the original integration variable; d${variable} is the differential indicating integration with respect to it.`;
  const integral = definite
    ? `\\int_{${result.lowerLatex}}^{${result.upperLatex}}${result.integrandLatex}\\,d${vl}`
    : `\\int ${result.integrandLatex}\\,d${vl}`;
  const finalLatex = definite
    ? `${integral}=${result.valueLatex ?? ""}`
    : `${integral}=${result.answerLatex ?? ""}`;
  const scenes: Scene[] = [];
  const partsCost =
    result.partsCost ?? (definite ? result.indefinite?.partsCost : undefined);
  const methodPolicy: [string[], string[]] = [
    [
      "可連續組合已支援的課程內方法；一般或三角代換不佔分部積分次數，代換及拆項亦不會重設整題累計。",
    ],
    [
      "Supported curriculum methods can be composed. General or trigonometric substitution does not use the by-parts budget, and substitution or splitting terms does not reset the total.",
    ],
  ];
  if (typeof partsCost === "number") {
    methodPolicy[0].push(
      `本條推導使用 ${partsCost} / 2 次分部積分；此數字是整題總次數，不是當前步驟編號。`
    );
    methodPolicy[1].push(
      `This derivation uses ${partsCost} / 2 integrations by parts; this is the whole-question total, not the current step number.`
    );
  }
  const add = (
    latex: string,
    stage: number,
    titles: [string, string],
    thoughts: [string, string],
    details: [string[], string[]],
    pitfalls: [string, string]
  ) => {
    const assignments = assignmentDetails(latex);
    scenes.push({
      titleZh: titles[0],
      titleEn: titles[1],
      thoughtZh: thoughts[0],
      thoughtEn: thoughts[1],
      latex,
      stage,
      detailsZh: [variableZh, ...assignments[0], ...details[0]],
      detailsEn: [variableEn, ...assignments[1], ...details[1]],
      pitfallZh: pitfalls[0],
      pitfallEn: pitfalls[1],
      ...highlight(latex, titles[0], titles[1]),
    });
  };
  const originalBounds: [string[], string[]] = definite
    ? [
        [
          `原下限 $${vl}=${result.lowerLatex}$，原上限 $${vl}=${result.upperLatex}$；a、b 只是這兩個已知端點的簡稱，不是新的未知數。`,
        ],
        [
          `The original lower endpoint is $${vl}=${result.lowerLatex}$ and the original upper endpoint is $${vl}=${result.upperLatex}$; a and b are names for these known endpoints, not new unknowns.`,
        ],
      ]
    : [
        ["目標是找出微分後等於被積函數的原函數；C 是任意常數。"],
        [
          "Find an antiderivative whose derivative is the integrand; C denotes an arbitrary constant.",
        ],
      ];
  add(
    integral,
    0,
    ["先看結構，選擇方法", "Recognise the structure"],
    methodReason(source.method),
    [
      [...originalBounds[0], ...methodPolicy[0]],
      [...originalBounds[1], ...methodPolicy[1]],
    ],
    [
      "積分方法應依原式結構選擇，不能把乘積直接當成兩個積分相乘。",
      "Choose the method from the expression's structure; an integral of a product is not a product of integrals.",
    ]
  );

  // Some result.stepsLatex already include the indefinite derivation. Exact
  // duplicate removal preserves first-occurrence order. A calculation step may
  // share the final formula with the finish/check scene: their purposes differ.
  const lines =
    definite && result.indefinite
      ? [...result.indefinite.stepsLatex, ...result.stepsLatex]
      : result.stepsLatex;
  const seen = new Set([integral.trim()]);
  const namedIntegrals = new Set<string>();
  for (const latex of lines) {
    const key = latex.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const noIntegral = !/\\int/.test(latex);
    const partsScheme = partsRoles(latex);
    const partsSetup = noIntegral && !!partsScheme;
    const [partsP, partsQ] = partsScheme === "pq" ? ["p", "q"] : ["u", "v"];
    const angle = latex.match(/\\(?:theta|phi)/)?.[0];
    const angleSetup = noIntegral && !!angle && /\\(?:sin|cos|tan)/.test(latex);
    const substitutionSymbol = latex.match(/^([a-z])\s*=/)?.[1];
    const substitutionSetup =
      noIntegral &&
      !partsSetup &&
      !angleSetup &&
      (/(?:^|,\s*\\quad\s*)(?:u|du)\s*=/.test(latex) ||
        (!!substitutionSymbol && substitutionSymbol !== vl));
    const newVariable = substitutionSymbol ?? "u";
    const inverseAngle = noIntegral && /^\\(?:theta|phi)\s*=/.test(latex);
    const trigIdentity =
      noIntegral &&
      /\\(?:sin|cos|tan|cot)\s*\^/.test(latex) &&
      !partsSetup &&
      !substitutionSetup &&
      !inverseAngle;
    const fDefinition = definite && /^F\s*(?:\(|\\left\()/.test(latex);
    const fBounds =
      definite && !fDefinition && /F\s*(?:\(|\\left\()/.test(latex);
    const namedIntegral = latex.match(/^\s*([IJK])\s*=\s*\\int/);
    const isIntegralDefinition =
      !!namedIntegral &&
      !scanLatex(latex).equals.slice(1).length &&
      /(?:parts|cycle)/.test(source.method);
    if (isIntegralDefinition) {
      const name = namedIntegral![1];
      namedIntegrals.add(name);
      add(
        latex,
        1,
        [
          "命名原積分，方便稍後移項",
          "Name the integral for later rearrangement",
        ],
        [
          `${name} 是本行整個積分的簡稱；先命名，分部後若它再次出現，就可移項解出它。`,
          `${name} abbreviates the entire integral on this line. Name it first so that repeated occurrences after integration by parts can be collected and solved for.`,
        ],
        [
          [
            `${name} 不是新的積分變數，也不是已知數值；原積分變數仍是 ${variable}。`,
            "本步只設定代號，尚未分部或移項，不佔分部積分次數。",
          ],
          [
            `${name} is neither a new integration variable nor a known numerical value; the integration variable remains ${variable}.`,
            "This step only introduces notation: it has not yet performed integration by parts or rearranged anything, and uses no by-parts allowance.",
          ],
        ],
        [
          "不要把積分代號與積分變數混淆；命名不是另一條解法。",
          "Do not confuse the integral's name with its integration variable; naming it is not another method.",
        ]
      );
    } else if (fDefinition) {
      add(
        latex,
        2,
        ["命名原函數 F", "Name the antiderivative F"],
        [
          "F 是剛求得的原函數的名稱，不是另一個待解未知量。",
          "F names the antiderivative just obtained; it is not another unknown to solve for.",
        ],
        [
          [
            `F 對 ${variable} 微分應等於被積函數；這裡選用一個不含 C 的代表。`,
            "任意常數 C 在上下限相減時抵消，所以定積分可選 C=0。",
          ],
          [
            `Differentiating F with respect to ${variable} must recover the integrand; here we choose a representative without C.`,
            "The arbitrary constant cancels when endpoint values are subtracted, so C=0 may be chosen for a definite integral.",
          ],
        ],
        [
          "F 的函數式仍用原變數；這一步尚未代入端點。",
          "F is still expressed in the original variable; endpoints have not yet been substituted.",
        ]
      );
    } else if (fBounds) {
      const bounds = explicitBounds(latex);
      const lower = bounds?.[0] ?? (definite ? result.lowerLatex : "");
      const upper = bounds?.[1] ?? (definite ? result.upperLatex : "");
      add(
        latex,
        3,
        ["代入上下限：上減下", "Substitute: upper minus lower"],
        [
          `計算 $F\\left(${upper}\\right)-F\\left(${lower}\\right)$：把 ${variable} 換成上限，再減去換成下限的值。`,
          `Evaluate $F\\left(${upper}\\right)-F\\left(${lower}\\right)$: replace ${variable} by the upper endpoint, then subtract the value at the lower endpoint.`,
        ],
        [
          [
            ...originalBounds[0],
            `本行積分的下限是 $${vl}=${lower}$，上限是 $${vl}=${upper}$；F 是本行所用的原函數。`,
          ],
          [
            ...originalBounds[1],
            `For the integral on this line, the lower endpoint is $${vl}=${lower}$ and the upper endpoint is $${vl}=${upper}$; F denotes the antiderivative used on this line.`,
          ],
        ],
        [
          "上減下是代入次序，不是按端點大小重新排序；不要額外加 C。",
          "Upper minus lower is the substitution order, not a reordering by endpoint size; do not add C.",
        ]
      );
    } else if (partsSetup) {
      add(
        latex,
        1,
        [
          "分部積分：分清四個角色",
          "Integration by parts: distinguish four roles",
        ],
        [
          `${partsP} 是選定要微分的函數；d${partsQ} 是其餘部分連同微分。求 d${partsP} 與 ${partsQ} 後代入 ${partsP}${partsQ}−∫${partsQ} d${partsP}。`,
          `${partsP} is the function chosen to differentiate; d${partsQ} is the remaining part with its differential. Find d${partsP} and ${partsQ}, then use ${partsP}${partsQ}−∫${partsQ} d${partsP}.`,
        ],
        [
          [
            `${partsP} 不一定等於原變數，也不是一律待解的未知數；本行等式指定它是哪個函數。`,
            `d${partsP} 是 ${partsP} 的微分；${partsQ} 是把 d${partsQ} 積分得到的一個原函數。求 ${partsQ} 時可取常數為零，總答案最後只需一個 C。`,
            partsScheme === "pq"
              ? "這裡用 p、q 表示分部角色，避免與前一次代換的新變數 u、v 混淆；它們不是新的積分變數。"
              : "本步分部積分沿用整題累計次數，不因改寫函數而重設。",
          ],
          [
            `${partsP} need not equal the original variable and is not automatically an unknown; the equality specifies the chosen function.`,
            `d${partsP} is the differential of ${partsP}; ${partsQ} is one antiderivative of d${partsQ}. Choose its constant as zero and include one C in the final answer.`,
            partsScheme === "pq"
              ? "p and q name the by-parts roles, avoiding a clash with earlier substitution variables u or v; they are not new integration variables."
              : "This by-parts step uses the whole-question count; rewriting the function does not reset it.",
          ],
        ],
        [
          `不要把 d${partsQ} 當成 ${partsQ}，或把 d${partsP} 當成導數而漏掉微分；公式的第二項是減號。`,
          `Do not confuse d${partsQ} with ${partsQ} or omit the differential in d${partsP}; the second term in the formula has a minus sign.`,
        ]
      );
    } else if (inverseAngle) {
      add(
        latex,
        2,
        [
          "將代換角寫回原變數",
          "Express the substitution angle in the original variable",
        ],
        [
          "由先前的三角代換解出角的表達式，再代回原函數。",
          "Solve the earlier trigonometric substitution for the angle and substitute it back into the antiderivative.",
        ],
        [
          [
            angle === vl
              ? "本行沿用引擎的角符號；請按前一個代換等式分辨其角色，勿當成另一個獨立未知量。"
              : `${angle ? `$${angle}$` : "代換角"} 是代換時引入的角，不是原積分變數 ${variable}。`,
            "反三角函數表示相應區間內的角；sin⁻¹ 不是 1/sin，tan⁻¹ 不是 1/tan。",
          ],
          [
            angle === vl
              ? "This line retains the engine's angle symbol; identify its role from the preceding substitution, not as another independent unknown."
              : `${angle ? `$${angle}$` : "The angle"} was introduced for substitution and is not the original variable ${variable}.`,
            "An inverse trigonometric function gives the angle on the appropriate branch; sin⁻¹ is not 1/sin and tan⁻¹ is not 1/tan.",
          ],
        ],
        [
          "未回到原變數前，不可直接代入原上下限。",
          "Do not substitute the original endpoints before returning to the original variable.",
        ]
      );
    } else if (
      substitutionSetup ||
      (noIntegral && angle && /d\\(?:theta|phi)|\\(?:sin|cos|tan)/.test(latex))
    ) {
      add(
        latex,
        1,
        [
          "設定新變數及微分關係",
          "Define the new variable and its differential",
        ],
        [
          "以本行等式定義新變數，同時用微分關係換掉原微分，才能完整改寫積分。",
          "Define the new variable by this equality and use the differential relation to replace the original differential, so the whole integral is transformed.",
        ],
        [
          [
            substitutionSetup
              ? `${newVariable} 是本次代換的新變數；本行指定它與當前變數的關係，d${newVariable} 是其微分。`
              : `${angle ? `$${angle}$` : "代換角"} 是本次三角代換引入的角；本行連結它與當前積分變數，後者可能已是前一次代換的新變數。`,
            `原題的微分是 d${variable}；每次代換都須換掉當步的微分並保留係數，不能只把函數改名。`,
          ],
          [
            substitutionSetup
              ? `${newVariable} is the new substitution variable; this equality relates it to the current variable, and d${newVariable} is its differential.`
              : `${angle ? `$${angle}$` : "The angle"} is introduced for this trigonometric substitution; the equality relates it to the current integration variable, which may itself come from an earlier substitution.`,
            `Transform d${variable} and every subsequent differential at the appropriate step; retain the coefficient, rather than merely renaming the function.`,
          ],
        ],
        [
          "分部積分的 u 與代換的新變數 u 角色不同；跟隨當前設定，並檢查負號及係數。",
          "The u chosen in integration by parts differs in role from a substitution variable u; follow the current definition and check signs and coefficients.",
        ]
      );
    } else if (trigIdentity) {
      add(
        latex,
        1,
        ["用三角恆等式等值改寫", "Rewrite using a trigonometric identity"],
        [
          "恆等式只改寫形式，沒有改變原來函數；再把右方各項逐項積分。",
          "The identity changes the form, not the original function; integrate the terms on the right separately.",
        ],
        [
          [
            "恆等式中的 u 表示同一個角或內層表達式，不自動代表已作變數代換。",
            "倍角中的 2 或其他角倍數會影響之後積分的係數。",
          ],
          [
            "In an identity, u stands for the same angle or inner expression; it does not by itself mean a variable substitution has been made.",
            "The factor 2 or another angle multiplier affects the coefficient when integrating later.",
          ],
        ],
        [
          "這一步是函數的恆等變形，尚未積分，不要在恆等式加 C。",
          "This is an identity between functions, not yet an integration step; do not add C to the identity.",
        ]
      );
    } else if (
      /f\(-/.test(latex) ||
      (/symmetry/.test(source.method) &&
        /\\int/.test(latex) &&
        !/F/.test(latex))
    ) {
      add(
        latex,
        2,
        ["使用奇偶對稱性", "Apply odd/even symmetry"],
        [
          "f 表示被積函數；奇函數兩側有向累積抵消，偶函數兩側相同。",
          "f denotes the integrand; odd-function signed contributions cancel, while even-function contributions agree.",
        ],
        [
          [
            ...originalBounds[0],
            "只在對稱區間且函數處處有定義時使用；若改為半區間，後續 F 的端點屬於該半區間。",
          ],
          [
            ...originalBounds[1],
            "Use symmetry only on a symmetric interval where the function is defined throughout; after reducing to a half-interval, subsequent F endpoints belong to that half-interval.",
          ],
        ],
        [
          "有向積分可能為零或負數，不能直接當成幾何面積。",
          "A signed integral may be zero or negative; it is not automatically geometric area.",
        ]
      );
    } else if (/^\s*=/.test(latex)) {
      add(
        latex,
        3,
        ["整理端點代入後的精確值", "Simplify the exact endpoint value"],
        [
          "沿用上一行等式，先保留括號內下限的整個值，再處理減號及精確常數。",
          "Continue the preceding equality, retain the entire lower-endpoint value in parentheses, then simplify the subtraction and exact constants.",
        ],
        [
          [
            ...originalBounds[0],
            "F 是原函數；本行若已展開 F 的值，就不再引入新的未知量。",
          ],
          [
            ...originalBounds[1],
            "F denotes the antiderivative; expanding its endpoint values does not introduce any new unknown.",
          ],
        ],
        [
          "減號作用於下限代入後的整個括號；保留分數、π、e、對數及根號，勿提早轉小數。",
          "The minus sign applies to the entire lower-endpoint value; retain fractions, π, e, logs and radicals rather than rounding early.",
        ]
      );
    } else {
      const hasIntegral = /\\int/.test(latex);
      const hasC = /\+\s*C\s*$/.test(latex);
      const transformed = hasIntegral && !hasC;
      const cycle =
        /(?:^|[^a-zA-Z])[IJK](?:=|\b)/.test(latex) &&
        /parts|cycle/.test(source.method);
      const titles: [string, string] = cycle
        ? [
            "連結分部後的等式，移項整理",
            "Link the by-parts relations and rearrange",
          ]
        : hasC
          ? ["求出本項的原函數", "Find the antiderivative of this term"]
          : transformed
            ? ["等值改寫積分", "Rewrite the integral equivalently"]
            : [
                "整理函數或核對導數",
                "Simplify the function or check its derivative",
              ];
      add(
        latex,
        2,
        titles,
        cycle
          ? [
              "利用分部後的等式或三角恆等式，把再次出現的原積分移到同一邊，解出原積分；移項本身不算另一次分部積分。",
              "Use the by-parts relations or trigonometric identities, collect repeated occurrences of the original integral on one side and solve. Rearrangement itself is not another integration by parts.",
            ]
          : hasC
            ? [
                "用本行所示的積分法則求原函數；微分右方應回到左方的被積函數。",
                "Apply the integration rule shown; differentiating the right-hand side should recover the integrand on the left.",
              ]
            : transformed
              ? [
                  "保留等值關係：拆項、提出常數，或依已設定的代換／分部公式改寫。",
                  "Preserve equality when splitting terms, taking out constants, or applying the substitution/integration-by-parts relation already established.",
                ]
              : [
                  "本行按代數等式或微分關係整理，沒有改變原題的數學內容。",
                  "This line uses an algebraic equality or derivative relation without changing the mathematics of the original problem.",
                ],
        [
          [
            cycle
              ? namedIntegrals.size
                ? `${Array.from(namedIntegrals).join("、")} 是本推導已命名的積分，其意義沿用各自的定義行；積分代號不是新的積分變數。`
                : "I 是原積分的簡稱，J 是分部後出現的輔助積分；兩者不是新積分變數。"
              : hasC
                ? "C 是任意常數，微分後為零；多項原函數的常數可合併成最後一個 C。"
                : transformed
                  ? "若微分已變成 du 或代換角的微分，就對該新變數積分；最後須換回原變數。"
                  : "等號兩邊是同一個量；框內保留本行完整的有效表達式。",
            "依實際步驟保留內層函數導數的係數；若用分部公式，第二項為 −∫v du（或改用角色符號時的 −∫q dp）。",
          ],
          [
            cycle
              ? namedIntegrals.size
                ? `${Array.from(namedIntegrals).join(", ")} name integrals in this derivation, with meanings retained from their defining lines; these names are not new integration variables.`
                : "I abbreviates the original integral and J an auxiliary integral after integration by parts; neither is a new integration variable."
              : hasC
                ? "C is an arbitrary constant whose derivative is zero; constants from separate terms combine into one final C."
                : transformed
                  ? "If the differential is now du or that of a substitution angle, integrate with respect to that new variable and return to the original variable at the end."
                  : "Both sides represent the same quantity; the box retains a complete expression from this line.",
            "Retain the inner-derivative coefficient shown; in integration by parts the second term is −∫v du (or −∫q dp with renamed roles).",
          ],
        ],
        [
          hasC
            ? "不要漏 C，亦不要把原函數當成被積函數；留意內層係數與負號。"
            : "等值變形不是任意刪項；係數、括號和負號都要保留。",
          hasC
            ? "Do not omit C or confuse the antiderivative with the integrand; check inner coefficients and signs."
            : "An equivalent rewrite cannot discard terms arbitrarily; retain coefficients, parentheses and signs.",
        ]
      );
    }
  }
  add(
    finalLatex,
    3,
    definite
      ? ["完成：確認結果與區間", "Finish: check the value and interval"]
      : ["完成：加上 C，微分核對", "Finish: add C and differentiate"],
    definite
      ? [
          "確認已按上減下計算並保留精確值；定積分是有向累積，不一定等於面積。",
          "Check upper minus lower and retain the exact value; a definite integral is signed accumulation, not always area.",
        ]
      : [
          "保留任意常數 C；把原函數微分，應回到原被積函數。",
          "Keep the arbitrary constant C; differentiate the antiderivative to recover the original integrand.",
        ],
    [
      [
        ...originalBounds[0],
        ...methodPolicy[0],
        definite
          ? "若曾代換，最後的原函數已回到原積分變數；C 在端點相減時抵消。"
          : "C 可取任何常數，代表所有相差常數的原函數。",
      ],
      [
        ...originalBounds[1],
        ...methodPolicy[1],
        definite
          ? "After substitution, the final antiderivative is back in the original variable; C cancels in endpoint subtraction."
          : "C may be any constant and represents all antiderivatives differing by a constant.",
      ],
    ],
    definite
      ? [
          "不要在定積分的數值答案後加 C；上下限反轉會改變符號。",
          "Do not append C to a definite value; reversing the limits reverses its sign.",
        ]
      : [
          "微分核對時 C 的導數為零；不要漏掉內層函數的鏈式因子。",
          "C differentiates to zero; include the inner-function factor when checking by the chain rule.",
        ]
  );
  return scenes;
}
