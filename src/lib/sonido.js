/** Pitido agudo y corto si se leyó bien; grave y largo si el código no sirve (error). */
export function pitido(error = false) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = pitido.ctx || (pitido.ctx = new Ctx());
    ctx.resume?.();
    const o = ctx.createOscillator(), g = ctx.createGain();
    const dur = error ? 0.3 : 0.12;
    o.frequency.value = error ? 320 : 1650; o.type = "square";
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + dur + 0.01);
  } catch { /* sin sonido */ }
  try { navigator.vibrate?.(error ? [90, 60, 90] : 40); } catch { /* sin vibración */ }
}

/** Avisa al componente y suena según su respuesta (false = código no válido). */
export async function entregar(cb, codigo) {
  let ok = true;
  try { ok = (await cb?.(codigo)) !== false; } catch { ok = false; }
  pitido(!ok);
  return ok;
}
