import {
  faFolder,
  faFile,
  faBomb,
  faTerminal,
  faCalculator,
  faFolderOpen,
  faNoteSticky,
  faCircle,
} from "@fortawesome/free-solid-svg-icons";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";

// Icônes spécifiques des apps (par nom d'icône stocké dans AppEntry.icon)
export const APP_ICONS: Record<string, IconDefinition> = {
  mine: faBomb,
  shell: faTerminal,
  calculator: faCalculator,
  explorer: faFolderOpen,
  notepad: faNoteSticky,
  powerfour: faCircle,
};

export type FileType = "file" | "folder" | "app";

// Icône déduite du type ; pour une app, on prend son icône spécifique
export function resolveIcon(type: FileType, icon?: string): IconDefinition {
  if (type === "folder") return faFolder;
  if (type === "app") return (icon && APP_ICONS[icon]) || faFile;
  return faFile; // type "file"
}
