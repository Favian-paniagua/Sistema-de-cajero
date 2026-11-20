import { useEffect, useRef, useState } from "react";
import { entregar } from "./sonido";

/**
 * Lector de códigos de barras USB o Bluetooth (en computadora).
 *
 * Estos lectores funcionan como un teclado: "escriben" el código muy rápido y presionan Enter.
 * Aquí se escucha el teclado de toda la página y, cuando llegan varias teclas seguidas muy rápido
 * terminadas en Enter (o Tab), se entiende que fue el lector y se entrega el código.
 * Una persona escribiendo no lo activa, porque teclea más lento.
 *
 * Si el cursor está dentro de un campo de texto, el lector escribe en ese campo como un teclado
 * normal y es ese campo el que decide qué hacer con el Enter.
 *
 * Solo recibe el código la última pantalla o ventana que llamó a useLector (por ejemplo,
 * con el formulario de producto abierto, lo recibe el formulario y no la lista de atrás).
 */

const MAX_PAUSA_MS = 60;   // tiempo máximo entre teclas del lector
const MIN_LARGO = 4;       // códigos más cortos se ignoran

const oyentes = [];
let buffer = "";
let ultimaTecla = 0;
let instalado = false;

const esEditable = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function alPresionar(e) {
  if (!oyentes.length) return;
  if (e.ctrlKey || e.metaKey || e.altKey) { buffer = ""; return; }
  if (esEditable(document.activeElement)) { buffer = ""; return; }

  const ahora = performance.now();
  if (ahora - ultimaTecla > MAX_PAUSA_MS) buffer = "";   // pausa larga: empieza un código nuevo
  ultimaTecla = ahora;

  if (e.key === "Enter" || e.key === "Tab") {
    if (buffer.length >= MIN_LARGO) {
      // Evita que el Enter del lector "presione" el botón que tenga el foco
      e.preventDefault();
      e.stopPropagation();
      const codigo = buffer;
      buffer = "";
      entregar(oyentes[oyentes.length - 1].current, codigo);
    }
    buffer = "";
    return;
  }
  if (e.key.length === 1) buffer += e.key;
}

/**
 * Recibe los códigos leídos con el lector mientras `activo` sea true.
 * onCodigo puede devolver false (o una promesa con false) si el código no sirve: suena el tono de error.
 */
export function useLector(onCodigo, activo = true) {
  const ref = useRef(onCodigo);
  ref.current = onCodigo;
  useEffect(() => {
    if (!activo) return;
    if (!instalado) { window.addEventListener("keydown", alPresionar, true); instalado = true; }
    const entrada = { get current() { return ref.current; } };
    oyentes.push(entrada);
    return () => { const i = oyentes.indexOf(entrada); if (i >= 0) oyentes.splice(i, 1); };
  }, [activo]);
}

/** true en pantallas de computadora (o tablet en horizontal), donde se usa el lector USB. */
export function useEsComputadora() {
  const consulta = "(min-width: 900px)";
  const [es, setEs] = useState(() => window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const cambio = () => setEs(m.matches);
    m.addEventListener("change", cambio);
    return () => m.removeEventListener("change", cambio);
  }, []);
  return es;
}
