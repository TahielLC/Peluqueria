import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../app.routes';
import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';
import { SUPABASE } from '../services/supabase.client';

/**
 * La puerta del panel, probada sobre la **configuración real de rutas**.
 *
 * Por qué existe este archivo y no alcanzaba con `admin.guard.spec.ts`: allá el
 * guard se ejecuta solo y se mira el `UrlTree` que devuelve. Eso prueba la
 * lógica del guard, pero **no** que `app.routes.ts` lo tenga efectivamente
 * enganchado a `admin`. Si alguien borrara el `canActivate` de la ruta, ese test
 * seguiría verde y el panel quedaría abierto. Acá se navega de verdad, con el
 * router real, y se mira dónde termina la persona.
 */

/** Consulta encadenable y "thenable", lo mínimo para que el sitio público renderice. */
interface ConsultaFalsa {
  select: () => ConsultaFalsa;
  eq: () => ConsultaFalsa;
  order: () => ConsultaFalsa;
  then: (resolver: (valor: { data: unknown[]; error: null }) => unknown) => Promise<unknown>;
}

function crearClienteFalso() {
  const cadena = {} as ConsultaFalsa;
  cadena.select = () => cadena;
  cadena.eq = () => cadena;
  cadena.order = () => cadena;
  cadena.then = (resolver) => Promise.resolve({ data: [], error: null }).then(resolver);

  return {
    auth: {
      signInWithPassword: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null } }),
      signOut: async () => ({ error: null }),
    },
    from: () => cadena,
  };
}

describe('S3 — la puerta del panel, con la configuración real de rutas', () => {
  /** Navega y devuelve dónde terminó la persona y qué está viendo. */
  async function navegar(url: string, haySesion: boolean) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: SUPABASE, useValue: crearClienteFalso() },
        {
          provide: AuthService,
          useValue: {
            haySesion: async () => haySesion,
            correoDeLaSesion: async () => 'admin@salon.test',
            cerrarSesion: async () => undefined,
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    // El guard es asíncrono: hay que dejarlo resolver antes de mirar la pantalla.
    await new Promise((r) => setTimeout(r, 0));

    return {
      url: router.url,
      texto: (harness.routeNativeElement?.textContent ?? '').replace(/\s+/g, ' '),
    };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('sin sesión, /admin desvía al ingreso en vez de dejar la pantalla vacía', async () => {
    const { url, texto } = await navegar('/admin', false);

    expect(url).toBe('/admin/login');
    expect(texto).toContain('Correo electrónico');
  });

  it('con sesión, /admin entra al panel', async () => {
    const { url, texto } = await navegar('/admin', true);

    expect(url).toBe('/admin');
    expect(texto).toContain('Panel de administración');
    expect(texto).toContain('Cerrar sesión');
  });

  it('/admin/login se alcanza sin sesión: es la puerta, no el panel', async () => {
    const { url, texto } = await navegar('/admin/login', false);

    expect(url).toBe('/admin/login');
    expect(texto).toContain('Entrar');
    // El panel no comparte layout con el sitio público (S2).
    expect(texto).not.toContain('Peluquería Estilo & Arte');
  });

  it('una subruta inexistente de /admin no queda atrapada adentro del panel', async () => {
    const { url } = await navegar('/admin/loquesea', false);

    expect(url).toBe('/');
  });

  it('sólo /admin está guardada; /admin/login no lo está', () => {
    const rutaDelPanel = routes.find((r) => r.path === 'admin');
    const rutaDelIngreso = routes.find((r) => r.path === 'admin/login');

    // Esta línea no es decorativa: `expect(undefined).toContain(x)` **pasa en
    // silencio** en Vitest 5 (comprobado con una sonda). Sin el chequeo explícito
    // de que `canActivate` sea un array, la aserción de abajo no probaría nada y
    // pasaría incluso con el panel completamente abierto.
    expect(Array.isArray(rutaDelPanel?.canActivate)).toBe(true);
    expect(rutaDelPanel?.canActivate).toContain(adminGuard);

    expect(rutaDelIngreso?.canActivate ?? []).toEqual([]);
  });
});
