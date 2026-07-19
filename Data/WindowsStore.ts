import { create } from "zustand";

type WindowData = {
  id: string;
  zIndex: number;
};

type WindowStore = {
  windows: WindowData[];

  addWindow: (id: string) => void;
  removeWindow: (id: string) => void;
  updateZIndex: (id: string) => void;

  getIndexById: (id: string) => number;
};

const getMaxZIndex = (windows: WindowData[]): number => {
  if (windows.length === 0) {
    return 1;
  }

  return Math.max(...windows.map((window) => window.zIndex));
};

const getIndexById = (windows: WindowData[], id: string): number => {
  return windows.findIndex((window) => window.id === id);
};

const normalizeZIndexes = (windows: WindowData[]): WindowData[] => {
  if (windows.length === 0) {
    return [];
  }

  const sortedWindows = [...windows].sort((a, b) => a.zIndex - b.zIndex);

  return sortedWindows.map((window, index) => ({
    ...window,
    zIndex: index + 2,
  }));
};

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],

  addWindow: (id) =>
    set((state) => {
      const index = getIndexById(state.windows, id);

      // La fenêtre existe déjà
      if (index !== -1) {
        return state;
      }

      return {
        windows: [
          ...state.windows,
          {
            id,
            zIndex: getMaxZIndex(state.windows) + 1,
          },
        ],
      };
    }),

  removeWindow: (id) =>
    set((state) => {
      const index = getIndexById(state.windows, id);

      if (index === -1) {
        return state;
      }

      const windows = [...state.windows];
      windows.splice(index, 1);

      return {
        windows: normalizeZIndexes(windows),
      };
    }),

  updateZIndex: (id) =>
    set((state) => {
      const index = getIndexById(state.windows, id);

      if (index === -1) {
        return state;
      }

      const windows = [...state.windows];

      windows[index] = {
        ...windows[index],
        zIndex: getMaxZIndex(windows) + 1,
      };

      return {
        windows: normalizeZIndexes(windows),
      };
    }),

  getIndexById: (id) => {
    return getIndexById(get().windows, id);
  },
}));
