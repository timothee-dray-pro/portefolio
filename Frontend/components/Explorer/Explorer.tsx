import styles from "../../styles/Explorer.module.css";
import { useEffect, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faFolderPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import ExplorerItem from "./ExplorerItem";
import Modal from "../Modal/Modal";
import {
  FileEntry,
  getApp,
  getFile,
  getFilesByParent,
  getFullPath,
  getSettings,
  createFile,
  createFolder,
  deleteEntry,
  moveEntry,
  parentExists,
  validateFileName,
} from "../../Data/indexeddb";
import { resolveEntryColor } from "../../Data/appColors";
import { useFileSystemStore } from "../../Data/FileSystemStore";
import { useWindowManager } from "../../Data/WindowManagerStore";

// Mode sauvegarde : props fournies uniquement quand l'explorateur est
// ouvert depuis "Enregistrer sous" du bloc-notes.
type SaveMode = {
  contentToSave: string; // contenu du fichier à écrire
  onSaved: (path: string) => void; // callback après sauvegarde réussie
};

function Explorer({
  initialPath = "/",
  saveMode,
  windowId,
}: {
  initialPath?: string;
  saveMode?: SaveMode;
  windowId?: string; // fourni par le window manager, pour se fermer après save
}) {
  const [currentPath, setCurrentPath] = useState<string>(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [username, setUsername] = useState<string | null>(null);

  // Map appId -> { icon, component } (résolu depuis le store "apps"),
  // car FileEntry ne stocke que appId, pas l'icône ni le composant.
  const [appInfos, setAppInfos] = useState<
    Record<string, { icon: string; component: string }>
  >({});

  // Champ nom de fichier (mode sauvegarde uniquement)
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Modale d'erreur (message affiché dans une popup, z-index max)
  const [errorModal, setErrorModal] = useState<string | null>(null);

  // Modale "Nouveau dossier" (ouverte/fermée)
  const [showNewFolder, setShowNewFolder] = useState<boolean>(false);

  // Path de l'entrée sélectionnée (simple clic), null si aucune
  const [selected, setSelected] = useState<string | null>(null);

  // Synchronisation du système de fichiers (refresh cross-fenêtres)
  const version = useFileSystemStore((s) => s.version);
  const notifyChange = useFileSystemStore((s) => s.notifyChange);

  // Pour fermer sa propre fenêtre après une sauvegarde (mode save)
  // et ouvrir un Notepad quand on double-clique un fichier
  const closeWindow = useWindowManager((s) => s.closeWindow);
  const openWindow = useWindowManager((s) => s.openWindow);

  // Charge le username une fois
  useEffect(() => {
    getSettings().then((s) => setUsername(s.username));
  }, []);

  // Recharge le contenu du dossier courant
  const loadEntries = useCallback(async () => {
    const list = await getFilesByParent(currentPath);
    setEntries(list);

    // Résout l'icône et le composant de chaque entrée de type "app"
    const infos: Record<string, { icon: string; component: string }> = {};
    for (const entry of list) {
      if (entry.type === "app" && entry.appId) {
        const app = await getApp(entry.appId);
        if (app)
          infos[entry.appId] = { icon: app.icon, component: app.component };
      }
    }
    setAppInfos(infos);
  }, [currentPath]);

  useEffect(() => {
    loadEntries();
    // recharge aussi quand une modif survient (dans cette fenêtre ou une autre)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEntries, version]);

  // Réinitialise la sélection quand on change de dossier
  useEffect(() => {
    setSelected(null);
  }, [currentPath]);

  // Simple clic sur une entrée -> sélection
  const handleSelect = (id: string): void => {
    setSelected((prev) => (prev === id ? null : id)); // re-clic = désélectionne
  };

  // Double-clic sur une entrée
  const handleOpen = async (id: string): Promise<void> => {
    const entry = entries.find((e) => e.path === id);
    if (!entry) return;

    // Dossier -> on navigue dedans
    if (entry.type === "folder") {
      setCurrentPath(entry.path);
      setError("");
      return;
    }

    // Fichier -> ouvre le Notepad avec son contenu
    if (entry.type === "file") {
      const file = await getFile(entry.path);
      if (!file) return;

      openWindow({
        kind: "notepad",
        title: entry.name,
        icon: "notepad",
        color: "#5B9BD5",
        minWidth: 350,
        minHeight: 250,
        props: {
          initialPath: entry.path,
          initialContent: file.content,
        },
      });
    }
    // app -> rien depuis l'explorateur
  };

  // Suppression de l'entrée sélectionnée (récursive, directe)
  const handleDelete = async (): Promise<void> => {
    if (!selected) return;

    const result = await deleteEntry(selected);
    if (!result.ok) {
      if (result.reason) setErrorModal(result.reason);
      return;
    }

    setSelected(null);
    notifyChange(); // recharge cette fenêtre + le bureau + autres explorers
  };

  // Calcule le dossier parent du dossier courant
  const getParentPath = (): string => {
    if (currentPath === "/") return "/";
    const trimmed = currentPath.slice(0, -1); // retire le "/" final
    const idx = trimmed.lastIndexOf("/");
    return idx === -1 ? "/" : trimmed.substring(0, idx + 1);
  };

  // Remonter d'un niveau (flèche retour)
  const goBack = (): void => {
    if (currentPath === "/") return; // déjà à la racine
    setCurrentPath(getParentPath());
    setError("");
  };

  // Sauvegarde (mode sauvegarde uniquement)
  const handleSave = async (): Promise<void> => {
    if (!saveMode) return;

    // Valide le nom + normalise l'extension (.txt par défaut, refus si interdit)
    const validation = validateFileName(fileName);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    const name = validation.finalName;

    // Le dossier courant doit exister encore (supprimé depuis une autre fenêtre ?)
    if (!(await parentExists(currentPath))) {
      setErrorModal("Le dossier courant n'existe plus.");
      return;
    }

    // Construit le path cible : dossier courant + nom
    const base = currentPath === "/" ? "" : currentPath;
    const targetPath = `${base}${name}`;

    // Erreur si un fichier du même nom existe déjà
    const existing = await getFile(targetPath);
    if (existing) {
      setError(`Le fichier « ${name} » existe déjà dans ce dossier.`);
      return;
    }

    await createFile({
      path: targetPath,
      parentPath: currentPath,
      name,
      type: "file",
      content: saveMode.contentToSave,
      modifiedAt: Date.now(),
    });

    notifyChange();
    saveMode.onSaved(targetPath);

    // Ferme la fenêtre "Enregistrer sous" après sauvegarde
    if (windowId) closeWindow(windowId);
  };

  // Création d'un nouveau dossier (depuis la modale)
  const handleCreateFolder = async (name: string): Promise<void> => {
    const result = await createFolder(currentPath, name);
    setShowNewFolder(false);

    if (!result.ok) {
      if (result.reason) setErrorModal(result.reason);
      return;
    }

    notifyChange(); // rafraîchit partout
  };

  const prompt = getFullPath(currentPath, username);

  return (
    <div className={styles.explorer}>
      <DragDropProvider
        onDragEnd={async (event) => {
          if (event.canceled) return;
          const { source, target } = event.operation;
          if (!source || !target) return;

          const sourcePath = String(source.id);
          const targetId = String(target.id);

          // Détermine le dossier cible (flèche retour ou dossier de la grille)
          let targetFolder: string;
          if (targetId === "__back__") {
            if (currentPath === "/") return; // déjà à la racine
            targetFolder = getParentPath();
          } else {
            targetFolder = targetId;
          }

          const result = await moveEntry(sourcePath, targetFolder);
          if (result.ok) {
            notifyChange();
          } else if (result.reason) {
            // échec explicite -> popup d'erreur (sinon simple annulation silencieuse)
            setErrorModal(result.reason);
          }
        }}
      >
        {/* Barre de navigation */}
        <div className={styles.toolbar}>
          <BackButton onClick={goBack} disabled={currentPath === "/"} />
          <div className={styles.pathBar}>{prompt}</div>
          <button
            className={styles.newFolderButton}
            onClick={() => setShowNewFolder(true)}
            aria-label="Nouveau dossier"
          >
            <FontAwesomeIcon icon={faFolderPlus} />
            <span>Nouveau dossier</span>
          </button>
          <button
            className={styles.deleteButton}
            onClick={handleDelete}
            disabled={selected === null}
            aria-label="Supprimer"
          >
            <FontAwesomeIcon icon={faTrash} />
            <span>Supprimer</span>
          </button>
        </div>

        {/* Grille des fichiers/dossiers */}
        <div className={styles.grid}>
          {entries.map((entry) => (
            <ExplorerItem
              key={entry.path}
              entry={entry}
              icon={
                entry.type === "app" && entry.appId
                  ? appInfos[entry.appId]?.icon
                  : undefined
              }
              color={resolveEntryColor(
                entry.type,
                entry.type === "app" && entry.appId
                  ? appInfos[entry.appId]?.component
                  : undefined,
              )}
              onOpen={handleOpen}
              onSelect={handleSelect}
              selected={selected === entry.path}
            />
          ))}
        </div>
      </DragDropProvider>

      {/* Barre de sauvegarde (seulement en mode sauvegarde) */}
      {saveMode && (
        <div className={styles.saveBar}>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.saveRow}>
            <input
              className={styles.nameInput}
              type="text"
              placeholder="Nom du fichier"
              value={fileName}
              onChange={(e) => {
                setFileName(e.target.value);
                setError("");
              }}
            />
            <button
              className={styles.saveButton}
              onClick={handleSave}
              disabled={fileName.trim() === ""}
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Modale : nouveau dossier */}
      {showNewFolder && (
        <Modal
          title="Nouveau dossier"
          variant="prompt"
          placeholder="Nom du dossier"
          confirmLabel="Créer"
          onConfirm={handleCreateFolder}
          onClose={() => setShowNewFolder(false)}
        />
      )}

      {/* Modale : message d'erreur */}
      {errorModal && (
        <Modal
          title="Action impossible"
          variant="message"
          message={errorModal}
          onClose={() => setErrorModal(null)}
        />
      )}
    </div>
  );
}

export default Explorer;

// ============================================================
// Flèche retour : bouton cliquable ET zone de dépôt.
// Déposer une entrée dessus la déplace dans le dossier parent.
// ============================================================
function BackButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  const { ref, isDropTarget } = useDroppable({
    id: "__back__",
    disabled, // pas droppable à la racine (rien au-dessus)
  });

  return (
    <button
      ref={ref}
      className={`${styles.backButton} ${
        isDropTarget ? styles.backDropTarget : ""
      }`}
      onClick={onClick}
      disabled={disabled}
      aria-label="Retour"
    >
      <FontAwesomeIcon icon={faArrowLeft} />
    </button>
  );
}
