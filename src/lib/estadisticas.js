import { claveDia, inicioDelDia, sumarDias, dosDigitos, r2 } from "./formato";

export const RANGOS = [
  { id: "hoy", nombre: "Hoy" },
  { id: "7d", nombre: "7 días" },
  { id: "30d", nombre: "30 días" },
  { id: "mes", nombre: "Este mes" },
];

/** Devuelve el periodo elegido y el periodo anterior para comparar. */
export function periodo(rango, ahora = new Date()) {
  const hoy = inicioDelDia(ahora);
  const fin = sumarDias(hoy, 1);
  switch (rango) {
    case "hoy": return { inicio: hoy, fin, inicioPrev: sumarDias(hoy, -1), finPrev: hoy, etiquetaPrev: "ayer" };
    case "7d": return { inicio: sumarDias(hoy, -6), fin, inicioPrev: sumarDias(hoy, -13), finPrev: sumarDias(hoy, -6), etiquetaPrev: "7 días anteriores" };
    case "30d": return { inicio: sumarDias(hoy, -29), fin, inicioPrev: sumarDias(hoy, -59), finPrev: sumarDias(hoy, -29), etiquetaPrev: "30 días anteriores" };
    default: {
      const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      const inicioPrev = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      const diasMesPrev = new Date(ahora.getFullYear(), ahora.getMonth(), 0).getDate();
      const finPrev = sumarDias(inicioPrev, Math.min(ahora.getDate(), diasMesPrev));
      return { inicio, fin, inicioPrev, finPrev, etiquetaPrev: "mismo periodo del mes pasado" };
    }
  }
}

export const entre = (ventas, a, b) => ventas.filter((v) => v.ts >= a.getTime() && v.ts < b.getTime());

export function resumen(ventas) {
  const total = ventas.reduce((a, v) => a + (v.total || 0), 0);
  const costo = ventas.reduce((a, v) => a + (v.costoTotal || 0), 0);
  return {
    total, costo,
    ganancia: total - costo,
    tieneCosto: ventas.some((v) => (v.costoTotal || 0) > 0),
    n: ventas.length,
    ticket: ventas.length ? total / ventas.length : 0,
    unidades: ventas.reduce((a, v) => a + (v.unidades || 0), 0),
  };
}

/** Serie para el gráfico: por hora si es "hoy", por día en otro caso. */
export function serie(rango, ventas, p) {
  if (rango === "hoy") {
    const horas = ventas.map((v) => v.hora);
    const h0 = Math.min(7, ...horas), h1 = Math.max(21, ...horas);
    const out = [];
    for (let h = h0; h <= h1; h++) {
      out.push({
        etiqueta: dosDigitos(h) + "h",
        detalle: `${dosDigitos(h)}:00 – ${dosDigitos(h)}:59`,
        total: r2(ventas.filter((v) => v.hora === h).reduce((a, v) => a + v.total, 0)),
      });
    }
    return out;
  }
  const out = [];
  for (let d = new Date(p.inicio); d < p.fin; d = sumarDias(d, 1)) {
    const k = claveDia(d);
    out.push({
      etiqueta: d.toLocaleDateString("es-BO", { day: "numeric", month: "short" }).replace(".", ""),
      detalle: d.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" }),
      total: r2(ventas.filter((v) => v.dia === k).reduce((a, v) => a + v.total, 0)),
    });
  }
  return out;
}

export function masVendidos(ventas, limite = 8) {
  const m = new Map();
  for (const v of ventas) for (const i of v.items || []) {
    const k = i.productoId ?? i.codigo;
    const a = m.get(k) || { nombre: i.nombre, unidades: 0, total: 0 };
    a.unidades += i.cantidad || 0;
    a.total += (i.precio || 0) * (i.cantidad || 0);
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, limite);
}

export const METODOS = {
  efectivo: { nombre: "Efectivo", color: "var(--s1)" },
  qr: { nombre: "QR", color: "var(--s2)" },
  tarjeta: { nombre: "Tarjeta", color: "var(--s3)" },
};

export function porMetodo(ventas) {
  return Object.entries(METODOS).map(([id, m]) => {
    const vs = ventas.filter((v) => v.metodo === id);
    return { id, ...m, total: vs.reduce((a, v) => a + v.total, 0), n: vs.length };
  });
}
