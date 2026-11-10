import { forwardRef, useMemo, useState } from "react";
import { dinero } from "../lib/formato";

/**
 * Campo para agregar productos escribiendo su nombre o código.
 * - Muestra sugerencias mientras escribes (flechas ↑ ↓ y Enter para elegir).
 * - Un código numérico que no existe se envía a onCodigo (para registrarlo).
 * - Sirve también con lectores USB, que escriben el código y presionan Enter.
 */
const BuscadorProducto = forwardRef(function BuscadorProducto(
  { productos, onElegir, onCodigo, placeholder = "Nombre o código", className = "", alto = 56 },
  ref
) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(-1);
  const [enfocado, setEnfocado] = useState(false);

  const sugerencias = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return productos.filter((p) => p.nombre.toLowerCase().includes(t) || String(p.codigo).includes(t)).slice(0, 6);
  }, [q, productos]);

  const limpiar = () => { setQ(""); setSel(-1); };
  const elegir = (p) => { onElegir(p); limpiar(); };

  function teclas(e) {
    if (e.key === "ArrowDown") { setSel((s) => Math.min(s + 1, sugerencias.length - 1)); e.preventDefault(); return; }
    if (e.key === "ArrowUp") { setSel((s) => Math.max(s - 1, -1)); e.preventDefault(); return; }
    if (e.key === "Escape") { limpiar(); return; }
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    const exacto = productos.find((p) => String(p.codigo) === v);
    if (sel >= 0 && sugerencias[sel]) return elegir(sugerencias[sel]);
    if (exacto) return elegir(exacto);
    if (/^\d{4,}$/.test(v)) { onCodigo(v); return limpiar(); }   // código desconocido → registrar producto
    if (sugerencias.length === 1) return elegir(sugerencias[0]);
    if (sugerencias.length > 1) { setSel(0); return; }
    onCodigo(v); limpiar();
  }

  return (
    <div className={"search " + className}>
      <input ref={ref} className="f" value={q} placeholder={placeholder} autoComplete="off" enterKeyHint="go"
        aria-label="Buscar producto por nombre o código" style={{ minHeight: alto }}
        onChange={(e) => { setQ(e.target.value); setSel(-1); }} onKeyDown={teclas}
        onFocus={() => setEnfocado(true)} onBlur={() => setTimeout(() => setEnfocado(false), 150)} />
      {enfocado && sugerencias.length > 0 && (
        <div className="sugg" style={{ display: "block" }}>
          {sugerencias.map((p, i) => (
            <button key={p.id} className={i === sel ? "hl" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(p)}>
              <span>{p.nombre}</span><span className="sub num">{dinero(p.precio)}</span>
            </button>
          ))}
        </div>
      )}
      {enfocado && q.trim().length >= 2 && sugerencias.length === 0 && !/^\d{4,}$/.test(q.trim()) && (
        <div className="sugg" style={{ display: "block" }}><div className="sub" style={{ padding: "11px 14px" }}>No hay productos con ese nombre.</div></div>
      )}
    </div>
  );
});

export default BuscadorProducto;
