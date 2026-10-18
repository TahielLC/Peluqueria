import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppointmentService } from './appointment.service';
import { SUPABASE } from './supabase.client';

/** Respuesta que el cliente falso va a devolver para una tabla. */
type Respuesta = { data: unknown[] | null; error: { message: string } | null };

/** Cómo se armó una consulta, para poder verificarla después. */
interface Consulta {
  tabla: string;
  columnas: string;
  filtros: Array<[string, unknown]>;
  orden: string[];
}

/**
 * Cliente de Supabase falso.
 *
 * Registra cómo se construyó cada consulta y devuelve la respuesta que se le
 * indique. Existe para que los tests no dependan de la red ni de claves reales:
 * sin esto, cada corrida de la suite pegarle al proyecto de Supabase sería
 * lento, frágil y filtraría datos de producción a los tests.
 */
function crearSupabaseFalso(respuestas: Record<string, Respuesta>) {
  const consultas: Consulta[] = [];

  const cliente = {
    from(tabla: string) {
      const consulta: Consulta = { tabla, columnas: '', filtros: [], orden: [] };
      consultas.push(consulta);

      const constructor = {
        select(columnas: string) {
          consulta.columnas = columnas;
          return constructor;
        },
        eq(columna: string, valor: unknown) {
          consulta.filtros.push([columna, valor]);
          return constructor;
        },
        order(columna: string) {
          consulta.orden.push(columna);
          return constructor;
        },
        // Hace que el constructor sea "thenable", que es lo que `from()` de RxJS
        // necesita para envolverlo en un Observable.
        then<T>(onOk: (valor: Respuesta) => T, onErr?: (e: unknown) => T) {
          return Promise.resolve(respuestas[tabla] ?? { data: [], error: null }).then(onOk, onErr);
        },
      };

      return constructor;
    },
  };

  return { cliente: cliente as unknown as SupabaseClient, consultas };
}

describe('AppointmentService', () => {
  /** Arma el servicio con un cliente falso y devuelve también lo consultado. */
  function armar(respuestas: Record<string, Respuesta>) {
    const { cliente, consultas } = crearSupabaseFalso(respuestas);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE, useValue: cliente }],
    });

    return { service: TestBed.inject(AppointmentService), consultas };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('getServicios', () => {
    it('traduce las columnas de la base al modelo de la app', async () => {
      const { service } = armar({
        servicios: {
          data: [
            {
              id: 7,
              nombre: 'Corte Clásico',
              descripcion: 'Corte de cabello tradicional.',
              duracion_minutos: 30,
              precio: 15,
            },
          ],
          error: null,
        },
      });

      const servicios = await firstValueFrom(service.getServicios());

      // `duracion_minutos` (base) tiene que llegar como `duracionMinutos` (app).
      expect(servicios).toEqual([
        {
          id: 7,
          nombre: 'Corte Clásico',
          descripcion: 'Corte de cabello tradicional.',
          duracionMinutos: 30,
          precio: 15,
        },
      ]);
    });

    it('pide la tabla servicios, sólo lo activo y en orden', async () => {
      const { service, consultas } = armar({ servicios: { data: [], error: null } });

      await firstValueFrom(service.getServicios());

      expect(consultas).toHaveLength(1);
      expect(consultas[0].tabla).toBe('servicios');
      expect(consultas[0].filtros).toEqual([['activo', true]]);
      expect(consultas[0].orden).toEqual(['orden', 'id']);
    });

    it('un precio que llega como texto se convierte en número', async () => {
      // Regresión: la UI formatea con `Number.isInteger` y después llama a
      // `.toFixed()`. Si el precio llegara como texto, esa cadena explotaría.
      const { service } = armar({
        servicios: {
          data: [
            {
              id: 1,
              nombre: 'Corte',
              descripcion: 'x',
              duracion_minutos: 30,
              precio: '15.50',
            },
          ],
          error: null,
        },
      });

      const servicios = await firstValueFrom(service.getServicios());

      expect(servicios[0].precio).toBe(15.5);
      expect(typeof servicios[0].precio).toBe('number');
    });

    it('una lista vacía es una lista vacía, no un error', async () => {
      const { service } = armar({ servicios: { data: [], error: null } });

      await expect(firstValueFrom(service.getServicios())).resolves.toEqual([]);
    });

    it('si Supabase falla, el Observable falla y NO devuelve una lista vacía', async () => {
      // Distinguir "no hay contenido" de "no se pudo leer" es el punto: una lista
      // vacía haría que un problema de red pareciera un sitio sin cargar.
      const { service } = armar({
        servicios: { data: null, error: { message: 'connection refused' } },
      });

      await expect(firstValueFrom(service.getServicios())).rejects.toThrow(
        /servicios.*connection refused/,
      );
    });
  });

  describe('getPeluqueros', () => {
    it('traduce las columnas y deja el título como opcional', async () => {
      const { service } = armar({
        peluqueros: {
          data: [
            {
              id: 1,
              nombre: 'Sofía Martínez',
              rol: 'Colorimetría',
              experiencia: 'Arrancó en 2020.',
              titulo: 'Tecnicatura (2021)',
              foto_url: 'https://fotos.test/sofia.jpg',
            },
            {
              id: 2,
              nombre: 'Lucas Pérez',
              rol: 'Fade',
              experiencia: 'Trabaja desde 2022.',
              titulo: null,
              foto_url: null,
            },
          ],
          error: null,
        },
      });

      const peluqueros = await firstValueFrom(service.getPeluqueros());

      expect(peluqueros[0]).toEqual({
        id: 1,
        nombre: 'Sofía Martínez',
        rol: 'Colorimetría',
        experiencia: 'Arrancó en 2020.',
        titulo: 'Tecnicatura (2021)',
        fotoUrl: 'https://fotos.test/sofia.jpg',
      });

      // `titulo` NULL en la base tiene que llegar como `undefined`, que es lo que
      // la UI evalúa para decidir si muestra la línea.
      expect(peluqueros[1].titulo).toBeUndefined();
      expect(peluqueros[1].fotoUrl).toBe('');
    });

    it('pide la tabla peluqueros, sólo lo activo y en orden', async () => {
      const { service, consultas } = armar({ peluqueros: { data: [], error: null } });

      await firstValueFrom(service.getPeluqueros());

      expect(consultas[0].tabla).toBe('peluqueros');
      expect(consultas[0].filtros).toEqual([['activo', true]]);
      expect(consultas[0].orden).toEqual(['orden', 'id']);
    });

    it('si Supabase falla, el Observable falla', async () => {
      const { service } = armar({
        peluqueros: { data: null, error: { message: 'timeout' } },
      });

      await expect(firstValueFrom(service.getPeluqueros())).rejects.toThrow(/perfiles.*timeout/);
    });
  });

  describe('getGaleria', () => {
    it('traduce las columnas de la galería al modelo', async () => {
      const { service } = armar({
        galeria: {
          data: [
            {
              id: 3,
              titulo: 'Fade Moderno',
              categoria: 'Corte',
              imagen_url: 'https://fotos.test/fade.jpg',
            },
          ],
          error: null,
        },
      });

      const trabajos = await firstValueFrom(service.getGaleria());

      expect(trabajos).toEqual([
        {
          id: 3,
          titulo: 'Fade Moderno',
          categoria: 'Corte',
          imagenUrl: 'https://fotos.test/fade.jpg',
        },
      ]);
    });

    it('pide la tabla galeria, sólo lo activo y en orden', async () => {
      const { service, consultas } = armar({ galeria: { data: [], error: null } });

      await firstValueFrom(service.getGaleria());

      expect(consultas[0].tabla).toBe('galeria');
      expect(consultas[0].filtros).toEqual([['activo', true]]);
      expect(consultas[0].orden).toEqual(['orden', 'id']);
    });

    it('si Supabase falla, el Observable falla', async () => {
      const { service } = armar({ galeria: { data: null, error: { message: 'sin red' } } });

      await expect(firstValueFrom(service.getGaleria())).rejects.toThrow(/trabajos.*sin red/);
    });
  });

  describe('agendarTurno', () => {
    // Este método NO se tocó en esta feature (los turnos están fuera de alcance).
    // El test queda para confirmar que su comportamiento no cambió.
    it('reporta exito al agendar', async () => {
      const { service } = armar({});

      const resultado = await firstValueFrom(
        service.agendarTurno({
          clienteId: 1,
          servicioId: 1,
          peluqueroId: 1,
          fechaHora: '2026-11-01T10:00:00',
          estado: 'PENDIENTE',
        }),
      );

      expect(resultado.success).toBe(true);
      expect(resultado.message).toBeTruthy();
    });
  });
});
