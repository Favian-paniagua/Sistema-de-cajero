import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/database";
import { dinero } from "../lib/formato";
import { useAvisos } from "../components/Avisos";
import ProductoForm from "../components/ProductoForm";
import ImportarLista from "../components/ImportarLista";
import { Package, PackagePlus, TriangleAlert, Upload } from "lucide-react";

/** Inventario: lista, búsqueda, alta, edición e importación de productos. */
export default function Productos() {
  const { avisar } = useAvisos();
  const productos = useLiveQuery(() => db.productos.orderBy("nombre").toArray(), [], null);
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState(null);   // {} = nuevo, {id…} = editar
  const [importando, setImportando] = useState(false);

  const lista = (productos || []).filter((p) => {
    const t = q.trim().toLowerCase();
    return !t || p.nombre.toLowerCase().includes(t) || String(p.codigo).includes(t);
  });

  return (
    <section className="view on">
      <div className="row" style={{ flexWrap: "wrap" }}>
        <input className="f" placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <button className="btn primary" onClick={() => setEditando({})}><PackagePlus size={18} /> Nuevo producto</button>
        <button className="btn" onClick={() => setImportando(true)}><Upload size={18} /> Importar lista</button>
      </div>

      <div className="card pad mt">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>Inventario</h2>
          <span className="sub">{productos ? `${productos.length} ${productos.length === 1 ? "producto" : "productos"}` : ""}</span>
        </div>
        <ul className="plist">
          {productos === null ? (
            <li style={{ display: "block", cursor: "default" }}><div className="empty">Cargando…</div></li>
          ) : productos.length === 0 ? (
            <li style={{ display: "block", cursor: "default" }}><div className="empty"><div className="ico"><Package size={34} strokeWidth={1.5} /></div>
              Aún no hay productos.<br />Agrégalos uno por uno, o pega tu lista con “Importar lista”.<br />
              También puedes escanear en la caja: si el código es nuevo, te pide los datos.</div></li>
          ) : lista.length === 0 ? (
            <li style={{ display: "block", cursor: "default" }}><div className="empty">Nada coincide con “{q}”.</div></li>
          ) : lista.map((p) => {
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
          })}
        </ul>
      </div>

      {editando && (
        <ProductoForm producto={editando} onCerrar={() => setEditando(null)}
          onGuardado={() => avisar(editando.id ? "Cambios guardados" : "Producto guardado")} />
      )}
      {importando && <ImportarLista onCerrar={() => setImportando(false)} />}
    </section>
  );
}
