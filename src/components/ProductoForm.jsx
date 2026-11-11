import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Escaner from "./EscanerLazy";
import { useAvisos } from "./Avisos";
import { aNumero } from "../lib/formato";
import { guardarProducto, eliminarProducto } from "../db/repositorio";
import { CATEGORIAS, categoriaDe } from "../lib/categorias";
import { ImagePlus, ScanBarcode, X } from "lucide-react";
import { prepararImagen } from "../lib/imagen";

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
    imagen: producto?.imagen instanceof Blob ? producto.imagen : null,
  });
  const archivo = useRef(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);
  const [cargandoImg, setCargandoImg] = useState(false);

  // URL temporal para mostrar la foto elegida
  useEffect(() => {
    if (!f.imagen) { setVistaPrevia(null); return; }
    const url = URL.createObjectURL(f.imagen);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [f.imagen]);

  async function elegirImagen(e) {
    const a = e.target.files?.[0];
    e.target.value = "";
    if (!a) return;
    setCargandoImg(true);
    try { const imagen = await prepararImagen(a); setF((x) => ({ ...x, imagen })); }
    catch (err) { setError(err.message); }
    finally { setCargandoImg(false); }
  }
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
          <div className="foto-prod">
            <button type="button" className={"foto-caja" + (vistaPrevia ? " con-foto" : "")} onClick={() => archivo.current?.click()}
              aria-label={vistaPrevia ? "Cambiar imagen del producto" : "Agregar imagen del producto"}>
              {cargandoImg ? <span className="spin" /> : vistaPrevia ? <img src={vistaPrevia} alt="" /> : <ImagePlus size={26} strokeWidth={1.8} />}
            </button>
            {vistaPrevia && (
              <button type="button" className="foto-quitar" aria-label="Quitar imagen" onClick={() => setF((x) => ({ ...x, imagen: null }))}><X size={14} strokeWidth={2.5} /></button>
            )}
            <span className="sub">{vistaPrevia ? "Toca la imagen para cambiarla" : "Agregar imagen (opcional)"}</span>
            <input ref={archivo} className="hidden-input" type="file" accept="image/*" onChange={elegirImagen} />
          </div>
          <label className="l mt" htmlFor="f_codigo">Código de barras</label>
          <div className="row">
            <input className="f num" id="f_codigo" value={f.codigo} onChange={cambiar("codigo")} placeholder="Ej. 7771234567890" />
            <button type="button" className="btn icon" onClick={() => setEscaneando(true)} aria-label="Escanear código" style={{ minHeight: 46, minWidth: 46 }}><ScanBarcode size={20} /></button>
          </div>
          <label className="l mt" htmlFor="f_nombre">Nombre</label>
          <input className="f" id="f_nombre" value={f.nombre} onChange={cambiar("nombre")} placeholder="Ej. Coca-Cola 2L" />
          <label className="l mt" htmlFor="f_cat">Categoría</label>
          <select className={"f select" + (f.categoria ? "" : " vacio")} id="f_cat" value={f.categoria} onChange={cambiar("categoria")}>
            {!f.categoria && <option value="" disabled>Elige una categoría</option>}
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
