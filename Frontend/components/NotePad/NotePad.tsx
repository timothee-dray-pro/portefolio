import styles from "../../styles/NotePad.module.css";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk } from "@fortawesome/free-solid-svg-icons";
import {
  getFullPath,
  getSettings,
  updateFileContent,
} from "../../Data/indexeddb";
import { useWindowManager } from "../../Data/WindowManagerStore";
import { useFileSystemStore } from "../../Data/FileSystemStore";

function Notepad({
  initialContent = "",
  initialPath,
}: {
  initialContent?: string;
  initialPath?: string; // défini si on édite un fichier existant
}) {
  const [content, setContent] = useState<string>(initialContent);
  // Chemin du fichier associé (undefined = nouveau fichier jamais sauvegardé)
  const [path, setPath] = useState<string | undefined>(initialPath);
  const [username, setUsername] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openWindow = useWindowManager((s) => s.openWindow);
  const notifyChange = useFileSystemStore((s) => s.notifyChange);

  useEffect(() => {
    getSettings().then((s) => setUsername(s.username));
  }, []);

  // Petit flash visuel "Enregistré" temporaire
  const flashSaved = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  // Ouvre l'Explorateur en mode sauvegarde (choix du dossier + nom)
  const openSaveDialog = () => {
    openWindow({
      kind: "explorer",
      title: "Enregistrer sous",
      icon: "explorer",
      color: "#F5C24B",
      minWidth: 600,
      minHeight: 400,
      props: {
        saveMode: {
          contentToSave: content,
          // callback appelé par l'Explorer une fois le fichier créé
          onSaved: (savedPath: string) => {
            setPath(savedPath); // le notepad est désormais lié à ce fichier
            flashSaved();
          },
        },
      },
    });
  };

  // Enregistrer : direct si le fichier existe déjà, sinon dialogue
  const handleSave = async () => {
    if (path) {
      await updateFileContent(path, content);
      notifyChange();
      flashSaved();
    } else {
      openSaveDialog();
    }
  };

  // Enregistrer sous : toujours le dialogue (nouveau fichier)
  const handleSaveAs = () => {
    openSaveDialog();
  };

  // Ctrl+S -> enregistrer
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSave();
    }
  };

  // Chemin affiché dans la barre de titre interne
  const displayPath = path ? getFullPath(path, username) : "Nouveau fichier";

  return (
    <div className={styles.notepad} onKeyDown={handleKeyDown}>
      {/* Barre d'actions */}
      <div className={styles.toolbar}>
        <div className={styles.filePath}>
          {displayPath}
          {savedFlash && (
            <span className={styles.savedFlash}> ✓ Enregistré</span>
          )}
        </div>
        <div className={styles.actions}>
          <button className={styles.saveButton} onClick={handleSave}>
            <FontAwesomeIcon icon={faFloppyDisk} />
            <span>Enregistrer</span>
          </button>
          <button className={styles.saveAsButton} onClick={handleSaveAs}>
            Enregistrer sous
          </button>
        </div>
      </div>

      {/* Zone d'écriture */}
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Écrivez ici…"
        spellCheck={false}
        autoFocus
      />
    </div>
  );
}

export default Notepad;
