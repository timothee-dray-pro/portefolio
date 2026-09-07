import { create } from "zustand";

// ============================================================
// Store de synchronisation du système de fichiers
// ------------------------------------------------------------
// IndexedDB n'émet pas d'événement natif "une entrée a changé".
// Ce store simule ce signal : `version` est incrémenté à chaque
// modification (création, suppression, déplacement). Les composants
// qui affichent des fichiers (Desktop, Explorer) mettent `version`
// dans les dépendances de leur useEffect de chargement, et se
// rechargent donc automatiquement à chaque changement.
// ============================================================

interface FileSystemStore {
  version: number;
  notifyChange: () => void;
}

export const useFileSystemStore = create<FileSystemStore>((set) => ({
  version: 0,
  notifyChange: () => set((state) => ({ version: state.version + 1 })),
}));
