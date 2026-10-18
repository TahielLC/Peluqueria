import { Component, OnInit, inject, signal } from '@angular/core';
import { AppointmentService } from '../../services/appointment.service';
import { Servicio } from '../../models/appointment.model';

@Component({
  selector: 'app-servicios',
  standalone: true,
  template: `
    <section id="servicios" class="py-12 bg-gray-50 px-4">
      <div class="max-w-6xl mx-auto text-center">
        <h2 class="text-3xl font-bold mb-4 text-gray-800">Nuestros Servicios</h2>
        <p class="text-gray-600 mb-10">Precios claros, sin sorpresas. Elegí el tuyo.</p>

        @if (servicios().length === 0) {
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

  ngOnInit(): void {
    this.appointmentService.getServicios().subscribe((data) => {
      this.servicios.set(data);
    });
  }

  precio(valor: number): string {
    return `$${Number.isInteger(valor) ? valor : valor.toFixed(2)}`;
  }
}
