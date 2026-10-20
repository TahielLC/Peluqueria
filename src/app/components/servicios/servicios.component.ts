import { Component, OnInit, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Servicio } from '../../models/appointment.model';
import { TextosSitioService } from '../../services/textos-sitio.service';
import { MENSAJES, CargaDeContenido } from '../estados';

@Component({
  selector: 'app-servicios',
  standalone: true,
  template: `
    <section id="servicios" class="bg-hueso px-5 py-20 text-noche md:py-28">
      <div class="mx-auto max-w-6xl">
        <div
          class="flex flex-col gap-5 border-t border-noche/15 pt-7 md:flex-row md:items-end md:justify-between"
        >
          <div>
            <p class="text-[10px] font-medium uppercase tracking-[0.3em] text-noche/50">01 — Servicios</p>
            <h2
              class="mt-3 font-display text-3xl font-semibold uppercase leading-[0.95] tracking-[-0.025em] text-noche sm:text-4xl md:text-5xl"
            >
              {{ textos.texto('servicios_titulo') }}
            </h2>
          </div>
          <p class="max-w-sm text-sm leading-relaxed text-noche/60 md:text-right">
            {{ textos.texto('servicios_bajada') }}
          </p>
        </div>

        @if (cargando()) {
          <p class="py-16 text-noche/50" role="status">{{ mensajes.cargando }}</p>
        } @else if (error()) {
          <div class="py-16">
            <p class="text-noche/70">{{ error() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="mt-6 rounded-full bg-noche px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-hueso transition-colors hover:bg-oro hover:text-noche focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-noche focus-visible:ring-offset-2 focus-visible:ring-offset-hueso"
            >
              {{ mensajes.reintentar }}
            </button>
          </div>
        } @else if (servicios().length === 0) {
          <p class="py-16 text-noche/50">Todavía no hay servicios cargados.</p>
        } @else {
          <div class="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            @for (servicio of servicios(); track servicio.id; let i = $index) {
              <article
                class="flex flex-col rounded-3xl border border-white/10 bg-noche p-7 text-left text-hueso transition duration-300 hover:-translate-y-1 hover:border-oro/50"
              >
                <span class="font-display text-xs tracking-[0.2em] text-oro">{{ indice(i) }}</span>
                <h3 class="mt-3 font-display text-2xl font-medium leading-snug tracking-[-0.01em]">
                  {{ servicio.nombre }}
                </h3>
                <p class="mt-3 flex-1 text-sm leading-relaxed text-humo">{{ servicio.descripcion }}</p>

                <div class="mt-7 flex items-end justify-between gap-4 border-t border-white/10 pt-5">
                  <span
                    class="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-humo"
                  >
                    {{ servicio.duracionMinutos }} min
                  </span>
                  <span class="font-display text-3xl leading-none text-hueso">{{ precio(servicio.precio) }}</span>
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
