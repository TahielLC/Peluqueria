import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ClaveDeTexto } from '../models/salon.model';
import { AppointmentService } from './appointment.service';

/**
 * Qué se ve en el sitio mientras los textos de la base no llegaron, o si no
 * llegan nunca.
 *
 * Duplica el seed de `supabase/schema.sql` a propósito, y el motivo es concreto:
 * un encabezado no puede quedar vacío ni mostrar un cartel de error. Es
 * preferible que el nombre del salón se vea un instante con su valor de fábrica
 * a que la página aparezca sin título. Si se cambia el seed, se cambia esto con
 * él: las dos listas tienen que decir lo mismo.
 */
export const TEXTOS_POR_DEFECTO: Record<ClaveDeTexto, string> = {
  hero_badge: 'Estilo & Vanguardia',
  hero_titulo: 'LA+ESTUDIO',
  hero_subtitulo:
    'El lugar donde tu imagen se transforma con las últimas tendencias en cortes, barbas y estilismo.',
  hero_cta: 'Ver Trabajos',
  servicios_titulo: 'Nuestros Servicios',
  servicios_bajada: 'Precios claros, sin sorpresas. Elegí el tuyo.',
  galeria_titulo: 'Galería de Trabajos',
  galeria_bajada: 'Echale un vistazo a nuestros últimos cortes y estilos.',
  staff_titulo: 'Nuestro Equipo',
  staff_bajada: 'Profesionales apasionados por el cuidado de tu imagen.',
};

/**
 * Los textos que el sitio está mostrando ahora mismo.
 *
 * Existe para que los textos se pidan una sola vez para todo el sitio (el home y
 * las tres secciones leen de acá) y para que, después de que la administradora
 * guarda desde el panel, el home muestre el valor nuevo sin recargar la página.
 *
 * A propósito NO tiene estado de error ni de "cargando": mientras no lleguen los
 * textos de la base, el sitio muestra los de fábrica, y si el pedido falla, se
 * queda con ellos. Un encabezado con su valor de fábrica se ve bien; una sección
 * rota o un cartel de error arriba del nombre del salón, no. Lo que sí hace es
 * volver a intentar en el próximo `cargar()`, para que un corte de red al abrir
 * la página no deje el texto viejo hasta que alguien recargue.
 */
@Injectable({
  providedIn: 'root',
})
export class TextosSitioService {
  private readonly datos = inject(AppointmentService);

  /** Lo que llegó de la base, por clave. Mientras esté vacío mandan los de fábrica. */
  private readonly deLaBase = signal<Partial<Record<ClaveDeTexto, string>>>({});

  private pedidoEnCurso = false;
  private yaLlegaron = false;

  /**
   * Pide los textos, una sola vez. Lo llama el home, que es el que siempre está
   * en pantalla; las secciones se limitan a leer con `texto()`.
   */
  cargar(): void {
    if (this.pedidoEnCurso || this.yaLlegaron) return;
    this.pedidoEnCurso = true;

    this.datos.getTextos().subscribe({
      next: (textos) => {
        const valores: Partial<Record<ClaveDeTexto, string>> = {};
        for (const texto of textos) {
          valores[texto.clave] = texto.valor;
        }

        this.deLaBase.set(valores);
        this.yaLlegaron = true;
        this.pedidoEnCurso = false;
      },
      error: () => {
        // Se queda con los de fábrica y deja la puerta abierta para reintentar.
        this.pedidoEnCurso = false;
      },
    });
  }

  /** El texto de esa clave: el de la base si llegó, y si no el de fábrica. */
  texto(clave: ClaveDeTexto): string {
    return this.deLaBase()[clave] ?? TEXTOS_POR_DEFECTO[clave];
  }

  /**
   * Guarda un texto y deja la copia del sitio al día.
   *
   * Lo segundo pesa tanto como lo primero: si el panel guardara sin tocar esta
   * copia, el home seguiría mostrando el texto viejo hasta recargar, y la
   * administradora vería un "no se guardó" que en realidad sí se guardó.
   */
  guardar(clave: ClaveDeTexto, valor: string): Observable<void> {
    return this.datos.guardarTexto(clave, valor).pipe(
      tap(() => this.deLaBase.update((actuales) => ({ ...actuales, [clave]: valor }))),
    );
  }
}
