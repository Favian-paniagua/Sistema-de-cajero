/**
 * Categorías fijas de productos. Para agregar o renombrar una, cámbiala aquí.
 * Un producto con una categoría que no está en la lista (o sin categoría) se trata como "Otros".
 */
export const CATEGORIAS = [
  "Lácteos",
  "Limpieza",
  "Bebidas",
  "Cuidado personal",
  "Snacks",
  "Panadería",
  "Alimentos",
  "Otros",
];

export const OTROS = "Otros";

/** Categoría válida de un producto o de un producto vendido. */
export const categoriaDe = (x) => (x && CATEGORIAS.includes(x.categoria) ? x.categoria : OTROS);
