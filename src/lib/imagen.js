/**
 * Achica una foto antes de guardarla (máx. 480 px por lado, JPEG) para que no ocupe
 * mucho espacio en el dispositivo. Devuelve un Blob.
 */
export async function prepararImagen(archivo, max = 480) {
  let fuente;
  try {
    fuente = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    fuente = await new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => mal(new Error("No se pudo leer la imagen."));
      img.src = URL.createObjectURL(archivo);
    });
  }
  const w = fuente.width, h = fuente.height;
  const k = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";                       // fondo blanco para imágenes con transparencia
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(fuente, 0, 0, canvas.width, canvas.height);
  fuente.close?.();
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la imagen."))), "image/jpeg", 0.82));
}
