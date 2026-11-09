import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { buscarPorCodigo, registrarVenta } from "../db/repositorio";
import { dinero, claveDia } from "../lib/formato";
import { useAvisos } from "../components/Avisos";
import Escaner from "../components/EscanerLazy";
import ProductoForm from "../components/ProductoForm";
import Cobro from "../components/Cobro";

/** Pantalla de venta: escanear o buscar productos, armar el carrito y cobrar. */
export default function Caja({ carrito, setCarrito }) {
  const { avisar, confirmar } = useAvisos();
  const productos = useLiveQuery(() => db.productos.toArray(), [], []);
  const hoy = claveDia(new Date());
  const ventasHoy = useLiveQuery(() => db.ventas.where("dia").equals(hoy).toArray(), [hoy], []);

  const [q, setQ] = useState("");
  const [sel, setSel] = useState(-1);
  const [escaneando, setEscaneando] = useState(false);
  const [ultimoEscaneo, setUltimoEscaneo] = useState(null);
  const [nuevoCodigo, setNuevoCodigo] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const [resaltado, setResaltado] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, []);

  const sugerencias = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return productos.filter((p) => p.nombre.toLowerCase().includes(t) || String(p.codigo).includes(t)).slice(0, 6);
  }, [q, productos]);

  const totales = useMemo(() => ({
    total: Math.round(carrito.reduce((a, i) => a + i.precio * i.cantidad, 0) * 100) / 100,
    unidades: carrito.reduce((a, i) => a + i.cantidad, 0),
  }), [carrito]);

  useEffect(() => {
    document.body.classList.toggle("has-cart", carrito.length > 0);
    return () => document.body.classList.remove("has-cart");
  }, [carrito.length]);

  function agregar(p, cantidad = 1) {
    setCarrito((c) => {
      const i = c.findIndex((x) => x.productoId === p.id);
      if (i >= 0) return c.map((x, k) => (k === i ? { ...x, cantidad: x.cantidad + cantidad } : x));
      return [{ productoId: p.id, codigo: p.codigo, nombre: p.nombre, precio: p.precio, costo: p.costo || 0, cantidad }, ...c];
    });
    setResaltado(p.id);
    setTimeout(() => setResaltado(null), 500);
  }

  async function porCodigo(codigo) {
    const p = await buscarPorCodigo(codigo);
    if (p) {
      agregar(p);
      setUltimoEscaneo({ ok: true, texto: `✓ ${p.nombre} · ${dinero(p.precio)}` });
      if (!escaneando) avisar("+1 " + p.nombre, 1200);
    } else {
      setEscaneando(false);
      setNuevoCodigo(codigo);
    }
  }

  function enter(e) {
    if (e.key === "ArrowDown") { setSel((s) => Math.min(s + 1, sugerencias.length - 1)); e.preventDefault(); return; }
    if (e.key === "ArrowUp") { setSel((s) => Math.max(s - 1, -1)); e.preventDefault(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    const exacto = productos.find((p) => String(p.codigo) === v);
    if (sel >= 0 && sugerencias[sel]) agregar(sugerencias[sel]);
    else if (exacto) agregar(exacto);
    else if (/^\d{4,}$/.test(v)) porCodigo(v);          // código desconocido → registrar producto
    else if (sugerencias.length === 1) agregar(sugerencias[0]);
    else if (sugerencias.length > 1) { setSel(0); return; }
    else porCodigo(v);
    setQ(""); setSel(-1);
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
        <div className="card pad">
          <div className="scanbar">
            <button className="btn primary big scan-btn" onClick={() => { setUltimoEscaneo(null); setEscaneando(true); }}>📷 <span>Escanear</span></button>
            <div className="search">
              <input ref={input} className="f" value={q} placeholder="Código o nombre del producto" autoComplete="off" enterKeyHint="go"
                style={{ minHeight: 56 }} onChange={(e) => { setQ(e.target.value); setSel(-1); }} onKeyDown={enter} />
              {sugerencias.length > 0 && (
                <div className="sugg" style={{ display: "block" }}>
                  {sugerencias.map((p, i) => (
                    <button key={p.id} className={i === sel ? "hl" : ""} onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { agregar(p); setQ(""); setSel(-1); }}>
                      <span>{p.nombre}</span><span className="sub num">{dinero(p.precio)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p className="sub" style={{ margin: "10px 2px 0" }}>Escanea con la cámara, escribe el código o usa un lector USB (escribe solo y presiona Enter).</p>

          <ul className="cart-list mt">
            {carrito.length === 0 ? (
              <li style={{ display: "block", border: 0 }}><div className="empty"><div className="ico">🛒</div>Escanea o busca un producto para empezar la venta.</div></li>
            ) : carrito.map((i) => (
              <li key={i.productoId} className={i.productoId === resaltado ? "flash" : ""}>
                <div><div className="ci-name">{i.nombre}</div><div className="ci-meta num">{dinero(i.precio)} c/u · {i.codigo}</div></div>
                <div className="ci-sub num">{dinero(i.precio * i.cantidad)}</div>
                <div className="row"><button className="btn ghost icon danger" aria-label="Quitar" onClick={() => cambiarCantidad(i.productoId, -i.cantidad)}>✕</button></div>
                <div className="qty">
                  <button aria-label="Menos" onClick={() => cambiarCantidad(i.productoId, -1)}>−</button>
                  <span className="num">{i.cantidad}</span>
                  <button aria-label="Más" onClick={() => cambiarCantidad(i.productoId, 1)}>+</button>
                </div>
              </li>
            ))}
          </ul>
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
            <Link to="/dashboard" className="btn ghost mt" style={{ width: "100%", textDecoration: "none" }}>Ver dashboard →</Link>
          </div>
        </div>
      </div>

      {/* barra fija de cobro en celular */}
      <div className="paybar">
        <div><div className="sub">{totales.unidades} {totales.unidades === 1 ? "producto" : "productos"}</div><div className="amt num">{dinero(totales.total)}</div></div>
        <button className="btn primary big" onClick={() => setCobrando(true)}>Cobrar</button>
      </div>

      <Escaner abierto={escaneando} continuo resultado={ultimoEscaneo} onCodigo={porCodigo} onCerrar={() => setEscaneando(false)} />
      {nuevoCodigo && (
        <ProductoForm producto={{ codigo: nuevoCodigo }} titulo="Producto nuevo" textoGuardar="Guardar y agregar"
          nota="Este código no está registrado. Complétalo una vez y quedará guardado."
          onCerrar={() => setNuevoCodigo(null)} onGuardado={(p) => { agregar(p); avisar("Guardado y agregado: " + p.nombre); }} />
      )}
      {cobrando && <Cobro total={totales.total} unidades={totales.unidades} onCerrar={() => setCobrando(false)} onConfirmar={confirmarVenta} />}
    </section>
  );
}
