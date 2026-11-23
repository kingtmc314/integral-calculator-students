import { parse, simplify, fraction, type MathNode } from "mathjs";

// Protect transcendental constants from mathjs's numerical constant evaluation.
// Numeric evaluation is used only to identify standard exact angles, never as an answer.
export function exactSimplify(expression: string): string {
  try {
    const constants = new Map<string, string>();
    let serial = 0;
    const protect = (value: string): MathNode => {
      const existing = Array.from(constants).find(([, v]) => v === value);
      if (existing) return parse(existing[0]);
      const key = `exactconstant${serial++}`;
      constants.set(key, value);
      return parse(key);
    };
    const visit = (node: any): MathNode => {
      if (node.type === "ParenthesisNode") return visit(node.content);
      if (node.args) node = node.clone().map((child: MathNode) => visit(child));
      const constant = (n: any): boolean => {
        let ok = true;
        n.traverse((c: any) => {
          if (
            c.type === "SymbolNode" &&
            ![
              "pi",
              "e",
              "sqrt",
              "sin",
              "cos",
              "tan",
              "asin",
              "acos",
              "atan",
              "log",
              "exp",
              "abs",
              "sec",
              "csc",
              "cot",
            ].includes(c.name)
          )
            ok = false;
        });
        return ok;
      };
      const restoreText = (text: string) => {
        for (const [key, value] of Array.from(constants))
          text = text.replace(new RegExp(`\\b${key}\\b`, "g"), `(${value})`);
        return text;
      };
      if (node.type === "FunctionNode") {
        const name = node.fn?.name;
        // Children have already been visited, so exact constant functions and
        // powers are placeholders while algebraic cancellation removes variables.
        // Decide whether this function is constant only after that cancellation.
        node = node.clone();
        node.args = node.args.map((arg: MathNode) => simplify(arg));
        const text = restoreText(node.toString());
        const rawArgs = node.args.map((a: any) =>
          parse(restoreText(a.toString()))
        );
        if (!rawArgs.every(constant)) return node;
        const arg = rawArgs[0];
        const numeric = () => Number(arg.compile().evaluate());
        if (name === "sqrt") {
          const n = numeric();
          if (Number.isInteger(n) && n >= 0) {
            if (Number.isInteger(Math.sqrt(n)))
              return parse(String(Math.sqrt(n)));
            let factor = 1;
            let remaining = n;
            for (let k = 2; k * k <= remaining; k++)
              while (remaining % (k * k) === 0) {
                factor *= k;
                remaining /= k * k;
              }
            return protect(
              factor === 1
                ? `sqrt(${remaining})`
                : `${factor}*sqrt(${remaining})`
            );
          }
          let rational = true;
          arg.traverse((c: any) => {
            if (c.type === "FunctionNode" || c.type === "SymbolNode")
              rational = false;
          });
          if (rational && n >= 0) {
            const f = fraction(n);
            const numerator = Number(f.n),
              denominator = Number(f.d);
            if (
              Number.isInteger(Math.sqrt(numerator)) &&
              Number.isInteger(Math.sqrt(denominator))
            )
              return parse(
                simplify(
                  `${Math.sqrt(numerator)}/${Math.sqrt(denominator)}`
                ).toString()
              );
            if (numerator < 1e6 && denominator < 1e6)
              return protect(`sqrt(${numerator * denominator})/${denominator}`);
          }
          return protect(text);
        }
        if (name === "abs") {
          const n = numeric();
          if (!Number.isFinite(n)) return protect(text);
          const clean = arg.toString();
          let rational = true;
          arg.traverse((c: any) => {
            if (c.type === "FunctionNode" || c.type === "SymbolNode")
              rational = false;
          });
          if (rational || clean === "e" || clean === "pi")
            return n >= 0 ? visit(arg) : visit(parse(`-(${clean})`));
          return protect(text);
        }
        if (["sin", "cos", "tan"].includes(name)) {
          const angle = numeric() / Math.PI;
          const twelfths = Math.round(angle * 12);
          if (Math.abs(angle * 12 - twelfths) < 1e-10) {
            const k = ((twelfths % 24) + 24) % 24;
            const sine: Record<number, string> = {
              0: "0",
              2: "1/2",
              3: "sqrt(2)/2",
              4: "sqrt(3)/2",
              6: "1",
              8: "sqrt(3)/2",
              9: "sqrt(2)/2",
              10: "1/2",
              12: "0",
              14: "-1/2",
              15: "-sqrt(2)/2",
              16: "-sqrt(3)/2",
              18: "-1",
              20: "-sqrt(3)/2",
              21: "-sqrt(2)/2",
              22: "-1/2",
            };
            const sinValue = sine[k];
            const cosValue = sine[(k + 6) % 24];
            const value =
              name === "sin"
                ? sinValue
                : name === "cos"
                  ? cosValue
                  : cosValue && cosValue !== "0" && sinValue
                    ? `(${sinValue})/(${cosValue})`
                    : undefined;
            if (value) return visit(parse(value));
          }
          return protect(text);
        }
        if (["asin", "acos", "atan"].includes(name)) {
          const n = numeric();
          const angles =
            name === "atan"
              ? [-1 / 3, -1 / 4, -1 / 6, 0, 1 / 6, 1 / 4, 1 / 3]
              : name === "asin"
                ? [
                    -1 / 2,
                    -1 / 3,
                    -1 / 4,
                    -1 / 6,
                    0,
                    1 / 6,
                    1 / 4,
                    1 / 3,
                    1 / 2,
                  ]
                : [0, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 5 / 6, 1];
          for (const a of angles) {
            const fn =
              name === "atan"
                ? Math.tan
                : name === "asin"
                  ? Math.sin
                  : Math.cos;
            if (Math.abs(n - fn(a * Math.PI)) < 1e-12)
              return a === 0
                ? parse("0")
                : protect(simplify(`${a}*pi`).toString());
          }
          return protect(text);
        }
        if (name === "log") {
          const n = numeric();
          if (n === 1) return parse("0");
          if (arg.toString() === "e" && rawArgs.length === 1) return parse("1");
          if (rawArgs.length === 2 && arg.toString() === rawArgs[1].toString())
            return parse("1");
          return protect(text);
        }
        if (name === "exp")
          return numeric() === 0
            ? parse("1")
            : protect(`e^(${arg.toString()})`);
        return protect(text);
      }
      if (node.type === "OperatorNode" && node.op === "^") {
        const [base, power] = node.args;
        const b = restoreText(base.toString());
        const p = restoreText(power.toString());
        const pb = parse(b);
        const pp = parse(p);
        let rootBase: any = pb;
        while (rootBase.type === "ParenthesisNode") rootBase = rootBase.content;
        const exponent = constant(pp) ? Number(pp.compile().evaluate()) : NaN;
        if (
          rootBase.type === "FunctionNode" &&
          rootBase.fn?.name === "sqrt" &&
          Number.isInteger(exponent / 2)
        )
          return visit(
            parse(`(${rootBase.args[0].toString()})^(${exponent / 2})`)
          );
        if (constant(pb) && constant(pp)) {
          const n = Number(pp.compile().evaluate());
          if (b === "e" || b.includes("pi") || !Number.isInteger(n))
            return n === 0 ? parse("1") : protect(`(${b})^(${p})`);
        }
      }
      return node;
    };
    let result = simplify(visit(parse(expression))).toString();
    // All placeholders are atomic during simplification; restore in reverse order.
    for (const [key, value] of Array.from(constants).reverse())
      result = result.replace(new RegExp(`\\b${key}\\b`, "g"), `(${value})`);
    return parse(result).toString();
  } catch {
    return expression;
  }
}
