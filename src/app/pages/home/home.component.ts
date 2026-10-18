import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { StaffComponent } from "../../components/staff/staff.component";
import { GalleryComponent } from "../../components/gallery/gallery.component";
import { ServiciosComponent } from "../../components/servicios/servicios.component";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [CommonModule, StaffComponent, GalleryComponent, ServiciosComponent],
  template: `
    <header class="bg-slate-900 text-white py-24 px-4 text-center">
      <div class="max-w-3xl mx-auto">
        <span
          class="text-indigo-400 font-semibold tracking-wide uppercase text-sm"
          >Estilo & Vanguardia</span
        >
        <h1 class="text-4xl md:text-6xl font-extrabold mt-2 mb-6">
          Peluquería Estilo & Arte
        </h1>
        <p class="text-gray-300 text-lg mb-8">
          El lugar donde tu imagen se transforma con las últimas tendencias en
          cortes, barbas y estilismo.
        </p>
        <a
          href="#galeria"
          class="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-8 py-3 rounded-full transition-colors shadow-lg inline-block"
        >
          Ver Trabajos
        </a>
      </div>
    </header>

    <app-servicios></app-servicios>
    <app-gallery></app-gallery>
    <app-staff></app-staff>
  `,
})
export class HomeComponent {}
