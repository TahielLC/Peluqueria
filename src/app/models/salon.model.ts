export interface TrabajoGaleria {
  id: number;
  titulo: string;
  categoria: 'Corte' | 'Peinado' | 'Barba' | 'Color';
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
