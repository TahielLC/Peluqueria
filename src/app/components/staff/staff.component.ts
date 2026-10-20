import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Peluquero } from '../../models/appointment.model';
import { TextosSitioService } from '../../services/textos-sitio.service';
import { MENSAJES, CargaDeContenido } from '../estados';

const SWIPE_THRESHOLD = 50;

@Component({
  selector: 'app-staff',
  standalone: true,
  template: `
    <section id="staff" class="bg-arena px-5 py-20 md:py-28">
      <div class="mx-auto max-w-4xl">
        <div class="mx-auto max-w-2xl text-center">
          <span class="mx-auto block h-px w-12 bg-bronce/60" aria-hidden="true"></span>
          <h2 class="mt-6 font-display text-3xl font-light tracking-tight text-tinta sm:text-4xl">
            {{ textos.texto('staff_titulo') }}
          </h2>
          <p class="mt-4 text-base leading-relaxed text-humo">{{ textos.texto('staff_bajada') }}</p>
        </div>

        @if (cargando()) {
          <p class="py-16 text-center text-humo/70" role="status">{{ mensajes.cargando }}</p>
        } @else if (error()) {
          <div class="py-16 text-center">
            <p class="text-humo">{{ error() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-6 rounded-full bg-tinta px-6 py-2.5 text-sm font-medium text-crema transition-colors hover:bg-bronce-oscuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronce focus-visible:ring-offset-2 focus-visible:ring-offset-arena"
            >
              {{ mensajes.reintentar }}
            </button>
          </div>
        } @else if (total() === 0) {
          <p class="py-16 text-center text-humo/70">Todavía no hay profesionales cargados.</p>
        } @else {
          <div
            class="mt-14 select-none rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-bronce focus-visible:ring-offset-4 focus-visible:ring-offset-arena"
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
            <div class="overflow-hidden rounded-3xl border border-linea bg-white shadow-[0_28px_60px_-45px_rgba(34,28,24,0.6)]">
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
                      class="h-72 w-full object-cover sm:h-auto sm:w-2/5"
                    >

                    <div class="flex flex-1 flex-col justify-center p-7 sm:p-10">
                      <h3 class="font-display text-2xl leading-snug text-tinta sm:text-3xl">{{ peluquero.nombre }}</h3>
                      <p class="mt-2 text-[11px] font-medium uppercase tracking-[0.24em] text-bronce">
                        {{ peluquero.rol }}
                      </p>

                      <p class="mt-5 text-sm leading-relaxed text-humo">
                        {{ peluquero.experiencia }}
                      </p>

                      @if (peluquero.titulo) {
                        <p class="mt-6 border-t border-linea/70 pt-5 text-sm text-humo">
                          <span class="font-medium text-tinta">Título: </span>{{ peluquero.titulo }}
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
                  class="grid h-11 w-11 place-items-center rounded-full border border-linea bg-white text-tinta shadow-sm transition hover:border-bronce/40 hover:text-bronce-oscuro focus:outline-none focus-visible:ring-2 focus-visible:ring-bronce focus-visible:ring-offset-2 focus-visible:ring-offset-arena"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
                          ? 'h-1.5 w-8 rounded-full bg-bronce transition-all duration-500'
                          : 'h-1.5 w-1.5 rounded-full bg-tinta/20 transition-all duration-500 hover:bg-tinta/40'
                      "
                    ></button>
                  }
                </div>

                <button
                  type="button"
                  (click)="next()"
                  aria-label="Profesional siguiente"
                  class="grid h-11 w-11 place-items-center rounded-full border border-linea bg-white text-tinta shadow-sm transition hover:border-bronce/40 hover:text-bronce-oscuro focus:outline-none focus-visible:ring-2 focus-visible:ring-bronce focus-visible:ring-offset-2 focus-visible:ring-offset-arena"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <p class="mt-6 text-center text-xs text-humo/70">Deslizá o usá las teclas ← →</p>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class StaffComponent implements OnInit {
  private appointmentService = inject(AppointmentService);

  /** Los textos del sitio: los pide el home una sola vez y las secciones leen. */
  readonly textos = inject(TextosSitioService);

  readonly peluqueros = signal<Peluquero[]>([]);
  readonly currentIndex = signal(0);

  /** Las tres reglas de cargando / error / vacío viven una sola vez: `estados.ts`. */
  private readonly carga = new CargaDeContenido<Peluquero[]>(
    () => this.appointmentService.getPeluqueros(),
    (datos) => {
      this.peluqueros.set(datos);
      // Contenido nuevo, carrusel al principio: si no, quedaría parado en un
      // índice de la lista anterior que puede no existir.
      this.currentIndex.set(0);
    },
  );

  readonly cargando = this.carga.cargando;
  readonly error = this.carga.error;

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

  /** Pide los perfiles. Separado del arranque para que "Reintentar" lo repita. */
  cargar(): void {
    this.carga.cargar();
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
