import { Injectable, inject } from '@angular/core';
import { SUPABASE } from './supabase.client';

/**
 * Por qué falló un intento de inicio de sesión, en términos que la pantalla
 * pueda traducir a un mensaje.
 */
export type MotivoDeFallo = 'credenciales' | 'correo_sin_confirmar' | 'desconocido';

export type ResultadoLogin = { ok: true } | { ok: false; motivo: MotivoDeFallo };

export interface Credenciales {
  correo: string;
  contrasena: string;
}

/**
 * Inicio y cierre de sesión de la administradora.
 *
 * Devuelve un **motivo** y no un mensaje ya escrito: clasificar el fallo es
 * tarea de acá, elegir las palabras es tarea de la pantalla. Si el texto viviera
 * en el servicio, cambiar una redacción obligaría a tocar la capa de datos.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private supabase = inject(SUPABASE);

  async iniciarSesion({ correo, contrasena }: Credenciales): Promise<ResultadoLogin> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    });

    if (!error) {
      return { ok: true };
    }

    return { ok: false, motivo: this.clasificar(error.message) };
  }

  /**
   * Si hay una sesión guardada.
   *
   * Lee la sesión local y no vuelve al servidor: alcanza para decidir una
   * navegación, porque la protección de verdad son las políticas RLS del lado
   * de Supabase, no este chequeo (ver S9). Un guard se saltea desde el navegador
   * en dos minutos; una política RLS, no.
   */
  async haySesion(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    return data.session !== null;
  }

  async correoDeLaSesion(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.user.email ?? null;
  }

  async cerrarSesion(): Promise<void> {
    await this.supabase.auth.signOut();
  }

  /** Traduce el mensaje en inglés de Supabase a un motivo clasificado. */
  private clasificar(mensaje: string): MotivoDeFallo {
    const texto = mensaje.toLowerCase();

    if (texto.includes('invalid login credentials')) {
      return 'credenciales';
    }
    if (texto.includes('email not confirmed')) {
      return 'correo_sin_confirmar';
    }

    return 'desconocido';
  }
}
