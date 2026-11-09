import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

/**
 * Escáner de códigos de barras con la cámara del celular, en vivo.
 * - continuo=true: se queda abierto y llama onCodigo por cada producto (modo caja).
 * - continuo=false: se cierra al leer el primer código (para formularios).
 * - children: si se pasa, la pantalla se divide: cámara arriba y ese contenido abajo (el carrito).
 * Requiere HTTPS (o localhost) para que el navegador permita la cámara.
 */
const FORMATOS = [
  BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.QR_CODE,
];

function crearLector() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 80, delayBetweenScanSuccess: 300 });
}

function pitido() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = pitido.ctx || (pitido.ctx = new Ctx());
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 1650; o.type = "square";
    g.gain.setValueAtTime(0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.13);
  } catch { /* sin sonido */ }
  try { navigator.vibrate?.(40); } catch { /* sin vibración */ }
}

export default function Escaner({ abierto, continuo = false, onCodigo, onCerrar, resultado, ignorar, children }) {
  const video = useRef(null);
  const controles = useRef(null);
  const ultimo = useRef({ codigo: "", visto: 0 });
  const onCodigoRef = useRef(onCodigo);
  onCodigoRef.current = onCodigo;
  const onCerrarRef = useRef(onCerrar);
  onCerrarRef.current = onCerrar;
  const ignorarRef = useRef(ignorar);
  ignorarRef.current = ignorar;
  const [error, setError] = useState("");
  const [leyendoFoto, setLeyendoFoto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setError("");
    // Un código recién agregado no se vuelve a sumar mientras siga frente a la cámara
    ultimo.current = { codigo: ignorarRef.current || "", visto: Date.now() };
    pitido.ctx?.resume?.();

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("La cámara solo funciona si la app se abre con https:// (o en localhost). Usa “Tomar foto” mientras tanto.");
      return;
    }
    const lector = crearLector();
    lector
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        video.current,
        (res) => {
          if (!res || cancelado) return;
          const codigo = res.getText();
          const ahora = Date.now();
          // Mientras el mismo código siga frente a la cámara, no se vuelve a sumar.
          // Para agregar otra unidad: aparta la cámara y vuelve a apuntar (o usa el botón +).
          const u = ultimo.current;
          if (codigo === u.codigo && ahora - u.visto < 1200) { u.visto = ahora; return; }
          ultimo.current = { codigo, visto: ahora };
          pitido();
          onCodigoRef.current?.(codigo);
          if (!continuo) { controles.current?.stop(); onCerrarRef.current?.(); }
        }
      )
      .then((c) => { if (cancelado) c.stop(); else controles.current = c; })
      .catch((e) => {
        if (cancelado) return;
        setError(
          e?.name === "NotAllowedError"
            ? "No diste permiso para usar la cámara. Actívalo en la configuración del navegador o usa “Tomar foto”."
            : "No se pudo abrir la cámara. Usa “Tomar foto” o escribe el código."
        );
      });

    return () => { cancelado = true; controles.current?.stop(); controles.current = null; };
  }, [abierto, continuo]);

  async function leerFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setLeyendoFoto(true);
    const url = URL.createObjectURL(archivo);
    try {
      const res = await crearLector().decodeFromImageUrl(url);
      pitido();
      onCodigoRef.current?.(res.getText());
      if (!continuo) onCerrar?.();
    } catch {
      setError("No se encontró un código en la foto. Acércate más, con buena luz y el código recto.");
    } finally {
      URL.revokeObjectURL(url);
      setLeyendoFoto(false);
    }
  }

  if (!abierto) return null;
  const dividido = !!children;   // modo caja: cámara arriba, carrito abajo
  const fotoBtn = (texto) => (
    <label className={"btn dark foto-label" + (dividido ? " icon-txt" : "")} style={dividido ? undefined : { flex: 1 }}>
      {leyendoFoto ? "Leyendo…" : texto}
      <input className="hidden-input" type="file" accept="image/*" capture="environment" onChange={leerFoto} />
    </label>
  );

  return (
    <div className={"scan-ov" + (dividido ? " dividido" : "")} role="dialog" aria-label="Escáner de códigos">
      <div className="scan-cam">
        <video ref={video} muted playsInline />
        {!error && <div className="scan-frame" aria-hidden="true" />}
        {error && <div className="scan-msg">{error}</div>}
        <div className="scan-top">
          <b>{continuo ? "Escanea los productos" : "Escanea el código"}</b>
          <div className="row" style={{ gap: 8 }}>
            {dividido && fotoBtn("📷 Foto")}
            <button className="btn dark icon" onClick={onCerrar} aria-label="Cerrar escáner">✕</button>
          </div>
        </div>
        {dividido && resultado && (
          <div key={resultado.texto + resultado.n} className={"scan-pill" + (resultado.ok ? " ok" : "")}>{resultado.texto}</div>
        )}
      </div>

      {dividido ? (
        <div className="scan-panel">{children}</div>
      ) : (
        <div className="scan-bottom">
          <div className={"scan-last" + (resultado?.ok ? " ok" : "")}>
            {resultado ? resultado.texto : "Apunta al código de barras dentro del recuadro."}
          </div>
          <div className="row">
            {fotoBtn("📷 Tomar foto")}
            <button className="btn light" style={{ flex: 1 }} onClick={onCerrar}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
