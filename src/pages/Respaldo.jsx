import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { exportarTodo, restaurarTodo, cerrarCaja } from "../db/repositorio";
import { claveDia, dinero } from "../lib/formato";
import { resumenCierre, generarPdfCierre } from "../lib/reporteCierre";
import { exportarExcel } from "../lib/exportarExcel";
import { useAvisos } from "../components/Avisos";
import { Download, FileSpreadsheet, LockKeyhole, Upload } from "lucide-react";

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
  const [cerrando, setCerrando] = useState(false);
  const hoy = claveDia(new Date());
  const ventasHoy = useLiveQuery(() => db.ventas.where("dia").equals(hoy).sortBy("ts"), [hoy], null);
  const cierresHoy = useLiveQuery(() => db.cierres.where("dia").equals(hoy).sortBy("ts"), [hoy], []);
  const ultimoCierre = cierresHoy[cierresHoy.length - 1];

  /** Cierra la caja: guarda el registro del cierre y descarga el reporte del día en PDF. */
  async function cerrar() {
    const ventas = ventasHoy || [];
    const total = ventas.reduce((a, v) => a + v.total, 0);
    const horaUltimo = ultimoCierre && new Date(ultimoCierre.ts).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
    const ok = await confirmar(
      "¿Cerrar la caja de hoy?",
      (ultimoCierre ? `Ya hiciste un cierre hoy a las ${horaUltimo}; este nuevo cierre incluirá todas las ventas del día. ` : "") +
        `Se descargará el reporte en PDF con ${ventas.length} ${ventas.length === 1 ? "venta" : "ventas"} por ${dinero(total)}.`,
      { boton: "Cerrar caja" }
    );
    if (!ok) return;
    setCerrando(true);
    try {
      const r = resumenCierre(ventas);
      const cierre = await cerrarCaja({ total: r.total, costo: r.costo, ganancia: r.ganancia, ventas: r.ventas, unidades: r.unidades, porMetodo: r.porMetodo });
      const pdf = await generarPdfCierre({ ventas, cierre });
      descargar(`cierre-de-caja-${cierre.dia}.pdf`, pdf);
      avisar("Caja cerrada · reporte PDF descargado", 3000);
    } catch (e) {
      avisar("No se pudo cerrar la caja: " + e.message, 4000);
    } finally { setCerrando(false); }
  }
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
        <h2>Cierre de caja</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          Al cerrar se descarga un reporte en PDF con las ventas de hoy: total vendido, ganancia,
          formas de pago y cuánto se vendió de cada producto.
        </p>
        {ventasHoy && (
          <p className="num" style={{ margin: "8px 0 0" }}>
            Hoy: <b>{dinero(ventasHoy.reduce((a, v) => a + v.total, 0))}</b> en <b>{ventasHoy.length}</b> {ventasHoy.length === 1 ? "venta" : "ventas"}
          </p>
        )}
        {ultimoCierre && (
          <p className="sub" style={{ margin: "4px 0 0" }}>
            Última vez cerrada hoy a las {new Date(ultimoCierre.ts).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
        <button className="btn primary mt2" onClick={cerrar} disabled={cerrando || !ventasHoy}>
          {cerrando ? <><span className="spin" /> Generando reporte…</> : <><LockKeyhole size={18} /> Cerrar caja</>}
        </button>
      </div>

      <div className="card pad mt">
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
