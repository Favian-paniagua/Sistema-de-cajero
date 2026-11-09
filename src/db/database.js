import Dexie from "dexie";

/**
 * Base de datos local del navegador (IndexedDB) usando Dexie.
 * Los datos quedan guardados en el dispositivo donde se usa la caja,
 * incluso sin internet. Usa "Respaldo" para exportarlos o pasarlos a otro equipo.
 *
 * Tablas:
 *  - productos: { id, codigo, nombre, precio, costo, stock, minimo, actualizado }
 *  - ventas:    { id, ts, dia, hora, metodo, total, costoTotal, unidades, recibido, cambio, items[] }
 */
export const db = new Dexie("sistema-de-cajero");

db.version(1).stores({
  productos: "++id, &codigo, nombre",
  ventas: "++id, ts, dia, metodo",
});
