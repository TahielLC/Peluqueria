import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { TrabajoGaleria } from '../../models/salon.model';
import { TextosSitioService } from '../../services/textos-sitio.service';
import { MENSAJES, CargaDeContenido } from '../estados';

const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 430;
const SWIPE_THRESHOLD = 50;
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const DURATION = '900ms';

@Component({
  selector: 'app-gallery',
  standalone: true,
  template: `
    <section id="galeria" class="relative overflow-hidden bg-noche py-20 md:py-28">
      <!-- Halo cálido que simula la luz cayendo sobre la puerta -->
      <div
        class="pointer-events-none absolute inset-0"
        style="background: radial-gradient(55% 55% at 50% 42%, rgba(214,178,94,0.3) 0%, rgba(11,12,10,0) 72%)"
      ></div>
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style="background: linear-gradient(to top, rgba(11,12,10,0.95) 0%, rgba(11,12,10,0) 100%)"
      ></div>

      <div class="relative mx-auto max-w-6xl px-5">
        <div
          class="flex flex-col gap-5 border-t border-borde pt-7 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <p class="text-[10px] font-medium uppercase tracking-[0.3em] text-oro">02 — Galería</p>
            <h2
              class="mt-3 font-display text-3xl font-semibold uppercase leading-[0.95] tracking-[-0.025em] text-hueso sm:text-4xl md:text-5xl"
            >
              {{ textos.texto('galeria_titulo') }}
            </h2>
          </div>
          <p class="max-w-sm text-sm leading-relaxed text-humo md:text-right">
            {{ textos.texto('galeria_bajada') }}
          </p>
        </div>

        @if (cargando()) {
          <p class="py-24 text-humo" role="status">{{ mensajes.cargando }}</p>
        } @else if (error()) {
          <div class="py-24">
            <p class="text-humo">{{ error() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-6 rounded-full bg-oro px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-noche transition-colors hover:bg-oro-claro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-noche"
            >
              {{ mensajes.reintentar }}
            </button>
          </div>
        } @else if (total() === 0) {
          <p class="py-24 text-humo">Todavía no hay trabajos para mostrar.</p>
        } @else {
          <div
            class="relative mt-12 select-none rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-oro"
            role="group"
            aria-roledescription="carrusel"
            aria-label="Galería de trabajos"
            tabindex="0"
            (keydown.arrowleft)="prev()"
            (keydown.arrowright)="next()"
            (touchstart)="onTouchStart($event)"
            (touchend)="onTouchEnd($event)"
          >
            <!-- Sombra elipsoidal en el "piso" -->
            <div
              class="pointer-events-none absolute left-1/2 top-1/2 h-56 w-[620px] -translate-x-1/2 translate-y-40 rounded-[50%] bg-oro/20 blur-3xl"
            ></div>

            <!-- ESCENARIO 3D -->
            <div
              class="relative mx-auto h-[520px] sm:h-[560px] md:h-[600px]"
              [style.perspective.px]="perspective"
              style="perspective-origin: 50% 42%"
            >
              <div
                class="absolute left-1/2 top-1/2"
                [style.width.px]="panelWidth"
                [style.height.px]="panelHeight"
                [style.margin-left.px]="-panelWidth / 2"
                [style.margin-top.px]="-panelHeight / 2"
                [style.transform]="ringTransform()"
                [style.transition]="'transform ' + duration + ' ' + easing"
                style="transform-style: preserve-3d; will-change: transform"
              >
                @for (item of galeria(); track item.id; let i = $index) {
                  <figure
                    class="absolute inset-0 m-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
                    [style.transform]="panelTransform(i)"
                    [style.opacity]="panelOpacity(i)"
                    [style.transition]="
                      'transform ' + duration + ' ' + easing + ', opacity ' + duration + ' ease-out'
                    "
                    style="will-change: transform, opacity"
                  >
                    <img
                      [src]="item.imagenUrl"
                      [alt]="item.titulo"
                      draggable="false"
                      class="h-full w-full object-cover"
                      [style.filter]="isActive(i) ? 'none' : 'blur(4px) brightness(0.5)'"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent"></div>

                    <figcaption
                      class="absolute bottom-0 left-0 p-6 transition-opacity duration-500"
                      [style.opacity]="isActive(i) ? 1 : 0"
                    >
                      <span class="mb-2 inline-block text-[10px] uppercase tracking-[0.28em] text-oro">
                        {{ item.categoria }}
                      </span>
                      <h3 class="font-display text-2xl font-medium uppercase tracking-[-0.01em] text-hueso">{{ item.titulo }}</h3>
                    </figcaption>
                  </figure>
                }
              </div>
            </div>

            <!-- CONTROLES -->
            <div
              class="relative -mt-6 flex items-center justify-center gap-6"
            >
              @if (hasMultiple()) {
                <button
                  type="button"
                  (click)="prev()"
                  aria-label="Trabajo anterior"
                  class="grid h-12 w-12 place-items-center rounded-full border border-borde bg-carbon/70 text-hueso backdrop-blur-md transition hover:border-oro/60 hover:text-oro focus:outline-none focus-visible:ring-2 focus-visible:ring-oro"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div class="flex items-center gap-2">
                  @for (item of galeria(); track item.id; let i = $index) {
                    <button
                      type="button"
                      (click)="goTo(i)"
                      [attr.aria-label]="'Ir al trabajo ' + (i + 1)"
                      [attr.aria-current]="isActive(i)"
                      [class]="
                        isActive(i)
                          ? 'h-1.5 w-8 rounded-full bg-oro transition-all duration-500'
                          : 'h-1.5 w-1.5 rounded-full bg-hueso/20 transition-all duration-500 hover:bg-hueso/40'
                      "
                    ></button>
                  }
                </div>

                <button
                  type="button"
                  (click)="next()"
                  aria-label="Trabajo siguiente"
                  class="grid h-12 w-12 place-items-center rounded-full border border-borde bg-carbon/70 text-hueso backdrop-blur-md transition hover:border-oro/60 hover:text-oro focus:outline-none focus-visible:ring-2 focus-visible:ring-oro"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              }
            </div>

            <p class="mt-6 text-center text-[10px] uppercase tracking-[0.2em] text-humo/70">
              Deslizá, usá las flechas o las teclas ← →
            </p>
          </div>
        }
      </div>
    </section>
  `,
})
export class GalleryComponent implements OnInit {
  private appointmentService = inject(AppointmentService);

  /** Los textos del sitio: los pide el home una sola vez y las secciones leen. */
  readonly textos = inject(TextosSitioService);

  readonly panelWidth = PANEL_WIDTH;
  readonly panelHeight = PANEL_HEIGHT;
  readonly duration = DURATION;
  readonly easing = EASING;
  readonly perspective = 1200;

  readonly galeria = signal<TrabajoGaleria[]>([]);
  readonly currentIndex = signal(0);

  /** Las tres reglas de cargando / error / vacío viven una sola vez: `estados.ts`. */
  private readonly carga = new CargaDeContenido<TrabajoGaleria[]>(
    () => this.appointmentService.getGaleria(),
    (datos) => {
      this.galeria.set(datos);
      // Contenido nuevo, cilindro al principio: si no, quedaría girado a un
      // ángulo de la lista anterior que puede no existir.
      this.currentIndex.set(0);
    },
  );

  readonly cargando = this.carga.cargando;
  readonly error = this.carga.error;

  readonly mensajes = MENSAJES;

  readonly total = computed(() => this.galeria().length);
  readonly hasMultiple = computed(() => this.total() > 1);

  /** Ángulo entre paneles. Con 3 fotos: 120°. */
  readonly step = computed(() => 360 / Math.max(this.total(), 1));

  /**
   * Radio del cilindro. Se elige para que el panel vecino asome por los
   * costados del panel frontal y la puerta se lea como objeto 3D en reposo,
   * no sólo mientras gira. Un radio chico los deja ocultos detrás.
   */
  readonly radius = computed(() => {
    const n = this.total();
    if (n < 2) return 0;
    if (n === 2) return 260;
    const ideal = PANEL_WIDTH / Math.sin((2 * Math.PI) / n);
    return Math.round(Math.min(Math.max(ideal, 240), 700));
  });

  /** El cilindro completo gira; cada panel mantiene su ángulo fijo respecto al eje. */
  readonly ringTransform = computed(
    () => `translateZ(${-this.radius()}px) rotateY(${-this.currentIndex() * this.step()}deg)`
  );

  private touchStartX = 0;

  ngOnInit(): void {
    this.cargar();
  }

  /** Pide los trabajos. Separado del arranque para que "Reintentar" lo repita. */
  cargar(): void {
    this.carga.cargar();
  }

  panelTransform(index: number): string {
    return `rotateY(${index * this.step()}deg) translateZ(${this.radius()}px)`;
  }

  isActive(index: number): boolean {
    return index === this.currentIndex();
  }

  /** Distancia angular mínima entre un panel y el que está al frente. */
  private angularDistance(index: number): number {
    const n = this.total();
    if (n === 0) return 0;
    const delta = Math.abs(index - this.currentIndex()) % n;
    return Math.min(delta, n - delta);
  }

  /** Los paneles que dan la espalda quedan como vidrio esmerilado, no compiten con el frente. */
  panelOpacity(index: number): number {
    const distance = this.angularDistance(index);
    if (distance === 0) return 1;
    return Math.max(0.08, 0.3 - (distance - 1) * 0.09);
  }

  next(): void {
    const length = this.total();
    if (length < 2) return;
    this.currentIndex.update((index) => (index + 1) % length);
  }

  prev(): void {
    const length = this.total();
    if (length < 2) return;
    this.currentIndex.update((index) => (index - 1 + length) % length);
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.total()) return;
    this.currentIndex.set(index);
  }

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].clientX;
  }

  onTouchEnd(event: TouchEvent): void {
    const deltaX = event.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0) {
      this.next();
    } else {
      this.prev();
    }
  }
}
