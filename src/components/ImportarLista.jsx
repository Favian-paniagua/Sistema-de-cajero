import { useState } from "react";
import Modal from "./Modal";
import { useAvisos } from "./Avisos";
import { aNumero } from "../lib/formato";
import { importarProductos } from "../db/repositorio";

/** Pega una lista (desde Excel o texto) para cargar muchos productos de una vez. */
export default function ImportarLista({ onCerrar }) {
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function importar() {
    const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const filas = [];
    let omitidas = 0;
    for (const l of lineas) {
      const sep = l.includes("\t") ? "\t" : l.includes(";") ? ";" : ",";
      const c = l.split(sep).map((s) => s.trim());
      if (c.length < 3 || !c[0] || !c[1] || aNumero(c[2]) <= 0 || /^c[oó]digo$/i.test(c[0])) { omitidas++; continue; }
      filas.push({ codigo: c[0], nombre: c[1], precio: aNumero(c[2]), costo: aNumero(c[3]), stock: aNumero(c[4]) });
    }
    if (!filas.length) return setMsg("No encontré filas válidas. Revisa el formato.");
    setOcupado(true);
    try {
      const r = await importarProductos(filas);
      avisar(`${r.creados} nuevos · ${r.actualizados} actualizados${omitidas ? ` · ${omitidas} filas omitidas` : ""}`, 3500);
      onCerrar();
    } catch (e) {
      setMsg("Error al importar: " + e.message);
      setOcupado(false);
    }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Importar lista de productos"
      nota="Una línea por producto: código, nombre, precio, costo, stock. Puedes copiarla desde Excel (columnas en ese orden). Si separas con comas, usa punto para los decimales. Si el código ya existe, se actualiza.">
      <textarea className="f num mt" rows={8} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus
        placeholder={"7771234567890, Coca-Cola 2L, 15, 11.5, 24\n7790001112223, Galletas María, 4.5, 3, 40"} />
      <p className="sub" style={{ minHeight: "1em" }}>{msg}</p>
      <div className="acts">
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn primary" onClick={importar} disabled={ocupado}>{ocupado ? <span className="spin" /> : "Importar"}</button>
      </div>
    </Modal>
  );
}
