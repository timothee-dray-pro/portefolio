import { openDB, DBSchema, IDBPDatabase } from "idb";

// ============================================================
// Convention de paths
// ============================================================
// - parentPath de la racine : "/"
// - un dossier se termine TOUJOURS par "/"   ex: "desktop/", "desktop/sous/"
// - un fichier ne se termine JAMAIS par "/"  ex: "desktop/notes.txt"
// - parentPath d'un élément = path du dossier qui le contient
//     "desktop/notes.txt"  -> parentPath: "desktop/"
//     "desktop/sous/"      -> parentPath: "desktop/"
//     "desktop/"           -> parentPath: "/"
// - le nom d'utilisateur n'est JAMAIS stocké dans les paths.
//   Il est ajouté uniquement à l'affichage via getFullPath().
// ============================================================

// ============================================================
// Types
// ============================================================

export interface FileEntry {
  path: string; // clé primaire, ex: "desktop/notes.txt" ou "desktop/"
  parentPath: string; // ex: "desktop/", ou "/" pour la racine
  name: string; // ex: "notes.txt" ou "desktop"
  type: "file" | "folder" | "app";
  content: string; // texte brut ; "" pour folder et app
  appId?: string; // uniquement si type === "app", référence AppEntry.id
  modifiedAt?: number; // timestamp
}

export interface AppWindowConfig {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  defaultX?: number;
  defaultY?: number;
}

export interface AppEntry {
  id: string; // clé primaire, ex: "calculator", "minesweeper"
  name: string; // nom affiché, ex: "Minesweeper"
  icon: string; // nom/chemin de l'icône FontAwesome ou image
  component: string; // identifiant pour mapper vers le vrai composant React
  config: AppWindowConfig;
}

export interface MinesweeperRecords {
  easy: number | null;
  medium: number | null;
  hard: number | null;
}

export interface AppSettings {
  id: string; // clé fixe, "main"
  theme: "light" | "dark";
  wallpaper: string;
  username: string | null;
  taskbarApps: string[]; // liste des id d'AppEntry épinglées
  minesweeperRecords: MinesweeperRecords;
  desktopPositions: Record<string, string>; // path d'icône -> position grille "grid_x-y"
}

// ============================================================
// Schéma de la base
// ============================================================

interface PortfolioDB extends DBSchema {
  files: {
    key: string;
    value: FileEntry;
    indexes: { "by-parent": string; "by-type": string };
  };
  apps: {
    key: string;
    value: AppEntry;
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

const DB_NAME = "Portfolio";
const DB_VERSION = 1;
const SETTINGS_ID = "main";

const defaultSettings: AppSettings = {
  id: SETTINGS_ID,
  theme: "dark",
  wallpaper: "",
  username: null,
  taskbarApps: [],
  minesweeperRecords: {
    easy: null,
    medium: null,
    hard: null,
  },
  desktopPositions: {},
};

// ============================================================
// Connexion (singleton)
// ============================================================

let dbInstance: IDBPDatabase<PortfolioDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<PortfolioDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<PortfolioDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const filesStore = db.createObjectStore("files", { keyPath: "path" });
      filesStore.createIndex("by-parent", "parentPath");
      filesStore.createIndex("by-type", "type");

      db.createObjectStore("apps", { keyPath: "id" });

      db.createObjectStore("settings", { keyPath: "id" });
    },
  });

  return dbInstance;
}

// ============================================================
// Helpers de paths
// ============================================================

// Chemin complet affiché à l'utilisateur (jamais stocké en DB)
//   getFullPath("desktop/notes.txt", "Edouart") -> "Edouart/desktop/notes.txt"
//   getFullPath("/", null)                       -> "invité/"
export function getFullPath(
  relativePath: string,
  username: string | null,
): string {
  const displayName = username ?? "invité";
  if (relativePath === "/") return `${displayName}/`;
  return `${displayName}/${relativePath}`;
}

// Déduit le nom depuis un path (gère le "/" final des dossiers)
//   "desktop/notes.txt" -> "notes.txt"
//   "desktop/sous/"     -> "sous"
function getNameFromPath(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const idx = trimmed.lastIndexOf("/");
  return idx === -1 ? trimmed : trimmed.substring(idx + 1);
}

// Déduit le parentPath depuis un path
//   "desktop/notes.txt" -> "desktop/"
//   "desktop/sous/"     -> "desktop/"
//   "desktop/"          -> "/"
function getParentFromPath(path: string): string {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const idx = trimmed.lastIndexOf("/");
  return idx === -1 ? "/" : trimmed.substring(0, idx + 1);
}

// ------------------------------------------------------------
// Dossiers protégés (créés au seed, non modifiables)
// ------------------------------------------------------------
// Ces 4 dossiers de base ne peuvent pas être déplacés, renommés
// ou supprimés. Liste en dur : ils sont fixes et connus.
export const PROTECTED_FOLDERS = [
  "desktop/",
  "documents/",
  "image/",
  "musique/",
];

// Vrai si le path correspond à un dossier de base protégé
export function isProtectedPath(path: string): boolean {
  return PROTECTED_FOLDERS.includes(path);
}

// Vrai si le dossier parent existe (ou si c'est la racine, toujours valide).
// Sert à éviter de créer un fichier/dossier dans un dossier qui vient
// d'être supprimé (ex: depuis une autre fenêtre).
export async function parentExists(parentPath: string): Promise<boolean> {
  if (parentPath === "/") return true; // la racine existe toujours
  const db = await getDB();
  const parent = await db.get("files", parentPath);
  return parent !== undefined && parent.type === "folder";
}

// ------------------------------------------------------------
// Validation & normalisation des noms de fichier
// ------------------------------------------------------------

// Caractères interdits dans un nom (classiques des systèmes de fichiers)
// eslint-disable-next-line no-useless-escape
const FORBIDDEN_CHARS = /[\/\\:*?"<>|]/;

// Extensions binaires qu'un bloc-notes ne peut pas éditer -> sauvegarde refusée
const FORBIDDEN_EXTENSIONS = [
  // images
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "svg",
  "ico",
  "tiff",
];

// Résultat de validation d'un nom de fichier
export type FileNameResult =
  | { ok: true; finalName: string } // nom validé (avec extension ajoutée si besoin)
  | { ok: false; reason: string };

// Valide un nom de fichier et normalise l'extension.
// - caractère interdit -> refus
// - extension binaire interdite -> refus
// - pas d'extension (ou juste ".") -> ajoute ".txt"
// - extension texte quelconque -> gardée
export function validateFileName(rawName: string): FileNameResult {
  const name = rawName.trim();

  if (name === "") {
    return { ok: false, reason: "Le nom du fichier ne peut pas être vide." };
  }

  if (FORBIDDEN_CHARS.test(name)) {
    return {
      ok: false,
      reason: 'Le nom contient un caractère interdit ( / \\ : * ? " < > | ).',
    };
  }

  // Extension = ce qui suit le dernier point, si le point n'est pas en tête/fin
  const lastDot = name.lastIndexOf(".");
  const hasRealExtension = lastDot > 0 && lastDot < name.length - 1;

  if (!hasRealExtension) {
    // "notes", "notes." ou ".xxx" -> on ajoute .txt
    // (on retire un éventuel point final pour éviter "notes..txt")
    const base = name.endsWith(".") ? name.slice(0, -1) : name;
    return { ok: true, finalName: `${base}.txt` };
  }

  const ext = name.slice(lastDot + 1).toLowerCase();

  if (FORBIDDEN_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      reason: `Les fichiers « .${ext} » ne peuvent pas être créés ici (format non éditable).`,
    };
  }

  return { ok: true, finalName: name };
}

// ============================================================
// Files : CRUD
// ============================================================

export async function createFile(entry: FileEntry): Promise<void> {
  const db = await getDB();
  await db.put("files", entry);
}

export async function getFile(path: string): Promise<FileEntry | undefined> {
  const db = await getDB();
  return db.get("files", path);
}

export async function getAllFiles(): Promise<FileEntry[]> {
  const db = await getDB();
  return db.getAll("files");
}

export async function getFilesByParent(
  parentPath: string,
): Promise<FileEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("files", "by-parent", parentPath);
}

export async function getFilesByType(
  type: "file" | "folder" | "app",
): Promise<FileEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("files", "by-type", type);
}

export async function updateFileContent(
  path: string,
  content: string,
): Promise<void> {
  const db = await getDB();
  const file = await db.get("files", path);
  if (!file) return;

  await db.put("files", {
    ...file,
    content,
    modifiedAt: Date.now(),
  });
}

export async function deleteFile(path: string): Promise<void> {
  const db = await getDB();
  await db.delete("files", path);
}

export async function moveFile(
  oldPath: string,
  newPath: string,
): Promise<void> {
  const db = await getDB();
  const file = await db.get("files", oldPath);
  if (!file) return;

  const tx = db.transaction("files", "readwrite");
  await tx.store.delete(oldPath);
  await tx.store.put({
    ...file,
    path: newPath,
    name: getNameFromPath(newPath),
    parentPath: getParentFromPath(newPath),
    modifiedAt: Date.now(),
  });
  await tx.done;
}

// ------------------------------------------------------------
// Déplacement d'une entrée dans un dossier cible (drag & drop)
// ------------------------------------------------------------
// Résultat d'un déplacement, avec une raison en cas d'échec.
export type MoveResult = {
  ok: boolean;
  reason?: string;
};

// Déplace `entryPath` DANS le dossier `targetFolder` (qui finit par "/").
// - Gère les dossiers de façon récursive (tout le contenu suit).
// - Bloque : déplacer un dossier de base protégé.
// - Bloque : déplacer un dossier dans lui-même ou un de ses descendants.
// - Bloque : conflit de nom dans le dossier cible.
export async function moveEntry(
  entryPath: string,
  targetFolder: string,
): Promise<MoveResult> {
  const db = await getDB();
  const entry = await db.get("files", entryPath);
  if (!entry) return { ok: false, reason: "L'élément est introuvable." };

  // Blocage : dossier de base protégé
  if (isProtectedPath(entryPath)) {
    return {
      ok: false,
      reason: `Le dossier « ${entry.name} » est un dossier système et ne peut pas être déplacé.`,
    };
  }

  const name = getNameFromPath(entryPath);
  const isFolder = entryPath.endsWith("/");

  // Nouveau path de l'entrée elle-même
  const newPath = isFolder
    ? `${targetFolder}${name}/`
    : `${targetFolder}${name}`;

  // Rien à faire si on le dépose dans son dossier actuel (annulation silencieuse)
  if (entry.parentPath === targetFolder) return { ok: false };

  // Blocage boucle : un dossier ne peut pas aller dans lui-même
  // ou dans un de ses sous-dossiers (le target commencerait par son path).
  if (isFolder && targetFolder.startsWith(entryPath)) {
    return {
      ok: false,
      reason: "Impossible de déplacer un dossier dans lui-même.",
    };
  }

  // Blocage conflit de nom dans la cible
  const existingAtTarget = await db.get("files", newPath);
  if (existingAtTarget) {
    return {
      ok: false,
      reason: `« ${name} » existe déjà dans le dossier de destination.`,
    };
  }

  // Récupère toutes les entrées à déplacer :
  // l'entrée elle-même + tous ses descendants si c'est un dossier.
  const all = await db.getAll("files");
  const toMove = all.filter(
    (f) => f.path === entryPath || (isFolder && f.path.startsWith(entryPath)),
  );

  const tx = db.transaction("files", "readwrite");

  for (const f of toMove) {
    // Recalcule le nouveau path en remplaçant le préfixe
    const relative = f.path.substring(entryPath.length); // ce qui suit l'ancien path
    const updatedPath = isFolder
      ? `${newPath}${relative}` // newPath finit par "/", relative est le reste
      : newPath;

    await tx.store.delete(f.path);
    await tx.store.put({
      ...f,
      path: updatedPath,
      name: getNameFromPath(updatedPath),
      parentPath: getParentFromPath(updatedPath),
      modifiedAt: Date.now(),
    });
  }

  await tx.done;
  return { ok: true };
}

// ------------------------------------------------------------
// Renommage d'une entrée (garde le même dossier parent)
// ------------------------------------------------------------
// Change le nom d'un fichier/dossier. Récursif pour les dossiers
// (les chemins des descendants suivent). Bloque apps et dossiers
// protégés, ainsi que les conflits de nom.
export async function renameEntry(
  entryPath: string,
  newName: string,
): Promise<MoveResult> {
  const db = await getDB();
  const entry = await db.get("files", entryPath);
  if (!entry) return { ok: false, reason: "L'élément est introuvable." };

  // Blocage : dossier de base protégé
  if (isProtectedPath(entryPath)) {
    return {
      ok: false,
      reason: `Le dossier « ${entry.name} » est un dossier système et ne peut pas être renommé.`,
    };
  }

  // Blocage : une application ne peut pas être renommée
  if (entry.type === "app") {
    return {
      ok: false,
      reason: `L'application « ${entry.name} » ne peut pas être renommée.`,
    };
  }

  const isFolder = entryPath.endsWith("/");
  const parent = getParentFromPath(entryPath);

  // Nouveau path : même parent, nouveau nom
  const base = parent === "/" ? "" : parent;
  const newPath = isFolder ? `${base}${newName}/` : `${base}${newName}`;

  // Rien à faire si le nom ne change pas
  if (newPath === entryPath) return { ok: false };

  // Conflit : un élément du même nom existe déjà dans le dossier
  const existing = await db.get("files", newPath);
  if (existing) {
    return {
      ok: false,
      reason: `« ${newName} » existe déjà dans ce dossier.`,
    };
  }

  // Récupère l'entrée + tous ses descendants si c'est un dossier
  const all = await db.getAll("files");
  const toRename = all.filter(
    (f) => f.path === entryPath || (isFolder && f.path.startsWith(entryPath)),
  );

  const tx = db.transaction("files", "readwrite");

  for (const f of toRename) {
    const relative = f.path.substring(entryPath.length);
    const updatedPath = isFolder ? `${newPath}${relative}` : newPath;

    await tx.store.delete(f.path);
    await tx.store.put({
      ...f,
      path: updatedPath,
      name: getNameFromPath(updatedPath),
      parentPath: getParentFromPath(updatedPath),
      modifiedAt: Date.now(),
    });
  }

  await tx.done;
  return { ok: true };
}
// ------------------------------------------------------------
// Valide le nom et l'unicité. Retourne un MoveResult (ok + raison).
export async function createFolder(
  parentPath: string,
  name: string,
): Promise<MoveResult> {
  const trimmed = name.trim();

  if (trimmed === "") {
    return { ok: false, reason: "Le nom du dossier ne peut pas être vide." };
  }

  // Interdit les caractères qui casseraient les paths
  if (trimmed.includes("/")) {
    return {
      ok: false,
      reason: "Le nom du dossier ne peut pas contenir « / ».",
    };
  }

  // Le dossier parent doit exister (peut avoir été supprimé ailleurs)
  if (!(await parentExists(parentPath))) {
    return {
      ok: false,
      reason: "Le dossier courant n'existe plus.",
    };
  }

  const db = await getDB();
  const base = parentPath === "/" ? "" : parentPath;
  const path = `${base}${trimmed}/`;

  // Conflit : un dossier/fichier du même nom existe déjà
  const existing = await db.get("files", path);
  if (existing) {
    return {
      ok: false,
      reason: `« ${trimmed} » existe déjà dans ce dossier.`,
    };
  }

  await db.put("files", {
    path,
    parentPath,
    name: trimmed,
    type: "folder",
    content: "",
    modifiedAt: Date.now(),
  });

  return { ok: true };
}

// ------------------------------------------------------------
// Suppression d'une entrée (récursive pour les dossiers)
// ------------------------------------------------------------
// Supprime `entryPath`. Si c'est un dossier, supprime aussi tout
// son contenu. Bloque les dossiers de base protégés.
export async function deleteEntry(entryPath: string): Promise<MoveResult> {
  const db = await getDB();
  const entry = await db.get("files", entryPath);
  if (!entry) return { ok: false, reason: "L'élément est introuvable." };

  // Blocage : dossier de base protégé
  if (isProtectedPath(entryPath)) {
    return {
      ok: false,
      reason: `Le dossier « ${entry.name} » est un dossier système et ne peut pas être supprimé.`,
    };
  }

  // Blocage : une application ne peut pas être supprimée
  if (entry.type === "app") {
    return {
      ok: false,
      reason: `L'application « ${entry.name} » ne peut pas être supprimée.`,
    };
  }

  const isFolder = entryPath.endsWith("/");

  // Récupère l'entrée + tous ses descendants si c'est un dossier
  const all = await db.getAll("files");
  const toDelete = all.filter(
    (f) => f.path === entryPath || (isFolder && f.path.startsWith(entryPath)),
  );

  const tx = db.transaction("files", "readwrite");
  for (const f of toDelete) {
    await tx.store.delete(f.path);
  }
  await tx.done;

  return { ok: true };
}

// ============================================================
// Apps : CRUD
// ============================================================

export async function createApp(entry: AppEntry): Promise<void> {
  const db = await getDB();
  await db.put("apps", entry);
}

export async function getApp(id: string): Promise<AppEntry | undefined> {
  const db = await getDB();
  return db.get("apps", id);
}

export async function getAllApps(): Promise<AppEntry[]> {
  const db = await getDB();
  return db.getAll("apps");
}

export async function updateApp(
  id: string,
  partial: Partial<AppEntry>,
): Promise<void> {
  const db = await getDB();
  const current = await db.get("apps", id);
  if (!current) return;

  await db.put("apps", { ...current, ...partial });
}

export async function deleteApp(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("apps", id);
}

// ============================================================
// Settings
// ============================================================

// Récupère les settings, crée les valeurs par défaut si rien n'existe
export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const settings = await db.get("settings", SETTINGS_ID);

  if (settings) {
    // Fusion avec les défauts : garantit que les champs ajoutés après coup
    // (ex: desktopPositions) existent même sur une base plus ancienne.
    return { ...defaultSettings, ...settings };
  }

  await db.put("settings", defaultSettings);
  return defaultSettings;
}

// Récupère la map des positions d'icônes du bureau
export async function getDesktopPositions(): Promise<Record<string, string>> {
  const settings = await getSettings();
  return settings.desktopPositions;
}

// Met à jour la position d'une icône du bureau (persistée)
export async function setDesktopPosition(
  path: string,
  position: string,
): Promise<void> {
  const db = await getDB();
  const current = await getSettings();
  await db.put("settings", {
    ...current,
    desktopPositions: {
      ...current.desktopPositions,
      [path]: position,
    },
  });
}

// Met à jour un ou plusieurs champs sans écraser le reste
export async function updateSettings(
  partial: Partial<AppSettings>,
): Promise<void> {
  const db = await getDB();
  const current = await getSettings();
  await db.put("settings", { ...current, ...partial });
}

// Met à jour un record de démineur précis (easy / medium / hard)
export async function updateMinesweeperRecord(
  level: keyof MinesweeperRecords,
  time: number,
): Promise<void> {
  const db = await getDB();
  const current = await getSettings();

  const currentRecord = current.minesweeperRecords[level];
  if (currentRecord !== null && time >= currentRecord) return; // pas un meilleur temps

  await db.put("settings", {
    ...current,
    minesweeperRecords: {
      ...current.minesweeperRecords,
      [level]: time,
    },
  });
}

// Ajoute une app à la barre des tâches
export async function pinToTaskbar(appId: string): Promise<void> {
  const db = await getDB();
  const current = await getSettings();

  if (current.taskbarApps.includes(appId)) return;

  await db.put("settings", {
    ...current,
    taskbarApps: [...current.taskbarApps, appId],
  });
}

// Retire une app de la barre des tâches
export async function unpinFromTaskbar(appId: string): Promise<void> {
  const db = await getDB();
  const current = await getSettings();

  await db.put("settings", {
    ...current,
    taskbarApps: current.taskbarApps.filter((id) => id !== appId),
  });
}

// ============================================================
// Seed : arborescence + apps par défaut au premier lancement
// ============================================================

// Dossiers créés par défaut à la racine
const DEFAULT_FOLDERS = ["desktop", "documents", "image", "musique"];

// Apps par défaut (définition) + où les poser sur le bureau
const DEFAULT_APPS: AppEntry[] = [
  {
    id: "minesweeper",
    name: "Minesweeper",
    icon: "mine",
    component: "Minesweeper",
    config: { width: 1200, height: 650, minWidth: 1200, minHeight: 650 },
  },
  {
    id: "shell",
    name: "Shell",
    icon: "shell",
    component: "Shell",
    config: { width: 500, height: 500, minWidth: 500, minHeight: 500 },
  },
  {
    id: "calculator",
    name: "Calculatrice",
    icon: "calculator",
    component: "Calculator",
    config: { width: 340, height: 570, minWidth: 340, minHeight: 570 },
  },
  {
    id: "explorer",
    name: "Explorateur",
    icon: "explorer",
    component: "Explorer",
    config: { width: 600, height: 300, minWidth: 600, minHeight: 300 },
  },
  {
    id: "notepad",
    name: "Bloc-notes",
    icon: "notepad",
    component: "Notepad",
    config: { width: 500, height: 400, minWidth: 350, minHeight: 250 },
  },
  {
    id: "powerfour",
    name: "Power Four",
    icon: "powerfour",
    component: "PowerFour",
    config: { width: 800, height: 600, minWidth: 800, minHeight: 600 },
  },
];

// Crée l'arborescence de base et les apps si la DB est vide.
// Idempotent : ne fait rien si des fichiers existent déjà.
export async function initializeFileSystem(): Promise<void> {
  const db = await getDB();

  const existing = await db.getAll("files");
  if (existing.length > 0) return; // déjà initialisé

  const tx = db.transaction(["files", "apps"], "readwrite");
  const filesStore = tx.objectStore("files");
  const appsStore = tx.objectStore("apps");

  // 1. Dossiers racine
  for (const folder of DEFAULT_FOLDERS) {
    const path = `${folder}/`;
    await filesStore.put({
      path,
      parentPath: "/",
      name: folder,
      type: "folder",
      content: "",
      modifiedAt: Date.now(),
    });
  }

  // 2. Apps : définition dans "apps" + entrée "app" dans desktop/
  for (const app of DEFAULT_APPS) {
    await appsStore.put(app);

    const path = `desktop/${app.id}`;
    await filesStore.put({
      path,
      parentPath: "desktop/",
      name: app.name,
      type: "app",
      content: "",
      appId: app.id,
      modifiedAt: Date.now(),
    });
  }

  await tx.done;

  // 3. Barre des tâches : épingle toutes les apps par défaut, dans l'ordre
  await initializeTaskbar();
}

// Remplit taskbarApps avec toutes les apps par défaut si la liste est vide.
// Idempotent : ne touche pas à un ordre déjà défini par l'utilisateur.
export async function initializeTaskbar(): Promise<void> {
  const db = await getDB();
  const current = await getSettings();

  if (current.taskbarApps.length > 0) return; // déjà configurée

  await db.put("settings", {
    ...current,
    taskbarApps: DEFAULT_APPS.map((app) => app.id),
  });
}

// Réordonne la barre des tâches (nouvel ordre complet des appId) et persiste.
export async function reorderTaskbar(orderedIds: string[]): Promise<void> {
  const db = await getDB();
  const current = await getSettings();
  await db.put("settings", {
    ...current,
    taskbarApps: orderedIds,
  });
}

// Renvoie la liste ordonnée des apps épinglées (AppEntry complets).
export async function getTaskbarApps(): Promise<AppEntry[]> {
  const settings = await getSettings();
  const apps: AppEntry[] = [];
  for (const id of settings.taskbarApps) {
    const app = await getApp(id);
    if (app) apps.push(app);
  }
  return apps;
}

// ============================================================
// DEBUG : vide toute la base puis relance le seed
// ============================================================
// Efface files, apps ET settings, puis recrée l'arborescence
// et les apps par défaut. À utiliser uniquement en développement.
export async function Debug(): Promise<void> {
  const db = await getDB();

  // 1. Vide tous les stores
  const clearTx = db.transaction(["files", "apps", "settings"], "readwrite");
  await clearTx.objectStore("files").clear();
  await clearTx.objectStore("apps").clear();
  await clearTx.objectStore("settings").clear();
  await clearTx.done;

  // 2. Relance le seed (la base est maintenant vide)
  await initializeFileSystem();
}
