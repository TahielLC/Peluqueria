import { Component, OnInit, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Servicio } from '../../models/appointment.model';
import { MENSAJES, CargaDeContenido } from '../estados';

@Component({
  selector: 'app-servicios',
  standalone: true,
  template: `
    <section id="servicios" class="py-12 bg-gray-50 px-4">
      <div class="max-w-6xl mx-auto text-center">
        <h2 class="text-3xl font-bold mb-4 text-gray-800">Nuestros Servicios</h2>
        <p class="text-gray-600 mb-10">Precios claros, sin sorpresas. Elegí el tuyo.</p>

        @if (cargando()) {
          <p class="text-gray-400 py-12" role="status">{{ mensajes.cargando }}</p>
        } @else if (error()) {
          <div class="py-12">
            <p class="text-gray-600 mb-6">{{ error() }}</p>
            <button
              type="button"
              (click)="cargar()"
              class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-full transition-colors"
            >
              {{ mensajes.reintentar }}
            </button>
          </div>
        } @else if (servicios().length === 0) {
          <p class="text-gray-400 py-12">Todavía no hay servicios cargados.</p>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            @for (servicio of servicios(); track servicio.id) {
              <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow text-left flex flex-col">
                <div class="p-6 flex flex-col flex-1">
                  <h3 class="text-xl font-semibold text-gray-800">{{ servicio.nombre }}</h3>
                  <p class="text-gray-500 text-sm mt-3 flex-1">{{ servicio.descripcion }}</p>
                  <div class="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                    <span class="text-indigo-600 font-medium text-sm">{{ servicio.duracionMinutos }} min</span>
                    <span class="text-2xl font-bold text-gray-800">{{ precio(servicio.precio) }}</span>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class ServiciosComponent implements OnInit {
  private appointmentService = inject(AppointmentService);

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
}
