import { db } from "./database";
import { r2, claveDia } from "../lib/formato";

/**
 * Todas las operaciones de datos pasan por aquí.
 * Si más adelante quieres guardar en la nube (Supabase, Firebase, tu propio backend),
 * solo tienes que reemplazar las funciones de este archivo.
 */

/* ---------- Productos ---------- */

export async function buscarPorCodigo(codigo) {
  const c = String(codigo ?? "").trim();
  if (!c) return null;
  return (await db.productos.where("codigo").equals(c).first()) ?? null;
}

export const SIN_CATEGORIA = "Sin categoría";

/** Lista de categorías ya usadas, en orden alfabético. */
export async function listarCategorias() {
  const cats = await db.productos.orderBy("categoria").uniqueKeys();
  return cats.filter((c) => c && c !== SIN_CATEGORIA).sort((a, b) => a.localeCompare(b, "es"));
}

/** Limpia el nombre de la categoría y reutiliza una existente si solo cambia mayúsculas/minúsculas. */
async function normalizarCategoria(texto) {
  const t = String(texto ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
  if (!t) return SIN_CATEGORIA;
  const existente = (await listarCategorias()).find((c) => c.toLocaleLowerCase("es") === t.toLocaleLowerCase("es"));
  return existente || t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
}

export async function guardarProducto(datos, id) {
  const p = {
    codigo: String(datos.codigo).trim(),
    nombre: String(datos.nombre).trim(),
    categoria: await normalizarCategoria(datos.categoria),
    precio: r2(datos.precio),
    costo: r2(datos.costo),
    stock: Math.round(Number(datos.stock) || 0),
    minimo: Math.round(Number(datos.minimo) || 0),
    actualizado: Date.now(),
  };
  const duplicado = await buscarPorCodigo(p.codigo);
  if (duplicado && duplicado.id !== id) {
    throw new Error(`El código ${p.codigo} ya pertenece a “${duplicado.nombre}”.`);
  }
  if (id) {
    await db.productos.update(id, p);
    return { ...p, id };
  }
  const nuevoId = await db.productos.add(p);
  return { ...p, id: nuevoId };
}

export const eliminarProducto = (id) => db.productos.delete(id);

/* ---------- Ventas ---------- */

/**
 * Registra una venta y descuenta el stock en una sola transacción:
 * o se guarda todo, o no se guarda nada.
 */
export async function registrarVenta(carrito, metodo, recibido) {
  const ahora = new Date();
  const total = r2(carrito.reduce((a, i) => a + i.precio * i.cantidad, 0));
  const costoTotal = r2(carrito.reduce((a, i) => a + i.costo * i.cantidad, 0));
  const venta = {
    ts: ahora.getTime(),
    dia: claveDia(ahora),
    hora: ahora.getHours(),
    metodo,
    total,
    costoTotal,
    unidades: carrito.reduce((a, i) => a + i.cantidad, 0),
    recibido: r2(recibido ?? total),
    cambio: r2(Math.max(0, (recibido ?? total) - total)),
    items: carrito.map((i) => ({
      productoId: i.productoId, codigo: i.codigo, nombre: i.nombre, categoria: i.categoria || SIN_CATEGORIA,
      precio: r2(i.precio), costo: r2(i.costo), cantidad: i.cantidad,
    })),
  };
  await db.transaction("rw", db.productos, db.ventas, async () => {
    venta.id = await db.ventas.add(venta);
    for (const i of venta.items) {
      const p = await db.productos.get(i.productoId);
      if (p) await db.productos.update(p.id, { stock: (p.stock || 0) - i.cantidad });
    }
  });
  return venta;
}

/** Anula una venta: la borra y devuelve los productos al stock. */
export async function anularVenta(id) {
  await db.transaction("rw", db.productos, db.ventas, async () => {
    const v = await db.ventas.get(id);
    if (!v) return;
    for (const i of v.items || []) {
      const p = await db.productos.get(i.productoId);
      if (p) await db.productos.update(p.id, { stock: (p.stock || 0) + i.cantidad });
    }
    await db.ventas.delete(id);
  });
}

export const ventasDesde = (ts) => db.ventas.where("ts").aboveOrEqual(ts).toArray();

/* ---------- Copia completa de los datos (sin botón en la app; útil para migrar al backend) ---------- */

export async function exportarTodo() {
  const [productos, ventas, cierres, aperturas] = await Promise.all([db.productos.toArray(), db.ventas.toArray(), db.cierres.toArray(), db.aperturas.toArray()]);
  return { app: "sistema-de-cajero", version: 3, exportado: new Date().toISOString(), productos, ventas, cierres, aperturas };
}

export async function restaurarTodo(datos) {
  if (!datos || !Array.isArray(datos.productos) || !Array.isArray(datos.ventas)) {
    throw new Error("El archivo no es un respaldo válido de Mi Caja.");
  }
  const cierres = Array.isArray(datos.cierres) ? datos.cierres : [];       // respaldos antiguos no traen cierres
  const aperturas = Array.isArray(datos.aperturas) ? datos.aperturas : [];
  await db.transaction("rw", [db.productos, db.ventas, db.cierres, db.aperturas], async () => {
    await Promise.all([db.productos.clear(), db.ventas.clear(), db.cierres.clear(), db.aperturas.clear()]);
    await db.productos.bulkAdd(datos.productos);
    await db.ventas.bulkAdd(datos.ventas);
    await db.cierres.bulkAdd(cierres);
    await db.aperturas.bulkAdd(aperturas);
  });
  return { productos: datos.productos.length, ventas: datos.ventas.length };
}

/* ---------- Apertura y cierre de caja ---------- */

/** La apertura en curso (la última que todavía no se cerró), o null si la caja está cerrada. */
export async function aperturaActual() {
  const ultima = await db.aperturas.orderBy("ts").last();
  return ultima && !ultima.cerradaTs ? ultima : null;
}

/** Abre la caja registrando con cuánto efectivo se empieza. */
export async function abrirCaja(efectivoInicial) {
  const abierta = await aperturaActual();
  if (abierta) return abierta;
  const ahora = new Date();
  const apertura = { ts: ahora.getTime(), dia: claveDia(ahora), efectivoInicial: r2(efectivoInicial), cerradaTs: null, cierreId: null };
  apertura.id = await db.aperturas.add(apertura);
  return apertura;
}

/** Ventas desde que se abrió la caja (o del día, si no hubo apertura). */
export function ventasDelTurno(apertura) {
  const desde = apertura ? apertura.ts : new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  // Sin límite superior: así la pantalla se actualiza con cada venta nueva del turno
  return db.ventas.where("ts").aboveOrEqual(desde).toArray();
}

/**
 * Cierra la caja: guarda el registro del cierre con su resumen y marca la apertura como cerrada.
 * No borra ventas. Después del cierre, hay que volver a abrir la caja para seguir vendiendo.
 */
export async function cerrarCaja(apertura, resumen) {
  const ahora = new Date();
  const cierre = {
    ts: ahora.getTime(), dia: claveDia(ahora),
    aperturaId: apertura?.id ?? null, aperturaTs: apertura?.ts ?? null,
    efectivoInicial: apertura?.efectivoInicial ?? 0,
    ...resumen,
  };
  await db.transaction("rw", db.cierres, db.aperturas, async () => {
    cierre.id = await db.cierres.add(cierre);
    if (apertura) await db.aperturas.update(apertura.id, { cerradaTs: cierre.ts, cierreId: cierre.id });
  });
  return cierre;
}

export const ultimoCierre = () => db.cierres.orderBy("ts").last();

/** Ventas que entraron en un cierre ya hecho (para volver a descargar su reporte). */
export function ventasDeCierre(cierre) {
  const d = new Date(cierre.ts);
  const desde = cierre.aperturaTs ?? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return db.ventas.where("ts").between(desde, cierre.ts, true, true).toArray();
}
