// ============================================================
// Couleurs des apps (par nom de composant) + couleurs par type
// ------------------------------------------------------------
// Centralisé ici pour être partagé entre le Bureau (Desktop) et
// l'Explorateur de fichiers, qui doivent afficher les mêmes teintes.
// En dur (pas en base) : cohérent avec le choix de garder le
// mapping composant/couleur côté code.
// ============================================================

// Couleur par composant d'app (clé = AppEntry.component)
export const APP_COLORS: Record<string, string> = {
  Minesweeper: "red",
  Shell: "black",
  Calculator: "#2f6fdb",
  Explorer: "#F5C24B",
  PowerFour: "#ffd500",
};

// Couleurs par défaut selon le type d'entrée (dossier / fichier simple)
export const FOLDER_COLOR = "#F5C24B"; // jaune dossier
export const FILE_COLOR = "#5B9BD5"; // bleu doux fichier

// Résout la couleur d'affichage d'une entrée.
//  - app    : couleur du composant (fallback noir)
//  - folder : jaune
//  - file   : bleu
// `component` n'est utile que pour les apps.
export function resolveEntryColor(
  type: "file" | "folder" | "app",
  component?: string,
): string {
  if (type === "folder") return FOLDER_COLOR;
  if (type === "file") return FILE_COLOR;
  // app
  return (component && APP_COLORS[component]) || "black";
}
