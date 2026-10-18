import { signal } from '@angular/core';
import { Observable } from 'rxjs';

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

/**
 * La máquina de estados de una sección que lee su contenido por red.
 *
 * POR QUÉ UNA CLASE Y NO SÓLO LOS TEXTOS DE ARRIBA
 * Los tres estados ya estaban, pero **copiados** en las tres secciones
 * (servicios, equipo, galería), así que centralizar únicamente los textos dejaba
 * afuera el 80% de lo que de verdad podía divergir. Lo marcó la revisión nativa
 * (R2-dup-estados). Acá viven las tres reglas que ninguna sección puede cumplir
 * distinto:
 *
 *   1. Arranca en `cargando`, **no** en vacío: antes de que llegue la respuesta
 *      no se sabe si hay contenido, y mostrar el estado vacío en ese momento
 *      afirmaría "no hay nada" cuando todavía no se preguntó.
 *   2. "No hay contenido" y "no se pudo leer" son situaciones distintas: el fallo
 *      tiene su propio texto y el vacío es simplemente la lista sin datos.
 *   3. Reintentar limpia el error viejo **antes** de pedir de nuevo, para que no
 *      quede un cartel de falla mientras la respuesta nueva está en camino.
 *
 * Los datos no los guarda acá: cada sección tiene su signal con su tipo y lo que
 * haga falta hacer al recibirlos (galería, por ejemplo, vuelve al primer panel).
 */
export class CargaDeContenido<T> {
  /** `true` hasta que la respuesta llegue, bien o mal. */
  readonly cargando = signal(true);

  /** `null` mientras no haya fallado; si falla, el texto compartido. */
  readonly error = signal<string | null>(null);

  constructor(
    private readonly leer: () => Observable<T>,
    private readonly recibir: (datos: T) => void,
  ) {}

  /** Pide el contenido. Está separado del arranque para que "Reintentar" lo repita. */
  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    // Las tres fuentes son `from(promesa)`: emiten una vez y completan, así que
    // no hay nada que desuscribir. Si alguna pasara a ser un stream vivo, este es
    // el único lugar donde hay que agregarlo.
    this.leer().subscribe({
      next: (datos) => {
        this.recibir(datos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(MENSAJES.errorAlCargar);
        this.cargando.set(false);
      },
    });
  }
}
