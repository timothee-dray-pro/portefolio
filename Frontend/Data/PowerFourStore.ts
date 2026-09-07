import { create } from "zustand";
import {
  getDropRow,
  applyMove,
  checkWinner,
  isDraw,
} from "../components/PowerFour/engine";

const emptyGrid = (): number[][] => [
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0],
];

type PowerFourStore = {
  grid: number[][];
  currentPlayer: number;
  statut: "waiting" | "ready" | "playing" | "win" | "draw";
  mode: "ia" | "local" | "online";
  me: number | null;
  winner: number | null;
  nbOfPlayer: number;
  role: string;

  playMove: (column: number, player: number) => void;
  resetGame: () => void;
  resetGrid: () => void;
  setCurrentPlayer: (player: number) => void;
  setMe: (player: number) => void;
  setNbOfPlayer: (nbOfPlayer: number) => void;
  setStatut: (statut: "waiting" | "ready" | "playing" | "win" | "draw") => void;
  setRole: (role: string) => void;
};

export const usePowerFourStore = create<PowerFourStore>((set, get) => ({
  grid: emptyGrid(),
  currentPlayer: 1,
  statut: "waiting",
  mode: "local",
  me: null,
  winner: null,
  nbOfPlayer: 2,
  role: "admin",
  // Methode pour jouer un coup dans une colonne spécifique
  playMove: (column: number, player: number) => {
    if (get().statut !== "playing") {
      return; // Ne rien faire si le jeu n'est pas en cours
    }

    if (player !== get().currentPlayer) {
      return; // Ne rien faire si ce n'est pas le tour du joueur
    }

    const row = getDropRow(get().grid, column);
    if (row !== null) {
      const newGrid = applyMove(get().grid, row, column, player);
      set({ grid: newGrid });
      set({ currentPlayer: get().currentPlayer === 1 ? 2 : 1 });
      if (checkWinner(newGrid, row, column)) {
        set({ statut: "win", winner: player }); // player = celui qui vient de jouer
      } else if (isDraw(newGrid)) {
        set({ statut: "draw" });
      }
    }
  },

  // Methode pour réinitialiser complètement le jeu (retour menu local/ia)
  resetGame: () => {
    set({
      grid: emptyGrid(),
      currentPlayer: 1,
      statut: "waiting",
      mode: "local",
      winner: null,
    });
  },

  // Methode pour réinitialiser uniquement le plateau (relance d'une partie) :
  // ne touche ni au statut, ni au mode, ni au role — utilisée notamment quand
  // le serveur (re)lance une partie en ligne via le message "playing"
  resetGrid: () => {
    set({
      grid: emptyGrid(),
      currentPlayer: 1,
      winner: null,
    });
  },

  // Methode pour changer le joueur actuel
  setCurrentPlayer: (player: number) => {
    set({ currentPlayer: player });
  },

  // Methode pour dire qui je suis
  setMe: (player: number) => {
    set({ me: player });
  },

  // Methode pour changer le nombre de joueur
  setNbOfPlayer: (nbOfPlayer: number) => {
    set({ nbOfPlayer: nbOfPlayer });
  },

  // Methode pour changer le statut de la partie / du salon
  setStatut: (statut: "waiting" | "ready" | "playing" | "win" | "draw") => {
    set({ statut: statut });
  },

  // Methode pour changer le role (admin ou user)
  setRole: (role: string) => {
    set({ role: role });
  },
}));
