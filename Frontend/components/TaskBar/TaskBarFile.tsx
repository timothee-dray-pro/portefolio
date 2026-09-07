import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useRef, useState } from "react";
import styles from "../../styles/TaskBar.module.css";
import { useSortable } from "@dnd-kit/react/sortable";
import { resolveIcon } from "../icons";
import TaskBarPreview, { PreviewWindow } from "./TaskBarPreview";

// Délai avant fermeture du menu de survol : laisse le temps à la souris de
// traverser le petit espace entre l'icône et le menu sans que ça se ferme.
const PREVIEW_CLOSE_DELAY_MS = 300;

// Variant "taskbar" : une app épinglée dans la barre des tâches.
// Sortable horizontalement (les autres apps se décalent au survol).
function TaskbarFile({
  id,
  index,
  icon,
  color,
  name,
  onClick,
  onSelectWindow,
  isOpen,
  isFocused,
  windows,
}: {
  id: string; // = appId
  index: number; // position dans la barre (requis par useSortable)
  icon?: string;
  color: string;
  name: string;
  onClick: (id: string) => void; // clic simple : focus le plus récent / ouvre
  onSelectWindow: (windowId: string) => void; // choix précis via le survol
  isOpen: boolean; // au moins une fenêtre de cette app est ouverte
  isFocused: boolean; // cette app est au premier plan
  windows: PreviewWindow[]; // fenêtres ouvertes de cette app (pour le survol)
}) {
  const { ref, isDragSource } = useSortable({ id, index });

  // Menu de survol affiché uniquement s'il y a plusieurs fenêtres à départager.
  const [hovered, setHovered] = useState<boolean>(false);
  const showPreview = hovered && windows.length > 1;

  // Le timer de fermeture différée : on le garde en ref pour pouvoir
  // l'annuler si la souris revient (sur l'icône OU sur le menu) avant
  // qu'il ne se déclenche.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setHovered(false);
    }, PREVIEW_CLOSE_DELAY_MS);
  };

  // Si la fenêtre change d'ordre (drag) ou l'app est démontée pendant que le
  // timer court, on l'annule pour ne pas déclencher un setState orphelin.
  useEffect(() => cancelClose, []);

  // Classe de l'indicateur : rien / point "ouvert" / barre "focus".
  let indicatorClass = styles.indicator;
  if (isFocused) {
    indicatorClass = `${styles.indicator} ${styles.indicatorFocused}`;
  } else if (isOpen) {
    indicatorClass = `${styles.indicator} ${styles.indicatorOpen}`;
  }

  return (
    <div
      ref={ref}
      className={styles.taskbarItem}
      onClick={() => onClick(id)}
      onMouseEnter={() => {
        cancelClose();
        setHovered(true);
      }}
      onMouseLeave={scheduleClose}
      title={windows.length > 1 ? undefined : name}
      style={{ opacity: isDragSource ? 0.4 : 1 }}
    >
      <FontAwesomeIcon
        icon={resolveIcon("app", icon)}
        style={{ color }}
        className={styles.taskbarIcon}
      />

      {/* Indicateur d'état sous l'icône (masqué si l'app n'est pas ouverte) */}
      <span
        className={indicatorClass}
        style={isFocused ? { backgroundColor: color } : undefined}
      />

      {/* Menu de survol : choix de la fenêtre quand plusieurs sont ouvertes */}
      {showPreview && (
        <div onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
          <TaskBarPreview windows={windows} onSelect={onSelectWindow} />
        </div>
      )}
    </div>
  );
}

export default TaskbarFile;
