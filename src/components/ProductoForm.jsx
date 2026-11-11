import { useState } from "react";
import Modal from "./Modal";
import Escaner from "./EscanerLazy";
import { useAvisos } from "./Avisos";
import { aNumero } from "../lib/formato";
import { guardarProducto, eliminarProducto } from "../db/repositorio";
import { CATEGORIAS, categoriaDe } from "../lib/categorias";
import { ScanBarcode } from "lucide-react";

const aTexto = (n) => (n == null || n === "" ? "" : String(n).replace(".", ","));

/**
 * Crear o editar un producto.
 * producto: datos iniciales (con id si se edita). onGuardado(producto) se llama al guardar.
 */
export default function ProductoForm({ producto, titulo, nota, textoGuardar, onCerrar, onGuardado }) {
  const editando = !!producto?.id;
  const { avisar, confirmar } = useAvisos();
  const [f, setF] = useState({
    codigo: producto?.codigo ?? "",
    nombre: producto?.nombre ?? "",
    categoria: producto?.id ? categoriaDe(producto) : "",   // al crear, se elige; al editar, la actual
    precio: aTexto(producto?.precio),
    costo: aTexto(producto?.costo),
    stock: producto?.stock ?? "",
    minimo: producto?.minimo ?? 5,
  });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });


  async function guardar(e) {
    e.preventDefault();
    if (!f.codigo.trim()) return setError("Falta el código.");
    if (!f.nombre.trim()) return setError("Falta el nombre.");
    if (!f.categoria) return setError("Elige una categoría.");
    if (aNumero(f.precio) <= 0) return setError("Pon un precio de venta mayor a 0.");
    setGuardando(true);
    try {
      const p = await guardarProducto(
        { ...f, precio: aNumero(f.precio), costo: aNumero(f.costo), stock: aNumero(f.stock), minimo: aNumero(f.minimo) },
        producto?.id
      );
      onGuardado?.(p);
      onCerrar();
    } catch (err) {
      setError(err.message || "No se pudo guardar.");
      setGuardando(false);
    }
  }

  async function borrar() {
    const ok = await confirmar("¿Eliminar producto?", `“${producto.nombre}” se quitará del inventario. Las ventas ya registradas no cambian.`, { boton: "Eliminar", peligro: true });
    if (!ok) return;
    await eliminarProducto(producto.id);
    avisar("Producto eliminado");
    onCerrar();
  }

  return (
    <>
      <Modal abierto arriba onCerrar={onCerrar} titulo={titulo || (editando ? "Editar producto" : "Nuevo producto")} nota={nota}>
        <form onSubmit={guardar} noValidate className="mt2">
          <label className="l" htmlFor="f_codigo">Código de barras</label>
          <div className="row">
            <input className="f num" id="f_codigo" value={f.codigo} onChange={cambiar("codigo")} placeholder="Ej. 7771234567890" autoFocus={!f.codigo} />
            <button type="button" className="btn icon" onClick={() => setEscaneando(true)} aria-label="Escanear código" style={{ minHeight: 46, minWidth: 46 }}><ScanBarcode size={20} /></button>
          </div>
          <label className="l mt" htmlFor="f_nombre">Nombre</label>
          <input className="f" id="f_nombre" value={f.nombre} onChange={cambiar("nombre")} placeholder="Ej. Coca-Cola 2L" autoFocus={!!f.codigo && !editando} />
          <label className="l mt" id="f_cat_l">Categoría</label>
          <div className="cat-grid" role="radiogroup" aria-labelledby="f_cat_l">
            {CATEGORIAS.map((c) => (
              <button type="button" key={c} role="radio" aria-checked={f.categoria === c}
                className={"chip" + (f.categoria === c ? " on" : "")} onClick={() => setF({ ...f, categoria: c })}>{c}</button>
            ))}
          </div>
          <div className="grid2 mt">
            <div><label className="l" htmlFor="f_precio">Precio de venta (Bs)</label><input className="f num" id="f_precio" inputMode="decimal" value={f.precio} onChange={cambiar("precio")} placeholder="0,00" /></div>
            <div><label className="l" htmlFor="f_costo">Costo (Bs)</label><input className="f num" id="f_costo" inputMode="decimal" value={f.costo} onChange={cambiar("costo")} placeholder="0,00" /></div>
            <div><label className="l" htmlFor="f_stock">Stock actual</label><input className="f num" id="f_stock" inputMode="numeric" value={f.stock} onChange={cambiar("stock")} placeholder="0" /></div>
            <div><label className="l" htmlFor="f_min">Avisar si baja de</label><input className="f num" id="f_min" inputMode="numeric" value={f.minimo} onChange={cambiar("minimo")} /></div>
          </div>
          <p className="sub" style={{ color: "var(--critical)", minHeight: "1em", margin: "10px 0 0" }}>{error}</p>
          <div className="acts">
            {editando && <button type="button" className="btn danger" style={{ flex: "0 0 auto" }} onClick={borrar}>Eliminar</button>}
            <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={guardando}>{guardando ? <span className="spin" /> : textoGuardar || "Guardar"}</button>
          </div>
        </form>
      </Modal>
      <Escaner abierto={escaneando} onCerrar={() => setEscaneando(false)} onCodigo={(c) => setF((x) => ({ ...x, codigo: c }))} />
    </>
  );
}
