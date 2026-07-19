import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/Files.module.css";
import { useDraggable } from "@dnd-kit/react";
import { useState } from "react";

function File({
  id,
  OpenWindow,
}: {
  id: string;
  OpenWindow: (id: string) => void;
}) {
  const [windowIsOpen, setWindowIsOpen] = useState<boolean>(false);
  const { ref } = useDraggable({
    id: id,
  });
  return (
    <div
      ref={ref}
      className={styles.container}
      onDoubleClick={() => {
        OpenWindow(id);
      }}
    >
      <FontAwesomeIcon icon={faFolder} className={styles.icon} />
      <p className={styles.text}>Explorateur {id}</p>
    </div>
  );
}

export default File;
