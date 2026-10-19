/**
 * Las categorías de la galería.
 *
 * La base guarda `categoria` como texto libre, pero el panel sólo ofrece estas
 * cuatro y el sitio las usa para agrupar los trabajos. Tenerlas con nombre evita
 * repetir la unión en el modelo, en el servicio y en el editor.
 */
export type CategoriaDeTrabajo = 'Corte' | 'Peinado' | 'Barba' | 'Color';

export interface TrabajoGaleria {
  id: number;
  titulo: string;
  categoria: CategoriaDeTrabajo;
  imagenUrl: string;
}

/** Un trabajo tal como lo ve el panel: además de lo público, si está publicado. */
export interface TrabajoDeGaleriaAdministrable extends TrabajoGaleria {
  activo: boolean;
}

/** Lo que la administradora edita. El orden y la baja no se editan desde acá. */
export interface DatosDeTrabajoDeGaleria {
  titulo: string;
  categoria: CategoriaDeTrabajo;
  imagenUrl: string;
}

/**
 * Las claves de `public.textos_sitio`: los textos del sitio que la administradora
 * puede editar. Son diez y están cerradas a propósito —la base tiene la misma
 * lista— para que el sitio no pueda pedir un texto que no existe y quedarse con
 * un hueco.
 */
export type ClaveDeTexto =
  | 'hero_badge'
  | 'hero_titulo'
  | 'hero_subtitulo'
  | 'hero_cta'
  | 'servicios_titulo'
  | 'servicios_bajada'
  | 'galeria_titulo'
  | 'galeria_bajada'
  | 'staff_titulo'
  | 'staff_bajada';

/**
 * Un texto del sitio tal como está guardado.
 *
 * `etiqueta` y `ayuda` no los usa el sitio público: existen para el panel, para
 * que quien lo edita lea "Nombre del salón" en vez de `hero_titulo`. Viven en la
 * base, y no en el código, porque son parte de lo que se edita; el código sólo
 * pone el valor de fábrica.
 */
export interface TextoDeSitio {
  clave: ClaveDeTexto;
  valor: string;
  etiqueta: string;
  ayuda: string | null;
}
