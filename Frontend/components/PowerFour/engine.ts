// Representation de la grille de puissance 4
//
// La grille est représentée par un tableau à deux dimensions de 6 lignes et 7 colonnes
// Chaque case de la grille peut contenir une valeur représentant le joueur qui a joué dans cette case
// 0 : case vide
// 1 : joueur 1 (jaune)
// 2 : joueur 2 (rouge)

// Déterminer dans quelle case tombe un jeton quand on joue une colonne (gravité), renvoie null si la colonne est pleine (pas jouable)
const getDropRow = (grid: number[][], column: number): number | null => {
  // Parcourir les lignes de la grille de bas en haut jusqu'a trouver une case vide ou avoir tout parcouru

  let run: boolean = true;
  let actualRow: number = grid.length - 1;
  let result: number | null = null;
  while (run) {
    if (actualRow < 0) {
      run = false;
    } else if (grid[actualRow][column] === 0) {
      result = actualRow;
      run = false;
    } else {
      actualRow--;
    }
  }

  return result;
};

// Appliquer un coup sur la grille, renvoie la nouvelle grille
const applyMove = (
  grid: number[][],
  row: number,
  column: number,
  player: number,
): number[][] => {
  const newGrid = grid.map((row) => [...row]);
  newGrid[row][column] = player;
  return newGrid;
};

// Détecte une victoire à partir du DERNIER coup joué (row, col).
// Bien plus efficace qu'un scan complet : un alignement de 4 ne peut
// se former qu'en passant par la case qu'on vient de jouer.
// Retourne 1 ou 2 si ce joueur gagne, sinon null.
const checkWinner = (
  grid: number[][],
  row: number,
  col: number,
): 1 | 2 | null => {
  const player = grid[row][col];
  if (player !== 1 && player !== 2) return null; // case vide

  const numRows = grid.length;
  const numCols = grid[0].length;

  // Compte les jetons alignés du même joueur dans une direction donnée en partant de (row, col) exclu
  // S'arrête seul quand la condition du while devient fausse (bord de grille ou jeton différent).
  const countDirection = (deltaRow: number, deltaCol: number): number => {
    let count = 0;
    let r = row + deltaRow;
    let c = col + deltaCol;

    while (
      r >= 0 &&
      r < numRows &&
      c >= 0 &&
      c < numCols &&
      grid[r][c] === player
    ) {
      count++;
      r += deltaRow;
      c += deltaCol;
    }

    return count;
  };

  // Les 4 axes : pour chacun, on compte dans les deux sens opposés.
  const axes: [[number, number], [number, number]][] = [
    [
      [0, 1],
      [0, -1],
    ], // horizontale : droite + gauche
    [
      [1, 0],
      [-1, 0],
    ], // verticale : bas + haut
    [
      [1, 1],
      [-1, -1],
    ], // diagonale \ : bas-droite + haut-gauche
    [
      [1, -1],
      [-1, 1],
    ], // diagonale / : bas-gauche + haut-droite
  ];

  let axisIndex = 0;
  let winner: 1 | 2 | null = null;

  // Parcours des axes avec un while : on s'arrête dès qu'on a un gagnant
  // OU qu'on a testé les 4 axes — sans break, via la condition du while.
  while (axisIndex < axes.length && winner === null) {
    const [dir1, dir2] = axes[axisIndex];

    // 1 (le jeton joué) + les alignés de chaque côté
    const total = 1 + countDirection(...dir1) + countDirection(...dir2);

    if (total >= 4) {
      winner = player;
    }

    axisIndex++;
  }

  return winner;
};

// Vérifie si la partie est nulle : grille pleine sans gagnant.
const isDraw = (grid: number[][]): boolean => {
  const topRow = grid[0];
  let col = 0;

  while (col < topRow.length && topRow[col] !== 0) {
    col++;
  }

  return col === topRow.length;
};

// Détermine à qui c'est le tour en comptant les jetons déjà posés avec le modulo (joueur 1 joue en premier, donc si le nombre de jetons est pair, c'est à lui de jouer).
const getCurrentPlayer = (grid: number[][]): 1 | 2 => {
  let count = 0;

  let row = 0;
  while (row < grid.length) {
    let col = 0;
    while (col < grid[row].length) {
      if (grid[row][col] !== 0) {
        count++;
      }
      col++;
    }
    row++;
  }

  // modulo 2 : pair -> joueur 1, impair -> joueur 2
  return count % 2 === 0 ? 1 : 2;
};

/*
const gridExemple: number[][] = [
  [0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 1, 2],
  [0, 0, 0, 0, 2, 2, 1],
  [0, 0, 0, 2, 1, 1, 2],
  [0, 0, 1, 1, 2, 2, 1],
  [0, 1, 2, 2, 1, 1, 2],
];
*/

export { getDropRow, applyMove, checkWinner, isDraw, getCurrentPlayer };
