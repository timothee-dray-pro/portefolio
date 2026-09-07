import styles from "../styles/Window.module.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faTerminal,
  faXmark,
  faMinus,
  faWindowRestore,
  faBomb,
  faCalculator,
  faFolderOpen,
  faNoteSticky,
  faCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useWindowStore } from "../Data/WindowsStore";
import { useWindowManager } from "../Data/WindowManagerStore";
import { motion, AnimatePresence } from "framer-motion";

// Table de correspondance icône -> FontAwesome : constante pure, aucune raison
// d'être un state (elle ne change jamais et ne déclenche aucun re-render).
const iconTranslator: Record<string, IconDefinition> = {
  mine: faBomb,
  shell: faTerminal,
  calculator: faCalculator,
  explorer: faFolderOpen,
  notepad: faNoteSticky,
  powerfour: faCircle,
};

function Window({
  id,
  children,
  CloseWindow,
  w = 500,
  h = 500,
  minWidth = 300,
  minHeight = 100,
  name,
  icon,
  color,
  minimized = false,
}: {
  id: string;
  children: ReactNode;
  CloseWindow: (id: string) => void;
  w?: number;
  h?: number;
  minWidth?: number;
  minHeight?: number;
  name: string;
  icon: string;
  color: string;
  minimized?: boolean;
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

  const setMinimized = useWindowManager((state) => state.setMinimized);

  // useCallback : identités stables entre les renders, indispensable pour que
  // removeEventListener retire exactement la fonction ajoutée par addEventListener.
  const handleMove = useCallback((e: PointerEvent): void => {
    const dx = e.clientX - drag.current.startMouseX;
    const dy = e.clientY - drag.current.startMouseY;

    setX(drag.current.startWindowX + dx);
    setY(drag.current.startWindowY + dy);
  }, []);

  const removeListener = useCallback((): void => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", removeListener);
  }, [handleMove]);

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

  const ResizeWindow = useCallback(
    (e: PointerEvent) => {
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
    },
    [minWidth, minHeight],
  );

  const StopResize = useCallback(() => {
    window.removeEventListener("pointermove", ResizeWindow);
    window.removeEventListener("pointerup", StopResize);
  }, [ResizeWindow]);

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

  // Enregistrement dans le store au montage, retrait au démontage.
  // Le cleanup rend le composant sûr en StrictMode (double montage en dev).
  useEffect(() => {
    addWindow(id);
    setX((prevX) => prevX + windows.length * 20);
    setY((prevY) => prevY + windows.length * 20);

    return () => {
      removeWindow(id);
    };
  }, []);

  // Filet de sécurité : retrait des écouteurs globaux au démontage.
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", removeListener);
      window.removeEventListener("pointermove", ResizeWindow);
      window.removeEventListener("pointerup", StopResize);
    };
  }, [handleMove, removeListener, ResizeWindow, StopResize]);

  useEffect(() => {
    setZ(getIndexById(id));
  }, [windows]);

  // Cible de l'animation de minimisation : milieu horizontal, tout en bas
  // (vers la barre des tâches). On réduit et on descend.
  const minimizedAnimation = {
    left: window.innerWidth / 2,
    top: window.innerHeight,
    scale: 0.05,
    opacity: 0,
  };

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
          animate={
            minimized
              ? minimizedAnimation
              : {
                  left: x,
                  top: y,
                  scale: 1,
                  opacity: 1,
                }
          }
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
            // Une fois réduite, la fenêtre ne doit plus intercepter les clics
            // (elle est invisible mais toujours dans le DOM pour garder son état).
            pointerEvents: minimized ? "none" : "auto",
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
                style={{ color: color }}
                icon={iconTranslator[icon]}
              />
              <p>{name}</p>
            </div>
            <div style={{ gap: "0px" }}>
              {/* Minimiser : la fenêtre se réduit vers la barre mais reste
                  ouverte (état géré dans le window manager). stopPropagation
                  pour ne pas déclencher le drag du header. */}
              <FontAwesomeIcon
                icon={faMinus}
                className={styles.icon}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setMinimized(id, true)}
              />
              {isInBigScreen ? (
                <FontAwesomeIcon
                  icon={faWindowRestore}
                  className={styles.icon}
                  onPointerDown={(e) => e.stopPropagation()}
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
                  onPointerDown={(e) => e.stopPropagation()}
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
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setOpen(false);
                  setTimeout(() => {
                    CloseWindow(id);
                  }, 200);
                }}
                icon={faXmark}
                className={styles.icon}
              />
            </div>
          </div>
          <div
            style={{
              height: `calc(100% - 52px)`,
              padding: "8px",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Window;
