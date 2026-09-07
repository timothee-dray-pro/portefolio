import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "../../styles/Files.module.css";
import { resolveIcon, FileType } from "../icons";

// Variant "explorer" : entrée dans l'explorateur.
// Le drag & drop est géré par le composant parent (ExplorerItem),
// ici on ne gère que l'affichage + le double-clic.
function ExplorerFile({
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
  return (
    <div className={styles.explorerItem} onDoubleClick={() => onOpen(id)}>
      <FontAwesomeIcon
        icon={resolveIcon(type, icon)}
        style={{ color }}
        className={styles.icon}
      />
      <p className={styles.text}>{name}</p>
    </div>
  );
}

export default ExplorerFile;
