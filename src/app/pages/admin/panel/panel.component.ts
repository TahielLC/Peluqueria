import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { SeccionTextosComponent } from '../seccion-textos/seccion-textos.component';
import { SeccionServiciosComponent } from '../seccion-servicios/seccion-servicios.component';
import { SeccionStaffComponent } from '../seccion-staff/seccion-staff.component';

/** Textos fijos del panel. */
const MENSAJES = {
  titulo: 'Panel de administración',
  cerrarSesion: 'Cerrar sesión',
  secciones: 'Secciones del panel',
  proximamente: 'Acá vas a poder editar esta parte del sitio. Llega en la próxima entrega.',
  // Un solo aviso para los dos fallos, y por eso está redactado como posibilidad
  // y no como hecho: hay una rama en la que no se pudo averiguar si la sesión
  // quedó abierta, y ahí afirmarlo sería mentir. Ver `intentarSalir`.
  salidaFallo:
    'No se pudo cerrar la sesión: puede que siga abierta. Revisá tu conexión y probá de nuevo.',
} as const;

/**
 * Las 4 secciones de edición del panel.
 *
 * Están en una lista y no escritas a mano en la plantilla por un motivo
 * concreto: el orden de las pestañas, el título y el resumen de cada una se
 * definen **en un solo lugar**. Cada editor reemplaza su cartel de
 * "próximamente" por su componente, como ya hacen Textos y Servicios.
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
  imports: [SeccionTextosComponent, SeccionServiciosComponent, SeccionStaffComponent],
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

        @if (aviso(); as textoAviso) {
          <div class="mx-auto max-w-4xl px-4 pb-3">
            <p
              role="alert"
              class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {{ textoAviso }}
            </p>
          </div>
        }

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

              @if (seccion.id === 'textos') {
                <app-seccion-textos />
              } @else if (seccion.id === 'servicios') {
                <app-seccion-servicios />
              } @else if (seccion.id === 'equipo') {
                <app-seccion-staff />
              } @else {
                <p class="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
                  {{ mensajes.proximamente }}
                </p>
              }
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

  /**
   * El único aviso que el panel muestra hoy: que la sesión no se pudo cerrar.
   *
   * Es un `signal` y no un `alert()` del navegador a propósito: un modal del
   * sistema se cierra con un clic y después no queda rastro de por qué la
   * persona sigue adentro. Esto queda a la vista hasta que la acción sale bien.
   */
  readonly aviso = signal<string | null>(null);

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

  /** Cierra la sesión, según lo que devuelva `intentarSalir`. */
  async salir(): Promise<void> {
    // Se limpia primero: si es un reintento, el aviso viejo no tiene que quedar
    // colgado mientras se espera la respuesta.
    this.aviso.set(null);

    if (await this.intentarSalir()) {
      await this.router.navigateByUrl('/admin/login');
      return;
    }

    this.aviso.set(MENSAJES.salidaFallo);
  }

  /**
   * Intenta cerrar la sesión y dice si corresponde irse al login.
   *
   * **Por qué esto no es un `if` de dos ramas.** Cerrar sesión tiene TRES
   * desenlaces, y confundirlos es exactamente el bug que tenía este método:
   *
   *   1. Salió bien -> al login.
   *
   *   2. Falló, pero la sesión local **ya no está** -> igual al login. Supabase
   *      borra la sesión local *antes* de avisarle al servidor, así que si falla
   *      la red la persona igual quedó afuera de este navegador. Dejarla en el
   *      panel sería peor que navegar.
   *
   *   3. Falló y la sesión sigue viva -> **no se navega**. Ir al login mentiría:
   *      al volver a /admin el guard la dejaría pasar sin contraseña, y creería
   *      que cerró algo que sigue abierto.
   *
   * Los casos 2 y 3 se distinguen preguntando, no adivinando. Y si ni siquiera
   * se puede averiguar, se asume el 3: afirmar que la sesión se cerró cuando no
   * se sabe es la única respuesta que no se puede dar.
   *
   * **Ese tercer camino es el que le da la redacción al aviso.** El mismo texto
   * cubre los dos fallos, y el caso «ni se pudo averiguar» también lo muestra:
   * por eso dice que la sesión *puede* seguir abierta y no que sigue abierta.
   * Afirmarlo ahí sería el mismo error que la revisión nativa nos marcó como
   * CRITICAL: un cartel que asegura un hecho que nadie comprobó.
   */
  private async intentarSalir(): Promise<boolean> {
    try {
      const cerroBien = await this.autenticacion.cerrarSesion();

      // Si cerró bien no hay nada que preguntar; si falló, hay que ver si la
      // sesión local sobrevivió.
      return cerroBien || !(await this.autenticacion.haySesion());
    } catch {
      return false;
    }
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
