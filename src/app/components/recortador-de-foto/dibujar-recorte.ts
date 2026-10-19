import { Rectangulo } from './encuadre';

/**
 * Dibuja en un canvas sólo la porción elegida de la imagen y la devuelve como
 * Blob.
 *
 * Se pide WebP con calidad 0.9. Si el navegador no lo soporta, `toBlob` devuelve
 * PNG en su lugar; la extensión del archivo subido sale del MIME resultante, así
 * que no hace falta forzar nada acá.
 */
export function dibujarRecorte(
  imagen: HTMLImageElement,
  origen: Rectangulo,
  salida: { ancho: number; alto: number },
): Promise<Blob> {
  const lienzo = document.createElement('canvas');
  lienzo.width = salida.ancho;
  lienzo.height = salida.alto;

  const contexto = lienzo.getContext('2d');
  if (!contexto) {
    return Promise.reject(new Error('El navegador no puede preparar el recorte.'));
  }

  contexto.drawImage(
    imagen,
    origen.sx,
    origen.sy,
    origen.sw,
    origen.sh,
    0,
    0,
    salida.ancho,
    salida.alto,
  );

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) => {
        if (blob) {
          resolver(blob);
        } else {
          rechazar(new Error('No se pudo generar el recorte.'));
        }
      },
      'image/webp',
      0.9,
    );
  });
}
