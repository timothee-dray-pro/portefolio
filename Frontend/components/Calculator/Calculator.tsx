import style from "../../styles/Calculator.module.css";
import { useState } from "react";
import { evaluate } from "./Engine";

function Calculator() {
  // Expression en cours, stockée en interne avec les symboles d'affichage
  // (× ÷ , ) — la conversion vers *, /, . se fait juste avant l'évaluation.
  const [expression, setExpression] = useState<string>("");
  const [result, setResult] = useState<string>("0");
  const [isResult, setIsResult] = useState<boolean>(false); // le dernier "=" a produit un résultat

  // Convertit l'expression d'affichage en syntaxe comprise par le moteur
  const toEngineSyntax = (expr: string): string =>
    expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, ".");

  // Formate un nombre pour l'affichage (virgule décimale, pas de .0 inutile)
  const formatResult = (n: number): string => {
    // arrondi pour éviter les artefacts de flottants (0.1 + 0.2)
    const rounded = Math.round(n * 1e10) / 1e10;
    return rounded.toString().replace(".", ",");
  };

  // Ajoute un symbole à l'expression
  const append = (symbol: string): void => {
    setExpression((prev) => {
      // si on repart après un "=", on efface d'abord
      if (isResult) {
        setIsResult(false);
        // un opérateur enchaîne sur le résultat, un chiffre repart de zéro
        if ("+-×÷%".includes(symbol)) {
          return result.replace(",", ",") + symbol;
        }
        return symbol;
      }
      return prev + symbol;
    });
  };

  const clearAll = (): void => {
    setExpression("");
    setResult("0");
    setIsResult(false);
  };

  // Décide d'ouvrir "(" ou fermer ")" selon le contexte de l'expression
  const toggleParen = (): void => {
    setExpression((prev) => {
      // repart proprement si on enchaîne après un "="
      const base = isResult ? "" : prev;
      if (isResult) setIsResult(false);

      const open = (base.match(/\(/g) || []).length;
      const close = (base.match(/\)/g) || []).length;
      const last = base[base.length - 1];

      // Peut-on fermer ? il faut une parenthèse ouverte non refermée,
      // et un dernier caractère qui autorise une fermeture (chiffre ou ")").
      const canClose =
        open > close && last !== undefined && /[0-9)]/.test(last);

      return base + (canClose ? ")" : "(");
    });
  };

  const deleteLast = (): void => {
    if (isResult) {
      clearAll();
      return;
    }
    setExpression((prev) => prev.slice(0, -1));
  };

  // Inverse le signe : enveloppe l'expression courante dans (0 - ...)
  const negate = (): void => {
    if (expression === "") return;
    setExpression((prev) => {
      // si déjà négassocié simplement, on retire ; sinon on enveloppe
      if (prev.startsWith("-(") && prev.endsWith(")")) {
        return prev.slice(2, -1);
      }
      return `-(${prev})`;
    });
  };

  const compute = (): void => {
    if (expression === "") return;
    try {
      const value = evaluate(toEngineSyntax(expression));
      setResult(formatResult(value));
      setIsResult(true);
    } catch {
      setResult("Erreur");
      setIsResult(true);
    }
  };

  // Définition des boutons : label + action + éventuelle classe de style
  type Btn = {
    label: string;
    onClick: () => void;
    variant?: "operator" | "function" | "equals";
    wide?: boolean;
  };

  const buttons: Btn[] = [
    { label: "C", onClick: clearAll, variant: "function" },
    { label: "( )", onClick: toggleParen, variant: "function" },
    { label: "%", onClick: () => append("%"), variant: "function" },
    { label: "÷", onClick: () => append("÷"), variant: "operator" },

    { label: "7", onClick: () => append("7") },
    { label: "8", onClick: () => append("8") },
    { label: "9", onClick: () => append("9") },
    { label: "×", onClick: () => append("×"), variant: "operator" },

    { label: "4", onClick: () => append("4") },
    { label: "5", onClick: () => append("5") },
    { label: "6", onClick: () => append("6") },
    { label: "−", onClick: () => append("-"), variant: "operator" },

    { label: "1", onClick: () => append("1") },
    { label: "2", onClick: () => append("2") },
    { label: "3", onClick: () => append("3") },
    { label: "+", onClick: () => append("+"), variant: "operator" },

    { label: "±", onClick: negate, variant: "function" },
    { label: "0", onClick: () => append("0") },
    { label: ",", onClick: () => append(",") },
    { label: "=", onClick: compute, variant: "equals" },
  ];

  return (
    <div className={style.calculator}>
      {/* Écran */}
      <div className={style.screen}>
        <div className={style.expression}>{expression || "\u00A0"}</div>
        <div className={style.result}>{result}</div>
      </div>

      {/* Clavier */}
      <div className={style.keypad}>
        {buttons.map((btn) => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            className={[
              style.key,
              btn.variant === "operator" ? style.operator : "",
              btn.variant === "function" ? style.function : "",
              btn.variant === "equals" ? style.equals : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {btn.label}
          </button>
        ))}

        {/* Bouton retour arrière, pleine largeur sous le clavier */}
        <button
          onClick={deleteLast}
          className={[style.key, style.backspace].join(" ")}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}

export default Calculator;
