import styles from "../../styles/Explorer.module.css";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import File from "../File/File";
import { FileEntry } from "../../Data/indexeddb";

function ExplorerItem({
  entry,
  icon,
  color,
  onOpen,
  onSelect,
  selected,
}: {
  entry: FileEntry;
  icon?: string;
  color: string;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  selected: boolean;
}) {
  const { ref: dragRef } = useDraggable({ id: entry.path });
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: entry.path,
    disabled: entry.type !== "folder", // seuls les dossiers acceptent un dépôt
  });

  // Combine les deux refs (draggable + droppable) sur le même élément
  const setRefs = (node: HTMLElement | null) => {
    dragRef(node);
    if (entry.type === "folder") dropRef(node);
  };

  // Classe combinée : cible de drop et/ou sélectionné
  const className = [
    isDropTarget ? styles.dropTarget : "",
    selected ? styles.selected : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setRefs}
      className={className || undefined}
      onClick={() => onSelect(entry.path)}
    >
      <File
        id={entry.path}
        type={entry.type}
        icon={icon}
        color={color}
        name={entry.name}
        onOpen={onOpen}
        variant="explorer"
      />
    </div>
  );
}

export default ExplorerItem;
