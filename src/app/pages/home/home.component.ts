import { Component, computed, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { StaffComponent } from "../../components/staff/staff.component";
import { GalleryComponent } from "../../components/gallery/gallery.component";
import { ServiciosComponent } from "../../components/servicios/servicios.component";
import { AppointmentService } from "../../services/appointment.service";
import { TextosSitioService } from "../../services/textos-sitio.service";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, StaffComponent, GalleryComponent, ServiciosComponent],
  template: `
    <div class="min-h-screen bg-crema">
      <!-- Barra: vive acá y no en el layout porque la portada es la única página
           pública; el panel tiene su propia cabecera. -->
      <header class="sticky top-0 z-50 border-b border-linea/70 bg-crema/85 backdrop-blur">
        <nav
          class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5"
          aria-label="Navegación principal"
        >
          <a
            href="#inicio"
            class="font-display text-base font-medium tracking-tight text-tinta transition-colors hover:text-bronce-oscuro sm:text-lg"
          >
            {{ textos.texto("hero_titulo") }}
          </a>

          <div class="hidden items-center gap-8 text-sm text-humo md:flex">
            <a class="transition-colors hover:text-tinta" href="#servicios">Servicios</a>
            <a class="transition-colors hover:text-tinta" href="#galeria">Galería</a>
            <a class="transition-colors hover:text-tinta" href="#staff">Equipo</a>
          </div>

          <!-- El botón de la barra usa el mismo texto editable que el del hero:
               una sola frase para la acción principal, no dos parecidas. -->
          <a
            href="#galeria"
            class="rounded-full bg-tinta px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-crema transition-colors hover:bg-bronce-oscuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronce focus-visible:ring-offset-2 focus-visible:ring-offset-crema sm:px-5"
          >
            {{ textos.texto("hero_cta") }}
          </a>
        </nav>
      </header>

      <!-- Portada -->
      <section id="inicio" class="relative overflow-hidden">
        <div
          class="pointer-events-none absolute inset-0"
          style="background:
            radial-gradient(60% 55% at 18% 20%, rgba(169,116,79,0.16) 0%, rgba(250,246,240,0) 65%),
            radial-gradient(45% 45% at 85% 80%, rgba(241,232,220,0.9) 0%, rgba(250,246,240,0) 70%)"
        ></div>

        <div class="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pt-20 md:pb-24 md:pt-24">
          <div [class]="claseDeLaPortada()">
            <div>
              <p
                class="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.34em] text-bronce"
              >
                <span class="h-px w-10 bg-bronce/60" aria-hidden="true"></span>
                {{ textos.texto("hero_badge") }}
              </p>

              <h1
                class="mt-6 max-w-[15ch] font-display text-4xl font-light leading-[1.03] tracking-tight text-tinta sm:text-5xl lg:text-6xl"
              >
                {{ textos.texto("hero_titulo") }}
              </h1>

              <p class="mt-6 max-w-xl text-base leading-relaxed text-humo sm:text-lg">
                {{ textos.texto("hero_subtitulo") }}
              </p>

              <div class="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href="#galeria"
                  class="rounded-full bg-bronce px-7 py-3 text-sm font-medium text-crema shadow-[0_18px_35px_-20px_rgba(169,116,79,0.9)] transition-colors hover:bg-bronce-oscuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronce focus-visible:ring-offset-2 focus-visible:ring-offset-crema"
                >
                  {{ textos.texto("hero_cta") }}
                </a>
                <a
                  href="#servicios"
                  class="rounded-full border border-linea px-7 py-3 text-sm font-medium text-tinta transition-colors hover:border-tinta/30 hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronce focus-visible:ring-offset-2 focus-visible:ring-offset-crema"
                >
                  Ver servicios
                </a>
              </div>
            </div>

            <!-- La foto es la primera de la galería: contenido real que la
                 administradora ya cura, sin una clave nueva ni una pantalla nueva.
                 Si no hay galería, la portada queda sólo con los textos. -->
            @if (destacada()) {
              <figure data-hero class="relative mx-auto w-full max-w-sm md:max-w-none">
                <span
                  class="absolute -inset-3 rounded-[2rem] border border-linea"
                  aria-hidden="true"
                ></span>
                <img
                  [src]="destacada()"
                  alt=""
                  loading="eager"
                  class="relative aspect-[4/5] w-full rounded-[1.75rem] object-cover shadow-[0_30px_60px_-40px_rgba(34,28,24,0.55)]"
                />
              </figure>
            }
          </div>
        </div>
      </section>

      <app-servicios></app-servicios>
      <app-gallery></app-gallery>
      <app-staff></app-staff>

      <!-- Pie. Todavía no tiene teléfono, dirección ni horarios: esos datos son
           reales del salón y no se inventan. Van cuando existan, editables. -->
      <footer class="bg-tinta text-crema/70">
        <div class="mx-auto max-w-6xl px-5 py-14">
          <div class="grid gap-10 md:grid-cols-[1.6fr_1fr]">
            <div>
              <p class="font-display text-2xl text-crema">
                {{ textos.texto("hero_titulo") }}
              </p>
              <p class="mt-3 max-w-md text-sm leading-relaxed">
                {{ textos.texto("hero_subtitulo") }}
              </p>
            </div>

            <nav aria-label="Secciones del sitio" class="md:justify-self-end">
              <p class="text-[11px] font-medium uppercase tracking-[0.28em] text-bronce-claro">
                Secciones
              </p>
              <ul class="mt-4 space-y-2 text-sm">
                <li>
                  <a class="transition-colors hover:text-crema" href="#servicios">Servicios</a>
                </li>
                <li><a class="transition-colors hover:text-crema" href="#galeria">Galería</a></li>
                <li><a class="transition-colors hover:text-crema" href="#staff">Equipo</a></li>
              </ul>
            </nav>
          </div>

          <div
            class="mt-12 flex flex-col gap-2 border-t border-crema/10 pt-6 text-xs text-crema/45 sm:flex-row sm:items-center sm:justify-between"
          >
            <p>© {{ anio }} {{ textos.texto("hero_titulo") }}</p>
            <a class="transition-colors hover:text-crema" href="#inicio">Volver arriba</a>
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

  /** Con foto, la portada es de dos columnas; sin foto, una sola y centrada. */
  readonly claseDeLaPortada = computed(() =>
    this.destacada()
      ? "grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-14"
      : "grid items-center gap-10",
  );

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
