/**
 * Textos de los estados de contenido, compartidos por las secciones del sitio.
 *
 * Viven acá y no repetidos en cada componente por una razón concreta: el mismo
 * fallo (no se pudo leer) tiene que leerse igual en todas las secciones. Si cada
 * plantilla tuviera su propia redacción, la misma causa aparecería con tres
 * mensajes distintos y parecerían tres problemas diferentes.
 */
export const MENSAJES = {
  /** Todavía no se sabe si hay contenido: la respuesta está en camino. */
  cargando: 'Cargando…',
  /** La respuesta llegó mal. No es lo mismo que "no hay contenido". */
  errorAlCargar: 'No pudimos cargar esta sección. Revisá tu conexión e intentá de nuevo.',
  reintentar: 'Reintentar',
} as const;
