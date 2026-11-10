import { db } from "../db/database";
import { METODOS } from "./estadisticas";

/**
 * Genera un archivo Excel (.xlsx) con tres hojas:
 *  - Ventas:    una fila por venta, con total, costo y ganancia (y fila de totales).
 *  - Detalle:   una fila por producto vendido.
 *  - Productos: el inventario actual.
 * La librería ExcelJS se descarga solo al exportar, para no hacer más pesada la app.
 */

const AZUL = "FF2A78D6";
const GRIS = "FFF0EFEC";
const BS = '"Bs" #,##0.00';
const metodo = (m) => METODOS[m]?.nombre || m;

/** Excel guarda fechas sin zona horaria: se pasa la hora local tal cual se ve en el reloj. */
const fechaLocal = (ts) => {
  const d = new Date(ts);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
};

function hoja(libro, nombre, columnas, filas, { totales } = {}) {
  const ws = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columnas.map((c) => ({
    header: c.titulo, key: c.clave, width: c.ancho,
    style: { ...(c.formato ? { numFmt: c.formato } : {}), ...(c.centrar ? { alignment: { horizontal: "center" } } : {}) },
  }));
  filas.forEach((f) => ws.addRow(f));

  // Encabezado: negrita, fondo azul, texto blanco
  const enc = ws.getRow(1);
  enc.height = 22;
  enc.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });

  // Filas alternadas para leer más fácil
  for (let i = 2; i <= filas.length + 1; i++) {
    if (i % 2 === 1) ws.getRow(i).eachCell({ includeEmpty: true }, (c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS } }; });
  }

  if (filas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };

  // Fila de totales con fórmulas
  if (totales && filas.length) {
    const ultima = filas.length + 1;
    const fila = ws.addRow({});
    fila.getCell(1).value = "TOTAL";
    totales.forEach((clave) => {
      const col = ws.getColumn(clave);
      const letra = col.letter;
      fila.getCell(col.number).value = { formula: `SUBTOTAL(9,${letra}2:${letra}${ultima})` };
    });
    fila.font = { bold: true };
    fila.eachCell({ includeEmpty: true }, (c) => { c.border = { top: { style: "thin", color: { argb: "FF999999" } } }; });
  }
  return ws;
}

export async function exportarExcel() {
  const { default: ExcelJS } = await import("exceljs");
  const [ventas, productos] = await Promise.all([db.ventas.orderBy("ts").toArray(), db.productos.orderBy("nombre").toArray()]);

  const libro = new ExcelJS.Workbook();
  libro.creator = "Mi Caja";
  libro.created = new Date();

  hoja(libro, "Ventas", [
    { titulo: "N.º", clave: "n", centrar: true, ancho: 7 },
    { titulo: "Fecha", clave: "fecha", centrar: true, ancho: 12, formato: "dd/mm/yyyy" },
    { titulo: "Hora", clave: "hora", centrar: true, ancho: 8, formato: "hh:mm" },
    { titulo: "Forma de pago", clave: "metodo", ancho: 14 },
    { titulo: "Productos", clave: "productos", ancho: 48 },
    { titulo: "Unidades", clave: "unidades", centrar: true, ancho: 10 },
    { titulo: "Total", clave: "total", ancho: 13, formato: BS },
    { titulo: "Costo", clave: "costo", ancho: 13, formato: BS },
    { titulo: "Ganancia", clave: "ganancia", ancho: 13, formato: BS },
    { titulo: "Recibido", clave: "recibido", ancho: 13, formato: BS },
    { titulo: "Cambio", clave: "cambio", ancho: 12, formato: BS },
  ], ventas.map((v, i) => ({
    n: i + 1,
    fecha: fechaLocal(v.ts),
    hora: fechaLocal(v.ts),
    metodo: metodo(v.metodo),
    productos: (v.items || []).map((x) => `${x.cantidad}× ${x.nombre}`).join(", "),
    unidades: v.unidades || 0,
    total: v.total || 0,
    costo: v.costoTotal || 0,
    ganancia: Math.round(((v.total || 0) - (v.costoTotal || 0)) * 100) / 100,
    recibido: v.recibido ?? v.total,
    cambio: v.cambio || 0,
  })), { totales: ["unidades", "total", "costo", "ganancia"] });

  const detalle = [];
  ventas.forEach((v, i) => (v.items || []).forEach((x) => detalle.push({
    n: i + 1,
    fecha: fechaLocal(v.ts),
    hora: fechaLocal(v.ts),
    metodo: metodo(v.metodo),
    codigo: String(x.codigo),
    producto: x.nombre,
    cantidad: x.cantidad,
    precio: x.precio,
    subtotal: x.precio * x.cantidad,
  })));
  hoja(libro, "Detalle", [
    { titulo: "Venta N.º", clave: "n", centrar: true, ancho: 10 },
    { titulo: "Fecha", clave: "fecha", centrar: true, ancho: 12, formato: "dd/mm/yyyy" },
    { titulo: "Hora", clave: "hora", centrar: true, ancho: 8, formato: "hh:mm" },
    { titulo: "Forma de pago", clave: "metodo", ancho: 14 },
    { titulo: "Código", clave: "codigo", ancho: 16, formato: "@" },
    { titulo: "Producto", clave: "producto", ancho: 32 },
    { titulo: "Cantidad", clave: "cantidad", centrar: true, ancho: 10 },
    { titulo: "Precio unitario", clave: "precio", ancho: 15, formato: BS },
    { titulo: "Subtotal", clave: "subtotal", ancho: 13, formato: BS },
  ], detalle, { totales: ["cantidad", "subtotal"] });

  hoja(libro, "Productos", [
    { titulo: "Código", clave: "codigo", ancho: 16, formato: "@" },
    { titulo: "Producto", clave: "nombre", ancho: 32 },
    { titulo: "Precio de venta", clave: "precio", ancho: 15, formato: BS },
    { titulo: "Costo", clave: "costo", ancho: 12, formato: BS },
    { titulo: "Stock", clave: "stock", centrar: true, ancho: 9 },
    { titulo: "Stock mínimo", clave: "minimo", centrar: true, ancho: 13 },
    { titulo: "Estado", clave: "estado", centrar: true, ancho: 12 },
  ], productos.map((p) => ({
    codigo: String(p.codigo),
    nombre: p.nombre,
    precio: p.precio || 0,
    costo: p.costo || 0,
    stock: p.stock || 0,
    minimo: p.minimo || 0,
    estado: (p.stock || 0) <= (p.minimo || 0) ? "Stock bajo" : "OK",
  })));

  const buffer = await libro.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
