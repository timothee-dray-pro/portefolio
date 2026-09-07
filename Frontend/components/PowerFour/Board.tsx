import styles from "../../styles/Board.module.css";
import Token from "./Token";
import { usePowerFourStore } from "../../Data/PowerFourStore";

function Euclidean(dividend: number, divisor: number): [number, number] {
  const quotient = Math.floor(dividend / divisor);
  const remainder = dividend % divisor;
  return [quotient, remainder];
}

function Board({ onColumnClick }: { onColumnClick: (col: number) => void }) {
  const grid = usePowerFourStore((state) => state.grid);

  return (
    <div className={styles.boardFront}>
      {Array.from({ length: 42 }).map((_, i) => {
        const [row, col] = Euclidean(i, 7);
        const cellValue = grid[row][col];

        return (
          <div
            onClick={() => onColumnClick(col)}
            key={i}
            className={styles.hole}
          >
            {cellValue === 1 && <Token row={row} col={col} color="yellow" />}
            {cellValue === 2 && <Token row={row} col={col} color="red" />}
          </div>
        );
      })}
    </div>
  );
}

export default Board;
