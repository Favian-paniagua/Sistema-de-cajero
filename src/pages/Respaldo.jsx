import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { exportarTodo, restaurarTodo } from "../db/repositorio";
import { claveDia } from "../lib/formato";
import { METODOS } from "../lib/estadisticas";
import { useAvisos } from "../components/Avisos";
import { Download, FileSpreadsheet, Upload } from "lucide-react";

function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Respaldo: los datos viven en este dispositivo, así que conviene guardar una copia seguido. */
export default function Respaldo() {
  const { avisar, confirmar } = useAvisos();
  const archivo = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const conteo = useLiveQuery(async () => ({ productos: await db.productos.count(), ventas: await db.ventas.count() }), [], null);

  async function exportarJSON() {
    const datos = await exportarTodo();
    descargar(`mi-caja-respaldo-${claveDia(new Date())}.json`, JSON.stringify(datos), "application/json");
    avisar("Respaldo descargado");
  }

  async function exportarCSV() {
    const ventas = await db.ventas.orderBy("ts").toArray();
    const filas = [["fecha", "hora", "forma_de_pago", "codigo", "producto", "cantidad", "precio", "subtotal", "total_venta"]];
    for (const v of ventas) {
      const d = new Date(v.ts);
      for (const i of v.items || []) {
        filas.push([claveDia(d), d.toTimeString().slice(0, 5), METODOS[v.metodo]?.nombre || v.metodo, i.codigo, i.nombre, i.cantidad, i.precio, i.precio * i.cantidad, v.total]);
      }
    }
    const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    descargar(`mi-caja-ventas-${claveDia(new Date())}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
    avisar("Ventas exportadas (se abre en Excel)");
  }

  async function restaurar(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const ok = await confirmar("¿Restaurar respaldo?", "Se reemplazarán TODOS los productos y ventas de este dispositivo por los del archivo.", { boton: "Restaurar", peligro: true });
    if (!ok) return;
    setOcupado(true);
    try {
      const r = await restaurarTodo(JSON.parse(await f.text()));
      avisar(`Restaurado: ${r.productos} productos y ${r.ventas} ventas`, 3500);
    } catch (err) {
      avisar("No se pudo restaurar: " + err.message, 4000);
    } finally { setOcupado(false); }
  }

  return (
    <section className="view on">
      <div className="card pad">
        <h2>Tus datos</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          Los productos y las ventas se guardan en este dispositivo (funciona sin internet).
          Descarga un respaldo cada cierto tiempo y úsalo para pasar los datos a otro equipo.
        </p>
        {conteo && <p className="num"><b>{conteo.productos}</b> productos · <b>{conteo.ventas}</b> ventas guardadas</p>}
        <div className="row mt" style={{ flexWrap: "wrap" }}>
          <button className="btn primary" onClick={exportarJSON}><Download size={18} /> Descargar respaldo</button>
          <button className="btn" onClick={exportarCSV}><FileSpreadsheet size={18} /> Exportar ventas a Excel (CSV)</button>
          <button className="btn" onClick={() => archivo.current?.click()} disabled={ocupado}>{ocupado ? <span className="spin" /> : <><Upload size={18} /> Restaurar respaldo…</>}</button>
          <input ref={archivo} className="hidden-input" type="file" accept="application/json,.json" onChange={restaurar} />
        </div>
      </div>
    </section>
  );
}
