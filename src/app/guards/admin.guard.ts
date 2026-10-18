import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Deja pasar al panel sólo si hay sesión iniciada; si no, manda al login.
 *
 * Ojo con qué es y qué no es esto: es una **comodidad de navegación**, no la
 * seguridad. Cualquiera puede saltear un guard desde el navegador, o pedirle los
 * datos a la API directamente. Lo que de verdad impide leer lo inactivo o
 * escribir el contenido son las políticas RLS de Supabase, que viven en el
 * servidor y no dependen de este archivo (S9).
 *
 * Detalle de implementación: `inject()` tiene que correr **antes** del primer
 * `await`. El contexto de inyección se pierde al cruzar un `await`, así que
 * pedir el servicio después de esperar la sesión fallaría.
 */
export const adminGuard: CanActivateFn = async () => {
  const autenticacion = inject(AuthService);
  const router = inject(Router);

  let haySesion = false;
  try {
    haySesion = await autenticacion.haySesion();
  } catch {
    // Si ni siquiera se pudo averiguar, se trata como "no hay sesión": es más
    // seguro mandar al login que dejar pasar por un error de lectura.
    haySesion = false;
  }

  if (haySesion) {
    return true;
  }

  return router.createUrlTree(['/admin/login']);
};
