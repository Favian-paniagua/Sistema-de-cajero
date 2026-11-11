import { useEffect, useState } from "react";
import { Bath, Cookie, Croissant, CupSoda, Milk, Package, Soup, SprayCan } from "lucide-react";
import { categoriaDe } from "../lib/categorias";

/** Ícono que representa cada categoría cuando el producto no tiene foto. */
const ICONOS = {
  "Lácteos": Milk,
  "Limpieza": SprayCan,
  "Bebidas": CupSoda,
  "Cuidado personal": Bath,
  "Snacks": Cookie,
  "Panadería": Croissant,
  "Alimentos": Soup,
  "Otros": Package,
};

/** Foto pequeña del producto, o el ícono de su categoría si no tiene foto. */
export default function MiniaturaProducto({ producto, tam = 48 }) {
  const [url, setUrl] = useState(null);
  const imagen = producto?.imagen instanceof Blob ? producto.imagen : null;

  useEffect(() => {
    if (!imagen) { setUrl(null); return; }
    const u = URL.createObjectURL(imagen);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [imagen]);

  const Icono = ICONOS[categoriaDe(producto)] || Package;
  return (
    <span className={"mini-prod" + (url ? " con-foto" : "")} style={{ width: tam, height: tam }} aria-hidden="true">
      {url ? <img src={url} alt="" loading="lazy" /> : <Icono size={Math.round(tam * 0.46)} strokeWidth={1.7} />}
    </span>
  );
}
