import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { exportarTodo, restaurarTodo } from "../db/repositorio";
import { claveDia } from "../lib/formato";
import { exportarExcel } from "../lib/exportarExcel";
import { useAvisos } from "../components/Avisos";
import { Download, FileSpreadsheet, Upload } from "lucide-react";

function descargar(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Respaldo: los datos viven en este dispositivo, así que conviene guardar una copia seguido. */
export default function Respaldo() {
  const { avisar, confirmar } = useAvisos();
  const archivo = useRef(null);
  const [ocupado, setOcupado] = useState(false);
  const [exportando, setExportando] = useState(false);
  const conteo = useLiveQuery(async () => ({ productos: await db.productos.count(), ventas: await db.ventas.count() }), [], null);

  async function exportarJSON() {
    const datos = await exportarTodo();
    descargar(`mi-caja-respaldo-${claveDia(new Date())}.json`, JSON.stringify(datos), "application/json");
    avisar("Respaldo descargado");
  }

  async function exportarAExcel() {
    setExportando(true);
    try {
      const archivo = await exportarExcel();
      descargar(`mi-caja-ventas-${claveDia(new Date())}.xlsx`, archivo);
      avisar("Excel descargado");
    } catch (e) {
      avisar("No se pudo crear el Excel: " + e.message, 4000);
    } finally { setExportando(false); }
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
          <button className="btn" onClick={exportarAExcel} disabled={exportando}>{exportando ? <span className="spin" /> : <><FileSpreadsheet size={18} /> Exportar a Excel</>}</button>
          <button className="btn" onClick={() => archivo.current?.click()} disabled={ocupado}>{ocupado ? <span className="spin" /> : <><Upload size={18} /> Restaurar respaldo…</>}</button>
          <input ref={archivo} className="hidden-input" type="file" accept="application/json,.json" onChange={restaurar} />
        </div>
      </div>
    </section>
  );
}
