import { METODOS } from "./estadisticas";

/**
 * Cálculos y PDF del cierre de caja.
 * El PDF no incluye montos recibidos ni cambio: solo lo vendido.
 * jsPDF se descarga solo al cerrar la caja, para no hacer más pesada la app.
 */

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Resumen del día a partir de sus ventas. */
export function resumenCierre(ventas) {
  const total = r2(ventas.reduce((a, v) => a + (v.total || 0), 0));
  const costo = r2(ventas.reduce((a, v) => a + (v.costoTotal || 0), 0));
  const unidades = ventas.reduce((a, v) => a + (v.unidades || 0), 0);
  const porMetodo = Object.fromEntries(Object.keys(METODOS).map((m) => {
    const vs = ventas.filter((v) => v.metodo === m);
    return [m, { ventas: vs.length, total: r2(vs.reduce((a, v) => a + v.total, 0)) }];
  }));
  return {
    total, costo, ganancia: r2(total - costo), tieneCosto: costo > 0,
    ventas: ventas.length, unidades,
    ticket: ventas.length ? r2(total / ventas.length) : 0,
    porMetodo,
  };
}

/** Cuánto se vendió de cada producto, de más a menos vendido (por monto). */
export function productosVendidos(ventas) {
  const m = new Map();
  for (const v of ventas) for (const i of v.items || []) {
    const k = i.productoId ?? i.codigo;
    const a = m.get(k) || { nombre: i.nombre, codigo: String(i.codigo), cantidad: 0, total: 0, costo: 0, precios: new Set() };
    a.cantidad += i.cantidad || 0;
    a.total += (i.precio || 0) * (i.cantidad || 0);
    a.costo += (i.costo || 0) * (i.cantidad || 0);
    a.precios.add(i.precio);
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => b.total - a.total || b.cantidad - a.cantidad);
}

/* ---------- PDF ---------- */

// Texto compatible con las fuentes estándar del PDF
const limpiar = (t) => String(t ?? "").replace(/[  ]/g, " ").replace(/[–—]/g, "-").replace(/[^\x20-\xff\n]/g, "");
const bs = (n) => limpiar("Bs " + r2(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const entero = (n) => limpiar(Number(n || 0).toLocaleString("es-BO"));
const hora = (ts) => limpiar(new Date(ts).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));

const AZUL = [42, 120, 214];
const TINTA = [11, 11, 11];
const GRIS = [100, 99, 95];
const FONDO = [244, 243, 239];

export async function generarPdfCierre({ ventas, cierre, nombreNegocio = "Mi Caja" }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;                       // margen
  const fecha = new Date(cierre.ts);
  const resumen = resumenCierre(ventas);
  const productos = productosVendidos(ventas);

  /* Encabezado */
  doc.setFillColor(...AZUL);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("Cierre de caja", M, 14);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  const fechaLarga = fecha.toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  doc.text(limpiar(fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)), M, 22);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(limpiar(nombreNegocio), W - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  doc.text(`Cerrado a las ${hora(cierre.ts)}`, W - M, 22, { align: "right" });

  /* Tarjetas de resumen */
  let y = 38;
  const tarjetas = [
    ["Total vendido", bs(resumen.total), `${entero(resumen.unidades)} unidades`],
    ["Ganancia estimada", resumen.tieneCosto ? bs(resumen.ganancia) : "-", resumen.tieneCosto && resumen.total ? `${Math.round((resumen.ganancia / resumen.total) * 100)}% de margen` : "Sin costos registrados"],
    ["N.º de ventas", entero(resumen.ventas), resumen.ventas ? `de ${hora(ventas[0].ts)} a ${hora(ventas[ventas.length - 1].ts)}` : ""],
    ["Ticket promedio", bs(resumen.ticket), "por venta"],
  ];
  const gap = 4, cw = (W - 2 * M - gap * 3) / 4, ch = 24;
  tarjetas.forEach(([k, v, d], i) => {
    const x = M + i * (cw + gap);
    doc.setFillColor(...FONDO); doc.roundedRect(x, y, cw, ch, 2.5, 2.5, "F");
    doc.setTextColor(...GRIS); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text(limpiar(k), x + 4, y + 6.5);
    doc.setTextColor(...TINTA); doc.setFont("helvetica", "bold"); doc.setFontSize(13.5);
    doc.text(limpiar(v), x + 4, y + 14.5);
    doc.setTextColor(...GRIS); doc.setFont("helvetica", "normal"); doc.setFontSize(7.8);
    doc.text(limpiar(d), x + 4, y + 20.5);
  });
  y += ch + 10;

  const titulo = (texto) => {
    if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20; }
    doc.setTextColor(...TINTA); doc.setFont("helvetica", "bold"); doc.setFontSize(12.5);
    doc.text(texto, M, y); y += 3;
  };
  const estilo = {
    theme: "grid",
    showFoot: "lastPage",            // la fila de totales solo al final de la tabla
    margin: { left: M, right: M, bottom: 18 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: TINTA, lineColor: [226, 224, 217], lineWidth: 0.2 },
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [232, 238, 249], textColor: TINTA, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 248] },
  };
  const seguir = () => { y = doc.lastAutoTable.finalY + 10; };

  if (!ventas.length) {
    doc.setTextColor(...GRIS); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    doc.text("No se registraron ventas en el día.", M, y + 4);
  } else {
    /* Formas de pago */
    titulo("Por forma de pago");
    autoTable(doc, {
      ...estilo, startY: y,
      head: [["Forma de pago", "Ventas", "Total", "% del total"]],
      body: Object.entries(METODOS).map(([id, m]) => {
        const p = resumen.porMetodo[id];
        return [m.nombre, entero(p.ventas), bs(p.total), resumen.total ? `${Math.round((p.total / resumen.total) * 100)}%` : "0%"];
      }),
      foot: [["Total", entero(resumen.ventas), bs(resumen.total), "100%"]],
      columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
      headStyles: { ...estilo.headStyles },
      didParseCell: (d) => { if ((d.section === "head" || d.section === "foot") && d.column.index > 0) d.cell.styles.halign = d.column.index === 1 ? "center" : "right"; },
    });
    seguir();

    /* Productos vendidos */
    titulo("Productos vendidos");
    const gananciaProductos = productos.reduce((a, p) => a + p.total - p.costo, 0);
    autoTable(doc, {
      ...estilo, startY: y,
      head: [["Producto", "Código", "Cantidad", "Precio unit.", "Total vendido", "Ganancia"]],
      body: productos.map((p) => [
        limpiar(p.nombre), limpiar(p.codigo), entero(p.cantidad),
        p.precios.size === 1 ? bs([...p.precios][0]) : "varios",
        bs(p.total), p.costo ? bs(p.total - p.costo) : "-",
      ]),
      foot: [[`${productos.length} productos`, "", entero(resumen.unidades), "", bs(resumen.total), resumen.tieneCosto ? bs(gananciaProductos) : "-"]],
      columnStyles: { 0: { cellWidth: 52 }, 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      didParseCell: (d) => {
        if (d.section === "head" || d.section === "foot") {
          if (d.column.index === 2) d.cell.styles.halign = "center";
          if (d.column.index >= 3) d.cell.styles.halign = "right";
        }
      },
    });
    seguir();

    /* Detalle de ventas (sin monto recibido ni cambio) */
    titulo("Detalle de ventas");
    autoTable(doc, {
      ...estilo, startY: y,
      head: [["N.º", "Hora", "Forma de pago", "Productos", "Unid.", "Total"]],
      body: ventas.map((v, i) => [
        String(i + 1), hora(v.ts), METODOS[v.metodo]?.nombre || v.metodo,
        limpiar((v.items || []).map((x) => `${x.cantidad} x ${x.nombre}`).join(", ")),
        entero(v.unidades), bs(v.total),
      ]),
      foot: [["", "", "", "Total del día", entero(resumen.unidades), bs(resumen.total)]],
      columnStyles: { 0: { halign: "center", cellWidth: 11 }, 1: { cellWidth: 15 }, 2: { cellWidth: 27 }, 4: { halign: "center", cellWidth: 14 }, 5: { halign: "right", cellWidth: 26 } },
      didParseCell: (d) => {
        if (d.section === "head" || d.section === "foot") {
          if (d.column.index === 0 || d.column.index === 4) d.cell.styles.halign = "center";
          if (d.column.index === 5) d.cell.styles.halign = "right";
          if (d.section === "foot" && d.column.index === 3) d.cell.styles.halign = "right";
        }
      },
    });
  }

  /* Pie de página en todas las hojas */
  const paginas = doc.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 224, 217); doc.setLineWidth(0.2); doc.line(M, H - 12, W - M, H - 12);
    doc.setTextColor(...GRIS); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(limpiar(`${nombreNegocio} - Cierre del ${fecha.toLocaleDateString("es-BO")} - Generado ${fecha.toLocaleDateString("es-BO")} ${hora(fecha)}`), M, H - 7);
    doc.text(`Página ${i} de ${paginas}`, W - M, H - 7, { align: "right" });
  }

  return doc.output("blob");
}
