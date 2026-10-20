import { Component, OnInit, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Servicio } from '../../models/appointment.model';
import { TextosSitioService } from '../../services/textos-sitio.service';
import { MENSAJES, CargaDeContenido } from '../estados';

@Component({
  selector: 'app-servicios',
  standalone: true,
  template: `
    <section id="servicios" class="bg-crema px-5 py-20 md:py-28">
      <div class="mx-auto max-w-6xl">
        <div class="mx-auto max-w-2xl text-center">
          <span class="mx-auto block h-px w-12 bg-bronce/60" aria-hidden="true"></span>
          <h2 class="mt-6 font-display text-3xl font-light tracking-tight text-tinta sm:text-4xl">
            {{ textos.texto('servicios_titulo') }}
          </h2>
          <p class="mt-4 text-base leading-relaxed text-humo">{{ textos.texto('servicios_bajada') }}</p>
        </div>

        @if (cargando()) {
          <p class="py-16 text-center text-humo/70" role="status">{{ mensajes.cargando }}</p>
        } @else if (error()) {
          <div class="py-16 text-center">
            <p class="text-humo">{{ error() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-6 rounded-full bg-tinta px-6 py-2.5 text-sm font-medium text-crema transition-colors hover:bg-bronce-oscuro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronce focus-visible:ring-offset-2"
            >
              {{ mensajes.reintentar }}
            </button>
          </div>
        } @else if (servicios().length === 0) {
          <p class="py-16 text-center text-humo/70">Todavía no hay servicios cargados.</p>
        } @else {
          <div class="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            @for (servicio of servicios(); track servicio.id; let i = $index) {
              <article
                class="flex flex-col rounded-3xl border border-linea bg-white p-7 text-left transition duration-300 hover:-translate-y-1 hover:border-bronce/40 hover:shadow-[0_24px_45px_-30px_rgba(34,28,24,0.5)]"
              >
                <span class="font-display text-sm tracking-[0.2em] text-bronce/70">{{ indice(i) }}</span>
                <h3 class="mt-3 font-display text-2xl leading-snug text-tinta">{{ servicio.nombre }}</h3>
                <p class="mt-3 flex-1 text-sm leading-relaxed text-humo">{{ servicio.descripcion }}</p>

                <div class="mt-7 flex items-end justify-between gap-4 border-t border-linea/70 pt-5">
                  <span
                    class="rounded-full bg-arena px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-humo"
                  >
                    {{ servicio.duracionMinutos }} min
                  </span>
                  <span class="font-display text-3xl leading-none text-tinta">{{ precio(servicio.precio) }}</span>
                </div>
              </article>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class ServiciosComponent implements OnInit {
  private appointmentService = inject(AppointmentService);

  /** Los textos del sitio: los pide el home una sola vez y las secciones leen. */
  readonly textos = inject(TextosSitioService);

  readonly servicios = signal<Servicio[]>([]);

  /**
   * Las tres reglas de cargando / error / vacío viven una sola vez, en
   * `estados.ts`, y son las mismas para las tres secciones del sitio.
   */
  private readonly carga = new CargaDeContenido<Servicio[]>(
    () => this.appointmentService.getServicios(),
    (datos) => this.servicios.set(datos),
  );

  readonly cargando = this.carga.cargando;
  readonly error = this.carga.error;

  readonly mensajes = MENSAJES;

  ngOnInit(): void {
    this.cargar();
  }

  /** Pide los servicios. Separado del arranque para que "Reintentar" lo repita. */
  cargar(): void {
    this.carga.cargar();
  }

  precio(valor: number): string {
    return `$${Number.isInteger(valor) ? valor : valor.toFixed(2)}`;
  }

  /** El número editorial de cada tarjeta: "01", "02", "03". */
  indice(posicion: number): string {
    return String(posicion + 1).padStart(2, '0');
  }
}
