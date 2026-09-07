import styles from "../../styles/TaskBar.module.css";

// Une fenêtre listée dans le menu de survol (données minimales d'affichage).
export type PreviewWindow = {
  windowId: string;
  title: string;
  minimized: boolean;
};

// Menu de survol d'une icône de la barre : liste les fenêtres ouvertes de
// cette app quand il y en a plusieurs, pour en choisir une précisément.
// Le clic sur une entrée met la fenêtre correspondante au premier plan.
function TaskBarPreview({
  windows,
  onSelect,
}: {
  windows: PreviewWindow[];
  onSelect: (windowId: string) => void;
}) {
  return (
    <div className={styles.preview}>
      {windows.map((win) => (
        <button
          key={win.windowId}
          className={styles.previewItem}
          // onMouseDown plutôt que onClick : le survol qui affiche ce menu
          // se ferme au mouseleave ; mousedown se déclenche avant que le
          // curseur ne puisse quitter la zone, le choix est donc fiable.
          onMouseDown={() => onSelect(win.windowId)}
        >
          <span className={styles.previewTitle}>{win.title}</span>
          {win.minimized && (
            <span className={styles.previewBadge}>réduite</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default TaskBarPreview;
