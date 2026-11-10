import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { aperturaActual, cerrarCaja, ventasDelTurno, ultimoCierre, ventasDeCierre } from "../db/repositorio";
import { claveDia, dinero } from "../lib/formato";
import { resumenCierre, generarPdfCierre } from "../lib/reporteCierre";
import { exportarExcel } from "../lib/exportarExcel";
import { useAvisos } from "../components/Avisos";
import { FileDown, FileSpreadsheet, LockKeyhole } from "lucide-react";

function descargar(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const horaCorta = (ts) => new Date(ts).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
const fechaHora = (ts) => new Date(ts).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Cierre: cierre del turno abierto (PDF) y exportación del historial completo a Excel. */
export default function Cierre() {
  const { avisar, confirmar } = useAvisos();
  const [exportando, setExportando] = useState(false);
  const [cerrando, setCerrando] = useState(false);

  // Turno actual: apertura abierta y sus ventas (se actualiza solo cuando cambian los datos)
  const turno = useLiveQuery(async () => {
    const apertura = await aperturaActual();
    const ventas = apertura ? await ventasDelTurno(apertura) : [];
    return { apertura, ventas: ventas.sort((a, b) => a.ts - b.ts), cierre: await ultimoCierre() };
  }, [], null);

  const historial = useLiveQuery(async () => {
    const n = await db.ventas.count();
    const primera = await db.ventas.orderBy("ts").first();
    return { n, desde: primera?.ts };
  }, [], null);

  const apertura = turno?.apertura;
  const ventas = turno?.ventas || [];
  const total = ventas.reduce((a, v) => a + v.total, 0);
  const efectivoVentas = ventas.filter((v) => v.metodo === "efectivo").reduce((a, v) => a + v.total, 0);
  const inicial = apertura?.efectivoInicial || 0;

  /** Cierra el turno: guarda el cierre, marca la apertura como cerrada y descarga el PDF. */
  async function cerrar() {
    const ok = await confirmar(
      "¿Cerrar la caja?",
      `Se descargará el reporte en PDF con ${ventas.length} ${ventas.length === 1 ? "venta" : "ventas"} por ${dinero(total)}. ` +
        `Deberías tener ${dinero(inicial + efectivoVentas)} en efectivo. Para volver a vender tendrás que abrir la caja otra vez.`,
      { boton: "Cerrar caja" }
    );
    if (!ok) return;
    setCerrando(true);
    try {
      const r = resumenCierre(ventas);
      const cierre = await cerrarCaja(apertura, { total: r.total, costo: r.costo, ganancia: r.ganancia, ventas: r.ventas, unidades: r.unidades, porMetodo: r.porMetodo });
      const pdf = await generarPdfCierre({ ventas, cierre });
      descargar(`cierre-de-caja-${cierre.dia}.pdf`, pdf);
      avisar("Caja cerrada · reporte PDF descargado", 3000);
    } catch (e) {
      avisar("No se pudo cerrar la caja: " + e.message, 4000);
    } finally { setCerrando(false); }
  }

  /** Vuelve a generar el PDF del último cierre. */
  async function descargarUltimo() {
    const cierre = turno?.cierre;
    if (!cierre) return;
    setCerrando(true);
    try {
      const vs = (await ventasDeCierre(cierre)).sort((a, b) => a.ts - b.ts);
      descargar(`cierre-de-caja-${cierre.dia}.pdf`, await generarPdfCierre({ ventas: vs, cierre }));
    } catch (e) {
      avisar("No se pudo generar el PDF: " + e.message, 4000);
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

  return (
    <section className="view on">
      <div className="card pad">
        <h2>Cierre de caja</h2>
        {!turno ? (
          <p className="sub">Cargando…</p>
        ) : apertura ? (
          <>
            <p className="sub" style={{ marginTop: 0 }}>
              Al cerrar se descarga un reporte en PDF del turno: total vendido, ganancia, efectivo en caja,
              formas de pago y cuánto se vendió de cada producto.
            </p>
            <div className="resumen-turno mt">
              <div><span className="sub">Abierta</span><b className="num">{new Date(apertura.ts).toDateString() === new Date().toDateString() ? horaCorta(apertura.ts) : fechaHora(apertura.ts)}</b></div>
              <div><span className="sub">Efectivo inicial</span><b className="num">{dinero(inicial)}</b></div>
              <div><span className="sub">Vendido</span><b className="num">{dinero(total)}</b><span className="sub">{ventas.length} {ventas.length === 1 ? "venta" : "ventas"}</span></div>
              <div><span className="sub">Efectivo esperado</span><b className="num">{dinero(inicial + efectivoVentas)}</b></div>
            </div>
            <button className="btn primary mt2" onClick={cerrar} disabled={cerrando}>
              {cerrando ? <><span className="spin" /> Generando reporte…</> : <><LockKeyhole size={18} /> Cerrar caja</>}
            </button>
          </>
        ) : (
          <>
            <p className="sub" style={{ marginTop: 0 }}>
              La caja está cerrada. Ábrela desde <b>Caja</b> registrando el efectivo inicial para empezar a vender.
            </p>
            {turno.cierre && (
              <>
                <p className="num" style={{ margin: "8px 0 0" }}>
                  Último cierre: <b>{fechaHora(turno.cierre.ts)}</b> · {dinero(turno.cierre.total)} en {turno.cierre.ventas} {turno.cierre.ventas === 1 ? "venta" : "ventas"}
                </p>
                <button className="btn mt2" onClick={descargarUltimo} disabled={cerrando}>
                  {cerrando ? <span className="spin" /> : <><FileDown size={18} /> Descargar reporte del último cierre</>}
                </button>
              </>
            )}
          </>
        )}
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
