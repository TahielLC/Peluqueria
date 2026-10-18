import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

/** AuthService falso: el guard sólo necesita saber si hay sesión. */
function crearAutenticacionFalsa(respuesta: () => Promise<boolean>) {
  let consultas = 0;

  return {
    service: {
      async haySesion() {
        consultas += 1;
        return respuesta();
      },
    },
    consultas: () => consultas,
  };
}

describe('adminGuard', () => {
  function armar(haySesion: boolean | (() => Promise<boolean>)) {
    const respuesta = typeof haySesion === 'function' ? haySesion : async () => haySesion;
    const falsa = crearAutenticacionFalsa(respuesta);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: falsa.service }, provideRouter([])],
    });

    return falsa;
  }

  async function ejecutar(): Promise<boolean | UrlTree> {
    const resultado = await TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    return resultado as boolean | UrlTree;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('deja pasar cuando hay sesión', async () => {
    armar(true);

    await expect(ejecutar()).resolves.toBe(true);
  });

  it('sin sesión devuelve un desvío al login, no un rechazo seco', async () => {
    armar(false);

    const resultado = await ejecutar();

    // Un UrlTree es un desvío: la persona termina en el login en vez de quedarse
    // en una pantalla en blanco sin entender qué pasó.
    expect(resultado).toBeInstanceOf(UrlTree);
    expect(String(resultado)).toBe('/admin/login');
  });

  it('consulta la sesión una sola vez por intento', async () => {
    const falsa = armar(true);

    await ejecutar();

    expect(falsa.consultas()).toBe(1);
  });

  it('si leer la sesión falla, lo trata como "sin sesión"', async () => {
    armar(async () => {
      throw new Error('storage roto');
    });

    const resultado = await ejecutar();

    // Fail closed: ante la duda, mejor mandar al login que dejar pasar.
    expect(String(resultado)).toBe('/admin/login');
  });
});
