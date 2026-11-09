import { createContext, useCallback, useContext, useRef, useState } from "react";
import Modal from "./Modal";

/**
 * Mensajes cortos (toast) y ventanas de confirmación para toda la app.
 * Uso: const { avisar, confirmar } = useAvisos();
 */
const Ctx = createContext(null);

export function AvisosProvider({ children }) {
  const [toast, setToast] = useState({ texto: "", visible: false });
  const [pregunta, setPregunta] = useState(null);
  const timer = useRef();

  const avisar = useCallback((texto, ms = 2200) => {
    clearTimeout(timer.current);
    setToast({ texto, visible: true });
    timer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), ms);
  }, []);

  const confirmar = useCallback(
    (titulo, texto, { boton = "Confirmar", peligro = false } = {}) =>
      new Promise((resolve) => setPregunta({ titulo, texto, boton, peligro, resolve })),
    []
  );

  const responder = (v) => { pregunta?.resolve(v); setPregunta(null); };

  return (
    <Ctx.Provider value={{ avisar, confirmar }}>
      {children}
      <div className={"toast" + (toast.visible ? " on" : "")} role="status" aria-live="polite">{toast.texto}</div>
      <Modal abierto={!!pregunta} onCerrar={() => responder(false)} titulo={pregunta?.titulo}>
        <p className="sub">{pregunta?.texto}</p>
        <div className="acts">
          <button className="btn" onClick={() => responder(false)}>Cancelar</button>
          <button className={"btn " + (pregunta?.peligro ? "danger" : "primary")} onClick={() => responder(true)} autoFocus>
            {pregunta?.boton}
          </button>
        </div>
      </Modal>
    </Ctx.Provider>
  );
}

export const useAvisos = () => useContext(Ctx);
