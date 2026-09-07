import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "../../styles/Files.module.css";
import { useDraggable } from "@dnd-kit/react";
import { resolveIcon, FileType } from "../icons";

// Variant "desktop" : icône draggable sur le bureau.
function DesktopFile({
  id,
  type,
  icon,
  name,
  color,
  onOpen,
}: {
  id: string;
  type: FileType;
  icon?: string;
  name: string;
  color: string;
  onOpen: (id: string) => void;
}) {
  const { ref } = useDraggable({ id });

  return (
    <div
      ref={ref}
      className={styles.container}
      onDoubleClick={() => onOpen(id)}
    >
      <FontAwesomeIcon
        icon={resolveIcon(type, icon)}
        style={{ color }}
        className={styles.icon}
      />
      <p className={styles.text}>{name}</p>
    </div>
  );
}

export default DesktopFile;
