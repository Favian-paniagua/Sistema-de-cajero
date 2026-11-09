// Utilidades de formato de dinero y fechas (moneda: Bolivianos)

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const dinero = (n) =>
  "Bs " + r2(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const dineroCorto = (n) => "Bs " + Math.round(Number(n) || 0).toLocaleString("es-BO");

/** Convierte "12,50" o "12.50" a número. */
export const aNumero = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const pad = (n) => String(n).padStart(2, "0");
export const dosDigitos = pad;

/** Clave de día en hora local: "2026-11-09" */
export const claveDia = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const inicioDelDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
