import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "../db/database";
import { anularVenta } from "../db/repositorio";
import { dinero } from "../lib/formato";
import { RANGOS, METODOS, periodo, entre, resumen, serie, masVendidos, porMetodo } from "../lib/estadisticas";
import { useAvisos } from "../components/Avisos";

function Variacion({ actual, anterior, etiqueta }) {
  if (!anterior) return <div className="d">{actual ? `Sin ventas ${etiqueta}` : " "}</div>;
  const pct = ((actual - anterior) / Math.abs(anterior)) * 100;
  const sube = pct >= 0;
  return <div className={"d " + (sube ? "up" : "down")}>{sube ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}% vs {etiqueta}</div>;
}

function TooltipVentas({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "var(--text)", color: "var(--bg)", padding: "8px 10px", borderRadius: 8, fontSize: 12 }}>
      <div style={{ opacity: 0.8 }}>{d.detalle}</div>
      <b className="num">{dinero(d.total)}</b>
    </div>
  );
}

/** Resumen de ventas: totales, gráfico, más vendidos, formas de pago, stock bajo y últimas ventas. */
export default function Dashboard() {
  const { avisar, confirmar } = useAvisos();
  const [rango, setRango] = useState("hoy");
  const p = useMemo(() => periodo(rango), [rango]);

  // Se cargan el periodo actual y el anterior (para comparar)
  const ventas = useLiveQuery(() => db.ventas.where("ts").aboveOrEqual(p.inicioPrev.getTime()).toArray(), [p.inicioPrev.getTime()], null);
  const productos = useLiveQuery(() => db.productos.toArray(), [], []);

  const datos = useMemo(() => {
    if (!ventas) return null;
    const actual = entre(ventas, p.inicio, p.fin);
    return {
      actual,
      A: resumen(actual),
      B: resumen(entre(ventas, p.inicioPrev, p.finPrev)),
      serie: serie(rango, actual, p),
      top: masVendidos(actual),
      metodos: porMetodo(actual),
      recientes: [...actual].sort((a, b) => b.ts - a.ts).slice(0, 15),
    };
  }, [ventas, p, rango]);

  const bajos = productos.filter((x) => (x.stock || 0) <= (x.minimo || 0)).sort((a, b) => (a.stock || 0) - (b.stock || 0)).slice(0, 10);

  async function anular(v) {
    const ok = await confirmar("¿Anular esta venta?", `Se borrará la venta de ${dinero(v.total)} y se devolverán los productos al stock.`, { boton: "Anular venta", peligro: true });
    if (!ok) return;
    await anularVenta(v.id);
    avisar("Venta anulada");
  }

  if (!datos) return <section className="view on"><div className="empty">Cargando…</div></section>;
  const { A, B } = datos;
  const totalMetodos = datos.metodos.reduce((a, m) => a + m.total, 0);
  const maxTop = datos.top[0]?.total || 1;

  return (
    <section className="view on">
      <div className="chips" role="tablist" aria-label="Periodo">
        {RANGOS.map((r) => (
          <button key={r.id} role="tab" aria-selected={rango === r.id} className={"chip" + (rango === r.id ? " on" : "")} onClick={() => setRango(r.id)}>{r.nombre}</button>
        ))}
      </div>

      <div className="kpis mt">
        <div className="card kpi"><div className="k">Ventas</div><div className="v num">{dinero(A.total)}</div><Variacion actual={A.total} anterior={B.total} etiqueta={p.etiquetaPrev} /></div>
        <div className="card kpi"><div className="k">Ganancia estimada</div><div className="v num">{A.tieneCosto ? dinero(A.ganancia) : "—"}</div>
          <div className="d">{A.tieneCosto ? `${A.total ? Math.round((A.ganancia / A.total) * 100) : 0}% de margen` : "Registra el costo de tus productos"}</div></div>
        <div className="card kpi"><div className="k">N.º de ventas</div><div className="v num">{A.n.toLocaleString("es-BO")}</div><Variacion actual={A.n} anterior={B.n} etiqueta={p.etiquetaPrev} /></div>
        <div className="card kpi"><div className="k">Ticket promedio</div><div className="v num">{dinero(A.ticket)}</div><div className="d">{A.unidades.toLocaleString("es-BO")} unidades vendidas</div></div>
      </div>

      <div className="dgrid mt">
        <div className="card pad">
          <h2>{rango === "hoy" ? "Ventas por hora (hoy)" : "Ventas por día"}</h2>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.serie} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }} width={56} tickCount={5}
                  tickFormatter={(v) => "Bs " + Number(v).toLocaleString("es-BO")} />
                <Tooltip content={<TooltipVentas />} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="total" fill="var(--s1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="tbl">
            <summary>Ver como tabla</summary>
            <table>
              <thead><tr><th>{rango === "hoy" ? "Hora" : "Día"}</th><th>Ventas</th></tr></thead>
              <tbody>{datos.serie.map((s) => <tr key={s.detalle}><td>{s.detalle}</td><td className="num">{dinero(s.total)}</td></tr>)}</tbody>
            </table>
          </details>
        </div>

        <div className="card pad">
          <h2>Productos más vendidos</h2>
          <ul className="bars">
            {datos.top.length ? datos.top.map((t) => (
              <li key={t.nombre}>
                <div className="t"><b>{t.nombre}</b><span className="num">{t.unidades} u · {dinero(t.total)}</span></div>
                <div className="track"><div className="fill" style={{ width: Math.max(2, (t.total / maxTop) * 100) + "%" }} /></div>
              </li>
            )) : <li><div className="empty" style={{ padding: 20 }}>Sin ventas en este periodo.</div></li>}
          </ul>
        </div>

        <div className="card pad">
          <h2>Formas de pago</h2>
          {totalMetodos ? (
            <>
              <div className="stack" role="img" aria-label="Reparto por forma de pago">
                {datos.metodos.filter((m) => m.total > 0).map((m) => <div key={m.id} style={{ width: (m.total / totalMetodos) * 100 + "%", background: m.color }} title={`${m.nombre}: ${dinero(m.total)}`} />)}
              </div>
              <ul className="legend">
                {datos.metodos.map((m) => (
                  <li key={m.id}><i style={{ background: m.color }} />{m.nombre}
                    <span className="num">{dinero(m.total)} · {Math.round((m.total / totalMetodos) * 100)}% · {m.n} {m.n === 1 ? "venta" : "ventas"}</span></li>
                ))}
              </ul>
            </>
          ) : <div className="empty" style={{ padding: 20 }}>Sin ventas en este periodo.</div>}
        </div>

        <div className="card pad">
          <h2>Stock bajo</h2>
          <ul className="slist">
            {!productos.length ? <li><div className="empty" style={{ padding: 16, width: "100%" }}>Agrega productos para ver alertas de stock.</div></li>
              : bajos.length ? bajos.map((x) => (
                <li key={x.id}><div className="grow"><div>{x.nombre}</div><div className="sub">Avisar bajo {x.minimo || 0} u</div></div>
                  <span className="badge low">⚠ {x.stock || 0} u</span></li>
              )) : <li><div className="sub" style={{ padding: "8px 0" }}>✓ Todo el inventario está sobre el mínimo.</div></li>}
          </ul>
        </div>

        <div className="card pad" style={{ gridColumn: "1 / -1" }}>
          <h2>Últimas ventas</h2>
          <ul className="slist">
            {datos.recientes.length ? datos.recientes.map((v) => {
              const d = new Date(v.ts);
              const cuando = rango === "hoy"
                ? d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
                : d.toLocaleString("es-BO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
              return (
                <li key={v.id}>
                  <div className="grow">
                    <div className="num">{dinero(v.total)} <span className="sub" style={{ fontWeight: 400 }}>· {METODOS[v.metodo]?.nombre || v.metodo} · {cuando}</span></div>
                    <div className="sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(v.items || []).map((i) => `${i.cantidad}× ${i.nombre}`).join(", ")}</div>
                  </div>
                  <button className="btn ghost danger" style={{ minHeight: 36, padding: "6px 10px", fontSize: 13 }} onClick={() => anular(v)}>Anular</button>
                </li>
              );
            }) : <li><div className="empty" style={{ padding: 20, width: "100%" }}>Todavía no hay ventas en este periodo. Ve a la Caja para registrar la primera.</div></li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
