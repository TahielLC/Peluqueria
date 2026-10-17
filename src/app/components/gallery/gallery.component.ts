import { Component, OnInit, inject } from '@angular/core';
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

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        @for (item of galeria; track item.id) {
          <div class="relative group overflow-hidden rounded-lg shadow-md">
            <img [src]="item.imagenUrl" [alt]="item.titulo" class="w-full h-72 object-cover group-hover:scale-105 transition-transform duration-300">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 text-white">
              <span class="text-xs uppercase tracking-wider bg-indigo-600 px-2 py-1 rounded w-max mb-1">{{ item.categoria }}</span>
              <h3 class="text-lg font-semibold">{{ item.titulo }}</h3>
            </div>
          </div>
        }
      </div>
    </section>
  `
})
export class GalleryComponent implements OnInit {
  private appointmentService = inject(AppointmentService);
  galeria: TrabajoGaleria[] = [];

  ngOnInit(): void {
    this.appointmentService.getGaleria().subscribe(data => {
      this.galeria = data;
    });
  }
}
