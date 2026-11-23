import { derivative, parse, type MathNode } from "mathjs";
import { exactSimplify } from "./exactMath";
import type { DefiniteIntegralResult, IntegralResult } from "./integralEngine";

export interface SolutionPath {
  id: string;
  titleZh: string;
  titleEn: string;
  rationaleZh: string;
  rationaleEn: string;
  result: IntegralResult | DefiniteIntegralResult;
}

export interface SolutionPathComparison {
  paths: SolutionPath[];
  noteZh: string;
  noteEn: string;
  verification: "same-value" | "constant-difference" | "single";
}

type Calculation = IntegralResult | DefiniteIntegralResult;
type Node = MathNode & {
  args?: MathNode[];
  content?: MathNode;
  op?: string;
  name?: string;
  fn?: { name?: string };
  value?: unknown;
};
const unwrap = (raw: MathNode): Node => {
  const n = raw as Node;
  return n.type === "ParenthesisNode" ? unwrap(n.content!) : n;
};
const definite = (r: Calculation): r is DefiniteIntegralResult =>
  "lowerLatex" in r;
const greek: Record<string, string> = {
  α: "\\alpha",
  β: "\\beta",
  γ: "\\gamma",
  δ: "\\delta",
  ε: "\\varepsilon",
  ζ: "\\zeta",
  η: "\\eta",
  θ: "\\theta",
  ι: "\\iota",
  κ: "\\kappa",
  λ: "\\lambda",
  μ: "\\mu",
  ν: "\\nu",
  ξ: "\\xi",
  ο: "o",
  π: "\\pi",
  ρ: "\\rho",
  σ: "\\sigma",
  τ: "\\tau",
  υ: "\\upsilon",
  φ: "\\phi",
  χ: "\\chi",
  ψ: "\\psi",
  ω: "\\omega",
};
const tex = (expression: string) =>
  parse(expression)
    .toTex({ parenthesis: "keep", implicit: "hide" })
    .replace(/[α-ω]/g, letter => `${greek[letter] ?? letter} `)
    .trim();
const substitute = (
  expression: string,
  variable: string,
  replacement: string
) =>
  parse(expression)
    .transform(n =>
      n.type === "SymbolNode" && (n as Node).name === variable
        ? parse(`(${replacement})`)
        : n
    )
    .toString();
const int = (expression: string, v: string) =>
  `\\int ${tex(expression)}\\,d${v}`;

// A small exact rational polynomial ring, NOT a general CAS. Functions are formal
// atoms. The only relations added are cos²=1-sin², sqrt(Q)²=Q and, on the
// certified semicircle domain, acos(z)=pi/2-asin(z). No sample authorises a path.
type Q = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint =>
  b === BigInt(0) ? (a < BigInt(0) ? -a : a) : gcd(b, a % b);
function q(n: bigint, d = BigInt(1)): Q {
  if (!d) throw new Error("zero denominator");
  const g = gcd(n, d),
    sign = d < BigInt(0) ? -BigInt(1) : BigInt(1);
  return { n: (n / g) * sign, d: (d / g) * sign };
}
function powBigInt(base: bigint, exponent: number): bigint {
  let out = BigInt(1);
  for (let i = 0; i < exponent; i++) out *= base;
  return out;
}
const ZERO = q(BigInt(0)),
  ONE = q(BigInt(1)),
  TWO = q(BigInt(2));
const addQ = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const negQ = (a: Q) => q(-a.n, a.d);
const mulQ = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const divQ = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const eqQ = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
const textQ = (a: Q) => (a.d === BigInt(1) ? `${a.n}` : `${a.n}/${a.d}`);
function literal(text: string): Q {
  const m = text.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!m || (!m[2] && !m[3]) || text.length > 80)
    throw new Error("not a rational literal");
  const exponent = Number(m[4] ?? 0) - (m[3]?.length ?? 0);
  if (Math.abs(exponent) > 80) throw new Error("literal too large");
  const n = BigInt(`${m[1]}${m[2] || "0"}${m[3] ?? ""}`);
  return exponent >= 0
    ? q(n * powBigInt(BigInt(10), exponent))
    : q(n, powBigInt(BigInt(10), -exponent));
}
type Poly = Map<string, Q>; // monomials are sorted lists of atom indices
interface RF {
  p: Poly;
  d: Poly;
}
interface ProofContext {
  trigArgs?: string[];
  radicand?: string;
  radius2?: Q;
  inverseArgs?: string[];
}
class Algebra {
  private atoms: { name: string; args: RF[] }[] = [];
  private relations = new Map<number, Poly>();
  private work = 0;
  constructor(private context: ProofContext = {}) {}
  private tick() {
    if (++this.work > 80000) throw new Error("proof budget");
  }
  private c(a: Q): Poly {
    return a.n ? new Map([["", a]]) : new Map();
  }
  private sum(a: Poly, b: Poly): Poly {
    const out = new Map(a);
    for (const [key, value] of Array.from(b)) {
      this.tick();
      const next = addQ(out.get(key) ?? ZERO, value);
      if (next.n) out.set(key, next);
      else out.delete(key);
    }
    if (out.size > 1024) throw new Error("polynomial budget");
    return out;
  }
  private scale(a: Poly, factor: Q): Poly {
    return new Map(
      Array.from(a)
        .map(([key, value]) => [key, mulQ(value, factor)])
        .filter(([, v]) => (v as Q).n !== BigInt(0)) as [string, Q][]
    );
  }
  private term(ids: number[], coefficient: Q): Poly {
    this.tick();
    ids.sort((a, b) => a - b);
    for (let i = 1; i < ids.length; i++) {
      const relation = ids[i] === ids[i - 1] && this.relations.get(ids[i]);
      if (relation) {
        const rest = [...ids];
        rest.splice(i - 1, 2);
        let out: Poly = new Map();
        for (const [key, value] of Array.from(relation))
          out = this.sum(
            out,
            this.term([...rest, ...this.ids(key)], mulQ(value, coefficient))
          );
        return out;
      }
    }
    return coefficient.n ? new Map([[ids.join(","), coefficient]]) : new Map();
  }
  private ids(key: string): number[] {
    return key ? key.split(",").map(Number) : [];
  }
  private product(a: Poly, b: Poly): Poly {
    let out: Poly = new Map();
    for (const [ka, va] of Array.from(a))
      for (const [kb, vb] of Array.from(b))
        out = this.sum(
          out,
          this.term([...this.ids(ka), ...this.ids(kb)], mulQ(va, vb))
        );
    return out;
  }
  constant(a: Q): RF {
    return { p: this.c(a), d: this.c(ONE) };
  }
  add(a: RF, b: RF): RF {
    return {
      p: this.sum(this.product(a.p, b.d), this.product(b.p, a.d)),
      d: this.product(a.d, b.d),
    };
  }
  neg(a: RF): RF {
    return { p: this.scale(a.p, negQ(ONE)), d: a.d };
  }
  mul(a: RF, b: RF): RF {
    return { p: this.product(a.p, b.p), d: this.product(a.d, b.d) };
  }
  div(a: RF, b: RF): RF {
    if (!b.p.size) throw new Error("division by zero");
    return { p: this.product(a.p, b.d), d: this.product(a.d, b.p) };
  }
  power(a: RF, exponent: number): RF {
    if (!Number.isInteger(exponent) || Math.abs(exponent) > 16)
      throw new Error("non-rational power");
    if (exponent < 0)
      return this.div(this.constant(ONE), this.power(a, -exponent));
    let out = this.constant(ONE);
    for (let i = 0; i < exponent; i++) out = this.mul(out, a);
    return out;
  }
  equal(a: RF, b: RF): boolean {
    return !this.sum(
      this.product(a.p, b.d),
      this.scale(this.product(b.p, a.d), negQ(ONE))
    ).size;
  }
  scalar(a: RF): Q | null {
    if (!a.d.size) return null;
    if (!a.p.size) return ZERO;
    const [key, value] = a.d.entries().next().value!;
    const numerator = a.p.get(key);
    if (!numerator) return null;
    const ratio = divQ(numerator, value);
    return this.equal(a, this.constant(ratio)) ? ratio : null;
  }
  private atom(name: string, args: RF[] = [], relation?: Poly): RF {
    let index = this.atoms.findIndex(
      atom =>
        atom.name === name &&
        atom.args.length === args.length &&
        args.every((arg, i) => this.equal(arg, atom.args[i]))
    );
    if (index < 0) {
      index = this.atoms.length;
      this.atoms.push({ name, args });
    }
    if (relation) this.relations.set(index, relation);
    return { p: new Map([[`${index}`, ONE]]), d: this.c(ONE) };
  }
  private polynomial(a: RF): Poly {
    const denominator = a.d.get("");
    if (a.d.size !== 1 || !denominator)
      throw new Error("non-polynomial radicand");
    return this.scale(a.p, divQ(ONE, denominator));
  }
  private rootConstant(value: Q): RF {
    if (value.n < BigInt(0) || value.n * value.d > BigInt(100000000))
      throw new Error("root budget/domain");
    if (!value.n) return this.constant(ZERO);
    // sqrt(n/d)=sqrt(n*d)/d; remove exact square factors (bounded integers).
    let remaining = value.n * value.d,
      factor = BigInt(1);
    for (let k = BigInt(2); k * k <= remaining; k++) {
      while (remaining % (k * k) === BigInt(0)) {
        remaining /= k * k;
        factor *= k;
      }
    }
    const coefficient = this.constant(q(factor, value.d));
    return remaining === BigInt(1)
      ? coefficient
      : this.mul(
          coefficient,
          this.atom(`root:${remaining}`, [], this.c(q(remaining)))
        );
  }
  read(expression: string | MathNode): RF {
    this.tick();
    const n = unwrap(
      typeof expression === "string" ? parse(expression) : expression
    );
    if (n.type === "ConstantNode")
      return this.constant(literal(String(n.value)));
    if (n.type === "SymbolNode") return this.atom(`symbol:${n.name}`);
    const args = n.args ?? [];
    if (n.type === "OperatorNode") {
      const a = this.read(args[0]);
      if (args.length === 1 && n.op === "-") return this.neg(a);
      if (args.length === 1 && n.op === "+") return a;
      const b = this.read(args[1]);
      if (n.op === "+") return this.add(a, b);
      if (n.op === "-") return this.add(a, this.neg(b));
      if (n.op === "*") return this.mul(a, b);
      if (n.op === "/") return this.div(a, b);
      if (n.op === "^") {
        const exponent = this.scalar(b);
        if (!exponent || exponent.d !== BigInt(1))
          throw new Error("noninteger power");
        return this.power(a, Number(exponent.n));
      }
    }
    if (n.type === "FunctionNode") {
      const name = n.fn?.name ?? "",
        a = this.read(args[0]);
      if (name === "sqrt") {
        const constant = this.scalar(a);
        if (constant) return this.rootConstant(constant);
        if (this.context.radicand && this.context.radius2) {
          const reference = this.read(this.context.radicand);
          const ratio = this.scalar(this.div(a, reference));
          if (ratio && ratio.n > BigInt(0)) {
            const root = this.atom(
              "domain-root",
              [],
              this.polynomial(reference)
            );
            return this.mul(this.rootConstant(ratio), root);
          }
        }
        return this.atom("sqrt", [a], this.polynomial(a));
      }
      if (name === "sin" || name === "cos") {
        // Endpoints can themselves be doubles of each other. Reduce the
        // double first, recursively, so every occurrence uses the same atoms.
        const half = (this.context.trigArgs ?? []).find(arg => {
          const base = this.read(arg);
          return (
            !this.equal(a, base) &&
            this.equal(a, this.mul(this.constant(TWO), base))
          );
        });
        if (half) {
          const s = this.read(`sin(${half})`),
            c = this.read(`cos(${half})`);
          return name === "sin"
            ? this.mul(this.constant(TWO), this.mul(s, c))
            : this.add(this.power(c, 2), this.neg(this.power(s, 2)));
        }
        for (const arg of this.context.trigArgs ?? []) {
          const base = this.read(arg);
          if (
            this.equal(a, base) ||
            this.equal(a, this.mul(this.constant(TWO), base))
          ) {
            const s = this.atom("sin", [base]);
            const c = this.atom(
              "cos",
              [base],
              this.polynomial(
                this.add(this.constant(ONE), this.neg(this.power(s, 2)))
              )
            );
            if (this.equal(a, base)) return name === "sin" ? s : c;
            return name === "sin"
              ? this.mul(this.constant(TWO), this.mul(s, c))
              : this.add(this.power(c, 2), this.neg(this.power(s, 2)));
          }
        }
      }
      if (
        name === "acos" &&
        (this.context.inverseArgs ?? []).some(arg =>
          this.equal(a, this.read(arg))
        )
      )
        return this.add(
          this.div(this.read("pi"), this.constant(TWO)),
          this.neg(this.atom("asin", [a]))
        );
      return this.atom(
        name,
        args.map(arg => this.read(arg))
      );
    }
    throw new Error("unsupported proof node");
  }
  same(a: string, b: string): boolean {
    return this.equal(this.read(a), this.read(b));
  }
}

function symbolsSafe(expression: string, variable: string): boolean {
  let safe = true;
  const constants = new Set(["pi", "e"]);
  parse(expression).traverse((node, _path, parent) => {
    if (node.type !== "SymbolNode") return;
    const name = (node as Node).name!;
    if (parent?.type === "FunctionNode" && (parent as Node).fn?.name === name)
      return;
    if (name !== variable && !constants.has(name)) safe = false;
  });
  return safe;
}

// Exact, rational-coefficient polynomial extraction of degree at most eight.
function polynomial(expression: string, variable: string): Q[] | null {
  function walk(raw: MathNode): Q[] {
    const n = unwrap(raw),
      args = n.args ?? [];
    if (n.type === "ConstantNode") return [literal(String(n.value))];
    if (n.type === "SymbolNode" && n.name === variable) return [ZERO, ONE];
    if (n.type !== "OperatorNode") throw new Error("not a polynomial");
    const a = walk(args[0]);
    if (args.length === 1 && n.op === "-") return a.map(negQ);
    if (args.length === 1 && n.op === "+") return a;
    const b = walk(args[1]);
    if (n.op === "+" || n.op === "-")
      return Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
        addQ(a[i] ?? ZERO, n.op === "-" ? negQ(b[i] ?? ZERO) : (b[i] ?? ZERO))
      );
    if (n.op === "/" && b.length === 1)
      return a.map(value => divQ(value, b[0]));
    const multiply = (x: Q[], y: Q[]) => {
      if (x.length + y.length > 10) throw new Error("degree budget");
      const out = Array.from({ length: x.length + y.length - 1 }, () => ZERO);
      x.forEach((u, i) =>
        y.forEach((v, j) => (out[i + j] = addQ(out[i + j], mulQ(u, v))))
      );
      return out;
    };
    if (n.op === "*") return multiply(a, b);
    if (
      n.op === "^" &&
      b.length === 1 &&
      b[0].d === BigInt(1) &&
      b[0].n >= BigInt(0) &&
      b[0].n <= BigInt(8)
    ) {
      let out = [ONE];
      for (let i = 0; i < Number(b[0].n); i++) out = multiply(out, a);
      return out;
    }
    throw new Error("not a bounded polynomial");
  }
  try {
    const out = walk(parse(expression));
    while (out.length > 1 && !out[out.length - 1].n) out.pop();
    return out;
  } catch {
    return null;
  }
}
interface Candidate {
  id: string;
  titleZh: string;
  titleEn: string;
  rationaleZh: string;
  rationaleEn: string;
  primitive: string;
  steps: string[];
  partsCost: number;
  proof: ProofContext;
}
const fresh = (variable: string, choices: string[]) =>
  choices.find(s => s !== variable)!;

function trigSquare(source: IntegralResult): Candidate | null {
  if (!source.method.includes("trigonometric identities")) return null;
  const n = unwrap(parse(source.normalized));
  if (
    n.op !== "^" ||
    n.args?.length !== 2 ||
    !new Algebra().same(n.args[1].toString(), "2")
  )
    return null;
  const base = unwrap(n.args[0]),
    fn = base.fn?.name;
  if (
    base.type !== "FunctionNode" ||
    !["sin", "cos"].includes(fn ?? "") ||
    base.args?.length !== 1
  )
    return null;
  const variable = source.variable!,
    arg = base.args[0].toString(),
    p = polynomial(arg, variable);
  if (!p || p.length !== 2 || !p[1].n) return null;
  const slope = textQ(p[1]),
    vl = source.variableLatex ?? tex(variable);
  const u = fresh(variable, ["u", "v", "w"]),
    v = fresh(
      variable,
      ["v", "w", "z"].filter(s => s !== u)
    );
  const I = fresh(variable, ["I", "J", "K"]),
    sine = fn === "sin",
    S = tex(`sin(${arg})`),
    C = tex(`cos(${arg})`);
  const product = `sin(${arg})*cos(${arg})/(${slope})`;
  const signedProduct = sine ? `-(${product})` : product;
  const primitive = `(${variable}+(${signedProduct}))/2`;
  return {
    id: "trig-square-parts",
    titleZh: "一次分部積分，移項解原積分",
    titleEn: "One integration by parts and rearrangement",
    rationaleZh:
      "把平方視為兩個相同因子的乘積，分部一次，再用 sin²＋cos²＝1 把重現的原積分移項；不用倍角積分。",
    rationaleEn:
      "Treat the square as a product, integrate by parts once, then use sin² + cos² = 1 and solve for the repeated integral, rather than integrating a double angle.",
    primitive,
    partsCost: 1,
    proof: { trigArgs: [arg] },
    steps: [
      `${I}=${int(source.normalized, vl)}`,
      `${u}=${sine ? S : C},\\quad d${v}=${sine ? S : C}\\,d${vl}`,
      `d${u}=${sine ? "" : "-"}\\left(${tex(slope)}\\right)${sine ? C : S}\\,d${vl},\\quad ${v}=${sine ? "-" : ""}\\frac{${sine ? C : S}}{${tex(slope)}}`,
      `\\int ${u}\\,d${v}=${u}${v}-\\int ${v}\\,d${u}`,
      `${I}=${sine ? "-" : ""}${tex(product)}+${int(`${sine ? "cos" : "sin"}(${arg})^2`, vl)}`,
      `${sine ? C : S}^{2}=1-${sine ? S : C}^{2}`,
      `${I}=${sine ? "-" : ""}${tex(product)}+${vl}-${I}`,
      `2${I}=${vl}${sine ? "-" : "+"}\\left(${tex(product)}\\right)`,
      `${int(source.normalized, vl)}=${tex(primitive)}+C`,
    ],
  };
}

function semicircle(source: IntegralResult): Candidate | null {
  if (!source.method.includes("trigonometric substitution")) return null;
  const n = unwrap(parse(source.normalized));
  if (
    n.type !== "FunctionNode" ||
    n.fn?.name !== "sqrt" ||
    n.args?.length !== 1
  )
    return null;
  const variable = source.variable!,
    radicand = n.args[0].toString(),
    p = polynomial(radicand, variable);
  if (
    !p ||
    p.length !== 3 ||
    p[1].n ||
    !eqQ(p[2], negQ(ONE)) ||
    p[0].n <= BigInt(0)
  )
    return null;
  const r2 = textQ(p[0]),
    radius = exactSimplify(`sqrt(${r2})`),
    A = tex(radius),
    vl = source.variableLatex ?? tex(variable);
  const angle = fresh(variable, ["θ", "φ", "α"]),
    t = tex(angle),
    ratio = `${variable}/(${radius})`;
  const primitive = `(${variable}*sqrt(${radicand})-(${r2})*acos(${ratio}))/2`;
  return {
    id: "semicircle-cos",
    titleZh: "餘弦三角代換",
    titleEn: "Cosine trigonometric substitution",
    rationaleZh:
      "改用 a cosθ（不是把 sinθ 改名）：θ 在 [0,π]、sinθ 非負，而 dx 帶負號。它與正弦代換的原函數相差常數 −a²π/4。",
    rationaleEn:
      "Use a cosθ, not a renaming of the sine path: θ lies in [0,π], sinθ is nonnegative, and dx has a minus sign. Its primitive differs from the sine primitive by −a²π/4.",
    primitive,
    partsCost: 0,
    proof: { radicand, radius2: p[0], inverseArgs: [ratio] },
    steps: [
      `-${A}\\leq ${vl}\\leq ${A},\\quad ${vl}=${A}\\cos${t},\\quad 0\\leq${t}\\leq\\pi`,
      `d${vl}=-${A}\\sin${t}\\,d${t},\\quad \\sin${t}\\geq0`,
      `\\sqrt{${tex(radicand)}}=${A}\\sin${t}`,
      `${int(source.normalized, vl)}=-\\left(${tex(r2)}\\right)\\int \\sin^2${t}\\,d${t}`,
      `\\sin^2${t}=\\frac{1-\\cos(2${t})}{2}`,
      `${int(source.normalized, vl)}=-\\frac{${tex(r2)}}{2}${t}+\\frac{${tex(r2)}}{4}\\sin(2${t})+C`,
      `${t}=\\cos^{-1}\\left(\\frac{${vl}}{${A}}\\right),\\quad \\sin(2${t})=\\frac{2${vl}\\sqrt{${tex(radicand)}}}{${tex(r2)}}`,
      `${int(source.normalized, vl)}=${tex(primitive)}+C`,
      `\\sin^{-1}\\left(\\frac{${vl}}{${A}}\\right)+\\cos^{-1}\\left(\\frac{${vl}}{${A}}\\right)=\\frac{\\pi}{2}`,
    ],
  };
}

function compress(expression: string, inner: string, symbol: string): string {
  const g = unwrap(parse(inner)),
    canonical = g.toString();
  return parse(expression)
    .transform(raw => {
      const n = unwrap(raw);
      if (n.toString() === canonical) return parse(symbol);
      if (
        g.op === "^" &&
        n.op === "^" &&
        g.args &&
        n.args &&
        unwrap(g.args[0]).toString() === unwrap(n.args[0]).toString()
      ) {
        const gp = polynomial(g.args[1].toString(), symbol),
          np = polynomial(n.args[1].toString(), symbol);
        if (
          gp?.length === 1 &&
          np?.length === 1 &&
          gp[0].d === BigInt(1) &&
          np[0].d === BigInt(1) &&
          gp[0].n > BigInt(0) &&
          np[0].n > BigInt(0) &&
          np[0].n % gp[0].n === BigInt(0)
        )
          return parse(`${symbol}^${np[0].n / gp[0].n}`);
      }
      return raw;
    })
    .toString();
}

function rationalPath(source: IntegralResult): Candidate | null {
  // Only compare with an existing real trigonometric-substitution path.
  if (!source.method.includes("trigonometric substitution")) return null;
  const n = unwrap(parse(source.normalized));
  if (n.op !== "/" || n.args?.length !== 2) return null;
  const [numerator, denominator] = n.args.map(a => a.toString()),
    variable = source.variable!;
  const dummy = fresh(variable, ["u", "v", "w"]),
    candidates = new Set([variable]);
  parse(denominator).traverse(raw => {
    if (candidates.size >= 24) return;
    const node = unwrap(raw);
    if (node.op === "^" && node.args) {
      const power = polynomial(node.args[1].toString(), dummy);
      if (
        power?.length === 1 &&
        power[0].d === BigInt(1) &&
        power[0].n >= BigInt(2) &&
        power[0].n <= BigInt(8)
      ) {
        const degree = Number(power[0].n);
        if (degree % 2 === 0)
          candidates.add(`(${node.args[0].toString()})^${degree / 2}`);
        candidates.add(node.args[0].toString());
      }
    }
    if (
      node.type === "FunctionNode" &&
      ["sin", "cos", "exp"].includes(node.fn?.name ?? "")
    )
      candidates.add(node.toString());
  });
  for (const inner of Array.from(candidates)) {
    const transformed = compress(denominator, inner, dummy),
      p = polynomial(transformed, dummy);
    if (!p || p.length !== 3 || !p[2].n) continue;
    const [c, b, a] = p,
      h = divQ(b, mulQ(TWO, a)),
      k = addQ(divQ(c, a), negQ(mulQ(h, h)));
    if (k.n <= BigInt(0)) continue; // no pole-bearing/logarithmic or degenerate cores
    const du = exactSimplify(
      derivative(inner, variable, { simplify: false }).toString()
    );
    let alpha = ZERO,
      beta: Q;
    if (inner === variable) {
      const np = polynomial(numerator, variable);
      if (!np || np.length > 2) continue;
      alpha = divQ(np[1] ?? ZERO, mulQ(TWO, a));
      beta = addQ(np[0], negQ(mulQ(alpha, b)));
    } else {
      const proof = new Algebra(),
        ratio = proof.scalar(proof.div(proof.read(numerator), proof.read(du)));
      if (!ratio) continue;
      beta = ratio;
    }
    if (!beta.n) continue; // a logarithmic reverse chain is not a second path
    const ae = textQ(a),
      be = textQ(beta),
      he = textQ(h),
      ke = textQ(k),
      al = textQ(alpha);
    const z = `(${inner})+(${he})`,
      scale = exactSimplify(`sqrt(${ke})`);
    const arctan = `(${be})/((${ae})*(${scale}))*atan((${z})/(${scale}))`;
    const primitive = alpha.n
      ? `(${al})*log(abs(${denominator}))+(${arctan})`
      : arctan;
    const vl = source.variableLatex ?? tex(variable),
      ul = tex(dummy);
    const shifted = h.n !== BigInt(0),
      zvar = shifted
        ? fresh(
            variable,
            ["v", "w", "z"].filter(s => s !== dummy)
          )
        : dummy;
    const zl = tex(zvar),
      transformedNumerator = alpha.n
        ? `(${al})*(2*(${ae})*${dummy}+(${textQ(b)}))+(${be})`
        : be;
    const steps: string[] = [
      `${ul}=${tex(inner)},\\quad d${ul}=${tex(du)}\\,d${vl}`,
      `${tex(denominator)}=${tex(`(${ae})*((${inner}+(${he}))^2+(${ke}))`)}`,
      `${int(source.normalized, vl)}=${int(`(${transformedNumerator})/(${transformed})`, ul)}`,
    ];
    if (alpha.n)
      steps.push(
        `${tex(`(${transformedNumerator})/(${transformed})`)}=${tex(`(${al})*(2*(${ae})*${dummy}+(${textQ(b)}))/(${transformed})+(${be})/(${transformed})`)}`,
        `${int(`(${al})*(2*(${ae})*${dummy}+(${textQ(b)}))/(${transformed})`, ul)}=${tex(`(${al})*log(abs(${transformed}))`)}+C`
      );
    if (shifted)
      steps.push(`${zl}=${ul}+\\left(${tex(he)}\\right),\\quad d${zl}=d${ul}`);
    steps.push(
      `\\frac{d}{d${zl}}\\tan^{-1}\\left(\\frac{${zl}}{${tex(scale)}}\\right)=\\frac{${tex(scale)}}{${zl}^{2}+${tex(ke)}}`,
      `${int(`1/(${zvar}^2+(${ke}))`, zl)}=\\frac{1}{${tex(scale)}}\\tan^{-1}\\left(\\frac{${zl}}{${tex(scale)}}\\right)+C`,
      `${int(`(${be})/((${ae})*(${zvar}^2+(${ke})))`, zl)}=${tex(`(${be})/((${ae})*(${scale}))*atan(${zvar}/(${scale}))`)}+C`,
      ...(shifted
        ? [`\\text{Substitute back: }${zl}=${ul}+\\left(${tex(he)}\\right)`]
        : []),
      `\\text{Substitute back: }${ul}=${tex(inner)}`,
      `${int(source.normalized, vl)}=${tex(primitive)}+C`
    );
    return {
      id: "quadratic-arctangent-rule",
      titleZh: "代換／完成平方後套反正切基本公式",
      titleEn: "Substitution / completing the square and the arctangent rule",
      rationaleZh:
        "保留內函數代換、必要的完成平方及分拆，但平方和積分直接用反正切基本公式，不再引入三角代換角；不需分部積分。",
      rationaleEn:
        "Keep the inner substitution, any completing of the square and decomposition, but use the basic arctangent rule directly for the sum of squares, without introducing a trigonometric-substitution angle or using integration by parts.",
      primitive,
      steps,
      partsCost: 0,
      proof: {},
    };
  }
  return null;
}

function verified(source: IntegralResult, candidate: Candidate): boolean {
  if (
    candidate.partsCost < 0 ||
    candidate.partsCost > 2 ||
    !source.antiderivative
  )
    return false;
  if (!symbolsSafe(candidate.primitive, source.variable!)) return false;
  const algebra = new Algebra(candidate.proof);
  return [source.antiderivative, candidate.primitive].every(F =>
    algebra.same(
      derivative(F, source.variable!, { simplify: false }).toString(),
      source.normalized
    )
  );
}
function primitiveLatex(c: Candidate): string {
  const simplified = exactSimplify(c.primitive);
  return tex(
    new Algebra(c.proof).same(simplified, c.primitive)
      ? simplified
      : c.primitive
  );
}
function alternativeIndefinite(
  source: IntegralResult,
  c: Candidate
): IntegralResult {
  return {
    ...source,
    antiderivative: c.primitive,
    answerLatex: `${primitiveLatex(c)}+C`,
    method: c.titleEn,
    methodZh: c.titleZh,
    stepsLatex: c.steps,
    partsCost: c.partsCost,
  };
}
function alternativeDefinite(
  original: DefiniteIntegralResult,
  source: IntegralResult,
  c: Candidate
): DefiniteIntegralResult | null {
  // Only reached after the original engine's interval/status gate has succeeded.
  if (!original.valueExpr) return null;
  const variable = source.variable!,
    F = c.primitive;
  const upper = exactSimplify(substitute(F, variable, original.upper));
  const lower = exactSimplify(substitute(F, variable, original.lower));
  const value = exactSimplify(`(${upper})-(${lower})`);
  const context: ProofContext = {
    ...c.proof,
    trigArgs: c.proof.trigArgs?.flatMap(arg => [
      arg,
      substitute(arg, variable, original.upper),
      substitute(arg, variable, original.lower),
    ]),
    inverseArgs: c.proof.inverseArgs?.flatMap(arg => [
      arg,
      substitute(arg, variable, original.upper),
      substitute(arg, variable, original.lower),
    ]),
  };
  if (
    exactSimplify(`(${value})-(${original.valueExpr})`) !== "0" &&
    !new Algebra(context).same(value, original.valueExpr)
  )
    return null;
  const vl = original.variableLatex ?? tex(variable),
    Ftex = primitiveLatex(c);
  return {
    ...original,
    indefinite: alternativeIndefinite(source, c),
    antiderivativeLatex: Ftex,
    method: `definite integral using ${c.titleEn}`,
    methodZh: `利用「${c.titleZh}」先求原函數，再代入上下限`,
    valueExpr: value,
    valueLatex: tex(value),
    partsCost: c.partsCost,
    stepsLatex: [
      `F(${vl})=${Ftex}`,
      `${vl}=${original.lowerLatex}\\quad\\text{(lower)},\\qquad ${vl}=${original.upperLatex}\\quad\\text{(upper)}`,
      `F\\left(${original.upperLatex}\\right)=${tex(upper)},\\quad F\\left(${original.lowerLatex}\\right)=${tex(lower)}`,
      `\\int_{${original.lowerLatex}}^{${original.upperLatex}}${original.integrandLatex}\\,d${vl}=F\\left(${original.upperLatex}\\right)-F\\left(${original.lowerLatex}\\right)`,
      `=${tex(upper)}-\\left(${tex(lower)}\\right)`,
      `=${tex(value)}`,
    ],
  };
}

/** Return only genuinely different, exactly verified DSE M2 derivations.
 * Each path has its own whole-question parts budget; the original is never mutated.
 * Unsupported patterns, proof-budget exhaustion and failed endpoint equality fail
 * closed to the genuine original result/hint, not an invented alternative.
 */
export function getSolutionPaths(result: Calculation): SolutionPathComparison {
  const first: SolutionPath = {
    id: "original",
    titleZh: result.methodZh,
    titleEn: result.method,
    rationaleZh: "沿用原引擎已計算的結果、推導及定義域提示。",
    rationaleEn:
      "Retain the original engine result, derivation and domain hints.",
    result,
  };
  const single = (): SolutionPathComparison => ({
    paths: [first],
    verification: "single",
    noteZh: `${result.hintZh ? `${result.hintZh} ` : ""}目前未找到另一條已通過精確驗證、真正不同且整題分部積分不超過兩次的 DSE M2 路徑；只保留原解法，這不代表其他解法不存在。`,
    noteEn: `${result.hintEn ? `${result.hintEn} ` : ""}No genuinely different DSE M2 path has passed exact verification within the whole-question limit of two integrations by parts. Only the original is retained; this does not mean other methods do not exist.`,
  });
  if (result.status !== "ok" || (result.partsCost ?? 0) > 2) return single();
  const source = definite(result) ? result.indefinite : result;
  if (
    !source ||
    source.status !== "ok" ||
    !source.antiderivative ||
    !source.variable ||
    source.normalized !== result.normalized ||
    (source.partsCost ?? 0) > 2 ||
    result.normalized.length > 1600
  )
    return single();
  try {
    if (
      !symbolsSafe(source.normalized, source.variable) ||
      (result.variable && result.variable !== source.variable)
    )
      return single();
    const candidate =
      trigSquare(source) ?? semicircle(source) ?? rationalPath(source);
    if (
      !candidate ||
      (candidate.steps.length === source.stepsLatex.length &&
        candidate.steps.every((line, i) => line === source.stepsLatex[i])) ||
      !verified(source, candidate)
    )
      return single();
    const alternate = definite(result)
      ? alternativeDefinite(result, source, candidate)
      : alternativeIndefinite(source, candidate);
    if (!alternate) return single();
    return {
      paths: [
        first,
        {
          id: candidate.id,
          titleZh: candidate.titleZh,
          titleEn: candidate.titleEn,
          rationaleZh: candidate.rationaleZh,
          rationaleEn: candidate.rationaleEn,
          result: alternate,
        },
      ],
      verification: definite(result) ? "same-value" : "constant-difference",
      noteZh: definite(result)
        ? "已先保留原引擎的區間及定義域安全門，再以各路徑自己的原函數代入原端點；精確符號驗證確認定積分值相同。"
        : "兩條原函數均已符號微分並以精確代數／三角恆等式核對同一被積函數，因此在每個連通實數定義域內最多相差常數；不是用數值樣本作證明。",
      noteEn: definite(result)
        ? "The original interval/domain gate is retained. Each path substitutes the original endpoints into its own primitive; exact symbolic verification confirms the same definite value."
        : "Both primitives have been symbolically differentiated and checked against the same integrand using exact algebra / trigonometric identities. They differ at most by a constant on each connected real domain, not by a conclusion drawn from numerical samples.",
    };
  } catch {
    return single();
  }
}
