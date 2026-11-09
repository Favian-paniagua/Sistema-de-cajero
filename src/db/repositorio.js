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

export async function guardarProducto(datos, id) {
  const p = {
    codigo: String(datos.codigo).trim(),
    nombre: String(datos.nombre).trim(),
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

/** Importa filas {codigo, nombre, precio, costo, stock}. Si el código existe, lo actualiza. */
export async function importarProductos(filas) {
  let creados = 0, actualizados = 0;
  await db.transaction("rw", db.productos, async () => {
    for (const f of filas) {
      const existente = await db.productos.where("codigo").equals(f.codigo).first();
      const datos = {
        codigo: f.codigo, nombre: f.nombre, precio: r2(f.precio), costo: r2(f.costo),
        stock: Math.round(f.stock || 0), minimo: existente?.minimo ?? 5, actualizado: Date.now(),
      };
      if (existente) { await db.productos.update(existente.id, datos); actualizados++; }
      else { await db.productos.add(datos); creados++; }
    }
  });
  return { creados, actualizados };
}

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
      productoId: i.productoId, codigo: i.codigo, nombre: i.nombre,
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

/* ---------- Respaldo ---------- */

export async function exportarTodo() {
  const [productos, ventas] = await Promise.all([db.productos.toArray(), db.ventas.toArray()]);
  return { app: "sistema-de-cajero", version: 1, exportado: new Date().toISOString(), productos, ventas };
}

export async function restaurarTodo(datos) {
  if (!datos || !Array.isArray(datos.productos) || !Array.isArray(datos.ventas)) {
    throw new Error("El archivo no es un respaldo válido de Mi Caja.");
  }
  await db.transaction("rw", db.productos, db.ventas, async () => {
    await db.productos.clear();
    await db.ventas.clear();
    await db.productos.bulkAdd(datos.productos);
    await db.ventas.bulkAdd(datos.ventas);
  });
  return { productos: datos.productos.length, ventas: datos.ventas.length };
}
