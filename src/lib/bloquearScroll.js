/**
 * Congela el desplazamiento de la página de fondo mientras hay una ventana abierta
 * (funciona también en iPhone). Admite varias ventanas abiertas a la vez.
 */
let abiertas = 0;
let posicion = 0;

export function bloquearScroll() {
  if (abiertas++ > 0) return;
  posicion = window.scrollY;
  const b = document.body.style;
  b.position = "fixed";
  b.top = `-${posicion}px`;
  b.left = "0";
  b.right = "0";
  b.overflow = "hidden";
}

export function desbloquearScroll() {
  if (abiertas === 0 || --abiertas > 0) return;
  const b = document.body.style;
  b.position = b.top = b.left = b.right = b.overflow = "";
  window.scrollTo(0, posicion);
}
