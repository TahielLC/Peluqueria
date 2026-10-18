import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Peluquero } from '../../models/appointment.model';
import { MENSAJES } from '../estados';

const SWIPE_THRESHOLD = 50;

@Component({
  selector: 'app-staff',
  standalone: true,
  template: `
    <section id="staff" class="bg-gray-50 px-4 py-16">
      <div class="mx-auto max-w-4xl text-center">
        <h2 class="mb-3 text-3xl font-bold text-gray-800">Nuestro Equipo</h2>
        <p class="mb-10 text-gray-600">Profesionales apasionados por el cuidado de tu imagen.</p>

        @if (cargando()) {
          <p class="py-16 text-gray-400" role="status">{{ mensajes.cargando }}</p>
        } @else if (error()) {
          <div class="py-16">
            <p class="text-gray-600 mb-6">{{ error() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-full transition-colors"
            >
              {{ mensajes.reintentar }}
            </button>
          </div>
        } @else if (total() === 0) {
          <p class="py-16 text-gray-400">Todavía no hay profesionales cargados.</p>
        } @else {
          <div
            class="select-none rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            role="group"
            aria-roledescription="carrusel"
            aria-label="Profesionales del equipo"
            tabindex="0"
            (keydown.arrowleft)="prev()"
            (keydown.arrowright)="next()"
            (touchstart)="onTouchStart($event)"
            (touchend)="onTouchEnd($event)"
          >
            <!-- Ventana: un perfil por vez -->
            <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
              <div class="flex transition-transform duration-500 ease-out" [style.transform]="trackTransform()">
                @for (peluquero of peluqueros(); track peluquero.id; let i = $index) {
                  <article
                    class="flex w-full shrink-0 flex-col text-left sm:min-h-[340px] sm:flex-row"
                    [attr.aria-hidden]="!isActive(i)"
                  >
                    <img
                      [src]="peluquero.fotoUrl"
                      [alt]="peluquero.nombre"
                      draggable="false"
                      class="h-64 w-full object-cover sm:h-auto sm:w-2/5"
                    >

                    <div class="flex-1 p-6 sm:p-8">
                      <h3 class="text-xl font-semibold text-gray-800">{{ peluquero.nombre }}</h3>
                      <p class="mt-1 text-sm font-medium text-indigo-600">{{ peluquero.rol }}</p>

                      <p class="mt-4 text-sm leading-relaxed text-gray-600">
                        {{ peluquero.experiencia }}
                      </p>

                      @if (peluquero.titulo) {
                        <p class="mt-5 border-t border-gray-100 pt-5 text-sm text-gray-500">
                          <span class="font-medium text-gray-700">Título: </span>{{ peluquero.titulo }}
                        </p>
                      }
                    </div>
                  </article>
                }
              </div>
            </div>

            <!-- Controles -->
            @if (hasMultiple()) {
              <div class="mt-8 flex items-center justify-center gap-6">
                <button
                  type="button"
                  (click)="prev()"
                  aria-label="Profesional anterior"
                  class="grid h-11 w-11 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div class="flex items-center gap-2">
                  @for (peluquero of peluqueros(); track peluquero.id; let i = $index) {
                    <button
                      type="button"
                      (click)="goTo(i)"
                      [attr.aria-label]="'Ver el perfil ' + (i + 1)"
                      [attr.aria-current]="isActive(i)"
                      [class]="
                        isActive(i)
                          ? 'h-1.5 w-8 rounded-full bg-indigo-600 transition-all duration-500'
                          : 'h-1.5 w-1.5 rounded-full bg-gray-300 transition-all duration-500 hover:bg-gray-400'
                      "
                    ></button>
                  }
                </div>

                <button
                  type="button"
                  (click)="next()"
                  aria-label="Profesional siguiente"
                  class="grid h-11 w-11 place-items-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <p class="mt-6 text-xs text-gray-400">Deslizá o usá las teclas ← →</p>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class StaffComponent implements OnInit {
  private appointmentService = inject(AppointmentService);

  readonly peluqueros = signal<Peluquero[]>([]);
  readonly currentIndex = signal(0);

  /** Arranca en `true`: antes de que llegue la respuesta no se sabe si hay contenido. */
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly mensajes = MENSAJES;

  readonly total = computed(() => this.peluqueros().length);
  readonly hasMultiple = computed(() => this.total() > 1);

  /**
   * Cada perfil mide el 100% del ancho de la ventana, así que un paso es
   * exactamente -100%. El track es block-level, por lo que el porcentaje se
   * resuelve contra el ancho de la ventana y no contra el ancho del contenido.
   */
  readonly trackTransform = computed(() => `translateX(-${this.currentIndex() * 100}%)`);

  private touchStartX = 0;

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * Pide los perfiles. Está separado de `ngOnInit` para que el botón de
   * reintentar pueda volver a llamarlo sin recargar la página.
   *
   * Los tres estados (cargando / error / contenido) son excluyentes, y "no hay
   * contenido" y "no se pudo leer" llevan mensajes distintos porque son
   * situaciones distintas: una es un equipo sin cargar, la otra es un problema
   * para averiguarlo.
   */
  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.appointmentService.getPeluqueros().subscribe({
      next: (data) => {
        this.peluqueros.set(data);
        this.currentIndex.set(0);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(MENSAJES.errorAlCargar);
        this.cargando.set(false);
      },
    });
  }

  isActive(index: number): boolean {
    return index === this.currentIndex();
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
