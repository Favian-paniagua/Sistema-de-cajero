import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { cerrarCaja } from "../db/repositorio";
import { claveDia, dinero } from "../lib/formato";
import { resumenCierre, generarPdfCierre } from "../lib/reporteCierre";
import { exportarExcel } from "../lib/exportarExcel";
import { useAvisos } from "../components/Avisos";
import { FileSpreadsheet, LockKeyhole } from "lucide-react";

function descargar(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Cierre: cierre de caja del día (PDF) y exportación del historial completo a Excel. */
export default function Cierre() {
  const { avisar, confirmar } = useAvisos();
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

  async function exportarAExcel() {
    setExportando(true);
    try {
      const archivo = await exportarExcel();
      descargar(`mi-caja-historial-ventas-${claveDia(new Date())}.xlsx`, archivo);
      avisar("Excel descargado");
    } catch (e) {
      avisar("No se pudo crear el Excel: " + e.message, 4000);
    } finally { setExportando(false); }
  }

  const historial = useLiveQuery(async () => {
    const n = await db.ventas.count();
    const primera = await db.ventas.orderBy("ts").first();
    return { n, desde: primera?.ts };
  }, [], null);

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
        <h2>Exportar a Excel</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          Descarga un Excel con <b>todas las ventas registradas juntas</b>: de todos los días, meses y años.
          Trae tres hojas: <b>Ventas</b> (una fila por venta, con totales), <b>Detalle</b> (cada producto vendido)
          y <b>Productos</b> (el inventario actual). Puedes filtrar por fecha, mes o forma de pago dentro de Excel.
        </p>
        {historial && (
          <p className="num" style={{ margin: "8px 0 0" }}>
            {historial.n
              ? <><b>{historial.n.toLocaleString("es-BO")}</b> {historial.n === 1 ? "venta" : "ventas"} desde el {new Date(historial.desde).toLocaleDateString("es-BO", { day: "numeric", month: "long", year: "numeric" })}</>
              : "Todavía no hay ventas registradas."}
          </p>
        )}
        <button className="btn mt2" onClick={exportarAExcel} disabled={exportando}>
          {exportando ? <><span className="spin" /> Generando Excel…</> : <><FileSpreadsheet size={18} /> Exportar a Excel</>}
        </button>
      </div>
    </section>
  );
}
