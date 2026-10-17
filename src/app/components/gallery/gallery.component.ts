import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentService } from '../../services/appointment.service';
import { TrabajoGaleria } from '../../models/salon.model';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="galeria" class="py-12 px-4 max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-4 text-gray-800">Galería de Trabajos</h2>
      <p class="text-gray-600 text-center mb-10">Echale un vistazo a nuestros últimos cortes y estilos.</p>

      @if (total() === 0) {
        <p class="text-center text-gray-400 py-16">Todavía no hay trabajos para mostrar.</p>
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
          <div class="overflow-hidden rounded-2xl shadow-xl bg-slate-900">
            <div
              class="flex transition-transform duration-500 ease-out"
              [style.transform]="'translateX(-' + currentIndex() * 100 + '%)'"
            >
              @for (item of galeria(); track item.id) {
                <figure class="w-full shrink-0 relative m-0">
                  <img
                    [src]="item.imagenUrl"
                    [alt]="item.titulo"
                    draggable="false"
                    class="w-full h-[360px] sm:h-[440px] md:h-[520px] object-cover"
                  />
                  <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent"></div>
                  <figcaption class="absolute bottom-0 left-0 p-6 md:p-8 text-white">
                    <span class="text-xs uppercase tracking-wider bg-indigo-600 px-2 py-1 rounded w-max mb-2 inline-block">
                      {{ item.categoria }}
                    </span>
                    <h3 class="text-xl md:text-2xl font-semibold">{{ item.titulo }}</h3>
                  </figcaption>
                </figure>
              }
            </div>
          </div>

          @if (hasMultiple()) {
            <button
              type="button"
              (click)="prev()"
              aria-label="Trabajo anterior"
              class="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 rounded-full bg-white/80 hover:bg-white text-slate-900 shadow-lg backdrop-blur transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              (click)="next()"
              aria-label="Trabajo siguiente"
              class="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-11 h-11 rounded-full bg-white/80 hover:bg-white text-slate-900 shadow-lg backdrop-blur transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          }
        </div>

        @if (hasMultiple()) {
          <div class="flex justify-center items-center gap-2 mt-6">
            @for (item of galeria(); track item.id; let i = $index) {
              <button
                type="button"
                (click)="goTo(i)"
                [attr.aria-label]="'Ir al trabajo ' + (i + 1)"
                [attr.aria-current]="currentIndex() === i"
                [class]="
                  currentIndex() === i
                    ? 'h-2 w-8 rounded-full bg-indigo-600 transition-all'
                    : 'h-2 w-2 rounded-full bg-slate-300 hover:bg-slate-400 transition-all'
                "
              ></button>
            }
          </div>
        }
      }
    </section>
  `,
})
export class GalleryComponent implements OnInit {
  private appointmentService = inject(AppointmentService);

  readonly galeria = signal<TrabajoGaleria[]>([]);
  readonly currentIndex = signal(0);

  readonly total = computed(() => this.galeria().length);
  readonly hasMultiple = computed(() => this.total() > 1);

  private readonly SWIPE_THRESHOLD = 50;
  private touchStartX = 0;

  ngOnInit(): void {
    this.appointmentService.getGaleria().subscribe((data) => {
      this.galeria.set(data);
      this.currentIndex.set(0);
    });
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
    if (Math.abs(deltaX) < this.SWIPE_THRESHOLD) return;
    if (deltaX < 0) {
      this.next();
    } else {
      this.prev();
    }
  }
}
