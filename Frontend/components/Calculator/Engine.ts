// ============================================================
// Moteur de calcul (logique pure, sans React)
// ============================================================
//
// - Gère : + - × ÷, parenthèses, décimales, pourcentage façon
//   calculatrice Windows.
// - Sémantique du % :
//     a + b%   -> a + (a * b/100)      ex: 200 + 10% = 220
//     a - b%   -> a - (a * b/100)      ex: 200 - 10% = 180
//     a × b%   -> a × (b/100)          ex: 200 × 10% = 20
//     a ÷ b%   -> a ÷ (b/100)          ex: 200 ÷ 10% = 2000
//     b% seul  -> b/100                ex: 10% = 0.1
// ============================================================

// Opérateurs internes (le moteur travaille avec * et /,
// l'UI affiche × et ÷).
type Operator = "+" | "-" | "*" | "/";

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: Operator }
  | { type: "percent" } // % post-fixe
  | { type: "lparen" }
  | { type: "rparen" };

const PRECEDENCE: Record<Operator, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
};

// ------------------------------------------------------------
// 1. Tokenizer : string -> Token[]
// ------------------------------------------------------------
// Attend une expression avec "." comme séparateur décimal et
// "*" / "/" comme opérateurs (conversion faite en amont par l'UI).
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    // espaces ignorés
    if (char === " ") {
      i++;
      continue;
    }

    // nombre (chiffres + point décimal)
    if (/[0-9.]/.test(char)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    // opérateurs
    if (char === "+" || char === "-" || char === "*" || char === "/") {
      tokens.push({ type: "operator", value: char });
      i++;
      continue;
    }

    if (char === "%") {
      tokens.push({ type: "percent" });
      i++;
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }

    // caractère inattendu
    throw new Error(`Caractère invalide : ${char}`);
  }

  return tokens;
}

// ------------------------------------------------------------
// 2. Gestion du moins unaire
// ------------------------------------------------------------
// Transforme les "-" unaires (ex: "-5", "3 × -2", "(-4)") en
// multiplication par -1 pour simplifier l'évaluation.
function handleUnaryMinus(tokens: Token[]): Token[] {
  const result: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === "operator" && token.value === "-") {
      const prev = result[result.length - 1];
      const isUnary =
        !prev || prev.type === "operator" || prev.type === "lparen";

      if (isUnary) {
        // -X devient (0 - X) via un 0 implicite
        result.push({ type: "number", value: 0 });
        result.push({ type: "operator", value: "-" });
        continue;
      }
    }

    result.push(token);
  }

  return result;
}

// ------------------------------------------------------------
// 3. Shunting-yard : infixe -> RPN (postfixe)
// ------------------------------------------------------------
function toRPN(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const operators: Token[] = [];

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
    } else if (token.type === "percent") {
      // le % s'applique au nombre déjà présent en sortie
      output.push(token);
    } else if (token.type === "operator") {
      while (
        operators.length > 0 &&
        operators[operators.length - 1].type === "operator" &&
        PRECEDENCE[
          (operators[operators.length - 1] as { value: Operator }).value
        ] >= PRECEDENCE[token.value]
      ) {
        output.push(operators.pop()!);
      }
      operators.push(token);
    } else if (token.type === "lparen") {
      operators.push(token);
    } else if (token.type === "rparen") {
      while (
        operators.length > 0 &&
        operators[operators.length - 1].type !== "lparen"
      ) {
        output.push(operators.pop()!);
      }
      if (operators.length === 0) {
        throw new Error("Parenthèses déséquilibrées");
      }
      operators.pop(); // retire la lparen
    }
  }

  while (operators.length > 0) {
    const op = operators.pop()!;
    if (op.type === "lparen") {
      throw new Error("Parenthèses déséquilibrées");
    }
    output.push(op);
  }

  return output;
}

// ------------------------------------------------------------
// 4. Évaluation de la RPN avec sémantique pourcentage
// ------------------------------------------------------------
function evalRPN(rpn: Token[]): number {
  const stack: number[] = [];

  for (let i = 0; i < rpn.length; i++) {
    const token = rpn[i];

    if (token.type === "number") {
      stack.push(token.value);
    } else if (token.type === "percent") {
      // % post-fixe : dépend de l'opérateur qui suit dans la RPN.
      // On regarde le prochain opérateur pour décider du sens.
      const nextOp = findNextOperator(rpn, i + 1);
      const value = stack.pop()!;

      if (nextOp === "+" || nextOp === "-") {
        // relatif à l'opérande de gauche (base encore dans la pile)
        const base = stack[stack.length - 1] ?? 0;
        stack.push((base * value) / 100);
      } else {
        // ×, ÷ ou rien : simple division par 100
        stack.push(value / 100);
      }
    } else if (token.type === "operator") {
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push(applyOperator(token.value, a, b));
    }
  }

  if (stack.length !== 1) {
    throw new Error("Expression invalide");
  }

  return stack[0];
}

// Cherche le prochain opérateur binaire dans la RPN à partir de `from`
function findNextOperator(rpn: Token[], from: number): Operator | null {
  for (let i = from; i < rpn.length; i++) {
    if (rpn[i].type === "operator") {
      return (rpn[i] as { value: Operator }).value;
    }
  }
  return null;
}

function applyOperator(op: Operator, a: number, b: number): number {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) throw new Error("Division par zéro");
      return a / b;
  }
}

// ------------------------------------------------------------
// API publique
// ------------------------------------------------------------
// Évalue une expression et retourne le résultat numérique.
// Lève une Error si l'expression est invalide (à catcher côté UI).
export function evaluate(expr: string): number {
  const tokens = handleUnaryMinus(tokenize(expr));
  const rpn = toRPN(tokens);
  const result = evalRPN(rpn);

  if (!isFinite(result)) {
    throw new Error("Résultat invalide");
  }

  return result;
}
