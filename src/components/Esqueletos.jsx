/**
 * Esqueletos de carga: bloques grises con brillo que imitan la forma de cada pantalla
 * mientras llegan los datos. Aparecen con un pequeño retraso (ver .esq en index.css)
 * para que no parpadeen cuando la carga es instantánea.
 */

/** Bloque gris básico. w/h aceptan números (px) o texto CSS ("60%"). */
export function Sk({ w = "100%", h = 14, r = 8, className = "", style }) {
  return <span className={"sk " + className} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

function Contenedor({ children, etiqueta = "Cargando" }) {
  return (
    <section className="view on esq" aria-busy="true">
      <span className="sr">{etiqueta}…</span>
      {children}
    </section>
  );
}

/** Caja: botón cuadrado de escanear + resumen del turno. */
export function EsqueletoCaja() {
  return (
    <Contenedor etiqueta="Cargando caja">
      <div className="caja">
        <div className="card pad scan-hero">
          <Sk w="min(62vw, 220px)" h="auto" r={28} style={{ aspectRatio: "1" }} />
          <Sk w="70%" h={12} />
          <Sk w="50%" h={12} />
        </div>
        <div className="pay-col">
          <div className="card pad">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="sk-col"><Sk w={130} h={12} /><Sk w={110} h={24} /></div>
              <div className="sk-col" style={{ alignItems: "flex-end" }}><Sk w={50} h={12} /><Sk w={28} h={24} /></div>
            </div>
            <Sk w="85%" h={12} style={{ marginTop: 14 }} />
          </div>
        </div>
      </div>
    </Contenedor>
  );
}

/** Filas de la lista de inventario (va dentro del recuadro de Productos). */
export function EsqueletoFilasProductos({ filas = 6 }) {
  return Array.from({ length: filas }, (_, i) => (
    <li key={i} className="esq" style={{ cursor: "default" }} aria-hidden="true">
      <Sk w={`${55 + ((i * 17) % 30)}%`} h={14} />
      <Sk w={64} h={16} className="pi-precio" />
      <Sk w="35%" h={11} />
      <Sk w={46} h={22} r={999} className="pi-stock" />
    </li>
  ));
}

/** Dashboard: periodos, 4 indicadores, gráfico, más vendidos, formas de pago, stock bajo y últimas ventas. */
export function EsqueletoDashboard() {
  const lista = (n) => Array.from({ length: n }, (_, i) => (
    <div key={i} className="sk-col" style={{ padding: "8px 0" }}>
      <div className="row" style={{ justifyContent: "space-between" }}><Sk w={`${40 + ((i * 13) % 25)}%`} h={12} /><Sk w={70} h={12} /></div>
      <Sk h={8} r={4} w={`${90 - i * 14}%`} />
    </div>
  ));
  return (
    <Contenedor etiqueta="Cargando dashboard">
      <div className="chips">{[44, 66, 70, 80].map((w, i) => <Sk key={i} w={w} h={34} r={999} />)}</div>
      <div className="kpis mt">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card kpi sk-col"><Sk w="60%" h={11} /><Sk w="80%" h={24} /><Sk w="55%" h={10} /></div>
        ))}
      </div>
      <div className="dgrid mt">
        <div className="card pad">
          <Sk w="45%" h={16} />
          <div className="sk-chart">
            {[35, 60, 25, 80, 50, 95, 40, 70, 30, 55].map((h, i) => <Sk key={i} h={`${h}%`} r={4} w="100%" />)}
          </div>
        </div>
        <div className="card pad"><Sk w="55%" h={16} style={{ marginBottom: 8 }} />{lista(5)}</div>
        <div className="card pad">
          <Sk w="45%" h={16} style={{ marginBottom: 14 }} />
          <Sk h={14} r={7} />
          {[0, 1, 2].map((i) => <div key={i} className="row" style={{ marginTop: 12, justifyContent: "space-between" }}><Sk w={90} h={12} /><Sk w={140} h={12} /></div>)}
        </div>
        <div className="card pad"><Sk w="35%" h={16} style={{ marginBottom: 12 }} />{[0, 1].map((i) => <div key={i} className="row" style={{ justifyContent: "space-between", padding: "8px 0" }}><div className="sk-col" style={{ flex: 1 }}><Sk w="55%" h={13} /><Sk w="35%" h={10} /></div><Sk w={52} h={22} r={999} /></div>)}</div>
        <div className="card pad" style={{ gridColumn: "1 / -1" }}><Sk w="30%" h={16} style={{ marginBottom: 12 }} />{[0, 1, 2].map((i) => <div key={i} className="row" style={{ justifyContent: "space-between", padding: "8px 0" }}><div className="sk-col" style={{ flex: 1 }}><Sk w="45%" h={13} /><Sk w="70%" h={10} /></div><Sk w={60} h={28} /></div>)}</div>
      </div>
    </Contenedor>
  );
}

/** Contenido del recuadro de cierre mientras carga el turno. */
export function EsqueletoTurno() {
  return (
    <div className="esq" aria-busy="true">
      <span className="sr">Cargando turno…</span>
      <Sk w="95%" h={12} /><Sk w="70%" h={12} style={{ marginTop: 8 }} />
      <div className="resumen-turno mt">
        {[0, 1, 2, 3].map((i) => <div key={i}><Sk w="60%" h={11} /><Sk w="80%" h={18} style={{ marginTop: 4 }} /></div>)}
      </div>
      <Sk w={150} h={44} r={11} style={{ marginTop: 20 }} />
    </div>
  );
}
