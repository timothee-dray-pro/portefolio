import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/Files.module.css";
import { useDraggable } from "@dnd-kit/react";

function File({ id }: { id: string }) {
  const { ref } = useDraggable({
    id: id,
  });
  return (
    <div ref={ref} className={styles.container}>
      <FontAwesomeIcon icon={faFolder} className={styles.icon} />
      <p>Explorateur {id}</p>
    </div>
  );
}

export default File;
