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
    // `!= null` y no `!== null` a propósito: si la respuesta llegara sin el
    // campo `session`, `data.session !== null` daría **true** y dejaría pasar a
    // alguien sin sesión. En un chequeo de acceso el error tiene que caer del
    // lado cerrado (lo encontró la verificación independiente de T5).
    return data.session != null;
  }

  async correoDeLaSesion(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.user.email ?? null;
  }

  /**
   * Cierra la sesión.
   *
   * Dos cosas que no son obvias y que hacen que este método NO sea un `await` y
   * listo:
   *
   *   1. `signOut()` **no lanza** cuando falla la red: devuelve `{ error }`. Un
   *      `try/catch` solo no lo cubre, hay que mirar el error devuelto.
   *   2. El `try/catch` igual hace falta, por otro camino: `signOut()` arranca
   *      con un `await initializePromise`, así que si el cliente no llegó a
   *      inicializar, la promesa **rechaza**.
   *
   * Devuelve `true` sólo si la sesión se cerró de verdad.
   *
   * **Y devuelve un booleano y no el motivo del fallo, a propósito.** Hasta la
   * revisión esto devolvía un resultado clasificado (`sin_conexion` /
   * `desconocido`)… que no miraba nadie: el panel mostraba la misma frase para
   * cualquier causa. Un dato que nadie consume es peor que no tenerlo, porque
   * parece información y encima se pudre. Lo que sí cambia la conducta es otra
   * cosa, y no la decide este método: si la sesión **local** sobrevivió. Eso lo
   * pregunta `AdminPanelComponent.salir`, que es donde está la decisión.
   */
  async cerrarSesion(): Promise<boolean> {
    try {
      const { error } = await this.supabase.auth.signOut();

      return !error;
    } catch {
      return false;
    }
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
