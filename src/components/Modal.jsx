import { useEffect } from "react";
import { bloquearScroll, desbloquearScroll } from "../lib/bloquearScroll";

/** Ventana emergente: hoja inferior en celular, centrada en computadora. Con arriba=true se abre pegada arriba. */
export default function Modal({ abierto, onCerrar, titulo, nota, arriba = false, children }) {
  // Mientras está abierta, la página de atrás no se desplaza
  useEffect(() => {
    if (!abierto) return;
    bloquearScroll();
    return desbloquearScroll;
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e) => e.key === "Escape" && onCerrar?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className={"ov on" + (arriba ? " arriba" : "")} onMouseDown={(e) => e.target === e.currentTarget && onCerrar?.()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        {titulo && <h3>{titulo}</h3>}
        {nota && <p className="sub" style={{ margin: "4px 0 0" }}>{nota}</p>}
        {children}
      </div>
    </div>
  );
}
