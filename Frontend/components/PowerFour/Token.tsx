import { motion } from "framer-motion";

function Token({
  color,
  row,
  col,
}: {
  color: "red" | "yellow";
  row: number;
  col: number;
}) {
  // Id unique par case : plusieurs jetons de même couleur coexistent dans le
  // DOM, et des ids SVG dupliqués provoquent des références croisées entre
  // gradients (le navigateur prend toujours le premier id trouvé).
  const gradientId = `${color}Grad-${row}-${col}`;
  const ringColor = color === "red" ? "#a5281f" : "#b8860b";
  const gradDark = color === "red" ? "#c0392b" : "#d9a017";
  const gradMain = color === "red" ? "#e5484d" : "#f5c518";

  const fallDistance = `-${row * 100}%`;

  return (
    <motion.div
      initial={{ y: fallDistance, rotate: -180 }}
      animate={{ y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        zIndex: 0,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="25%">
            <stop offset="0%" stopColor={gradDark} />
            <stop offset="100%" stopColor={gradMain} />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="34" fill={ringColor} />
        <circle cx="50" cy="50" r="27" fill={`url(#${gradientId})`} />
      </svg>
    </motion.div>
  );
}

export default Token;
