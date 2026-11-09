import { useState } from "react";
import Modal from "./Modal";
import { dinero, dineroCorto, aNumero } from "../lib/formato";
import { METODOS } from "../lib/estadisticas";

/** Ventana de cobro: forma de pago, monto recibido y cambio. */
export default function Cobro({ total, unidades, onCerrar, onConfirmar }) {
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState("");
  const [guardando, setGuardando] = useState(false);

  const rec = aNumero(recibido);
  const efectivo = metodo === "efectivo";
  const falta = efectivo && recibido !== "" && rec < total;
  const rapidos = [...new Set([total, Math.ceil(total / 10) * 10, ...[10, 20, 50, 100, 200].filter((d) => d >= total).slice(0, 3)])]
    .filter((v) => v >= total).slice(0, 4);

  async function confirmar() {
    if (falta || guardando) return;
    setGuardando(true);
    try { await onConfirmar(metodo, efectivo && recibido !== "" ? rec : total); }
    catch { setGuardando(false); }
  }

  return (
    <Modal abierto onCerrar={onCerrar} titulo="Cobrar">
      <div className="total-box" style={{ margin: "6px 0 16px" }}>
        <div className="amt num">{dinero(total)}</div>
        <div className="meta">{unidades} {unidades === 1 ? "producto" : "productos"}</div>
      </div>
      <label className="l">Forma de pago</label>
      <div className="seg">
        {Object.entries(METODOS).map(([id, m]) => (
          <button key={id} className={metodo === id ? "on" : ""} onClick={() => setMetodo(id)}>{m.nombre}</button>
        ))}
      </div>
      {efectivo && (
        <div className="mt2">
          <label className="l" htmlFor="recibido">Monto recibido</label>
          <input className="f num" id="recibido" inputMode="decimal" placeholder="0,00" autoFocus value={recibido}
            onChange={(e) => setRecibido(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmar()} />
          <div className="quick">
            {rapidos.map((v) => (
              <button key={v} onClick={() => setRecibido(String(v).replace(".", ","))}>{v === total ? "Exacto" : dineroCorto(v)}</button>
            ))}
          </div>
          <div className="change">
            <span>Cambio</span>
            <b className="num">{recibido === "" ? "—" : falta ? "Falta " + dinero(total - rec) : dinero(rec - total)}</b>
          </div>
        </div>
      )}
      <div className="acts">
        <button className="btn" onClick={onCerrar}>Cancelar</button>
        <button className="btn primary" onClick={confirmar} disabled={falta || guardando}>
          {guardando ? <><span className="spin" /> Guardando</> : "Confirmar venta"}
        </button>
      </div>
    </Modal>
  );
}
