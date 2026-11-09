import { lazy, Suspense } from "react";

// El lector de códigos (ZXing) pesa bastante: se descarga solo la primera vez que abres el escáner.
const Escaner = lazy(() => import("./Escaner"));

export default function EscanerLazy(props) {
  if (!props.abierto) return null;
  return (
    <Suspense fallback={<div className="scan-ov"><div className="scan-msg">Abriendo cámara…</div></div>}>
      <Escaner {...props} />
    </Suspense>
  );
}
