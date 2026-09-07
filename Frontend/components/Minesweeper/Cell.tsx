import style from "../../styles/Minesweeper.module.css";
import { faBomb } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// -3 = rien mais enfoncé
// -2 = bomb
// -1 = flag
// 0 = vide donc activable
// 0> = nombre classique
const numberToColor: Record<number, string> = {
  [-2]: "red",
  [-3]: "#DDE0E8",
  1: "#3B82F6",
  2: "#22C55E",
  3: "#EF4444",
  4: "#6366F1",
  5: "#F97316",
  6: "#06B6D4",
  7: "#111827",
  8: "#6B7280",
};

function Cell({
  value,
  position,
  updateGrid,
  updateFlag,
}: {
  value: number;
  position: string;
  updateGrid: (position: string) => void;
  updateFlag: (position: string) => void;
}) {
  // Contenu de la case selon sa valeur — remplace la cascade de ternaires
  // imbriqués, illisible et impossible à faire évoluer proprement.
  const renderContent = () => {
    if (value === -1) return <p>🚩</p>;

    if (value === -2)
      return <FontAwesomeIcon icon={faBomb} style={{ color: "black" }} />;

    if (value > 0)
      return (
        <p style={{ color: numberToColor[value], fontWeight: 750 }}>{value}</p>
      );

    return null; // 0 (cachée) ou -3 (révélée vide)
  };

  return (
    <button
      onClick={() => {
        if (value === 0) {
          updateGrid(position);
        }
      }}
      onContextMenu={(e) => {
        // Sans ça, le clic droit ouvre le menu contextuel du navigateur
        // par-dessus le jeu à chaque pose de drapeau.
        e.preventDefault();

        if (value === 0 || value === -1) {
          updateFlag(position);
        }
      }}
      style={
        value !== 0
          ? value <= -2
            ? {
                cursor: "default",
                transform: "translateY(1px)",
                backgroundColor: numberToColor[value],
                boxShadow:
                  "0 1px 2px rgba(0, 0, 0, 0.08), inset 0 2px 4px rgba(0, 0, 0, 0.08)",
              }
            : {
                cursor: "default",
                transform: "translateY(1px)",
                boxShadow:
                  "0 1px 2px rgba(0, 0, 0, 0.08), inset 0 2px 4px rgba(0, 0, 0, 0.08)",
              }
          : {}
      }
      className={style.cell}
    >
      {renderContent()}
    </button>
  );
}

export default Cell;
