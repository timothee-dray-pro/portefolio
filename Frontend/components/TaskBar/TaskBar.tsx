import styles from "../../styles/TaskBar.module.css";
import { useEffect, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import TaskbarFile from "./TaskBarFile";
import {
  AppEntry,
  getTaskbarApps,
  reorderTaskbar,
  initializeTaskbar,
} from "../../Data/indexeddb";
import { APP_COLORS } from "../../Data/appColors";
import { useFileSystemStore } from "../../Data/FileSystemStore";
import { useWindowManager, WindowKind } from "../../Data/WindowManagerStore";
import { useWindowStore } from "../../Data/WindowsStore";

// Mapping nom de composant d'app (DB) -> kind du window manager
const COMPONENT_TO_KIND: Record<string, WindowKind> = {
  Minesweeper: "minesweeper",
  Shell: "shell",
  Calculator: "calculator",
  Explorer: "explorer",
  Notepad: "notepad",
  PowerFour: "powerfour",
};

function TaskBar() {
  // Liste ordonnée des apps épinglées (source de vérité locale)
  const [apps, setApps] = useState<AppEntry[]>([]);

  const version = useFileSystemStore((s) => s.version);
  const openWindow = useWindowManager((s) => s.openWindow);
  const setMinimized = useWindowManager((s) => s.setMinimized);

  // Fenêtres ouvertes (données) : quels "kind" sont ouverts + leurs infos.
  const openWindows = useWindowManager((s) => s.windows);
  // Fenêtres (z-index) : ordre de premier plan + actions de focus.
  const focusWindows = useWindowStore((s) => s.windows);
  const getFocusedId = useWindowStore((s) => s.getFocusedId);
  const updateZIndex = useWindowStore((s) => s.updateZIndex);

  // Kinds actuellement ouverts (au moins une fenêtre) -> pour le point "ouvert".
  const openKinds = new Set(openWindows.map((w) => w.kind));

  // Kind de la fenêtre au premier plan -> pour l'indicateur "focus".
  const focusedId = getFocusedId();
  const focusedWindow = openWindows.find((w) => w.windowId === focusedId);
  const focusedKind = focusedWindow ? focusedWindow.kind : null;

  // Charge les apps épinglées dans l'ordre stocké
  useEffect(() => {
    const load = async () => {
      await initializeTaskbar(); // remplit avec les apps par défaut si vide
      const list = await getTaskbarApps();
      setApps(list);
    };
    load();
  }, [version]);

  // Met une fenêtre précise au premier plan : on la restaure si elle était
  // réduite, puis on remonte son z-index.
  const focusWindow = (windowId: string): void => {
    setMinimized(windowId, false);
    updateZIndex(windowId);
  };

  // Renvoie les fenêtres ouvertes d'un kind, ordonnées de la plus récemment
  // active à la plus ancienne (via le z-index décroissant de WindowsStore).
  const getWindowsOfKind = (kind: WindowKind) => {
    const zIndexById = new Map(focusWindows.map((w) => [w.id, w.zIndex]));

    return openWindows
      .filter((w) => w.kind === kind)
      .sort(
        (a, b) =>
          (zIndexById.get(b.windowId) ?? 0) - (zIndexById.get(a.windowId) ?? 0),
      );
  };

  // Clic sur une icône : comportement "barre des tâches Windows".
  //  - aucune fenêtre de ce kind -> on en ouvre une
  //  - au moins une -> on met au premier plan la plus récemment active
  //    (jamais de doublon créé depuis la barre)
  const handleIconClick = (appId: string): void => {
    const app = apps.find((a) => a.id === appId);
    if (!app) return;

    const kind = COMPONENT_TO_KIND[app.component];
    if (!kind) return;

    const existing = getWindowsOfKind(kind);

    if (existing.length === 0) {
      openWindow({
        kind,
        title: app.name,
        icon: app.icon,
        color: APP_COLORS[app.component] ?? "black",
        minWidth: app.config.minWidth ?? app.config.width,
        minHeight: app.config.minHeight ?? app.config.height,
      });
    } else {
      focusWindow(existing[0].windowId); // la plus récemment active
    }
  };

  return (
    <div className={styles.taskbar}>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;

          const { source } = event.operation;
          if (!isSortable(source)) return;

          const { initialIndex, index } = source;
          if (initialIndex === index) return; // pas de changement

          setApps((prev) => {
            const next = [...prev];
            const [moved] = next.splice(initialIndex, 1);
            next.splice(index, 0, moved);

            // Persiste le nouvel ordre dans les settings
            reorderTaskbar(next.map((a) => a.id));

            return next;
          });
        }}
      >
        <div className={styles.taskbarItems}>
          {apps.map((app, index) => {
            const kind = COMPONENT_TO_KIND[app.component];
            const windowsOfKind = kind ? getWindowsOfKind(kind) : [];

            return (
              <TaskbarFile
                key={app.id}
                id={app.id}
                index={index}
                icon={app.icon}
                color={APP_COLORS[app.component] ?? "black"}
                name={app.name}
                onClick={handleIconClick}
                onSelectWindow={focusWindow}
                isOpen={kind ? openKinds.has(kind) : false}
                isFocused={kind ? focusedKind === kind : false}
                windows={windowsOfKind.map((w) => ({
                  windowId: w.windowId,
                  title: w.title,
                  minimized: w.minimized,
                }))}
              />
            );
          })}
        </div>
      </DragDropProvider>
    </div>
  );
}

export default TaskBar;
