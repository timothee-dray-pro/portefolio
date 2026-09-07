import styles from "../../styles/Modal.module.css";
import { useEffect, useRef, useState } from "react";

// Le composant gère trois usages :
//  - "message" : afficher une information/erreur avec un bouton OK
//  - "prompt"  : demander une saisie texte avec Valider / Annuler
//  - "confirm" : demander une confirmation Oui / Annuler
type ModalProps = {
  title: string;
  variant: "message" | "prompt" | "confirm";
  // mode message / confirm
  message?: string;
  // mode prompt
  placeholder?: string;
  // mode prompt / confirm
  confirmLabel?: string;
  onConfirm?: (value: string) => void; // prompt: reçoit la saisie ; confirm: reçoit ""
  // commun
  onClose: () => void;
  danger?: boolean; // bouton de confirmation en rouge (suppression)
};

// z-index maximal pour toujours passer au-dessus des fenêtres
const MAX_Z_INDEX = 2147483647;

function Modal({
  title,
  variant,
  message,
  placeholder,
  confirmLabel,
  onConfirm,
  onClose,
  danger = false,
}: ModalProps) {
  const [value, setValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus auto sur le champ en mode prompt
  useEffect(() => {
    if (variant === "prompt") {
      inputRef.current?.focus();
    }
  }, [variant]);

  const handleConfirm = () => {
    if (variant === "message") {
      onClose();
    } else {
      onConfirm?.(value); // prompt renvoie la saisie, confirm renvoie ""
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onClose();
  };

  // Libellé du bouton de confirmation selon la variante
  const confirmText =
    confirmLabel ??
    (variant === "message"
      ? "OK"
      : variant === "confirm"
        ? "Confirmer"
        : "Valider");

  return (
    <div
      className={styles.overlay}
      style={{ zIndex: MAX_Z_INDEX }}
      onPointerDown={onClose} // clic en dehors -> ferme
    >
      <div
        className={styles.modal}
        onPointerDown={(e) => e.stopPropagation()} // clic dans la modale -> ne ferme pas
        onKeyDown={handleKeyDown}
      >
        <p className={styles.title}>{title}</p>

        {variant === "prompt" ? (
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <p className={styles.message}>{message}</p>
        )}

        <div className={styles.actions}>
          {variant !== "message" && (
            <button className={styles.cancelButton} onClick={onClose}>
              Annuler
            </button>
          )}
          <button
            className={danger ? styles.dangerButton : styles.confirmButton}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
