import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

/**
 * Cascarón del panel. Por ahora sólo prueba que la puerta funciona: que se llega
 * con sesión y que se puede salir. Las secciones de edición (textos, servicios,
 * equipo y galería) se construyen sobre esto en T6 a T10.
 */
@Component({
  selector: 'app-admin-panel',
  standalone: true,
  template: `
    <section class="min-h-screen bg-gray-100 px-4 py-10">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-center justify-between gap-4 mb-8">
          <h1 class="text-2xl font-bold text-gray-800">Panel de administración</h1>
          <button
            type="button"
            (click)="salir()"
            class="text-sm text-indigo-600 hover:underline whitespace-nowrap"
          >
            {{ mensajes.cerrarSesion }}
          </button>
        </div>

        <p class="text-gray-600">
          Sesión iniciada como <span class="font-medium text-gray-800">{{ correo() ?? '…' }}</span>.
        </p>

        <p class="text-gray-500 text-sm mt-6">
          Desde acá vas a poder editar los textos del sitio, los servicios y sus precios, el equipo
          y la galería de trabajos.
        </p>
      </div>
    </section>
  `,
})
export class AdminPanelComponent implements OnInit {
  private autenticacion = inject(AuthService);
  private router = inject(Router);

  readonly correo = signal<string | null>(null);

  readonly mensajes = { cerrarSesion: 'Cerrar sesión' } as const;

  ngOnInit(): void {
    this.cargarCorreo();
  }

  async salir(): Promise<void> {
    await this.autenticacion.cerrarSesion();
    await this.router.navigateByUrl('/admin/login');
  }

  private async cargarCorreo(): Promise<void> {
    this.correo.set(await this.autenticacion.correoDeLaSesion());
  }
}
