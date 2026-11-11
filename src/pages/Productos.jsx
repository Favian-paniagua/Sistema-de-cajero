import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { CATEGORIAS, categoriaDe } from "../lib/categorias";
import { dinero } from "../lib/formato";
import { useAvisos } from "../components/Avisos";
import ProductoForm from "../components/ProductoForm";
import { Package, PackagePlus, TriangleAlert } from "lucide-react";
import { EsqueletoFilasProductos, Sk } from "../components/Esqueletos";


/** Inventario: lista por categoría, búsqueda, alta y edición de productos. */
export default function Productos() {
  const { avisar } = useAvisos();
  const productos = useLiveQuery(() => db.productos.orderBy("nombre").toArray(), [], null);
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [editando, setEditando] = useState(null);   // {} = nuevo, {id…} = editar

  // Todas las categorías fijas, con su cantidad de productos
  const categorias = useMemo(() => CATEGORIAS.map((c) => [c, (productos || []).filter((p) => categoriaDe(p) === c).length]), [productos]);
  const catFiltro = categoria;

  const lista = (productos || []).filter((p) => {
    const t = q.trim().toLowerCase();
    const okTexto = !t || p.nombre.toLowerCase().includes(t) || String(p.codigo).includes(t);
    return okTexto && (catFiltro === "todas" || categoriaDe(p) === catFiltro);
  });

  // Agrupados por categoría cuando se ven todas
  const grupos = useMemo(() => {
    if (catFiltro !== "todas") return [[catFiltro, lista]];
    return categorias.map(([c]) => [c, lista.filter((p) => categoriaDe(p) === c)]).filter(([, ps]) => ps.length);
  }, [catFiltro, categorias, lista]);
  const mostrarTitulos = catFiltro === "todas";

  const fila = (p) => {
    const bajo = (p.stock || 0) <= (p.minimo || 0);
    return (
      <li key={p.id} onClick={() => setEditando(p)}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{p.nombre}</div>
          <div className="sub num">{p.codigo}{p.costo ? ` · costo ${dinero(p.costo)}` : ""}</div>
        </div>
        <span className={"badge" + (bajo ? " low" : "")}>{bajo && <TriangleAlert size={12} strokeWidth={2.4} />}{p.stock || 0} u</span>
        <b className="num">{dinero(p.precio)}</b>
      </li>
    );
  };

  return (
    <section className="view on">
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input className="f" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn primary" onClick={() => setEditando({})}><PackagePlus size={18} /> Nuevo producto</button>
      </div>

      {productos && (
        <div className="chips mt" role="tablist" aria-label="Categorías">
          <button role="tab" aria-selected={catFiltro === "todas"} className={"chip" + (catFiltro === "todas" ? " on" : "")} onClick={() => setCategoria("todas")}>
            Todas <span className="chip-n">{productos.length}</span>
          </button>
          {categorias.map(([c, n]) => (
            <button key={c} role="tab" aria-selected={catFiltro === c} className={"chip" + (catFiltro === c ? " on" : "")} onClick={() => setCategoria(c)}>
              {c} <span className="chip-n">{n}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card pad mt">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Inventario</h2>
          {productos ? <span className="sub">{`${lista.length} ${lista.length === 1 ? "producto" : "productos"}`}</span> : <Sk w={80} h={12} />}
        </div>
        {productos === null ? (
          <ul className="plist"><EsqueletoFilasProductos /></ul>
        ) : productos.length === 0 ? (
          <div className="empty"><div className="ico"><Package size={34} strokeWidth={1.5} /></div>
            Aún no hay productos.<br />Toca “Nuevo producto” para registrar el primero, con su categoría.</div>
        ) : lista.length === 0 ? (
          <div className="empty">{q ? <>Nada coincide con “{q}”.</> : "No hay productos en esta categoría."}</div>
        ) : grupos.map(([c, ps]) => (
          <div key={c} className="grupo-cat">
            {mostrarTitulos && <h3 className="cat-titulo">{c} <span>{ps.length}</span></h3>}
            <ul className="plist">{ps.map(fila)}</ul>
          </div>
        ))}
      </div>

      {editando && (
        <ProductoForm producto={editando} onCerrar={() => setEditando(null)}
          onGuardado={() => avisar(editando.id ? "Cambios guardados" : "Producto guardado")} />
      )}
    </section>
  );
}
