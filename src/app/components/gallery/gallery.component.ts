import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { TrabajoGaleria } from '../../models/salon.model';
import { MENSAJES } from '../estados';

const PANEL_WIDTH = 340;
const PANEL_HEIGHT = 430;
const SWIPE_THRESHOLD = 50;
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const DURATION = '900ms';

@Component({
  selector: 'app-gallery',
  standalone: true,
  template: `
    <section id="galeria" class="relative bg-black py-16 overflow-hidden">
      <!-- Halo indigo que simula la luz cayendo sobre la puerta -->
      <div
        class="pointer-events-none absolute inset-0"
        style="background: radial-gradient(55% 55% at 50% 42%, rgba(79,70,229,0.38) 0%, rgba(0,0,0,0) 72%)"
      ></div>
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style="background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0) 100%)"
      ></div>

      <div class="relative max-w-6xl mx-auto px-4">
        <h2 class="text-3xl md:text-4xl font-bold text-center mb-3 text-white tracking-tight">
          Galería de Trabajos
        </h2>
        <p class="text-gray-400 text-center mb-12">
          Echale un vistazo a nuestros últimos cortes y estilos.
        </p>

        @if (cargando()) {
          <p class="text-center text-gray-400 py-24" role="status">{{ mensajes.cargando }}</p>
        } @else if (error()) {
          <div class="py-24 text-center">
            <p class="text-gray-400 mb-6">{{ error() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-full transition-colors"
            >
              {{ mensajes.reintentar }}
            </button>
          </div>
        } @else if (total() === 0) {
          <p class="text-center text-gray-600 py-24">Todavía no hay trabajos para mostrar.</p>
        } @else {
          <div
            class="relative select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-2xl"
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
              class="pointer-events-none absolute left-1/2 top-1/2 h-56 w-[620px] -translate-x-1/2 translate-y-40 rounded-[50%] bg-indigo-600/25 blur-3xl"
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
                      <span class="text-xs uppercase tracking-widest text-indigo-300 mb-2 inline-block">
                        {{ item.categoria }}
                      </span>
                      <h3 class="text-2xl font-semibold text-white">{{ item.titulo }}</h3>
                    </figcaption>
                  </figure>
                }
              </div>
            </div>

            <!-- CONTROLES -->
            <div
              class="relative flex items-center justify-center gap-6 -mt-6"
            >
              @if (hasMultiple()) {
                <button
                  type="button"
                  (click)="prev()"
                  aria-label="Trabajo anterior"
                  class="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
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
                          ? 'h-1.5 w-8 rounded-full bg-indigo-500 transition-all duration-500'
                          : 'h-1.5 w-1.5 rounded-full bg-white/25 hover:bg-white/50 transition-all duration-500'
                      "
                    ></button>
                  }
                </div>

                <button
                  type="button"
                  (click)="next()"
                  aria-label="Trabajo siguiente"
                  class="grid h-12 w-12 place-items-center rounded-full border border-white/15 bg-white/5 text-white backdrop-blur-md transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              }
            </div>

            <p class="text-center text-gray-600 text-xs mt-6">
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

  readonly panelWidth = PANEL_WIDTH;
  readonly panelHeight = PANEL_HEIGHT;
  readonly duration = DURATION;
  readonly easing = EASING;
  readonly perspective = 1200;

  readonly galeria = signal<TrabajoGaleria[]>([]);
  readonly currentIndex = signal(0);

  /** Arranca en `true`: antes de que llegue la respuesta no se sabe si hay contenido. */
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

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

  /**
   * Pide los trabajos. Está separado de `ngOnInit` para que el botón de
   * reintentar pueda volver a llamarlo sin recargar la página.
   *
   * Los tres estados (cargando / error / contenido) son excluyentes, y "no hay
   * contenido" y "no se pudo leer" llevan mensajes distintos porque son
   * situaciones distintas: una es un salón sin trabajos cargados, la otra es un
   * problema para averiguarlo.
   */
  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.appointmentService.getGaleria().subscribe({
      next: (data) => {
        this.galeria.set(data);
        this.currentIndex.set(0);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(MENSAJES.errorAlCargar);
        this.cargando.set(false);
      },
    });
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
