import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { buscarPorCodigo, registrarVenta } from "../db/repositorio";
import { dinero, claveDia } from "../lib/formato";
import { useAvisos } from "../components/Avisos";
import Escaner from "../components/EscanerLazy";
import Cobro from "../components/Cobro";
import BuscadorProducto from "../components/BuscadorProducto";
import { Minus, Plus, ScanBarcode, ShoppingCart, X } from "lucide-react";

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

/** Pantalla de venta: botón para escanear, total del carrito y cobro. */
export default function Caja({ carrito, setCarrito }) {
  const { avisar, confirmar } = useAvisos();
  const productos = useLiveQuery(() => db.productos.toArray(), [], []);
  const hoy = claveDia(new Date());
  const ventasHoy = useLiveQuery(() => db.ventas.where("dia").equals(hoy).toArray(), [hoy], []);

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
      return [{ productoId: p.id, codigo: p.codigo, nombre: p.nombre, precio: p.precio, costo: p.costo || 0, cantidad }, ...c];
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

  async function vaciar() {
    if (await confirmar("¿Vaciar carrito?", "Se quitarán todos los productos de esta venta.", { boton: "Vaciar", peligro: true })) setCarrito([]);
  }

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

  const vendidoHoy = ventasHoy.reduce((a, v) => a + v.total, 0);

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
          <div className="card pad total-box">
            <div className="lbl">Total a cobrar</div>
            <div className="amt num">{dinero(totales.total)}</div>
            <div className="meta">{totales.unidades ? `${totales.unidades} ${totales.unidades === 1 ? "producto" : "productos"}` : "Sin productos"}</div>
            <button className="btn primary big mt2" style={{ width: "100%" }} disabled={!carrito.length} onClick={() => setCobrando(true)}>Cobrar</button>
            <button className="btn ghost mt" style={{ width: "100%" }} disabled={!carrito.length} onClick={vaciar}>Vaciar carrito</button>
          </div>
          <div className="card pad mt">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div><div className="sub">Vendido hoy</div><div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{dinero(vendidoHoy)}</div></div>
              <div style={{ textAlign: "right" }}><div className="sub">Ventas</div><div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{ventasHoy.length}</div></div>
            </div>
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
