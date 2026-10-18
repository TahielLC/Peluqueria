import { Component, OnInit, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Servicio } from '../../models/appointment.model';
import { MENSAJES } from '../estados';

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
   * Arranca en `true` a propósito. Los datos vienen por red, así que antes de
   * que llegue la respuesta no se sabe si hay contenido o no: mostrar el estado
   * vacío en ese momento afirmaría "no hay nada" cuando todavía no se preguntó.
   */
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly mensajes = MENSAJES;

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * Pide los servicios. Está separado de `ngOnInit` para que el botón de
   * reintentar pueda volver a llamarlo sin recargar la página.
   *
   * Sobre los tres estados: "no hay contenido" y "no se pudo leer" son
   * situaciones distintas y llevan mensajes distintos. Confundirlas haría que
   * un problema de red se viera como un salón sin servicios cargados.
   */
  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.appointmentService.getServicios().subscribe({
      next: (data) => {
        this.servicios.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(MENSAJES.errorAlCargar);
        this.cargando.set(false);
      },
    });
  }

  precio(valor: number): string {
    return `$${Number.isInteger(valor) ? valor : valor.toFixed(2)}`;
  }
}
