import styles from "../styles/Window.module.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  faFolder,
  faXmark,
  faMinus,
  faWindowRestore,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useWindowStore } from "../Data/WindowsStore";
import { motion, AnimatePresence } from "framer-motion";

function Window({
  id,
  children,
  CloseWindow,
  w = 500,
  h = 500,
  minWidth = 300,
  minHeight = 100,
}: {
  id: string;
  children: ReactNode;
  CloseWindow: (id: string) => void;
  w?: number;
  h?: number;
  minWidth?: number;
  minHeight?: number;
}) {
  const [x, setX] = useState<number>(200);
  const [y, setY] = useState<number>(100);
  const [z, setZ] = useState<number>(2);
  const [height, setHeight] = useState<number>(h);
  const [width, setWidth] = useState<number>(w);
  const [isInBigScreen, setIsInBigScreen] = useState<boolean>(false);
  const [oldWidth, setOldWidth] = useState<number>(0);
  const [oldHeight, setOldHeight] = useState<number>(0);
  const [oldX, setOldX] = useState<number>(0);
  const [oldY, setOldY] = useState<number>(0);
  const [open, setOpen] = useState<boolean>(true);

  const drag = useRef({
    startMouseX: 0,
    startMouseY: 0,
    startWindowX: 0,
    startWindowY: 0,
  });

  const resize = useRef({
    direction: "",
    startMouseX: 0,
    startMouseY: 0,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  const addWindow = useWindowStore((state) => state.addWindow);
  const getIndexById = useWindowStore((state) => state.getIndexById);
  const updateZIndex = useWindowStore((state) => state.updateZIndex);
  const removeWindow = useWindowStore((state) => state.removeWindow);
  const windows = useWindowStore((state) => state.windows);

  const handleMove = (e: PointerEvent): void => {
    const dx = e.clientX - drag.current.startMouseX;
    const dy = e.clientY - drag.current.startMouseY;

    setX(drag.current.startWindowX + dx);
    setY(drag.current.startWindowY + dy);
  };

  const removeListener = (): void => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", removeListener);
  };

  const MoveWindow = (e: React.PointerEvent): void => {
    drag.current.startMouseX = e.clientX;
    drag.current.startMouseY = e.clientY;

    drag.current.startWindowX = x;
    drag.current.startWindowY = y;

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", removeListener);
  };

  const getResizeDirection = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const borderSize = 8;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const left = x <= borderSize;
    const right = x >= rect.width - borderSize;
    const top = y <= borderSize;
    const bottom = y >= rect.height - borderSize;

    if (top && left) return "top-left";
    if (top && right) return "top-right";
    if (bottom && left) return "bottom-left";
    if (bottom && right) return "bottom-right";

    if (left) return "left";
    if (right) return "right";
    if (top) return "top";
    if (bottom) return "bottom";

    return null;
  };

  const ResizeWindow = (e: PointerEvent) => {
    const dx = e.clientX - resize.current.startMouseX;
    const dy = e.clientY - resize.current.startMouseY;

    let newX = resize.current.startX;
    let newY = resize.current.startY;
    let newWidth = resize.current.startWidth;
    let newHeight = resize.current.startHeight;

    const direction = resize.current.direction;

    if (direction.includes("right")) {
      newWidth = resize.current.startWidth + dx;
    }

    if (direction.includes("bottom")) {
      newHeight = resize.current.startHeight + dy;
    }

    if (direction.includes("left")) {
      newWidth = resize.current.startWidth - dx;
      newX = resize.current.startX + dx;
    }

    if (direction.includes("top")) {
      newHeight = resize.current.startHeight - dy;
      newY = resize.current.startY + dy;
    }

    if (newWidth < minWidth) {
      newWidth = minWidth;
    }

    if (newHeight < minHeight) {
      newHeight = minHeight;
    }

    setX(newX);
    setY(newY);
    setWidth(newWidth);
    setHeight(newHeight);
  };

  const StopResize = () => {
    window.removeEventListener("pointermove", ResizeWindow);
    window.removeEventListener("pointerup", StopResize);
  };

  const StartResize = (e: React.PointerEvent, direction: string) => {
    e.stopPropagation();

    resize.current = {
      direction,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: x,
      startY: y,
      startWidth: width,
      startHeight: height,
    };

    window.addEventListener("pointermove", ResizeWindow);
    window.addEventListener("pointerup", StopResize);
  };

  useEffect(() => {
    addWindow(id);
    setX(x + windows.length * 20);
    setY(y + windows.length * 20);
  }, []);

  useEffect(() => {
    setZ(getIndexById(id));
  }, [windows]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{
            left: x,
            top: y,
            scale: 0.1,
            opacity: 0,
          }}
          animate={{
            left: x,
            top: y,
            scale: 1,
            opacity: 1,
          }}
          transition={{
            type: "spring",
            stiffness: 1000,
            damping: 35,
          }}
          exit={{
            scale: 0.1,
            opacity: 0,
            left: x,
            top: y,
          }}
          style={{
            position: "absolute",
            width: width,
            height: height,
            zIndex: z,
          }}
          className={styles.container}
          onPointerDown={(e) => {
            updateZIndex(id);
            const direction = getResizeDirection(e);

            if (direction) {
              StartResize(e, direction);
            }
          }}
          onPointerMove={(e) => {
            const direction = getResizeDirection(e);

            if (!direction) {
              e.currentTarget.style.cursor = "default";
              return;
            }

            switch (direction) {
              case "left":
              case "right":
                e.currentTarget.style.cursor = "ew-resize";
                break;

              case "top":
              case "bottom":
                e.currentTarget.style.cursor = "ns-resize";
                break;

              case "top-left":
              case "bottom-right":
                e.currentTarget.style.cursor = "nwse-resize";
                break;

              case "top-right":
              case "bottom-left":
                e.currentTarget.style.cursor = "nesw-resize";
                break;

              default:
                e.currentTarget.style.cursor = "default";
            }
          }}
        >
          <div onPointerDown={MoveWindow} className={styles.header}>
            <div>
              <FontAwesomeIcon
                style={{ color: "rgb(255, 204, 0)" }}
                icon={faFolder}
              />
              <p>Explorateur de fichier</p>
            </div>
            <div style={{ gap: "0px" }}>
              <FontAwesomeIcon icon={faMinus} className={styles.icon} />
              {isInBigScreen ? (
                <FontAwesomeIcon
                  icon={faWindowRestore}
                  className={styles.icon}
                  onClick={() => {
                    setHeight(oldHeight);
                    setWidth(oldWidth);
                    setX(oldX);
                    setY(oldY);
                    setIsInBigScreen(false);
                  }}
                />
              ) : (
                <div
                  className={styles.icon}
                  style={{ height: "52px" }}
                  onClick={() => {
                    setOldWidth(width);
                    setOldHeight(height);
                    setOldX(x);
                    setOldY(y);
                    setX(5);
                    setY(5);
                    setHeight(window.innerHeight - 60);
                    setWidth(window.innerWidth - 10);
                    setIsInBigScreen(true);
                  }}
                >
                  <div
                    style={{
                      height: "15px",
                      width: "15px",
                      border: "solid",
                      borderWidth: "3px",
                      borderRadius: "4px",
                      padding: 0,
                    }}
                  ></div>
                </div>
              )}
              <FontAwesomeIcon
                onClick={() => {
                  setOpen(false);
                  setTimeout(() => {
                    CloseWindow(id);
                    removeWindow(id);
                  }, 200);
                }}
                icon={faXmark}
                className={styles.icon}
              />
            </div>
          </div>
          <div>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Window;
