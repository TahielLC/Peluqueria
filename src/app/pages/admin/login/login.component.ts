import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, MotivoDeFallo, ResultadoLogin } from '../../../services/auth.service';

/** Textos de la pantalla de ingreso. */
const MENSAJES = {
  titulo: 'Panel de administración',
  instruccion: 'Ingresá con el correo y la contraseña de la cuenta del salón.',
  correo: 'Correo electrónico',
  contrasena: 'Contraseña',
  entrar: 'Entrar',
  entrando: 'Entrando…',
} as const;

/**
 * Qué se le dice a la administradora según por qué falló el ingreso.
 *
 * Nada de esto repite el mensaje técnico de Supabase (que viene en inglés y
 * habla de "credentials"): son mensajes para alguien que no sabe qué es una API.
 */
const FALLOS: Record<MotivoDeFallo, string> = {
  credenciales: 'El correo o la contraseña no son correctos. Fijate que no haya un espacio de más.',
  correo_sin_confirmar: 'Falta confirmar ese correo. Revisá la casilla de entrada.',
  desconocido: 'No pudimos iniciar sesión. Revisá tu conexión e intentá de nuevo.',
};

/**
 * Pantalla de ingreso al panel.
 *
 * Nota de diseño: **no usa `@angular/forms`**. El proyecto no tiene esa
 * dependencia y dos campos de texto no justifican agregarla, así que se usan
 * inputs nativos con señales. Los atributos `type` y `required` siguen ahí: la
 * validación del navegador actúa igual, sin código de por medio.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <section class="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div class="w-full max-w-sm bg-white rounded-xl shadow-md p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-2">{{ mensajes.titulo }}</h1>
        <p class="text-gray-600 text-sm mb-8">{{ mensajes.instruccion }}</p>

        <form (submit)="enviar($event)" class="space-y-5">
          <div>
            <label for="correo" class="block text-sm font-medium text-gray-700 mb-1">
              {{ mensajes.correo }}
            </label>
            <input
              id="correo"
              type="email"
              autocomplete="username"
              required
              [value]="correo()"
              (input)="escribirCorreo($event)"
              class="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label for="contrasena" class="block text-sm font-medium text-gray-700 mb-1">
              {{ mensajes.contrasena }}
            </label>
            <input
              id="contrasena"
              type="password"
              autocomplete="current-password"
              required
              [value]="contrasena()"
              (input)="escribirContrasena($event)"
              class="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-800 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          @if (error()) {
            <p class="text-sm text-red-600" role="alert">{{ error() }}</p>
          }

          <button
            type="submit"
            [disabled]="cargando()"
            class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg transition-colors"
          >
            {{ cargando() ? mensajes.entrando : mensajes.entrar }}
          </button>
        </form>
      </div>
    </section>
  `,
})
export class LoginComponent {
  private autenticacion = inject(AuthService);
  private router = inject(Router);

  readonly correo = signal('');
  readonly contrasena = signal('');

  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensajes = MENSAJES;

  escribirCorreo(evento: Event): void {
    this.correo.set((evento.target as HTMLInputElement).value);
  }

  escribirContrasena(evento: Event): void {
    this.contrasena.set((evento.target as HTMLInputElement).value);
  }

  /** Handler del formulario. Separado de `entrar()` para poder probar la lógica sola. */
  enviar(evento: Event): void {
    evento.preventDefault();
    void this.entrar();
  }

  async entrar(): Promise<void> {
    // Evita que un doble clic dispare dos intentos.
    if (this.cargando()) return;

    this.cargando.set(true);
    this.error.set(null);

    let resultado: ResultadoLogin;
    try {
      resultado = await this.autenticacion.iniciarSesion({
        correo: this.correo().trim(),
        contrasena: this.contrasena(),
      });
    } catch {
      // Una excepción antes de llegar a Supabase no puede dejar la pantalla
      // girando para siempre con el botón deshabilitado: para alguien que no
      // sabe de apps, eso es un callejón sin salida del que no sabe salir.
      this.cargando.set(false);
      this.error.set(FALLOS.desconocido);
      return;
    }

    this.cargando.set(false);

    if (resultado.ok) {
      this.contrasena.set('');
      await this.router.navigateByUrl('/admin');
      return;
    }

    this.error.set(FALLOS[resultado.motivo]);
  }
}
