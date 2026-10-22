import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { StaffComponent } from "../../components/staff/staff.component";
import { GalleryComponent } from "../../components/gallery/gallery.component";
import { ServiciosComponent } from "../../components/servicios/servicios.component";
import { AppointmentService } from "../../services/appointment.service";
import { TextosSitioService } from "../../services/textos-sitio.service";
import { EnlaceInternoDirective } from "../../directives/enlace-interno.directive";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, StaffComponent, GalleryComponent, ServiciosComponent, EnlaceInternoDirective],
  template: `
    <div class="min-h-screen bg-noche">
      <!-- Barra: vive acá y no en el layout porque la portada es la única página
           pública; el panel tiene su propia cabecera. -->
      <header class="sticky top-0 z-50 border-b border-borde/70 bg-noche/80 backdrop-blur">
        <nav
          class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3"
          aria-label="Navegación principal"
        >
          <a
            href="#inicio"
            class="max-w-[42%] truncate text-xs font-medium uppercase tracking-[0.18em] text-hueso transition-colors hover:text-oro sm:max-w-none sm:text-sm"
          >
            {{ textos.texto("hero_titulo") }}
          </a>

          <div class="hidden items-center gap-1 rounded-full border border-borde bg-carbon/70 p-1 md:flex">
            <a
              class="rounded-full px-4 py-1.5 text-xs text-humo transition-colors hover:text-hueso"
              href="#servicios"
            >
              Servicios
            </a>
            <a
              class="rounded-full px-4 py-1.5 text-xs text-humo transition-colors hover:text-hueso"
              href="#galeria"
            >
              Galería
            </a>
            <a
              class="rounded-full px-4 py-1.5 text-xs text-humo transition-colors hover:text-hueso"
              href="#staff"
            >
              Equipo
            </a>
          </div>

          <!-- El botón de la barra usa el mismo texto editable que el del hero:
               una sola frase para la acción principal, no dos parecidas. -->
          <a
            href="#galeria"
            class="rounded-full bg-hueso px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-noche transition-colors hover:bg-oro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-noche sm:px-5 sm:text-[11px]"
          >
            {{ textos.texto("hero_cta") }}
          </a>
        </nav>
      </header>

      <!-- Portada -->
      <section id="inicio" class="relative isolate overflow-hidden">
        <!-- La foto es la primera de la galería: contenido real que la
             administradora ya cura, sin una clave nueva ni una pantalla nueva.
             Va de fondo y oscurecida para que el letrero se lea siempre, sea
             cual sea la foto que suba. -->
        @if (destacada()) {
          <div class="absolute inset-0" data-hero>
            <img [src]="destacada()" alt="" class="h-full w-full object-cover opacity-45" />
          </div>
        }
        <div class="absolute inset-0 bg-gradient-to-b from-noche/60 via-noche/80 to-noche"></div>
        <div
          class="pointer-events-none absolute inset-0"
          style="background: radial-gradient(55% 50% at 50% 45%, rgba(214,178,94,0.16) 0%, rgba(11,12,10,0) 70%)"
        ></div>

        <div
          class="relative mx-auto flex min-h-[86svh] max-w-6xl flex-col justify-between px-5 pb-10 pt-16 sm:pt-24"
        >
          <div class="flex flex-1 items-center">
            <div class="w-full">
              <p
                class="inline-flex items-center gap-2 rounded-full border border-borde bg-noche/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-humo backdrop-blur"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-verde" aria-hidden="true"></span>
                {{ textos.texto("hero_badge") }}
              </p>

              <!-- El nombre se dibuja dos veces: el halo (oculto para lectores de
                   pantalla) y el texto. Ver styles.css para el encendido. -->
              <h1
                class="neon mt-7 max-w-[13ch] font-display text-[clamp(2.6rem,8.5vw,6.5rem)] font-semibold uppercase leading-[0.9] tracking-[-0.035em]"
              >
                <span class="neon-halo" aria-hidden="true">{{
                  textos.texto("hero_titulo")
                }}</span>
                <span class="neon-texto">{{ textos.texto("hero_titulo") }}</span>
              </h1>

              <p class="mt-7 max-w-lg text-sm leading-relaxed text-humo sm:text-base">
                {{ textos.texto("hero_subtitulo") }}
              </p>

              <div class="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href="#galeria"
                  class="rounded-full bg-hueso px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-noche transition-colors hover:bg-oro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-noche"
                >
                  {{ textos.texto("hero_cta") }}
                </a>
                <a
                  href="#servicios"
                  class="rounded-full border border-borde px-6 py-3 text-xs font-medium uppercase tracking-[0.16em] text-hueso transition-colors hover:border-oro/60 hover:text-oro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-noche"
                >
                  Ver servicios
                </a>
              </div>
            </div>
          </div>

          <!-- Pie de la portada: las categorías que el panel ya usa, como
               señalética chica, no como contenido inventado. -->
          <ul
            class="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-borde/80 pt-6 text-[10px] uppercase tracking-[0.24em] text-humo"
          >
            <li><span class="mr-2 text-oro">01</span>Corte</li>
            <li><span class="mr-2 text-oro">02</span>Color</li>
            <li><span class="mr-2 text-oro">03</span>Barba</li>
            <li><span class="mr-2 text-oro">04</span>Peinado</li>
          </ul>
        </div>
      </section>

      <app-servicios></app-servicios>
      <app-gallery></app-gallery>
      <app-staff></app-staff>

      <!-- Pie. Todavía no tiene teléfono, dirección ni horarios: esos datos son
           reales del salón y no se inventan. Van cuando existan, editables. -->
      <footer class="border-t border-borde bg-noche">
        <div class="mx-auto max-w-6xl px-5 py-14">
          <div class="grid gap-10 md:grid-cols-[1.6fr_1fr]">
            <div>
              <p class="font-display text-2xl font-semibold uppercase tracking-[-0.01em] text-hueso">
                {{ textos.texto("hero_titulo") }}
              </p>
              <p class="mt-3 max-w-md text-sm leading-relaxed text-humo">
                {{ textos.texto("hero_subtitulo") }}
              </p>
            </div>

            <nav aria-label="Secciones del sitio" class="md:justify-self-end">
              <p class="text-[10px] uppercase tracking-[0.28em] text-oro">Secciones</p>
              <ul class="mt-4 space-y-2 text-sm text-humo">
                <li><a class="transition-colors hover:text-hueso" href="#servicios">Servicios</a></li>
                <li><a class="transition-colors hover:text-hueso" href="#galeria">Galería</a></li>
                <li><a class="transition-colors hover:text-hueso" href="#staff">Equipo</a></li>
              </ul>
            </nav>
          </div>

          <div
            class="mt-12 flex flex-col gap-2 border-t border-borde/70 pt-6 text-[10px] uppercase tracking-[0.2em] text-humo/70 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>© {{ anio }} {{ textos.texto("hero_titulo") }}</p>
            <a class="transition-colors hover:text-hueso" href="#inicio">Volver arriba</a>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class HomeComponent {
  /**
   * Los textos del sitio. El home es el único que los pide, porque es la
   * pantalla que siempre está en el DOM; las tres secciones leen de esta misma
   * copia y no hacen su propio pedido.
   */
  readonly textos = inject(TextosSitioService);

  private readonly appointmentService = inject(AppointmentService);

  /** La primera foto publicada de la galería, o `null` si no hay ninguna. */
  readonly destacada = signal<string | null>(null);

  readonly anio = new Date().getFullYear();

  constructor() {
    this.textos.cargar();
    this.cargarDestacada();
  }

  /**
   * Pide la galería sólo para la foto de la portada.
   *
   * El error se ignora a propósito: la foto es decorativa y el fallo de lectura
   * ya lo muestra la sección de galería, más abajo, con su "Reintentar". Mostrar
   * el mismo error dos veces haría parecer dos problemas distintos.
   */
  private cargarDestacada(): void {
    this.appointmentService.getGaleria().subscribe({
      next: (trabajos) => this.destacada.set(trabajos[0]?.imagenUrl ?? null),
      error: () => this.destacada.set(null),
    });
  }
}
