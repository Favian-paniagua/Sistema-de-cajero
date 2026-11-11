import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { aperturaActual, cerrarCaja, ventasDelTurno, ultimoCierre, ventasDeCierre } from "../db/repositorio";
import { claveDia, dinero, aNumero } from "../lib/formato";
import { resumenCierre, generarPdfCierre } from "../lib/reporteCierre";
import { exportarExcel } from "../lib/exportarExcel";
import { BILLETES, MONEDAS, efectivoEsperado, totalConteo, diferencia } from "../lib/arqueo";
import { METODOS } from "../lib/estadisticas";
import { useAvisos } from "../components/Avisos";
import { EsqueletoTurno, Sk } from "../components/Esqueletos";
import { ArrowDown, ArrowUp, ChevronLeft, CircleCheck, Coins, FileDown, FileSpreadsheet, LockKeyhole, Pencil, Wallet } from "lucide-react";

function descargar(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const horaCorta = (ts) => new Date(ts).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
const fechaHora = (ts) => new Date(ts).toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const den = (v) => (v < 1 ? `${Math.round(v * 100)} ctvs` : `Bs ${v}`);

/** Texto e ícono de la diferencia entre lo contado y lo esperado. */
function Diferencia({ monto, tipo, grande = false }) {
  const Icono = tipo === "cuadra" ? CircleCheck : tipo === "sobrante" ? ArrowUp : ArrowDown;
  const texto = tipo === "cuadra" ? "Cuadra, no hay diferencia" : tipo === "sobrante" ? `Sobran ${dinero(monto)}` : `Faltan ${dinero(Math.abs(monto))}`;
  return (
    <div className={`dif dif-${tipo}` + (grande ? " grande" : "")} role="status">
      <Icono size={grande ? 22 : 16} strokeWidth={2.4} /><span>{texto}</span>
    </div>
  );
}

/** Paso de conteo: el cajero cuenta el efectivo y ve la diferencia antes de confirmar. */
function ArqueoEfectivo({ inicial, ventasEfectivo, esperado, onVolver, onConfirmar, cerrando }) {
  const [modo, setModo] = useState("total");          // "total" | "detalle"
  const [total, setTotal] = useState("");
  const [conteo, setConteo] = useState({});
  const [observacion, setObservacion] = useState("");

  // Solo cuenta una forma: al cambiar, se borra lo escrito en la otra
  const cambiarModo = (m) => {
    if (m === modo) return;
    setModo(m); setTotal(""); setConteo({});
  };

  const contado = modo === "detalle" ? totalConteo(conteo) : aNumero(total);
  const ingresado = modo === "detalle" ? Object.values(conteo).some((c) => c !== "" && c != null) : total.trim() !== "";
  const dif = ingresado ? diferencia(contado, esperado) : null;

  const fila = (v) => {
    const cant = conteo[v] ?? "";
    return (
      <div className="den-fila" key={v}>
        <span className="den-valor num">{den(v)}</span>
        <span className="den-x">×</span>
        <input className="f num den-input" inputMode="numeric" placeholder="0" value={cant} aria-label={`Cantidad de ${den(v)}`}
          onChange={(e) => setConteo({ ...conteo, [v]: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
        <span className="den-sub num">{dinero(v * (parseInt(cant, 10) || 0))}</span>
      </div>
    );
  };

  return (
    <div className="arqueo">
      <button className="btn ghost volver" onClick={onVolver} disabled={cerrando}><ChevronLeft size={18} /> Volver</button>

      <div className="esperado">
        <span className="sub">Debería haber en caja</span>
        <b className="num">{dinero(esperado)}</b>
        <span className="sub num">{dinero(inicial)} inicial + {dinero(ventasEfectivo)} en ventas en efectivo</span>
      </div>

      <h3 className="arqueo-titulo">Cuenta el efectivo</h3>
      <p className="sub" style={{ margin: "-4px 0 10px" }}>Elige <b>una</b> de las dos formas de registrar lo que contaste:</p>
      <div className="elegir-modo" role="radiogroup" aria-label="Forma de contar el efectivo">
        <button role="radio" aria-checked={modo === "total"} className={"modo-op" + (modo === "total" ? " on" : "")} onClick={() => cambiarModo("total")}>
          <Pencil size={18} /><span>Escribir total</span>
        </button>
        <span className="modo-o" aria-hidden="true">o</span>
        <button role="radio" aria-checked={modo === "detalle"} className={"modo-op" + (modo === "detalle" ? " on" : "")} onClick={() => cambiarModo("detalle")}>
          <Coins size={18} /><span>Billetes y monedas</span>
        </button>
      </div>

      {modo === "total" ? (
        <div className="mt">
          <label className="l" htmlFor="contado">Efectivo contado (Bs)</label>
          <input className="f num contado-input" id="contado" inputMode="decimal" placeholder="0,00" value={total} onChange={(e) => setTotal(e.target.value)} />
        </div>
      ) : (
        <div className="mt denominaciones">
          <div className="den-grupo"><span className="l">Billetes</span>{BILLETES.map(fila)}</div>
          <div className="den-grupo"><span className="l">Monedas</span>{MONEDAS.map(fila)}</div>
          <div className="den-total"><span>Total contado</span><b className="num">{dinero(contado)}</b></div>
        </div>
      )}

      <div className="mt2">
        {dif ? (
          <>
            <div className="comparacion num">
              <div><span className="sub">Esperado</span><b>{dinero(esperado)}</b></div>
              <div><span className="sub">Contado</span><b>{dinero(contado)}</b></div>
            </div>
            <Diferencia {...dif} grande />
          </>
        ) : (
          <p className="sub dif-vacia">Ingresa el efectivo contado para ver si hay diferencia.</p>
        )}
      </div>

      {dif && dif.tipo !== "cuadra" && (
        <div className="mt">
          <label className="l" htmlFor="obs">Observación (opcional)</label>
          <textarea className="f" id="obs" rows={2} maxLength={200} value={observacion} onChange={(e) => setObservacion(e.target.value)}
            placeholder={dif.tipo === "faltante" ? "Ej. se dio cambio de más" : "Ej. un cliente dejó propina"} />
        </div>
      )}

      <button className="btn primary big mt2" style={{ width: "100%" }} disabled={!dif || cerrando}
        onClick={() => onConfirmar({
          efectivoContado: contado, diferencia: dif.monto, tipoDiferencia: dif.tipo,
          observacion: observacion.trim(), conteo: modo === "detalle" ? conteo : null,
        })}>
        {cerrando ? <><span className="spin" /> Cerrando caja…</> : <><LockKeyhole size={18} /> Confirmar cierre</>}
      </button>
    </div>
  );
}

/** Cierre: resumen del turno → conteo del efectivo → diferencia → confirmar. También exporta el historial a Excel. */
export default function Cierre() {
  const { avisar } = useAvisos();
  const [exportando, setExportando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [paso, setPaso] = useState("resumen");         // "resumen" | "conteo"
  const [recien, setRecien] = useState(null);          // cierre recién confirmado (para mostrar el resultado)

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
  const r = resumenCierre(ventas);
  const inicial = apertura?.efectivoInicial || 0;
  const esperado = efectivoEsperado(inicial, ventas);

  async function confirmarCierre(arqueo) {
    setCerrando(true);
    try {
      const cierre = await cerrarCaja(apertura, {
        total: r.total, costo: r.costo, ganancia: r.ganancia, ventas: r.ventas, unidades: r.unidades, porMetodo: r.porMetodo,
        efectivoEsperado: esperado, ...arqueo,
      });
      try {
        descargar(`cierre-de-caja-${cierre.dia}.pdf`, await generarPdfCierre({ ventas, cierre }));
      } catch (e) {
        avisar("La caja se cerró, pero no se pudo crear el PDF: " + e.message, 4500);
      }
      setRecien(cierre);
      setPaso("resumen");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      avisar("No se pudo cerrar la caja: " + e.message, 4000);
    } finally { setCerrando(false); }
  }

  async function descargarPdf(cierre) {
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
      descargar(`mi-caja-historial-ventas-${claveDia(new Date())}.xlsx`, await exportarExcel());
      avisar("Excel descargado");
    } catch (e) {
      avisar("No se pudo crear el Excel: " + e.message, 4000);
    } finally { setExportando(false); }
  }

  /* --- Contenido del recuadro de cierre según el estado --- */
  let contenido;
  if (recien) {
    contenido = (
      <div className="resultado-cierre">
        <div className={`resultado-ico dif-${recien.tipoDiferencia}`}><LockKeyhole size={28} strokeWidth={1.9} /></div>
        <h3>Caja cerrada</h3>
        <p className="sub">{fechaHora(recien.ts)} · {recien.ventas} {recien.ventas === 1 ? "venta" : "ventas"} por {dinero(recien.total)}</p>
        <div className="comparacion num">
          <div><span className="sub">Esperado</span><b>{dinero(recien.efectivoEsperado)}</b></div>
          <div><span className="sub">Contado</span><b>{dinero(recien.efectivoContado)}</b></div>
        </div>
        <Diferencia monto={recien.diferencia} tipo={recien.tipoDiferencia} grande />
        {recien.observacion && <p className="sub obs">“{recien.observacion}”</p>}
        <p className="sub">El reporte en PDF se descargó en tu dispositivo.</p>
        <div className="row" style={{ width: "100%" }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => descargarPdf(recien)} disabled={cerrando}><FileDown size={18} /> PDF otra vez</button>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => setRecien(null)}>Listo</button>
        </div>
      </div>
    );
  } else if (!turno) {
    contenido = <EsqueletoTurno />;
  } else if (apertura && paso === "conteo") {
    contenido = (
      <ArqueoEfectivo inicial={inicial} ventasEfectivo={esperado - inicial} esperado={esperado} cerrando={cerrando}
        onVolver={() => setPaso("resumen")} onConfirmar={confirmarCierre} />
    );
  } else if (apertura) {
    contenido = (
      <>
        <p className="sub" style={{ marginTop: 0 }}>
          Al terminar el día, cuenta el efectivo para cerrar la caja. Se guardará el resultado y se descargará el reporte en PDF.
        </p>
        <div className="resumen-turno mt">
          <div><span className="sub">Abierta</span><b className="num">{new Date(apertura.ts).toDateString() === new Date().toDateString() ? horaCorta(apertura.ts) : fechaHora(apertura.ts)}</b></div>
          <div><span className="sub">Efectivo inicial</span><b className="num">{dinero(inicial)}</b></div>
          <div><span className="sub">Vendido</span><b className="num">{dinero(r.total)}</b><span className="sub">{r.ventas} {r.ventas === 1 ? "venta" : "ventas"}</span></div>
          <div className="destacado"><span className="sub">Efectivo esperado</span><b className="num">{dinero(esperado)}</b></div>
        </div>
        <ul className="metodos-turno">
          {Object.entries(METODOS).map(([id, m]) => (
            <li key={id}><i style={{ background: m.color }} />{m.nombre}<span className="num">{dinero(r.porMetodo[id]?.total || 0)}</span></li>
          ))}
        </ul>
        <button className="btn primary mt2" onClick={() => setPaso("conteo")}><Wallet size={18} /> Cerrar caja</button>
      </>
    );
  } else {
    const c = turno.cierre;
    contenido = (
      <>
        <p className="sub" style={{ marginTop: 0 }}>
          La caja está cerrada. Ábrela desde <b>Caja</b> registrando el efectivo inicial para empezar a vender.
        </p>
        {c && (
          <div className="ultimo-cierre">
            <p className="num" style={{ margin: 0 }}>Último cierre: <b>{fechaHora(c.ts)}</b> · {dinero(c.total)} en {c.ventas} {c.ventas === 1 ? "venta" : "ventas"}</p>
            {c.efectivoContado != null && (
              <>
                <p className="sub num" style={{ margin: "6px 0" }}>Esperado {dinero(c.efectivoEsperado)} · Contado {dinero(c.efectivoContado)}</p>
                <Diferencia monto={c.diferencia} tipo={c.tipoDiferencia} />
              </>
            )}
            <button className="btn mt" onClick={() => descargarPdf(c)} disabled={cerrando}>
              {cerrando ? <span className="spin" /> : <><FileDown size={18} /> Descargar reporte del último cierre</>}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <section className="view on">
      <div className="card pad">
        {!recien && <h2>{paso === "conteo" && apertura ? "Cerrar caja" : "Cierre de caja"}</h2>}
        {contenido}
      </div>

      {paso !== "conteo" && (
        <div className="card pad mt">
          <h2>Exportar a Excel</h2>
          <p className="sub" style={{ marginTop: 0 }}>
            Descarga un Excel con <b>todas las ventas registradas juntas</b>: de todos los días, meses y años.
            Puedes filtrar por fecha, mes o forma de pago dentro de Excel.
          </p>
          {!historial && <Sk w={240} h={14} style={{ margin: "10px 0 0" }} />}
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
      )}
    </section>
  );
}
