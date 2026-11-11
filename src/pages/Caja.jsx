import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { buscarPorCodigo, registrarVenta, aperturaActual, abrirCaja, ventasDelTurno } from "../db/repositorio";
import { dinero, dineroCorto, aNumero } from "../lib/formato";
import { useAvisos } from "../components/Avisos";
import Escaner from "../components/EscanerLazy";
import Cobro from "../components/Cobro";
import BuscadorProducto from "../components/BuscadorProducto";
import { LockKeyholeOpen, Minus, Plus, ScanBarcode, ShoppingCart, X } from "lucide-react";
import { EsqueletoCaja } from "../components/Esqueletos";

/** Lista del carrito con botones para sumar, restar o quitar (se muestra dentro del escáner). */
function ListaCarrito({ carrito, resaltado, cambiarCantidad, vacio }) {
  if (!carrito.length) {
    return <ul className="cart-list"><li style={{ display: "block", border: 0 }}><div className="empty"><div className="ico"><ShoppingCart size={34} strokeWidth={1.5} /></div>{vacio}</div></li></ul>;
  }
  return (
    <ul className="cart-list">
      {carrito.map((i) => (
        <li key={i.productoId} className={i.productoId === resaltado ? "flash" : ""}>
          <div><div className="ci-name">{i.nombre}</div><div className="ci-meta num">{dinero(i.precio)} c/u · {i.codigo}</div></div>
          <div className="ci-sub num">{dinero(i.precio * i.cantidad)}</div>
          <div className="row"><button className="btn ghost icon danger" aria-label={"Quitar " + i.nombre} onClick={() => cambiarCantidad(i.productoId, -i.cantidad)}><X size={18} /></button></div>
          <div className="qty">
            <button aria-label={"Menos " + i.nombre} onClick={() => cambiarCantidad(i.productoId, -1)}><Minus size={16} /></button>
            <span className="num">{i.cantidad}</span>
            <button aria-label={"Más " + i.nombre} onClick={() => cambiarCantidad(i.productoId, 1)}><Plus size={16} /></button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Recuadro de apertura de caja: registra con cuánto efectivo se empieza el turno. */
function AperturaCaja({ onAbierta }) {
  const { avisar } = useAvisos();
  const [monto, setMonto] = useState("");
  const [abriendo, setAbriendo] = useState(false);

  async function abrir(e) {
    e.preventDefault();
    if (monto.trim() === "" || aNumero(monto) < 0) return avisar("Escribe con cuánto efectivo empiezas (puede ser 0).", 2600);
    setAbriendo(true);
    try {
      const a = await abrirCaja(aNumero(monto));
      avisar(`Caja abierta con ${dinero(a.efectivoInicial)}`);
      onAbierta?.(a);
    } catch (err) {
      avisar("No se pudo abrir la caja: " + err.message, 4000);
      setAbriendo(false);
    }
  }

  return (
    <form className="card pad apertura" onSubmit={abrir} noValidate>
      <div className="apertura-ico"><LockKeyholeOpen size={30} strokeWidth={1.8} /></div>
      <h2 style={{ margin: 0, fontSize: 20 }}>Apertura de caja</h2>
      <p className="sub" style={{ margin: 0 }}>
        Antes de vender, registra con cuánto efectivo (billetes y monedas) empiezas. Así, al cerrar,
        sabrás cuánto debería haber en la caja.
      </p>
      <label className="l" htmlFor="efectivoInicial" style={{ alignSelf: "stretch", textAlign: "left", marginTop: 6 }}>Efectivo inicial (Bs)</label>
      <input className="f num apertura-input" id="efectivoInicial" inputMode="decimal" placeholder="0,00"
        value={monto} onChange={(e) => setMonto(e.target.value)} />
      <div className="quick" style={{ justifyContent: "center", marginTop: 0 }}>
        {[0, 50, 100, 200, 500].map((v) => (
          <button type="button" key={v} onClick={() => setMonto(String(v))}>{v === 0 ? "Sin efectivo" : dineroCorto(v)}</button>
        ))}
      </div>
      <button type="submit" className="btn primary big" style={{ alignSelf: "stretch" }} disabled={abriendo}>
        {abriendo ? <span className="spin" /> : "Abrir caja"}
      </button>
    </form>
  );
}

/** Pantalla de venta: apertura de caja y botón para escanear (el carrito y el cobro están en el escáner). */
export default function Caja({ carrito, setCarrito }) {
  const { avisar } = useAvisos();
  const productos = useLiveQuery(() => db.productos.toArray(), [], []);
  // Turno actual: la apertura en curso y lo vendido desde entonces
  const turno = useLiveQuery(async () => {
    const apertura = await aperturaActual();
    return { apertura, ventas: apertura ? await ventasDelTurno(apertura) : [] };
  }, [], null);

  const [escaneando, setEscaneando] = useState(false);
  const [ultimoEscaneo, setUltimoEscaneo] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const [resaltado, setResaltado] = useState(null);

  const totales = useMemo(() => ({
    total: Math.round(carrito.reduce((a, i) => a + i.precio * i.cantidad, 0) * 100) / 100,
    unidades: carrito.reduce((a, i) => a + i.cantidad, 0),
  }), [carrito]);

  function agregar(p, cantidad = 1) {
    setCarrito((c) => {
      const i = c.findIndex((x) => x.productoId === p.id);
      if (i >= 0) return c.map((x, k) => (k === i ? { ...x, cantidad: x.cantidad + cantidad } : x));
      return [{ productoId: p.id, codigo: p.codigo, nombre: p.nombre, categoria: p.categoria, precio: p.precio, costo: p.costo || 0, cantidad }, ...c];
    });
    setResaltado(p.id);
    setTimeout(() => setResaltado(null), 500);
  }

  /** Desde el escáner: si el código no existe, solo avisa en rojo y la cámara sigue abierta. */
  async function porCodigoEscaner(codigo) {
    const p = await buscarPorCodigo(codigo);
    if (p) {
      agregar(p);
      setUltimoEscaneo((u) => ({ tipo: "ok", texto: `+1 ${p.nombre} · ${dinero(p.precio)}`, n: (u?.n || 0) + 1 }));
      return true;
    }
    setUltimoEscaneo((u) => ({ tipo: "error", texto: `Producto no registrado · ${codigo}`, n: (u?.n || 0) + 1 }));
    return false;
  }


  const cambiarCantidad = (id, delta) =>
    setCarrito((c) => c.map((x) => (x.productoId === id ? { ...x, cantidad: x.cantidad + delta } : x)).filter((x) => x.cantidad > 0));

  async function confirmarVenta(metodo, recibido) {
    try {
      const v = await registrarVenta(carrito, metodo, recibido);
      setCarrito([]); setCobrando(false);
      avisar(`Venta registrada · ${dinero(v.total)}${v.cambio > 0 ? ` · Cambio ${dinero(v.cambio)}` : ""}`, 3200);
    } catch (e) {
      avisar("No se pudo guardar la venta: " + e.message, 4000);
      throw e;
    }
  }

  const vendido = (turno?.ventas || []).reduce((a, v) => a + v.total, 0);
  const apertura = turno?.apertura;

  if (!turno) return <EsqueletoCaja />;
  if (!apertura) return <section className="view on"><div className="caja-sola"><AperturaCaja /></div></section>;

  return (
    <section className="view on">
      <div className="caja">
        <div className="card pad scan-hero">
          <button className="scan-big" onClick={() => { setUltimoEscaneo(null); setEscaneando(true); }}>
            <ScanBarcode size={56} strokeWidth={1.8} />
            <span>Escanear</span>
          </button>
          <p className="sub">Toca para abrir la cámara. Ahí también puedes buscar por nombre o código y ajustar las cantidades.</p>
        </div>

        <div className="pay-col">
          <div className="card pad">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div><div className="sub">Vendido en este turno</div><div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{dinero(vendido)}</div></div>
              <div style={{ textAlign: "right" }}><div className="sub">Ventas</div><div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{turno.ventas.length}</div></div>
            </div>
            <p className="sub num" style={{ margin: "10px 0 0" }}>
              Caja abierta a las {new Date(apertura.ts).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })} con {dinero(apertura.efectivoInicial)} de efectivo inicial.
            </p>
          </div>
        </div>
      </div>

      {/* Escáner dividido: cámara arriba, carrito abajo (se puede sumar/restar sin cerrar la cámara) */}
      <Escaner abierto={escaneando} continuo resultado={ultimoEscaneo} onCodigo={porCodigoEscaner} onCerrar={() => setEscaneando(false)}
        barra={<BuscadorProducto className="scan-search" alto={44} productos={productos} placeholder="Nombre o código del producto"
          onElegir={(p) => { agregar(p); setUltimoEscaneo((u) => ({ tipo: "ok", texto: `+1 ${p.nombre} · ${dinero(p.precio)}`, n: (u?.n || 0) + 1 })); }}
          onCodigo={porCodigoEscaner} />}>
        <div className="sp-list">
          <ListaCarrito carrito={carrito} resaltado={resaltado} cambiarCantidad={cambiarCantidad}
            vacio="Apunta la cámara al código de barras. Los productos aparecerán aquí." />
        </div>
        <div className="sp-foot">
          <div className="sp-total">
            <div className="sub">{totales.unidades} {totales.unidades === 1 ? "producto" : "productos"}</div>
            <div className="amt num">{dinero(totales.total)}</div>
          </div>
          <button className="btn primary" disabled={!carrito.length} onClick={() => { setEscaneando(false); setCobrando(true); }}>Cobrar</button>
        </div>
      </Escaner>
      {cobrando && <Cobro total={totales.total} unidades={totales.unidades} onCerrar={() => setCobrando(false)} onConfirmar={confirmarVenta} />}
    </section>
  );
}
