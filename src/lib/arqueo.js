/**
 * Arqueo de caja: cuánto efectivo debería haber, cuánto se contó y la diferencia.
 * Los cálculos se hacen en centavos para evitar errores de redondeo.
 */

/** Billetes y monedas de Bolivia (Bs). */
export const BILLETES = [200, 100, 50, 20, 10];
export const MONEDAS = [5, 2, 1, 0.5, 0.2, 0.1];

const cent = (n) => Math.round((Number(n) || 0) * 100);

/** Efectivo que debería haber: monto inicial + ventas cobradas en efectivo. */
export function efectivoEsperado(efectivoInicial, ventas) {
  const enEfectivo = ventas.filter((v) => v.metodo === "efectivo").reduce((a, v) => a + cent(v.total), 0);
  return (cent(efectivoInicial) + enEfectivo) / 100;
}

/** Total de un conteo por billetes y monedas: { 200: 3, 0.5: 4, ... } → Bs */
export function totalConteo(conteo) {
  return Object.entries(conteo || {}).reduce((a, [den, cant]) => a + cent(den) * (parseInt(cant, 10) || 0), 0) / 100;
}

/**
 * Diferencia entre lo contado y lo esperado.
 * tipo: "cuadra" (0), "sobrante" (sobra dinero) o "faltante" (falta dinero).
 */
export function diferencia(contado, esperado) {
  const d = (cent(contado) - cent(esperado)) / 100;
  return { monto: d, tipo: d === 0 ? "cuadra" : d > 0 ? "sobrante" : "faltante" };
}

export const ETIQUETA_DIFERENCIA = { cuadra: "Cuadra", sobrante: "Sobrante", faltante: "Faltante" };
