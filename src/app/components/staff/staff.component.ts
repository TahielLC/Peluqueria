import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentService } from '../../services/appointment.service';
import { Peluquero } from '../../models/appointment.model';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="staff" class="py-12 bg-gray-50 px-4">
      <div class="max-w-6xl mx-auto text-center">
        <h2 class="text-3xl font-bold mb-4 text-gray-800">Nuestro Equipo</h2>
        <p class="text-gray-600 mb-10">Profesionales apasionados por el cuidado de tu imagen.</p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          @for (peluquero of peluqueros; track peluquero.id) {
            <div class="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow text-left">
              <img [src]="peluquero.fotoUrl" [alt]="peluquero.nombre" class="w-full h-64 object-cover">
              <div class="p-6">
                <h3 class="text-xl font-semibold text-gray-800">{{ peluquero.nombre }}</h3>
                <p class="text-indigo-600 font-medium text-sm mt-1">{{ peluquero.rol }}</p>
                <p class="text-gray-500 text-sm mt-3">{{ peluquero.experiencia }}</p>
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `
})
export class StaffComponent implements OnInit {
  private appointmentService = inject(AppointmentService);
  peluqueros: Peluquero[] = [];

  ngOnInit(): void {
    this.appointmentService.getPeluqueros().subscribe(data => {
      this.peluqueros = data;
    });
  }
}
