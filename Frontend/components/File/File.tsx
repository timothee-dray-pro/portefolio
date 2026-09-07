import DesktopFile from "./DesktopFile";
import ExplorerFile from "./ExplorerFile";
import { FileType } from "../icons";

// Composant File unifié : délègue au sous-composant selon le contexte.
//  - "desktop"  : icône draggable du bureau
//  - "explorer" : entrée de l'explorateur (double-clic)
// Le variant "taskbar" a sa propre logique (index requis pour le tri)
// et s'utilise directement via TaskbarFile, pas via ce composant.
type Variant = "desktop" | "explorer";

function File({
  id,
  type,
  icon,
  name,
  color,
  onOpen,
  variant = "desktop",
}: {
  id: string;
  type: FileType;
  icon?: string;
  name: string;
  color?: string;
  onOpen: (id: string) => void;
  variant?: Variant;
}) {
  const resolvedColor = color || "black";

  if (variant === "explorer") {
    return (
      <ExplorerFile
        id={id}
        type={type}
        icon={icon}
        name={name}
        color={resolvedColor}
        onOpen={onOpen}
      />
    );
  }

  return (
    <DesktopFile
      id={id}
      type={type}
      icon={icon}
      name={name}
      color={resolvedColor}
      onOpen={onOpen}
    />
  );
}

export default File;
