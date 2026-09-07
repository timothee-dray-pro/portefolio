import { useDroppable } from "@dnd-kit/react";
import type { ReactNode } from "react";

function Droppable({ id, children }: { id: string; children?: ReactNode }) {
  const { ref } = useDroppable({
    id,
  });

  return (
    <div
      ref={ref}
      style={{
        width: 110,
        height: 110,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {children}
    </div>
  );
}

export default Droppable;
