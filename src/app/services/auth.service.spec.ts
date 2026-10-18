import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';
import { SUPABASE } from './supabase.client';

interface SesionFalsa {
  user: { email: string | null };
}

/**
 * Cliente de Supabase falso, limitado a lo que usa el servicio: `auth`.
 *
 * Registra con qué credenciales se intentó entrar —eso también es
 * comportamiento: hay que mandar el correo y la contraseña tal cual— y devuelve
 * lo que el test le indique. Sin esto, cada corrida de la suite le pegaría al
 * proyecto real y probaría el estado de la base en vez del código.
 */
function crearSupabaseFalso(opciones: {
  errorAlEntrar?: { message: string } | null;
  sesion?: SesionFalsa | null;
}) {
  const intentos: Array<{ email: string; password: string }> = [];
  let salidasDeSesion = 0;

  const cliente = {
    auth: {
      async signInWithPassword(credenciales: { email: string; password: string }) {
        intentos.push(credenciales);
        return { error: opciones.errorAlEntrar ?? null };
      },
      async getSession() {
        return { data: { session: opciones.sesion ?? null } };
      },
      async signOut() {
        salidasDeSesion += 1;
        return { error: null };
      },
    },
  };

  return {
    cliente: cliente as unknown as SupabaseClient,
    intentos,
    /** Cuántas veces se cerró sesión. */
    salidas: () => salidasDeSesion,
  };
}

describe('AuthService', () => {
  function armar(opciones: Parameters<typeof crearSupabaseFalso>[0] = {}) {
    const falso = crearSupabaseFalso(opciones);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE, useValue: falso.cliente }],
    });

    return { service: TestBed.inject(AuthService), ...falso };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('iniciarSesion', () => {
    it('manda el correo y la contraseña a Supabase y reporta ok', async () => {
      const { service, intentos } = armar();

      const resultado = await service.iniciarSesion({
        correo: 'admin@salon.test',
        contrasena: 'secreta',
      });

      expect(resultado).toEqual({ ok: true });
      expect(intentos).toEqual([{ email: 'admin@salon.test', password: 'secreta' }]);
    });

    it('con credenciales inválidas devuelve el motivo "credenciales"', async () => {
      const { service } = armar({ errorAlEntrar: { message: 'Invalid login credentials' } });

      const resultado = await service.iniciarSesion({ correo: 'a@b.test', contrasena: 'mala' });

      expect(resultado).toEqual({ ok: false, motivo: 'credenciales' });
    });

    it('con el correo sin confirmar devuelve el motivo "correo_sin_confirmar"', async () => {
      const { service } = armar({ errorAlEntrar: { message: 'Email not confirmed' } });

      const resultado = await service.iniciarSesion({ correo: 'a@b.test', contrasena: 'x' });

      expect(resultado).toEqual({ ok: false, motivo: 'correo_sin_confirmar' });
    });

    it('un error desconocido cae en "desconocido" y no se filtra crudo', async () => {
      const { service } = armar({ errorAlEntrar: { message: 'fetch failed: ECONNREFUSED 5432' } });

      const resultado = await service.iniciarSesion({ correo: 'a@b.test', contrasena: 'x' });

      // El mensaje técnico no sale del servicio: hacia afuera viaja sólo el motivo.
      expect(resultado).toEqual({ ok: false, motivo: 'desconocido' });
      expect(JSON.stringify(resultado)).not.toContain('ECONNREFUSED');
    });
  });

  describe('haySesion', () => {
    it('es true cuando hay sesión guardada', async () => {
      const { service } = armar({ sesion: { user: { email: 'admin@salon.test' } } });

      await expect(service.haySesion()).resolves.toBe(true);
    });

    it('es false cuando no hay sesión', async () => {
      const { service } = armar({ sesion: null });

      await expect(service.haySesion()).resolves.toBe(false);
    });
  });

  describe('correoDeLaSesion', () => {
    it('devuelve el correo de la sesión', async () => {
      const { service } = armar({ sesion: { user: { email: 'admin@salon.test' } } });

      await expect(service.correoDeLaSesion()).resolves.toBe('admin@salon.test');
    });

    it('devuelve null si no hay sesión', async () => {
      const { service } = armar({ sesion: null });

      await expect(service.correoDeLaSesion()).resolves.toBeNull();
    });
  });

  describe('cerrarSesion', () => {
    it('le pide a Supabase que cierre la sesión', async () => {
      const { service, salidas } = armar();

      await service.cerrarSesion();

      expect(salidas()).toBe(1);
    });
  });
});
