import style from "../../styles/Minesweeper.module.css";
import { faClock } from "@fortawesome/free-regular-svg-icons";
import { faGear, faTrophy } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import Cell from "./Cell";
import {
  MinesweeperRecords,
  getSettings,
  updateMinesweeperRecord,
} from "../../Data/indexeddb";

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

type Level = keyof MinesweeperRecords;

// Une case de la grille (renommé CellData pour ne pas entrer en collision
// avec le composant Cell importé au-dessus)
type CellData = {
  isMine: boolean;
  valueOfScreen: number;
};

// Détermine le niveau (easy/medium/hard) à partir de la config actuelle
function getLevelFromConfig(
  col: number,
  row: number,
  numberOfBomb: number,
): Level | null {
  if (col === 9 && row === 9 && numberOfBomb === 10) return "easy";
  if (col === 16 && row === 16 && numberOfBomb === 40) return "medium";
  if (col === 30 && row === 16 && numberOfBomb === 99) return "hard";
  return null;
}

function Minesweeper() {
  const [grid, setGrid] = useState<CellData[][]>([]);
  const [isInGame, setIsInGame] = useState<boolean>(true);
  const [emoji, setEmoji] = useState<string>("🙂");
  const [numberOfBomb, setNumberOfBomb] = useState<number>(10);
  const [numberOfFlag, setNumberOfFlag] = useState<number>(0);
  const [time, setTime] = useState(0);
  const [isSettingOpen, setIsSettingOpen] = useState<boolean>(false);
  const [row, setRow] = useState<number>(9);
  const [col, setCol] = useState<number>(9);
  const [records, setRecords] = useState<MinesweeperRecords>({
    easy: null,
    medium: null,
    hard: null,
  });

  const currentLevel = getLevelFromConfig(col, row, numberOfBomb);
  const currentRecord = currentLevel ? records[currentLevel] : null;

  const generateGrid = (
    mineCount: number,
    row: number,
    col: number,
    position?: string,
  ): CellData[][] => {
    // Sans position de départ, aucune case n'est protégée (-1 ne matche
    // jamais un index) : les mines se placent librement.
    let iSafe: number = -1;
    let jSafe: number = -1;
    if (position) {
      [iSafe, jSafe] = position.split("-").map(Number);
    }
    const gridTemp: CellData[][] = [];
    let cell: CellData;
    for (let i = 0; i < row; i++) {
      gridTemp.push([]);
      for (let j = 0; j < col; j++) {
        cell = {
          isMine: false,
          valueOfScreen: 0,
        };
        gridTemp[i].push(cell);
      }
    }

    let placedMines = 0;
    while (placedMines < mineCount) {
      const i = getRandomInt(row);
      const j = getRandomInt(col);

      if (!gridTemp[i][j].isMine && (i !== iSafe || j !== jSafe)) {
        gridTemp[i][j].isMine = true;
        placedMines++;
      }
    }

    setGrid(gridTemp);
    return gridTemp;
  };

  const updateCellValue = (position: string, value: number): void => {
    const [i, j] = position.split("-").map(Number);

    setGrid((prevGrid) =>
      prevGrid.map((row, rowIndex) =>
        row.map((cell, colIndex) =>
          rowIndex === i && colIndex === j
            ? { ...cell, valueOfScreen: value }
            : cell,
        ),
      ),
    );
  };

  // Voisins d'une case, bornés par les dimensions de la grille passée en
  // paramètre (et non le state, qui peut être en retard d'un render).
  const getNeighbors = (
    position: string,
    targetGrid: CellData[][],
  ): string[] => {
    const [i, j] = position.split("-").map(Number);

    const neighbors: string[] = [];

    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (di === 0 && dj === 0) continue;

        const ni = i + di;
        const nj = j + dj;

        if (
          ni >= 0 &&
          ni < targetGrid.length &&
          nj >= 0 &&
          nj < targetGrid[ni].length
        ) {
          neighbors.push(`${ni}-${nj}`);
        }
      }
    }

    return neighbors;
  };

  const updateGrid = (position: string): void => {
    // if it's a bomb, set to -2
    // otherwise, find the number of surrounding bombs
    // if > 0, set the number
    // otherwise, set to -3 and repeat the process for all surrounding cells that are not bombs

    let newGrid: CellData[][] = [];
    if (!isInGame) {
      const allCellsAreZero = grid.every((row) =>
        row.every((cell) => cell.valueOfScreen === 0),
      );
      if (allCellsAreZero) {
        newGrid = launchGame(position);
      } else {
        return;
      }
    }

    if (newGrid.length === 0)
      newGrid = grid.map((row) => row.map((cell) => ({ ...cell })));

    // Mine touchée : fin de partie immédiate, on révèle tout.
    const [i, j] = position.split("-").map(Number);
    if (newGrid[i][j].isMine) {
      endGame(newGrid);
      return;
    }

    // Révélation récursive : on ne MUTE que la copie locale newGrid, sans
    // aucun setGrid intermédiaire — un seul setGrid à la fin. (L'ancienne
    // version faisait un setGrid complet PAR case révélée : sur un grand
    // flood c'était des centaines de re-parcours de grille inutiles.)
    const updateGridAux = (
      position: string,
      targetGrid: CellData[][],
    ): void => {
      const [i, j] = position.split("-").map(Number);

      const posAround: string[] = getNeighbors(position, targetGrid);
      const posAroundNoBombAndNoVisited: string[] = [];
      let bombAround: number = 0;
      let iTemp: number;
      let jTemp: number;

      for (let pos of posAround) {
        [iTemp, jTemp] = pos.split("-").map(Number);
        if (targetGrid[iTemp][jTemp].isMine) {
          bombAround++;
        } else if (targetGrid[iTemp][jTemp].valueOfScreen === 0) {
          posAroundNoBombAndNoVisited.push(pos);
        }
      }

      if (bombAround > 0) {
        targetGrid[i][j].valueOfScreen = bombAround;
      } else {
        targetGrid[i][j].valueOfScreen = -3;
        for (let pos of posAroundNoBombAndNoVisited) {
          // Une case peut avoir été révélée entre-temps par une autre branche
          // de la récursion : on ne retraite que les cases encore à 0.
          [iTemp, jTemp] = pos.split("-").map(Number);
          if (targetGrid[iTemp][jTemp].valueOfScreen === 0) {
            updateGridAux(pos, targetGrid);
          }
        }
      }
    };

    updateGridAux(position, newGrid);
    setGrid(newGrid);
    checkWin(newGrid);
  };

  const updateFlag = (position: string): void => {
    if (!isInGame) return;
    const [i, j] = position.split("-").map(Number);
    if (grid[i][j].valueOfScreen === -1) {
      updateCellValue(position, 0);
      setNumberOfFlag((prev) => prev - 1);
    } else if (grid[i][j].valueOfScreen === 0) {
      updateCellValue(position, -1);
      setNumberOfFlag((prev) => prev + 1);
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // Fin de partie perdue : on révèle les mines à partir de la grille fournie
  // (ou du state si non fournie), en un seul setGrid.
  const endGame = (fromGrid?: CellData[][]): void => {
    setIsInGame(false);
    setEmoji("☠️");

    const reveal = (source: CellData[][]) =>
      source.map((row) =>
        row.map((cell) => ({
          ...cell,
          valueOfScreen: cell.isMine ? -2 : cell.valueOfScreen,
        })),
      );

    if (fromGrid) {
      setGrid(reveal(fromGrid));
    } else {
      setGrid((prevGrid) => reveal(prevGrid));
    }
  };

  const resetGame = (col: number, row: number, NumberOfBomb: number): void => {
    setEmoji("🙂");
    setIsInGame(false);
    generateGrid(NumberOfBomb, row, col);
    setNumberOfFlag(0);
    setTime(0);
    setRow(row);
    setCol(col);
    setNumberOfBomb(NumberOfBomb);
  };

  const launchGame = (position: string): CellData[][] => {
    setEmoji("🙂");
    setIsInGame(true);
    setTime(0);
    setNumberOfFlag(0);
    return generateGrid(numberOfBomb, row, col, position);
  };

  const checkWin = (newGrid: CellData[][]) => {
    const hasWon = newGrid.every((row) =>
      row.every(
        (cell) =>
          cell.isMine || cell.valueOfScreen > 0 || cell.valueOfScreen === -3,
      ),
    );

    if (!hasWon) return false;

    setGrid((prevGrid) =>
      prevGrid.map((row) =>
        row.map((cell) => ({
          ...cell,
          valueOfScreen: cell.isMine ? -1 : cell.valueOfScreen,
        })),
      ),
    );

    setEmoji("😎");
    setIsInGame(false);
    setNumberOfFlag(numberOfBomb);

    // Mise à jour du record si la partie correspond à un niveau standard
    const level = getLevelFromConfig(col, row, numberOfBomb);
    if (level) {
      updateMinesweeperRecord(level, time).then(() => {
        setRecords((prev) => {
          const previousRecord = prev[level];
          if (previousRecord !== null && time >= previousRecord) return prev;
          return { ...prev, [level]: time };
        });
      });
    }

    return true;
  };

  // Charge les records depuis IndexedDB au montage
  useEffect(() => {
    getSettings().then((settings) => {
      setRecords(settings.minesweeperRecords);
    });
  }, []);

  useEffect(() => {
    resetGame(col, row, numberOfBomb);
  }, []);

  useEffect(() => {
    if (!isInGame) return;

    const interval = setInterval(() => {
      setTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isInGame]);

  return (
    <div
      onClick={() => {
        if (isSettingOpen) {
          setIsSettingOpen(false);
        }
      }}
    >
      <div className={style.header}>
        <div className={style.headerSide}>
          <div
            style={{ justifyContent: "left" }}
            className={style.partOfHeader}
          >
            <FontAwesomeIcon
              style={{ color: "#727C8E", fontSize: "20px" }}
              icon={faClock}
            />
            <div>
              <p className={style.subtitle}>Time</p>
              <p className={style.numbers}>{formatTime(time)}</p>
            </div>
          </div>
          <div
            style={{ justifyContent: "left" }}
            className={style.partOfHeader}
          >
            <FontAwesomeIcon
              style={{ color: "#727C8E", fontSize: "20px" }}
              icon={faTrophy}
            />
            <div>
              <p className={style.subtitle}>Record</p>
              <p className={style.numbers}>
                {currentRecord !== null && currentRecord !== undefined
                  ? formatTime(currentRecord)
                  : "--:--"}
              </p>
            </div>
          </div>
        </div>
        <div>
          <button
            onClick={() => resetGame(col, row, numberOfBomb)}
            className={style.smileyButton}
            style={{ fontSize: "20px" }}
          >
            {emoji}
          </button>
        </div>
        <div className={style.headerSide}>
          <div
            style={{ justifyContent: "space-between" }}
            className={style.partOfHeader}
          >
            <div className={style.leftOfRightSize}>
              <p style={{ fontSize: "20px" }}>🚩</p>
              <div>
                <p className={style.subtitle}>Mines</p>
                <p className={style.numbers}>{numberOfBomb - numberOfFlag}</p>
              </div>
            </div>
            <div>
              <FontAwesomeIcon
                onClick={() => {
                  setIsSettingOpen(!isSettingOpen);
                }}
                className={style.gear}
                icon={faGear}
              />
              {isSettingOpen ? (
                <div className={style.setting}>
                  <button
                    onClick={() => {
                      resetGame(9, 9, 10);
                    }}
                    className={style.button}
                    style={{
                      borderTopLeftRadius: "12px",
                      borderTopRightRadius: "12px",
                    }}
                  >
                    Facile
                  </button>
                  <button
                    onClick={() => {
                      resetGame(16, 16, 40);
                    }}
                    className={style.button}
                  >
                    Moyen
                  </button>
                  <button
                    onClick={() => {
                      resetGame(30, 16, 99);
                    }}
                    className={style.button}
                    style={{
                      borderBottomLeftRadius: "12px",
                      borderBottomRightRadius: "12px",
                    }}
                  >
                    Difficile
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          margin: "20px",
          padding: "0px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {grid.map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: "flex" }}>
            {row.map((cell, colIndex) => (
              <Cell
                updateFlag={updateFlag}
                updateGrid={updateGrid}
                key={`${rowIndex}-${colIndex}`}
                position={`${rowIndex}-${colIndex}`}
                value={cell.valueOfScreen}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Minesweeper;
