import { useEffect, useState } from "react";
import styles from "../styles/Desktop.module.css";
import File from "./File";
import Droppable from "./Droppable";
import { DragDropProvider } from "@dnd-kit/react";
import Window from "./Window";

const DROPPABLE_SIZE = 110;

function Desktop() {
  type FileData = {
    id: string;
    position: string;
    isOpen: boolean;
  };

  const [files, setFiles] = useState<FileData[]>([
    {
      id: "0",
      position: "grid_0-0",
      isOpen: false,
    },
    {
      id: "1",
      position: "grid_0-1",
      isOpen: false,
    },
  ]);

  const [gridId, setGridId] = useState<string[][]>([]);

  useEffect(() => {
    function handleResize() {
      const columns: number = Math.floor(
        (window.innerWidth - 30) / DROPPABLE_SIZE,
      );
      const rows: number = Math.floor(
        (window.innerHeight - 50) / DROPPABLE_SIZE,
      );

      const gridTemp: string[][] = [];

      for (let i: number = 0; i < rows; i++) {
        gridTemp.push([]);
        for (let j: number = 0; j < columns; j++) {
          gridTemp[i].push(`grid_${i}-${j}`);
        }
      }
      setGridId(gridTemp);
    }

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const getIdByPosition = (id: string): string => {
    let result: string = "";

    for (let file of files) {
      if (file.position === id) {
        result = file.id;
      }
    }
    return result;
  };

  const updatePositionById = (id: string, newPosition: string): void => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === id ? { ...file, position: newPosition } : file,
      ),
    );
  };

  const updateOpenById = (id: string): void => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === id ? { ...file, isOpen: !file.isOpen } : file,
      ),
    );
  };

  const OpenWindow = (id: string): void => {
    for (let file of files) {
      if (file.id === id) {
        if (!file.isOpen) updateOpenById(id);
        break;
      }
    }
  };

  const CloseWindow = (id: string): void => {
    for (let file of files) {
      if (file.id === id) {
        if (file.isOpen) updateOpenById(id);
        break;
      }
    }
  };

  return (
    <div className={styles.container}>
      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;

          const { source, target } = event.operation;

          if (!source || !target) return;

          if (getIdByPosition(String(target.id)) === "")
            updatePositionById(String(source.id), String(target.id));
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {gridId.map((row, key) => (
            <div style={{ display: "flex" }} key={key}>
              {row.map((id, key) => (
                <Droppable id={id} key={key}>
                  {getIdByPosition(id) && (
                    <File id={getIdByPosition(id)} OpenWindow={OpenWindow} />
                  )}
                </Droppable>
              ))}
            </div>
          ))}
        </div>
      </DragDropProvider>

      <div>
        {files.map((file, key) =>
          file.isOpen ? (
            <Window id={file.id} key={key} CloseWindow={CloseWindow}>
              {file.id}
            </Window>
          ) : null,
        )}
      </div>
    </div>
  );
}

export default Desktop;
