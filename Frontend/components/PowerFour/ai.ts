import { applyMove, checkWinner, getDropRow, isDraw } from "./engine";

const columnWeights: number[] = [1, 2, 3, 4, 3, 2, 1];

type Direction = [number, number];

// Les 4 axes, comme dans ton checkWinner : chaque axe a un sens "aller" (dir1) et son opposé (dir2)
const axes: [Direction, Direction][] = [
  [
    [0, 1],
    [0, -1],
  ], // horizontale
  [
    [1, 0],
    [-1, 0],
  ], // verticale
  [
    [1, 1],
    [-1, -1],
  ], // diagonale \
  [
    [1, -1],
    [-1, 1],
  ], // diagonale /
];

// Compte les cases vides consécutives à partir de (row, col), en avançant dans une direction donnée
function countFreeCells(
  grid: number[][],
  row: number,
  col: number,
  deltaRow: number,
  deltaCol: number,
): number {
  const numRows = grid.length;
  const numCols = grid[0].length;
  let count = 0;
  let r = row;
  let c = col;

  while (r >= 0 && r < numRows && c >= 0 && c < numCols && grid[r][c] === 0) {
    count++;
    r += deltaRow;
    c += deltaCol;
  }

  return count;
}

function evaluatePatterns(grid: number[][], currentPlayer: number): number {
  const numRows = grid.length;
  const numCols = grid[0].length;
  let total = 0;

  let row = 0;
  while (row < numRows) {
    let col = 0;
    while (col < numCols) {
      if (grid[row][col] === currentPlayer) {
        let axisIndex = 0;
        while (axisIndex < axes.length) {
          const [[dr1, dc1], [dr2, dc2]] = axes[axisIndex];

          // On ne traite que le DEBUT d'un run dans le sens dir1
          // (sinon on compterait le même alignement plusieurs fois)
          const prevRow = row + dr2;
          const prevCol = col + dc2;
          const isStartOfRun =
            prevRow < 0 ||
            prevRow >= numRows ||
            prevCol < 0 ||
            prevCol >= numCols ||
            grid[prevRow][prevCol] !== currentPlayer;

          if (isStartOfRun) {
            // Longueur du run à partir d'ici, dans le sens dir1
            let runLength = 0;
            let r = row;
            let c = col;
            while (
              r >= 0 &&
              r < numRows &&
              c >= 0 &&
              c < numCols &&
              grid[r][c] === currentPlayer
            ) {
              runLength++;
              r += dr1;
              c += dc1;
            }

            const freeAfter = countFreeCells(grid, r, c, dr1, dc1);
            const freeBefore = countFreeCells(grid, prevRow, prevCol, dr2, dc2);

            // Patterns "libre d'un seul côté"
            if (runLength === 1 && (freeAfter >= 3 || freeBefore >= 3))
              total += 5;
            if (runLength === 2 && (freeAfter >= 2 || freeBefore >= 2))
              total += 10;
            if (runLength === 3 && (freeAfter >= 1 || freeBefore >= 1))
              total += 15;

            // Patterns "libre des deux côtés" (ouvert)
            if (runLength === 1 && freeAfter >= 3 && freeBefore >= 3)
              total += 10;
            if (runLength === 2 && freeAfter >= 2 && freeBefore >= 2)
              total += 15;
            if (runLength === 3 && freeAfter >= 1 && freeBefore >= 1)
              total += 20;
          }

          axisIndex++;
        }
      }
      col++;
    }
    row++;
  }

  return total;
}

function evaluateColumnControl(
  grid: number[][],
  currentPlayer: number,
): number {
  let total = 0;
  let col = 0;

  while (col < columnWeights.length) {
    let countInColumn = 0;
    let row = 0;

    while (row < grid.length) {
      if (grid[row][col] === currentPlayer) {
        countInColumn++;
      }
      row++;
    }

    total += countInColumn * columnWeights[col];
    col++;
  }

  return total;
}

function argMax(numbers: number[]): number {
  let bestIndex = 0;
  let i = 1;
  while (i < numbers.length) {
    if (numbers[i] > numbers[bestIndex]) {
      bestIndex = i;
    }
    i++;
  }
  return bestIndex;
}

function argMin(numbers: number[]): number {
  let bestIndex = 0;
  let i = 1;
  while (i < numbers.length) {
    if (numbers[i] < numbers[bestIndex]) {
      bestIndex = i;
    }
    i++;
  }
  return bestIndex;
}

function max(numbers: number[]): number {
  let result = numbers[0];
  let i = 1;
  while (i < numbers.length) {
    if (numbers[i] > result) {
      result = numbers[i];
    }
    i++;
  }
  return result;
}

function min(numbers: number[]): number {
  let result = numbers[0];
  let i = 1;
  while (i < numbers.length) {
    if (numbers[i] < result) {
      result = numbers[i];
    }
    i++;
  }
  return result;
}

function GetIaMove(
  difficulty: string,
  currentPlayer: number,
  grid: number[][],
): number {
  // Au premier niveau, le joueur qui pose le jeton EST l'IA :
  // on passe donc currentPlayer à la fois comme joueur courant et comme iaPlayer (fixe).
  return miniMax(
    difficulty === "easy" ? 1 : difficulty === "medium" ? 3 : 4,
    grid,
    currentPlayer,
    currentPlayer,
    0,
    0,
  )[1];
}

function miniMax(
  profondeur: number,
  grid: number[][],
  currentPlayer: number, // joueur qui pose le jeton A CE niveau -> alterne à chaque descente
  iaPlayer: number, // joueur du point de vue duquel on évalue -> FIXE, c'est lui qui maximise
  row: number,
  col: number,
): [number, number] {
  if (profondeur === 0) {
    return [evaluateGrid(grid, iaPlayer, row, col), col];
  }

  const result: number[] = [];
  const nextPlayer: number = currentPlayer === 1 ? 2 : 1;
  const isMaximizing: boolean = currentPlayer === iaPlayer;

  let dropRow: number | null;
  let newGrid: number[][];
  let winner: number | null;

  for (let i = 0; i < 7; i++) {
    dropRow = getDropRow(grid, i);
    if (dropRow === null) {
      // Colonne pleine : on pousse une valeur neutre pour garder l'alignement
      // entre l'index du tableau result et le vrai numéro de colonne.
      result.push(isMaximizing ? -Infinity : Infinity);
    } else {
      newGrid = applyMove(grid, dropRow, i, currentPlayer);
      winner = checkWinner(newGrid, dropRow, i);
      if (winner === iaPlayer) {
        result.push(1000);
      } else if (winner !== null) {
        result.push(-1000);
      } else {
        if (isDraw(newGrid)) {
          result.push(0);
        } else {
          result.push(
            miniMax(
              profondeur - 1,
              newGrid,
              nextPlayer,
              iaPlayer,
              dropRow,
              i,
            )[0],
          );
        }
      }
    }
  }

  if (isMaximizing) {
    return [max(result), argMax(result)];
  } else {
    return [min(result), argMin(result)];
  }
}

function evaluateGrid(
  grid: number[][],
  iaPlayer: number,
  row: number,
  col: number,
): number {
  let result = 0;
  const ia = iaPlayer;
  const player = iaPlayer === 1 ? 2 : 1;

  result =
    evaluateColumnControl(grid, ia) - evaluateColumnControl(grid, player);
  result *= 2;

  result += evaluatePatterns(grid, ia) - evaluatePatterns(grid, player);
  return result;
}

export default GetIaMove;
