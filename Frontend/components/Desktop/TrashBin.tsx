import { useDroppable } from "@dnd-kit/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashCan } from "@fortawesome/free-solid-svg-icons";
import styles from "../../styles/Files.module.css";

// Id de la cible droppable "corbeille". Exporté pour que Desktop puisse
// reconnaître ce target dans son onDragEnd (comparaison sur cet id).
export const TRASH_DROP_ID = "__trash__";

// ============================================================
// Corbeille : case droppable fixe du bureau.
// Glisser une icône dessus déclenche la confirmation de suppression
// (gérée par le onDragEnd du parent via TRASH_DROP_ID).
// Non déplaçable, non ouvrable.
// ============================================================
function TrashBin({ size = 110 }: { size?: number }) {
  const { ref, isDropTarget } = useDroppable({ id: TRASH_DROP_ID });

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: 8,
        backgroundColor: isDropTarget ? "rgba(229,72,77,0.18)" : "transparent",
        outline: isDropTarget ? "2px dashed #e5484d" : "none",
        outlineOffset: -2,
        transition: "background-color 0.12s ease",
      }}
    >
      <FontAwesomeIcon
        icon={faTrashCan}
        style={{ color: "#c0c4cc", fontSize: 40 }}
        className={styles.icon}
      />
      <p className={styles.text}>Corbeille</p>
    </div>
  );
}

export default TrashBin;
