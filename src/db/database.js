import Dexie from "dexie";

/**
 * Base de datos local del navegador (IndexedDB) usando Dexie.
 * Los datos quedan guardados en el dispositivo donde se usa la caja,
 * incluso sin internet. (Más adelante se sincronizará con un backend.)
 *
 * Tablas:
 *  - productos: { id, codigo, nombre, categoria, precio, costo, stock, minimo, actualizado }
 *  - ventas:    { id, ts, dia, hora, metodo, total, costoTotal, unidades, recibido, cambio, items[] }
 *  - aperturas: { id, ts, dia, efectivoInicial, cerradaTs, cierreId }   (un registro por cada apertura de caja)
 *  - cierres:   { id, ts, dia, aperturaId, aperturaTs, efectivoInicial, total, costo, ganancia, ventas, unidades, porMetodo }
 */
export const db = new Dexie("sistema-de-cajero");

db.version(1).stores({
  productos: "++id, &codigo, nombre",
  ventas: "++id, ts, dia, metodo",
});

// v2: se agrega la tabla de cierres de caja (los datos anteriores se conservan)
db.version(2).stores({
  productos: "++id, &codigo, nombre",
  ventas: "++id, ts, dia, metodo",
  cierres: "++id, ts, dia",
});

// v3: apertura de caja (efectivo inicial). Cada cierre queda ligado a su apertura.
db.version(3).stores({
  productos: "++id, &codigo, nombre",
  ventas: "++id, ts, dia, metodo",
  cierres: "++id, ts, dia",
  aperturas: "++id, ts, dia",
});

// v4: categoría de producto (indexada para listar las categorías existentes)
db.version(4).stores({
  productos: "++id, &codigo, nombre, categoria",
  ventas: "++id, ts, dia, metodo",
  cierres: "++id, ts, dia",
  aperturas: "++id, ts, dia",
});
