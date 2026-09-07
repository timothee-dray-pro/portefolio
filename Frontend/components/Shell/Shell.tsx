import style from "../../styles/Shell.module.css";
import { useEffect, useRef, useState } from "react";
import {
  FileEntry,
  getFilesByParent,
  getFile,
  getFullPath,
  getSettings,
  createFile,
  createFolder,
  deleteEntry,
  moveEntry,
  renameEntry,
  validateFileName,
  parentExists,
} from "../../Data/indexeddb";
import { useFileSystemStore } from "../../Data/FileSystemStore";

// Couleurs d'affichage par type d'entrée dans le terminal
const TYPE_COLORS: Record<FileEntry["type"], string> = {
  folder: "#4FC3F7", // bleu clair pour les dossiers
  file: "#E0E0E0", // gris clair pour les fichiers
  app: "#81C784", // vert pour les apps
};

// Un segment de sortie coloré (un mot avec sa couleur)
type OutputSegment = {
  text: string;
  color: string;
};

// Une ligne de sortie = suite de segments affichés côte à côte
type OutputLine = OutputSegment[];

// Une ligne affichée dans l'historique du terminal
type HistoryLine = {
  prompt: string; // ex: "Edouart/documents/"
  command: string; // ce que l'utilisateur a tapé
  output: OutputLine[]; // lignes de résultat (vide si aucune sortie)
};

// Helper : transforme du texte simple en une ligne de sortie monochrome
const plain = (text: string, color = "#CCCCCC"): OutputLine => [
  { text, color },
];

function Shell() {
  const [currentPath, setCurrentPath] = useState<string>("/"); // path relatif interne
  const [username, setUsername] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryLine[]>([]);
  const [input, setInput] = useState<string>("");

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const notifyChange = useFileSystemStore((s) => s.notifyChange);

  // Prompt affiché (avec nom d'utilisateur, jamais le path brut)
  const prompt = getFullPath(currentPath, username);

  // Charge le username au montage
  useEffect(() => {
    getSettings().then((settings) => {
      setUsername(settings.username);
    });
  }, []);

  // Autoscroll vers le bas à chaque nouvelle ligne
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // ============================================================
  // Commande : cd
  // ============================================================
  // Formes gérées :
  //   cd X   -> entre dans le sous-dossier X du dossier courant (relatif)
  //   cd ..  -> remonte d'un niveau
  //   cd /   -> revient à la racine
  //   cd     -> erreur (argument requis)
  const handleCd = async (arg: string | undefined): Promise<OutputLine[]> => {
    // cd sans argument -> message d'erreur
    if (!arg) {
      return [plain("cd : un argument valide est requis.")];
    }

    // cd / -> racine
    if (arg === "/") {
      setCurrentPath("/");
      return [];
    }

    // cd .. -> remonter d'un niveau
    if (arg === "..") {
      if (currentPath === "/") {
        return []; // déjà à la racine, ne fait rien
      }
      // currentPath finit toujours par "/", ex: "documents/sous/"
      const trimmed = currentPath.slice(0, -1); // "documents/sous"
      const idx = trimmed.lastIndexOf("/");
      const parent = idx === -1 ? "/" : trimmed.substring(0, idx + 1);
      setCurrentPath(parent);
      return [];
    }

    // cd X -> sous-dossier du dossier courant (relatif)
    const base = currentPath === "/" ? "" : currentPath;
    const targetName = arg.endsWith("/") ? arg.slice(0, -1) : arg; // tolère "docs/" ou "docs"
    const targetPath = `${base}${targetName}/`;

    const target: FileEntry | undefined = await getFile(targetPath);

    if (!target) {
      return [plain("Le chemin spécifié est introuvable.")];
    }

    if (target.type !== "folder") {
      return [plain(`${targetName} n'est pas un dossier.`)];
    }

    setCurrentPath(targetPath);
    return [];
  };

  // ============================================================
  // Commande : ls
  // ============================================================
  // Liste le contenu du dossier courant, horizontalement,
  // chaque nom coloré selon son type (dossier / fichier / app).
  // Dossier vide -> aucune sortie.
  const handleLs = async (): Promise<OutputLine[]> => {
    const parent = currentPath === "/" ? "/" : currentPath;
    const entries: FileEntry[] = await getFilesByParent(parent);

    if (entries.length === 0) {
      return []; // rien du tout si vide
    }

    // une seule ligne, chaque nom = un segment coloré, séparés par un espace
    const segments: OutputLine = [];
    entries.forEach((entry, i) => {
      segments.push({
        text: entry.name,
        color: TYPE_COLORS[entry.type],
      });
      // espace de séparation entre les entrées (sauf après la dernière)
      if (i < entries.length - 1) {
        segments.push({ text: " ", color: "#CCCCCC" });
      }
    });

    return [segments];
  };

  // ============================================================
  // Commande : help
  // ============================================================
  // Liste toutes les commandes du projet avec leur syntaxe.
  // Nom + argument colorés, description en gris.
  const handleHelp = (): OutputLine[] => {
    const CMD_COLOR = "#4FC3F7"; // nom de la commande (bleu clair)
    const ARG_COLOR = "#81C784"; // argument (vert)
    const DESC_COLOR = "#CCCCCC"; // description (gris)

    // [nom, argument (ou ""), description]
    const commands: [string, string, string][] = [
      [
        "cd",
        "<dossier>",
        "Change de dossier (cd .. pour remonter, cd / pour la racine)",
      ],
      ["ls", "", "Liste le contenu du dossier courant"],
      ["cat", "<fichier>", "Affiche le contenu d'un fichier"],
      ["mkdir", "<dossier>", "Crée un nouveau dossier"],
      ["touch", "<fichier>", "Crée un nouveau fichier texte"],
      ["rm", "<élément>", "Supprime un fichier (rm -r pour un dossier)"],
      ["mv", "<src> <dest>", "Déplace ou renomme un élément"],
      ["cls", "", "Efface l'écran"],
      ["pwd", "", "Affiche le chemin du dossier courant"],
      ["whoami", "", "Affiche le nom de l'utilisateur"],
      ["help", "", "Affiche la liste des commandes"],
      ["projects", "", "Affiche mes projets"],
      ["skills", "", "Affiche mes compétences"],
    ];

    return commands.map(([name, arg, desc]) => {
      const line: OutputLine = [{ text: name, color: CMD_COLOR }];
      if (arg) {
        line.push({ text: " " + arg, color: ARG_COLOR });
      }
      line.push({ text: "  —  " + desc, color: DESC_COLOR });
      return line;
    });
  };

  // ============================================================
  // Helpers de résolution de chemin (partagés par touch/rm/mv/mkdir)
  // ============================================================
  // Résout un argument en { parentPath, name } selon la forme :
  //   "X"    -> dans le dossier courant
  //   "/X"   -> à la racine
  //   "X/Y"  -> Y dans le sous-dossier X (relatif au courant)
  const resolveParentAndName = (
    arg: string,
  ): { parentPath: string; name: string } => {
    if (arg.startsWith("/")) {
      const clean = arg.replace(/^\/+/, "").replace(/\/+$/, "");
      const idx = clean.lastIndexOf("/");
      if (idx === -1) return { parentPath: "/", name: clean };
      return {
        parentPath: `${clean.substring(0, idx)}/`,
        name: clean.substring(idx + 1),
      };
    }

    const clean = arg.replace(/\/+$/, "");
    const idx = clean.lastIndexOf("/");
    const base = currentPath === "/" ? "" : currentPath;

    if (idx === -1) {
      return { parentPath: currentPath, name: clean };
    }
    return {
      parentPath: `${base}${clean.substring(0, idx)}/`,
      name: clean.substring(idx + 1),
    };
  };

  // Résout un argument en un path complet d'entrée existante (fichier ou dossier).
  // Cherche d'abord un fichier, puis un dossier (avec "/" final).
  const resolveExistingPath = async (arg: string): Promise<string | null> => {
    const { parentPath, name } = resolveParentAndName(arg);
    const base = parentPath === "/" ? "" : parentPath;

    // essaie fichier
    const filePath = `${base}${name}`;
    if (await getFile(filePath)) return filePath;

    // essaie dossier
    const folderPath = `${base}${name}/`;
    if (await getFile(folderPath)) return folderPath;

    return null;
  };

  // ============================================================
  // Commande : cat  (affiche le contenu d'un fichier)
  // ============================================================
  const handleCat = async (arg: string | undefined): Promise<OutputLine[]> => {
    if (!arg) return [plain("cat : nom de fichier requis.")];

    const path = await resolveExistingPath(arg);
    if (!path) return [plain("cat : fichier introuvable.")];

    // Refuse les dossiers
    if (path.endsWith("/")) {
      return [plain(`cat : « ${arg} » est un dossier.`)];
    }

    const file = await getFile(path);
    if (!file) return [plain("cat : fichier introuvable.")];

    // Fichier vide -> aucune sortie
    if (file.content === "") return [];

    // Découpe le contenu en lignes (chaque ligne = une OutputLine)
    return file.content.split("\n").map((line) => plain(line));
  };

  // ============================================================
  // Commande : mkdir  (crée un dossier)
  // ============================================================
  const handleMkdir = async (
    arg: string | undefined,
  ): Promise<OutputLine[]> => {
    if (!arg) return [plain("mkdir : nom de dossier requis.")];

    const { parentPath, name } = resolveParentAndName(arg);
    const result = await createFolder(parentPath, name);

    if (!result.ok) {
      return [plain(result.reason ?? "mkdir : échec de la création.")];
    }

    notifyChange();
    return [];
  };

  // ============================================================
  // Commande : touch  (crée un fichier texte vide)
  // ============================================================
  const handleTouch = async (
    arg: string | undefined,
  ): Promise<OutputLine[]> => {
    if (!arg) return [plain("touch : nom de fichier requis.")];

    const { parentPath, name } = resolveParentAndName(arg);

    // Valide le nom + extension (ajoute .txt, refuse extensions binaires/caractères)
    const validation = validateFileName(name);
    if (!validation.ok) return [plain(validation.reason)];

    const finalName = validation.finalName;
    const base = parentPath === "/" ? "" : parentPath;
    const targetPath = `${base}${finalName}`;

    // Le dossier parent doit exister
    if (!(await parentExists(parentPath))) {
      return [plain("touch : le dossier cible n'existe pas.")];
    }

    // Erreur si le fichier existe déjà
    if (await getFile(targetPath)) {
      return [plain(`touch : « ${finalName} » existe déjà.`)];
    }

    // createFile ne vérifie pas le parent -> on s'appuie sur createFolder-like check
    // via une écriture directe : on crée le fichier vide
    await createFile({
      path: targetPath,
      parentPath,
      name: finalName,
      type: "file",
      content: "",
      modifiedAt: Date.now(),
    });

    notifyChange();
    return [];
  };

  // ============================================================
  // Commande : rm  (supprime un fichier ; -r pour un dossier)
  // ============================================================
  const handleRm = async (args: string[]): Promise<OutputLine[]> => {
    // gère le flag -r (dans n'importe quel ordre)
    const recursive = args.includes("-r");
    const target = args.find((a) => a !== "-r");

    if (!target) return [plain("rm : nom de fichier ou dossier requis.")];

    const path = await resolveExistingPath(target);
    if (!path) return [plain("rm : élément introuvable.")];

    const isFolder = path.endsWith("/");

    // Refuse un dossier sans -r
    if (isFolder && !recursive) {
      return [plain(`rm : « ${target} » est un dossier (utilisez rm -r).`)];
    }

    const result = await deleteEntry(path);
    if (!result.ok) {
      return [plain(result.reason ?? "rm : échec de la suppression.")];
    }

    notifyChange();
    return [];
  };

  // ============================================================
  // Commande : mv  (déplace si cible = dossier existant, sinon renomme)
  // ============================================================
  const handleMv = async (args: string[]): Promise<OutputLine[]> => {
    const [src, dest] = args;
    if (!src || !dest) {
      return [plain("mv : deux arguments requis (source et destination).")];
    }

    const srcPath = await resolveExistingPath(src);
    if (!srcPath) return [plain("mv : source introuvable.")];

    // La destination est-elle un dossier existant ?
    const { parentPath, name } = resolveParentAndName(dest);
    const base = parentPath === "/" ? "" : parentPath;
    const destAsFolder = `${base}${name}/`;
    const destFolder = await getFile(destAsFolder);

    if (destFolder) {
      // déplacement dans le dossier existant
      const result = await moveEntry(srcPath, destAsFolder);
      if (!result.ok)
        return [plain(result.reason ?? "mv : échec du déplacement.")];
      notifyChange();
      return [];
    }

    // sinon : renommage (dest = nouveau nom, même dossier que la source)
    // valide le nom selon le type de la source
    const isFolder = srcPath.endsWith("/");
    let finalName = name;
    if (!isFolder) {
      const validation = validateFileName(name);
      if (!validation.ok) return [plain(validation.reason)];
      finalName = validation.finalName;
    } else if (name.includes(".")) {
      // un dossier ne devrait pas avoir d'extension bizarre, mais on tolère
      finalName = name;
    }

    const result = await renameEntry(srcPath, finalName);
    if (!result.ok) return [plain(result.reason ?? "mv : échec du renommage.")];
    notifyChange();
    return [];
  };

  // ============================================================
  // Dispatcher de commandes
  // ============================================================
  const runCommand = async (raw: string): Promise<OutputLine[]> => {
    const trimmed = raw.trim();
    if (trimmed === "") return [];

    const [command, ...args] = trimmed.split(/\s+/);

    switch (command.toLowerCase()) {
      case "cd":
        return handleCd(args[0]);

      case "ls":
        return handleLs();

      case "help":
        return handleHelp();

      case "pwd":
        return [plain(getFullPath(currentPath, username))];

      case "cat":
        return handleCat(args[0]);

      case "mkdir":
        return handleMkdir(args[0]);

      case "touch":
        return handleTouch(args[0]);

      case "rm":
        return handleRm(args);

      case "mv":
        return handleMv(args);

      // Les autres commandes (cat, whoami, projects, skills) seront ajoutées ici

      default:
        return [plain(`'${command}' n'est pas reconnu en tant que commande.`)];
    }
  };

  // ============================================================
  // Soumission (touche Entrée)
  // ============================================================
  const handleSubmit = async () => {
    const command = input;
    const promptAtSubmit = prompt; // capture le prompt AVANT un éventuel cd

    setInput("");

    // cls : cas particulier, vide l'historique au lieu d'y ajouter une ligne
    if (command.trim().toLowerCase() === "cls") {
      setHistory([]);
      return;
    }

    const output = await runCommand(command);

    setHistory((prev) => [
      ...prev,
      { prompt: promptAtSubmit, command, output },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className={style.terminal} onClick={() => inputRef.current?.focus()}>
      <div className={style.output}>
        {/* Message d'accueil */}
        <p className={style.welcome}>Portfolio [Version 1.0.0]</p>
        <p className={style.welcome}>
          Tapez « help » pour afficher la liste des commandes.
        </p>

        {/* Historique dynamique */}
        {history.map((line, i) => (
          <div key={i}>
            <div className={style.line}>
              <span className={style.prompt}>{line.prompt}&gt;</span>
              <span className={style.command}>{line.command}</span>
            </div>
            {line.output.map((outLine, j) => (
              <p key={j} className={style.resultLine}>
                {outLine.map((seg, k) => (
                  <span key={k} style={{ color: seg.color }}>
                    {seg.text}
                  </span>
                ))}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Ligne d'input active */}
      <div className={style.inputLine}>
        <span className={style.prompt}>{prompt}&gt;</span>
        <input
          ref={inputRef}
          className={style.input}
          type="text"
          spellCheck={false}
          autoComplete="off"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>

      <div ref={bottomRef} />
    </div>
  );
}

export default Shell;
