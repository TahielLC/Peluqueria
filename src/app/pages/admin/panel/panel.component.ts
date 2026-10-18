import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

/** Textos fijos del panel. */
const MENSAJES = {
  titulo: 'Panel de administración',
  cerrarSesion: 'Cerrar sesión',
  secciones: 'Secciones del panel',
  proximamente: 'Acá vas a poder editar esta parte del sitio. Llega en la próxima entrega.',
} as const;

/**
 * Las 4 secciones de edición del panel.
 *
 * Están en una lista y no escritas a mano en la plantilla por un motivo
 * concreto: el orden de las pestañas, el título y el resumen de cada una se
 * definen **en un solo lugar**. Cuando T7 a T10 metan los editores de verdad,
 * cada uno cambia su entrada y no hay que tocar la plantilla del panel.
 */
const SECCIONES = [
  {
    id: 'textos',
    etiqueta: 'Textos',
    titulo: 'Textos del sitio',
    resumen: 'El título y el subtítulo de la portada, y las bajadas de cada sección.',
  },
  {
    id: 'servicios',
    etiqueta: 'Servicios',
    titulo: 'Servicios y precios',
    resumen: 'Cada servicio que ofrecés, con lo que dura y lo que sale.',
  },
  {
    id: 'equipo',
    etiqueta: 'Equipo',
    titulo: 'Equipo',
    resumen: 'Las personas del salón, con su foto, su especialidad y su experiencia.',
  },
  {
    id: 'galeria',
    etiqueta: 'Galería',
    titulo: 'Galería de trabajos',
    resumen: 'Las fotos de trabajos que se ven en la portada.',
  },
] as const;

export type IdSeccion = (typeof SECCIONES)[number]['id'];

/**
 * Cascarón del panel: quién entró, cómo salir y las 4 pestañas.
 *
 * **Por qué pestañas en una sola pantalla** (decisión del usuario, L40): la
 * persona que usa esto no sabe de apps. Con todo el panel en una pantalla no hay
 * nada que recordar ni dónde perderse: siempre ve dónde está parada y qué otras
 * cosas puede editar. Con navegación entre pantallas, en cambio, hay que
 * entender que se "entra" y se "sale" de cada sección.
 *
 * **Por qué botones con `aria-pressed` y no `role="tab"`.** El patrón ARIA de
 * pestañas exige, para estar completo, flechas del teclado y `tabindex` móvil
 * entre las pestañas. Media pestaña ARIA es peor que un grupo de botones
 * completo: los botones nativos ya se recorren con Tab y se activan con Enter o
 * Espacio, sin una línea de código propio. Lo que se pierde es sólo la
 * semántica de "pestaña" para un lector de pantalla, y eso no le quita
 * operabilidad a nadie. La decisión es deliberada, no un olvido.
 */
@Component({
  selector: 'app-admin-panel',
  standalone: true,
  template: `
    <section class="min-h-screen bg-gray-100">
      <header class="bg-white border-b border-gray-200">
        <div class="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 class="text-lg font-bold text-gray-800">{{ mensajes.titulo }}</h1>
            <p class="text-sm text-gray-500">{{ correo() ?? '…' }}</p>
          </div>

          <button
            type="button"
            (click)="salir()"
            class="whitespace-nowrap text-sm text-indigo-600 hover:underline"
          >
            {{ mensajes.cerrarSesion }}
          </button>
        </div>

        <div class="mx-auto max-w-4xl px-4">
          <div class="flex gap-1 overflow-x-auto" role="group" [attr.aria-label]="mensajes.secciones">
            @for (seccion of secciones; track seccion.id) {
              <button
                type="button"
                [attr.aria-pressed]="esActiva(seccion.id)"
                (click)="activar(seccion.id)"
                [class]="claseDePestania(seccion.id)"
              >
                {{ seccion.etiqueta }}
              </button>
            }
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-4xl px-4 py-8">
        @for (seccion of secciones; track seccion.id) {
          @if (esActiva(seccion.id)) {
            <section [attr.aria-label]="seccion.titulo">
              <h2 class="mb-2 text-xl font-semibold text-gray-800">{{ seccion.titulo }}</h2>
              <p class="mb-6 text-gray-500">{{ seccion.resumen }}</p>

              <p class="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
                {{ mensajes.proximamente }}
              </p>
            </section>
          }
        }
      </main>
    </section>
  `,
})
export class AdminPanelComponent implements OnInit {
  private autenticacion = inject(AuthService);
  private router = inject(Router);

  readonly correo = signal<string | null>(null);
  readonly seccionActiva = signal<IdSeccion>('textos');

  readonly secciones = SECCIONES;
  readonly mensajes = MENSAJES;

  ngOnInit(): void {
    this.cargarCorreo();
  }

  esActiva(id: IdSeccion): boolean {
    return this.seccionActiva() === id;
  }

  activar(id: IdSeccion): void {
    this.seccionActiva.set(id);
  }

  /** La clase de la pestaña se arma entera acá para no mezclar `class` con un binding parcial. */
  claseDePestania(id: IdSeccion): string {
    const base =
      'whitespace-nowrap rounded-t-lg border-b-2 -mb-px px-4 py-2 text-sm font-medium transition-colors';

    return this.esActiva(id)
      ? `${base} border-indigo-600 text-indigo-700`
      : `${base} border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700`;
  }

  async salir(): Promise<void> {
    await this.autenticacion.cerrarSesion();
    await this.router.navigateByUrl('/admin/login');
  }

  /**
   * Público para poder esperarlo desde los tests, que es donde se prueba que no
   * deja una promesa rechazada suelta.
   */
  async cargarCorreo(): Promise<void> {
    try {
      this.correo.set(await this.autenticacion.correoDeLaSesion());
    } catch {
      // No poder leer el correo no justifica romper una pantalla que ya está
      // autorizada: se muestra el panel sin ese dato. El caso "no hay sesión"
      // no llega hasta acá, lo corta el guard.
      this.correo.set(null);
    }
  }
}
