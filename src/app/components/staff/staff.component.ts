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
    <section id="staff" class="bg-carbon px-5 py-20 md:py-28">
      <div class="mx-auto max-w-6xl">
        <div
          class="flex flex-col gap-5 border-t border-borde pt-7 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <p class="text-[10px] font-medium uppercase tracking-[0.3em] text-oro">03 — Equipo</p>
            <h2
              class="mt-3 font-display text-3xl font-semibold uppercase leading-[0.95] tracking-[-0.025em] text-hueso sm:text-4xl md:text-5xl"
            >
              {{ textos.texto('staff_titulo') }}
            </h2>
          </div>
          <p class="max-w-sm text-sm leading-relaxed text-humo md:text-right">
            {{ textos.texto('staff_bajada') }}
          </p>
        </div>

        @if (cargando()) {
          <p class="py-16 text-humo" role="status">{{ mensajes.cargando }}</p>
        } @else if (error()) {
          <div class="py-16">
            <p class="text-humo">{{ error() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-6 rounded-full bg-hueso px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-noche transition-colors hover:bg-oro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-carbon"
            >
              {{ mensajes.reintentar }}
            </button>
          </div>
        } @else if (total() === 0) {
          <p class="py-16 text-humo">Todavía no hay profesionales cargados.</p>
        } @else {
          <div
            class="mt-12 select-none rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-4 focus-visible:ring-offset-carbon"
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
            <div class="overflow-hidden rounded-3xl border border-borde bg-noche">
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
                      class="h-80 w-full object-cover sm:h-auto sm:w-2/5"
                    >

                    <div class="flex flex-1 flex-col justify-center p-7 sm:p-10">
                      <h3 class="font-display text-2xl font-medium uppercase tracking-[-0.01em] text-hueso sm:text-3xl">{{ peluquero.nombre }}</h3>
                      <p class="mt-2 text-[10px] font-medium uppercase tracking-[0.24em] text-oro">
                        {{ peluquero.rol }}
                      </p>

                      <p class="mt-5 text-sm leading-relaxed text-humo">
                        {{ peluquero.experiencia }}
                      </p>

                      @if (peluquero.titulo) {
                        <p class="mt-6 border-t border-borde pt-5 text-sm text-humo">
                          <span class="font-medium text-hueso">Título: </span>{{ peluquero.titulo }}
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
                  class="grid h-11 w-11 place-items-center rounded-full border border-borde bg-noche text-hueso transition hover:border-oro/50 hover:text-oro focus:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-carbon"
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
                          ? 'h-1.5 w-8 rounded-full bg-oro transition-all duration-500'
                          : 'h-1.5 w-1.5 rounded-full bg-hueso/20 transition-all duration-500 hover:bg-hueso/40'
                      "
                    ></button>
                  }
                </div>

                <button
                  type="button"
                  (click)="next()"
                  aria-label="Profesional siguiente"
                  class="grid h-11 w-11 place-items-center rounded-full border border-borde bg-noche text-hueso transition hover:border-oro/50 hover:text-oro focus:outline-none focus-visible:ring-2 focus-visible:ring-oro focus-visible:ring-offset-2 focus-visible:ring-offset-carbon"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <p class="mt-6 text-center text-[10px] uppercase tracking-[0.2em] text-humo/70">Deslizá o usá las teclas ← →</p>
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
