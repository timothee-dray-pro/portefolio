import { useEffect, useState, ReactNode } from "react";
import styles from "../../styles/Desktop.module.css";
import File from "../File/File";
import Droppable from "./Droppable";
import TrashBin, { TRASH_DROP_ID } from "./TrashBin";
import { DragDropProvider } from "@dnd-kit/react";
import Window from "../Window";
import Minesweeper from "../Minesweeper/Minesweeper";
import Shell from "../Shell/Shell";
import Calculator from "../Calculator/Calculator";
import Explorer from "../Explorer/Explorer";
import Notepad from "../NotePad/NotePad";
import PowerFour from "../PowerFour/PowerFour";
import Modal from "../Modal/Modal";
import {
  AppEntry,
  FileEntry,
  getApp,
  getFile,
  getFilesByParent,
  initializeFileSystem,
  Debug,
  getDesktopPositions,
  setDesktopPosition,
  deleteEntry,
} from "../../Data/indexeddb";
import { APP_COLORS, resolveEntryColor } from "../../Data/appColors";
import { useFileSystemStore } from "../../Data/FileSystemStore";
import {
  useWindowManager,
  WindowKind,
  WindowProps,
} from "../../Data/WindowManagerStore";

const DROPPABLE_SIZE = 110;

// Position réservée à la corbeille sur le bureau (coin haut-gauche par défaut).
// Cette case n'accueille jamais d'autre icône.
const TRASH_POSITION = "grid_0-0";

// Reconstruit le composant d'une fenêtre à partir de son kind + props.
// Le store window manager ne contient que des données ; c'est ici que
// l'on retrouve le vrai composant React. windowId est injecté pour les
// composants qui doivent pouvoir fermer leur propre fenêtre.
function renderWindowContent(
  kind: WindowKind,
  windowId: string,
  props?: WindowProps,
): ReactNode {
  switch (kind) {
    case "minesweeper":
      return <Minesweeper />;
    case "shell":
      return <Shell />;
    case "calculator":
      return <Calculator />;
    case "explorer":
      return (
        <Explorer
          windowId={windowId}
          {...(props as {
            initialPath?: string;
            saveMode?: {
              contentToSave: string;
              onSaved: (path: string) => void;
            };
          })}
        />
      );
    case "notepad":
      return (
        <Notepad
          {...(props as { initialPath?: string; initialContent?: string })}
        />
      );
    case "powerfour":
      return <PowerFour />;
    default:
      return null;
  }
}

// Mapping nom de composant d'app (DB) -> kind du window manager
const COMPONENT_TO_KIND: Record<string, WindowKind> = {
  Minesweeper: "minesweeper",
  Shell: "shell",
  Calculator: "calculator",
  Explorer: "explorer",
  Notepad: "notepad",
  PowerFour: "powerfour",
};

// Un item affiché sur le bureau (icône)
type DesktopItem = {
  id: string; // = path en DB
  type: "file" | "folder" | "app";
  position: string;
  icon?: string; // nom d'icône (apps)
  name: string;
  color: string;
  appId?: string; // pour les apps
};

function Desktop() {
  const [items, setItems] = useState<DesktopItem[]>([]);
  const [gridId, setGridId] = useState<string[][]>([]);

  // Synchronisation du système de fichiers : recharge le bureau à chaque modif
  const version = useFileSystemStore((s) => s.version);

  // Window manager : liste des fenêtres ouvertes + actions
  const windows = useWindowManager((s) => s.windows);
  const openWindow = useWindowManager((s) => s.openWindow);
  const closeWindow = useWindowManager((s) => s.closeWindow);

  // Confirmation de suppression via la corbeille : { path, name } ou null
  const [trashTarget, setTrashTarget] = useState<{
    path: string;
    name: string;
  } | null>(null);

  // Message d'erreur éventuel (ex: suppression refusée)
  const [trashError, setTrashError] = useState<string | null>(null);

  const notifyChange = useFileSystemStore((s) => s.notifyChange);

  // Charge le contenu du bureau depuis IndexedDB
  const loadDesktop = async () => {
    await initializeFileSystem();

    const desktopFiles: FileEntry[] = await getFilesByParent("desktop/");
    const savedPositions = await getDesktopPositions();

    // Ensemble des positions déjà occupées (par les positions sauvegardées)
    const usedPositions = new Set<string>(Object.values(savedPositions));
    usedPositions.add(TRASH_POSITION); // la corbeille occupe une case réservée

    // Dimensions actuelles de la grille (mêmes calculs que handleResize)
    const columns = Math.floor((window.innerWidth - 30) / DROPPABLE_SIZE);
    const rows = Math.floor((window.innerHeight - 50) / DROPPABLE_SIZE);

    // Première case réellement libre, balayée ligne par ligne (gauche -> droite)
    const getFreePosition = (): string => {
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < columns; j++) {
          const pos = `grid_${i}-${j}`;
          if (!usedPositions.has(pos)) {
            usedPositions.add(pos);
            return pos;
          }
        }
      }
      // grille pleine : fallback hors écran (ne devrait pas arriver)
      const fallback = `grid_${rows}-0`;
      usedPositions.add(fallback);
      return fallback;
    };

    const loaded: DesktopItem[] = [];

    // Positions nouvellement attribuées à persister après la boucle
    const toPersist: Array<{ path: string; position: string }> = [];

    for (const entry of desktopFiles) {
      // Position : sauvegardée si connue, sinon première case libre
      let position = savedPositions[entry.path];
      if (!position) {
        position = getFreePosition();
        toPersist.push({ path: entry.path, position }); // grave la position
      }

      if (entry.type === "app" && entry.appId) {
        const app: AppEntry | undefined = await getApp(entry.appId);
        if (!app) continue;

        loaded.push({
          id: entry.path,
          type: "app",
          position,
          icon: app.icon,
          name: app.name,
          color: APP_COLORS[app.component] ?? "black",
          appId: entry.appId,
        });
      } else if (entry.type === "folder" || entry.type === "file") {
        loaded.push({
          id: entry.path,
          type: entry.type,
          position,
          name: entry.name,
          color: resolveEntryColor(entry.type),
        });
      }
    }

    setItems(loaded);

    // Persiste les positions auto-attribuées (une fois, après la boucle)
    for (const { path, position } of toPersist) {
      await setDesktopPosition(path, position);
    }
  };

  useEffect(() => {
    loadDesktop();
    // recharge le bureau quand le système de fichiers change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);

  useEffect(() => {
    function handleResize() {
      const columns: number = Math.floor(
        (window.innerWidth - 30) / DROPPABLE_SIZE,
      );
      const rows: number = Math.floor(
        (window.innerHeight - 50) / DROPPABLE_SIZE,
      );

      const gridTemp: string[][] = [];

      for (let i: number = 0; i < rows; i++) {
        gridTemp.push([]);
        for (let j: number = 0; j < columns; j++) {
          gridTemp[i].push(`grid_${i}-${j}`);
        }
      }
      setGridId(gridTemp);
    }

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const getItemByPosition = (position: string): DesktopItem | null => {
    let result: DesktopItem | null = null;
    for (let item of items) {
      if (item.position === position) result = item;
    }
    return result;
  };

  const updatePositionById = (id: string, newPosition: string): void => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, position: newPosition } : item,
      ),
    );
  };

  // Ouvre une fenêtre selon le type de l'item double-cliqué
  const openItem = async (id: string): Promise<void> => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (item.type === "app" && item.appId) {
      const app = await getApp(item.appId);
      if (!app) return;

      const kind = COMPONENT_TO_KIND[app.component];
      if (!kind) return;

      openWindow({
        kind,
        title: app.name,
        icon: app.icon,
        color: APP_COLORS[app.component] ?? "black",
        minWidth: app.config.minWidth ?? app.config.width,
        minHeight: app.config.minHeight ?? app.config.height,
      });
    } else if (item.type === "folder") {
      // Ouvre un Explorateur sur ce dossier (titre fixe "Explorateur")
      openWindow({
        kind: "explorer",
        title: "Explorateur",
        icon: "explorer",
        color: APP_COLORS["Explorer"] ?? "#F5C24B",
        minWidth: 600,
        minHeight: 300,
        props: { initialPath: item.id },
      });
    } else if (item.type === "file") {
      // Ouvre le fichier dans le Notepad avec son contenu
      const file = await getFile(item.id);
      if (!file) return;

      openWindow({
        kind: "notepad",
        title: item.name,
        icon: "notepad",
        color: "#5B9BD5",
        minWidth: 350,
        minHeight: 250,
        props: {
          initialPath: item.id,
          initialContent: file.content,
        },
      });
    }
  };

  return (
    <div className={styles.container}>
      <button
        onClick={async () => {
          await Debug();
          window.location.reload();
        }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 9999,
          padding: "6px 12px",
          background: "red",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        DEBUG
      </button>

      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          const { source, target } = event.operation;
          if (!source || !target) return;

          const sourceId = String(source.id);
          const targetId = String(target.id);

          // Drop sur la corbeille -> demande confirmation de suppression
          if (targetId === TRASH_DROP_ID) {
            const item = items.find((i) => i.id === sourceId);
            if (!item) return;

            // Les apps ne se suppriment pas -> on ignore le drop (retour à sa place)
            if (item.type === "app") return;

            setTrashTarget({ path: item.id, name: item.name });
            return;
          }

          // Drop sur une case libre -> déplace l'icône
          if (!getItemByPosition(targetId)) {
            updatePositionById(sourceId, targetId);
            setDesktopPosition(sourceId, targetId); // persiste la nouvelle position
          }
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {gridId.map((row, rowIndex) => (
            <div style={{ display: "flex" }} key={rowIndex}>
              {row.map((position) => {
                // Case réservée à la corbeille
                if (position === TRASH_POSITION) {
                  return (
                    <div
                      key={position}
                      style={{ width: DROPPABLE_SIZE, height: DROPPABLE_SIZE }}
                    >
                      <TrashBin size={DROPPABLE_SIZE} />
                    </div>
                  );
                }

                const item = getItemByPosition(position);

                return (
                  <Droppable id={position} key={position}>
                    {item ? (
                      <File
                        id={item.id}
                        type={item.type}
                        onOpen={openItem}
                        icon={item.icon}
                        name={item.name}
                        color={item.color}
                        variant="desktop"
                      />
                    ) : (
                      ""
                    )}
                  </Droppable>
                );
              })}
            </div>
          ))}
        </div>
      </DragDropProvider>

      {/* Modale de confirmation de suppression (corbeille) */}
      {trashTarget && (
        <Modal
          title="Supprimer"
          variant="confirm"
          message={`Voulez-vous vraiment supprimer « ${trashTarget.name} » ? Cette action est définitive.`}
          confirmLabel="Supprimer"
          danger
          onConfirm={async () => {
            const result = await deleteEntry(trashTarget.path);
            setTrashTarget(null);
            if (result.ok) {
              notifyChange();
            } else if (result.reason) {
              setTrashError(result.reason);
            }
          }}
          onClose={() => setTrashTarget(null)}
        />
      )}

      {/* Modale d'erreur de suppression */}
      {trashError && (
        <Modal
          title="Suppression impossible"
          variant="message"
          message={trashError}
          onClose={() => setTrashError(null)}
        />
      )}

      <div>
        {windows.map((win) => (
          <Window
            id={win.windowId}
            key={win.windowId}
            CloseWindow={closeWindow}
            name={win.title}
            color={win.color}
            icon={win.icon}
            w={win.minWidth}
            h={win.minHeight}
            minHeight={win.minHeight}
            minWidth={win.minWidth}
            minimized={win.minimized}
          >
            {renderWindowContent(win.kind, win.windowId, win.props)}
          </Window>
        ))}
      </div>
    </div>
  );
}

export default Desktop;
