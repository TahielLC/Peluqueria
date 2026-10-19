export const RELACION_DE_RECORTE = 4 / 5;
export const ANCHO_DE_SALIDA = 800;
export const ALTO_DE_SALIDA = 1000;

/** Tamaño del marco de encuadre en píxeles de pantalla. */
export interface Marco {
  ancho: number;
  alto: number;
}

/** Tamaño natural de la imagen original. */
export interface Imagen {
  ancho: number;
  alto: number;
}

/**
 * Lo que el usuario eligió ver.
 *
 * `x` e `y` son píxeles de pantalla respecto del centro del marco; el
 * acercamiento es un factor sobre la escala que ya cubre el marco.
 */
export interface Encuadre {
  x: number;
  y: number;
  acercamiento: number;
}

/** Porción de la imagen original, en sus propios píxeles. */
export interface Rectangulo {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function encuadreInicial(): Encuadre {
  return { x: 0, y: 0, acercamiento: 1 };
}

/**
 * Escala a la que la imagen recién cubre el marco.
 *
 * Es la misma regla que `object-fit: cover`: se toma el mayor de los dos
 * cocientes, así ninguno de los lados queda corto.
 */
function escalaBase(imagen: Imagen, marco: Marco): number {
  return Math.max(marco.ancho / imagen.ancho, marco.alto / imagen.alto);
}

function tieneMedidas(medidas: { ancho: number; alto: number }): boolean {
  return (
    Number.isFinite(medidas.ancho) &&
    Number.isFinite(medidas.alto) &&
    medidas.ancho > 0 &&
    medidas.alto > 0
  );
}

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Corrige el encuadre para que la imagen cubra el marco entero.
 *
 * Es la regla que impide que alguien arrastre la foto y aparezca un borde
 * vacío. El margen disponible es la mitad de lo que la imagen excede al marco
 * en cada eje: si no lo excede (porque ese eje justo coincide), no hay margen.
 */
export function limitarEncuadre(
  encuadre: Encuadre,
  imagen: Imagen,
  marco: Marco,
): Encuadre {
  if (!tieneMedidas(imagen) || !tieneMedidas(marco)) {
    return encuadreInicial();
  }

  const acercamiento = Number.isFinite(encuadre.acercamiento)
    ? Math.max(1, encuadre.acercamiento)
    : 1;
  const escala = escalaBase(imagen, marco) * acercamiento;

  const margenX = Math.max(0, (imagen.ancho * escala - marco.ancho) / 2);
  const margenY = Math.max(0, (imagen.alto * escala - marco.alto) / 2);

  return {
    x: acotar(Number.isFinite(encuadre.x) ? encuadre.x : 0, -margenX, margenX),
    y: acotar(Number.isFinite(encuadre.y) ? encuadre.y : 0, -margenY, margenY),
    acercamiento,
  };
}

/**
 * Rectángulo de la imagen original que se ve dentro del marco.
 *
 * Se limita el encuadre primero: lo que se guarda tiene que ser exactamente lo
 * que el marco está mostrando, no un encuadre que la pantalla ya corrigió.
 */
export function rectanguloDeOrigen(
  encuadre: Encuadre,
  imagen: Imagen,
  marco: Marco,
): Rectangulo {
  if (!tieneMedidas(imagen) || !tieneMedidas(marco)) {
    return { sx: 0, sy: 0, sw: 0, sh: 0 };
  }

  const seguro = limitarEncuadre(encuadre, imagen, marco);
  const escala = escalaBase(imagen, marco) * seguro.acercamiento;

  const sw = marco.ancho / escala;
  const sh = marco.alto / escala;
  const sx = (imagen.ancho - sw) / 2 - seguro.x / escala;
  const sy = (imagen.alto - sh) / 2 - seguro.y / escala;

  return {
    // El acotado final absorbe el error de coma flotante en los bordes.
    sx: acotar(sx, 0, Math.max(0, imagen.ancho - sw)),
    sy: acotar(sy, 0, Math.max(0, imagen.alto - sh)),
    sw,
    sh,
  };
}
