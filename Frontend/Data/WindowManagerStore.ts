import { create } from "zustand";

// ============================================================
// Window Manager
// ------------------------------------------------------------
// Gère la liste des fenêtres ouvertes du bureau.
// Le store ne contient QUE des données (pas de JSX) : chaque
// fenêtre est décrite par un `kind` (quel composant afficher) et
// des `props` (paramètres du composant). Le Desktop reconstruit
// le vrai composant React à partir de ces données via un mapping.
//
// N'importe quel composant (Notepad, etc.) peut donc demander
// l'ouverture d'une fenêtre sans que le Desktop ait à lui passer
// une fonction en prop.
// ============================================================

// Les types de fenêtres possibles
export type WindowKind =
  | "minesweeper"
  | "shell"
  | "calculator"
  | "explorer"
  | "notepad"
  | "powerfour";

// Props génériques passées au composant de la fenêtre
export type WindowProps = Record<string, unknown>;

export interface OpenWindow {
  windowId: string; // identifiant unique de CETTE fenêtre (doublons autorisés)
  kind: WindowKind;
  title: string;
  icon: string;
  color: string;
  minWidth: number;
  minHeight: number;
  minimized: boolean; // fenêtre réduite dans la barre (mais toujours ouverte)
  props?: WindowProps; // paramètres passés au composant (ex: initialPath)
}

interface WindowManagerStore {
  windows: OpenWindow[];
  openWindow: (win: Omit<OpenWindow, "windowId" | "minimized">) => string; // retourne le windowId créé
  closeWindow: (windowId: string) => void;
  setMinimized: (windowId: string, minimized: boolean) => void;
}

// Génère un id de fenêtre unique (doublons autorisés)
function makeWindowId(): string {
  return `win_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useWindowManager = create<WindowManagerStore>((set) => ({
  windows: [],

  openWindow: (win) => {
    const windowId = makeWindowId();
    set((state) => ({
      windows: [...state.windows, { ...win, windowId, minimized: false }],
    }));
    return windowId;
  },

  closeWindow: (windowId) =>
    set((state) => ({
      windows: state.windows.filter((w) => w.windowId !== windowId),
    })),

  // Réduit ou restaure une fenêtre (sans la fermer : elle reste dans la liste).
  setMinimized: (windowId, minimized) =>
    set((state) => ({
      windows: state.windows.map((w) =>
        w.windowId === windowId ? { ...w, minimized } : w,
      ),
    })),
}));
