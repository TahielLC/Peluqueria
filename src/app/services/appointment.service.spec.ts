import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppointmentService } from './appointment.service';
import { SUPABASE } from './supabase.client';
import { DatosDePeluquero } from '../models/appointment.model';
import { DatosDeTrabajoDeGaleria } from '../models/salon.model';

/** Respuesta que el cliente falso va a devolver para una tabla. */
type Respuesta = { data: unknown[] | null; error: { message: string } | null };

/**
 * Una respuesta o una cola de respuestas para la misma tabla.
 *
 * La cola hace falta cuando una sola operación consulta dos veces la misma
 * tabla (por ejemplo `crearServicio`: primero lee el orden máximo y después
 * inserta). Una respuesta suelta se devuelve siempre, como antes.
 */
type Respuestas = Record<string, Respuesta | Respuesta[]>;

/** Cómo se armó una consulta, para poder verificarla después. */
interface Consulta {
  tabla: string;
  columnas: string;
  filtros: Array<[string, unknown]>;
  orden: string[];
  /** Los valores de un `update`, o `null` si la consulta no actualiza. */
  cambios: Record<string, unknown> | null;
  /** Los valores de un `insert`, o `null` si la consulta no inserta. */
  insercion: Record<string, unknown> | null;
}

/**
 * Cliente de Supabase falso.
 *
 * Registra cómo se construyó cada consulta y devuelve la respuesta que se le
 * indique. Existe para que los tests no dependan de la red ni de claves reales:
 * sin esto, cada corrida de la suite pegarle al proyecto de Supabase sería
 * lento, frágil y filtraría datos de producción a los tests.
 */
function crearSupabaseFalso(respuestas: Respuestas) {
  const consultas: Consulta[] = [];

  const cliente = {
    from(tabla: string) {
      const consulta: Consulta = {
        tabla,
        columnas: '',
        filtros: [],
        orden: [],
        cambios: null,
        insercion: null,
      };
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
        // `update` marca la consulta como escritura y guarda lo que se manda. De
        // acá en adelante la cadena es la misma —`eq`, `select`— así que el
        // mismo doble sirve para leer y para escribir sin duplicarse.
        update(cambios: Record<string, unknown>) {
          consulta.cambios = cambios;
          return constructor;
        },
        // `insert` es la contraparte de `update` para las filas nuevas.
        insert(valores: Record<string, unknown>) {
          consulta.insercion = valores;
          return constructor;
        },
        // Hace que el constructor sea "thenable", que es lo que `from()` de RxJS
        // necesita para envolverlo en un Observable.
        then<T>(onOk: (valor: Respuesta) => T, onErr?: (e: unknown) => T) {
          const configurada = respuestas[tabla];
          // Una cola se consume de a una respuesta por consulta. Una respuesta
          // suelta se repite: es lo que esperan los tests que leen una sola vez.
          const respuesta = Array.isArray(configurada)
            ? (configurada.shift() ?? { data: [], error: null })
            : (configurada ?? { data: [], error: null });

          return Promise.resolve(respuesta).then(onOk, onErr);
        },
      };

      return constructor;
    },
  };

  return { cliente: cliente as unknown as SupabaseClient, consultas };
}

describe('AppointmentService', () => {
  /** Arma el servicio con un cliente falso y devuelve también lo consultado. */
  function armar(respuestas: Respuestas) {
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

  describe('getTodosLosServicios', () => {
    it('trae también los inactivos, con su estado, y pide el orden del panel', async () => {
      const { service, consultas } = armar({
        servicios: {
          data: [
            {
              id: 2,
              nombre: 'Perfilado de barba',
              descripcion: 'Con toalla caliente.',
              duracion_minutos: 20,
              precio: 12.5,
              activo: false,
            },
            {
              id: 1,
              nombre: 'Corte Clásico',
              descripcion: 'Corte tradicional.',
              duracion_minutos: 30,
              precio: 15,
              activo: true,
            },
          ],
          error: null,
        },
      });

      const servicios = await firstValueFrom(service.getTodosLosServicios());

      expect(servicios).toEqual([
        {
          id: 2,
          nombre: 'Perfilado de barba',
          descripcion: 'Con toalla caliente.',
          duracionMinutos: 20,
          precio: 12.5,
          activo: false,
        },
        {
          id: 1,
          nombre: 'Corte Clásico',
          descripcion: 'Corte tradicional.',
          duracionMinutos: 30,
          precio: 15,
          activo: true,
        },
      ]);

      expect(consultas[0].tabla).toBe('servicios');
      // Sin filtro de activo: el panel necesita ver también lo dado de baja para
      // poder volver a publicarlo.
      expect(consultas[0].filtros).toEqual([]);
      expect(consultas[0].orden).toEqual(['orden', 'id']);
    });

    it('si Supabase falla, el Observable falla', async () => {
      const { service } = armar({ servicios: { data: null, error: { message: 'sin red' } } });

      await expect(firstValueFrom(service.getTodosLosServicios())).rejects.toThrow(
        /servicios.*sin red/,
      );
    });
  });

  describe('crearServicio', () => {
    const DATOS = {
      nombre: 'Color completo',
      descripcion: 'Coloración y brushing.',
      duracionMinutos: 90,
      precio: 42.5,
    };

    it('calcula el orden como el máximo + 1 e inserta activo con los nombres de la base', async () => {
      const { service, consultas } = armar({
        servicios: [
          // Primero la lectura del orden de toda la tabla, después la fila nueva.
          { data: [{ orden: 0 }, { orden: 4 }, { orden: 2 }], error: null },
          { data: [{ id: 9 }], error: null },
        ],
      });

      await firstValueFrom(service.crearServicio(DATOS));

      expect(consultas).toHaveLength(2);

      // La lectura del orden es de toda la tabla: sin filtro ni orden, a
      // propósito. Es una tabla de tres filas, no hace falta paginar.
      expect(consultas[0].columnas).toBe('orden');
      expect(consultas[0].filtros).toEqual([]);
      expect(consultas[0].orden).toEqual([]);

      expect(consultas[1].insercion).toEqual({
        nombre: 'Color completo',
        descripcion: 'Coloración y brushing.',
        duracion_minutos: 90,
        precio: 42.5,
        orden: 5,
        activo: true,
      });
      expect(consultas[1].columnas).toBe('id');
    });

    it('si la base no devuelve la fila insertada, FALLA en vez de decir que agregó', async () => {
      const { service } = armar({
        servicios: [
          { data: [], error: null },
          { data: [], error: null },
        ],
      });

      await expect(firstValueFrom(service.crearServicio(DATOS))).rejects.toThrow(
        /No se agregó el servicio.*no aceptó el cambio/,
      );
    });

    it('si el insert devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        servicios: [
          { data: [], error: null },
          { data: null, error: { message: 'row-level security policy' } },
        ],
      });

      await expect(firstValueFrom(service.crearServicio(DATOS))).rejects.toThrow(
        /agregar el servicio.*row-level security/,
      );
    });
  });

  describe('actualizarServicio', () => {
    const DATOS = {
      nombre: 'Corte Premium',
      descripcion: 'Con lavado incluido.',
      duracionMinutos: 45,
      precio: 18.75,
    };

    it('manda los cuatro campos editables y filtra por id', async () => {
      const { service, consultas } = armar({
        servicios: { data: [{ id: 7 }], error: null },
      });

      await firstValueFrom(service.actualizarServicio(7, DATOS));

      expect(consultas[0].tabla).toBe('servicios');
      expect(consultas[0].cambios).toEqual({
        nombre: 'Corte Premium',
        descripcion: 'Con lavado incluido.',
        duracion_minutos: 45,
        precio: 18.75,
      });
      expect(consultas[0].filtros).toEqual([['id', 7]]);
      // Pedir la fila de vuelta es lo que distingue "se guardó" de "no se tocó
      // nada": un UPDATE bloqueado por RLS afecta cero filas y no da error.
      expect(consultas[0].columnas).toBe('id');
    });

    it('si la base no actualiza ninguna fila, FALLA en vez de decir que guardó', async () => {
      const { service } = armar({ servicios: { data: [], error: null } });

      await expect(firstValueFrom(service.actualizarServicio(7, DATOS))).rejects.toThrow(
        /No se guardó el servicio.*no aceptó el cambio/,
      );
    });

    it('si Supabase devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        servicios: { data: null, error: { message: 'sin red' } },
      });

      await expect(firstValueFrom(service.actualizarServicio(7, DATOS))).rejects.toThrow(
        /guardar el servicio.*sin red/,
      );
    });
  });

  describe('cambiarActivoDeServicio', () => {
    it('manda el estado nuevo y filtra por id', async () => {
      const { service, consultas } = armar({
        servicios: { data: [{ id: 3 }], error: null },
      });

      await firstValueFrom(service.cambiarActivoDeServicio(3, false));

      expect(consultas[0].tabla).toBe('servicios');
      expect(consultas[0].cambios).toEqual({ activo: false });
      expect(consultas[0].filtros).toEqual([['id', 3]]);
      expect(consultas[0].columnas).toBe('id');
    });

    it('si la base no actualiza ninguna fila, FALLA en vez de decir que cambió', async () => {
      const { service } = armar({ servicios: { data: [], error: null } });

      await expect(firstValueFrom(service.cambiarActivoDeServicio(3, false))).rejects.toThrow(
        /No se cambió el estado del servicio.*no aceptó el cambio/,
      );
    });

    it('si Supabase devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        servicios: { data: null, error: { message: 'sin red' } },
      });

      await expect(firstValueFrom(service.cambiarActivoDeServicio(3, false))).rejects.toThrow(
        /cambiar el estado del servicio.*sin red/,
      );
    });
  });

  describe('actualizarPeluquero', () => {
    const DATOS: DatosDePeluquero = {
      nombre: 'Sofía Martínez',
      rol: 'Colorimetría',
      experiencia: 'Arrancó en 2020 y se especializó en color.',
      titulo: 'Tecnicatura (2021)',
      fotoUrl: 'https://fotos.test/sofia.jpg',
    };

    it('manda los cinco campos editables y filtra por id', async () => {
      const { service, consultas } = armar({
        peluqueros: { data: [{ id: 4 }], error: null },
      });

      await firstValueFrom(service.actualizarPeluquero(4, DATOS));

      expect(consultas[0].tabla).toBe('peluqueros');
      expect(consultas[0].cambios).toEqual({
        nombre: 'Sofía Martínez',
        rol: 'Colorimetría',
        experiencia: 'Arrancó en 2020 y se especializó en color.',
        titulo: 'Tecnicatura (2021)',
        foto_url: 'https://fotos.test/sofia.jpg',
      });
      expect(consultas[0].filtros).toEqual([['id', 4]]);
      // Pedir la fila de vuelta distingue "se guardó" de "no se tocó nada": un
      // UPDATE bloqueado por RLS afecta cero filas y no da error.
      expect(consultas[0].columnas).toBe('id');
    });

    it('guarda el título y la foto vacíos como NULL, no como cadena vacía', async () => {
      const { service, consultas } = armar({
        peluqueros: { data: [{ id: 4 }], error: null },
      });

      await firstValueFrom(
        service.actualizarPeluquero(4, { ...DATOS, titulo: '', fotoUrl: '' }),
      );

      // En la base los dos campos son opcionales y `aPeluquero` mapea NULL a
      // "sin título" y "sin foto". Una cadena vacía mostraría una línea en blanco.
      expect(consultas[0].cambios).toMatchObject({ titulo: null, foto_url: null });
    });

    it('si la base no actualiza ninguna fila, FALLA en vez de decir que guardó', async () => {
      // El caso RLS silencioso: cero filas y respuesta exitosa. Sin mirar las
      // filas, el panel diría "guardado" sin haber guardado nada.
      const { service } = armar({ peluqueros: { data: [], error: null } });

      await expect(firstValueFrom(service.actualizarPeluquero(4, DATOS))).rejects.toThrow(
        /No se guardó el perfil.*no aceptó el cambio/,
      );
    });

    it('si la base devuelve más de una fila, también FALLA', async () => {
      const { service } = armar({
        peluqueros: { data: [{ id: 4 }, { id: 5 }], error: null },
      });

      await expect(firstValueFrom(service.actualizarPeluquero(4, DATOS))).rejects.toThrow(
        /No se guardó el perfil/,
      );
    });

    it('si Supabase devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        peluqueros: { data: null, error: { message: 'row-level security policy' } },
      });

      await expect(firstValueFrom(service.actualizarPeluquero(4, DATOS))).rejects.toThrow(
        /guardar el perfil.*row-level security/,
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

  describe('getTodosLosPeluqueros', () => {
    it('trae también los inactivos, con su estado, y pide el orden del panel', async () => {
      const { service, consultas } = armar({
        peluqueros: {
          data: [
            {
              id: 1,
              nombre: 'Sofía Martínez',
              rol: 'Colorimetría',
              experiencia: 'Arrancó en 2020.',
              titulo: 'Tecnicatura (2021)',
              foto_url: 'https://fotos.test/sofia.jpg',
              activo: true,
            },
            {
              id: 2,
              nombre: 'Lucas Pérez',
              rol: 'Fade',
              experiencia: 'Trabaja desde 2022.',
              titulo: null,
              foto_url: null,
              activo: false,
            },
          ],
          error: null,
        },
      });

      const peluqueros = await firstValueFrom(service.getTodosLosPeluqueros());

      expect(peluqueros).toEqual([
        {
          id: 1,
          nombre: 'Sofía Martínez',
          rol: 'Colorimetría',
          experiencia: 'Arrancó en 2020.',
          titulo: 'Tecnicatura (2021)',
          fotoUrl: 'https://fotos.test/sofia.jpg',
          activo: true,
        },
        {
          id: 2,
          nombre: 'Lucas Pérez',
          rol: 'Fade',
          experiencia: 'Trabaja desde 2022.',
          titulo: undefined,
          fotoUrl: '',
          activo: false,
        },
      ]);

      expect(consultas[0].tabla).toBe('peluqueros');
      // Sin filtro de activo: el panel necesita ver también lo dado de baja para
      // poder volver a publicarlo.
      expect(consultas[0].filtros).toEqual([]);
      expect(consultas[0].orden).toEqual(['orden', 'id']);
      expect(consultas[0].columnas).toContain('activo');
    });

    it('si Supabase falla, el Observable falla', async () => {
      const { service } = armar({
        peluqueros: { data: null, error: { message: 'sin red' } },
      });

      await expect(firstValueFrom(service.getTodosLosPeluqueros())).rejects.toThrow(
        /perfiles.*sin red/,
      );
    });
  });

  describe('crearPeluquero', () => {
    const DATOS: DatosDePeluquero = {
      nombre: 'Martina López',
      rol: 'Corte y color',
      experiencia: 'Trabaja desde 2019.',
      titulo: 'Tecnicatura (2020)',
      fotoUrl: 'https://fotos.test/martina.jpg',
    };

    it('calcula el orden como el máximo + 1 e inserta activo con los nombres de la base', async () => {
      const { service, consultas } = armar({
        peluqueros: [
          // Primero la lectura del orden de toda la tabla, después la fila nueva.
          { data: [{ orden: 0 }, { orden: 4 }, { orden: 2 }], error: null },
          { data: [{ id: 9 }], error: null },
        ],
      });

      await firstValueFrom(service.crearPeluquero(DATOS));

      expect(consultas).toHaveLength(2);

      // La lectura del orden es de toda la tabla: sin filtro ni orden, a
      // propósito. Es una tabla de tres filas, no hace falta paginar.
      expect(consultas[0].columnas).toBe('orden');
      expect(consultas[0].filtros).toEqual([]);
      expect(consultas[0].orden).toEqual([]);

      expect(consultas[1].insercion).toEqual({
        nombre: 'Martina López',
        rol: 'Corte y color',
        experiencia: 'Trabaja desde 2019.',
        titulo: 'Tecnicatura (2020)',
        foto_url: 'https://fotos.test/martina.jpg',
        orden: 5,
        activo: true,
      });
      expect(consultas[1].columnas).toBe('id');
    });

    it('guarda el título y la foto vacíos como NULL, no como cadena vacía', async () => {
      const { service, consultas } = armar({
        peluqueros: [
          { data: [{ orden: 1 }], error: null },
          { data: [{ id: 9 }], error: null },
        ],
      });

      await firstValueFrom(
        service.crearPeluquero({ ...DATOS, titulo: '', fotoUrl: '' }),
      );

      expect(consultas[1].insercion).toMatchObject({
        titulo: null,
        foto_url: null,
        orden: 2,
        activo: true,
      });
    });

    it('si la base no devuelve la fila insertada, FALLA en vez de decir que agregó', async () => {
      const { service } = armar({
        peluqueros: [
          { data: [], error: null },
          { data: [], error: null },
        ],
      });

      await expect(firstValueFrom(service.crearPeluquero(DATOS))).rejects.toThrow(
        /No se agregó el perfil.*no aceptó el cambio/,
      );
    });

    it('si el insert devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        peluqueros: [
          { data: [], error: null },
          { data: null, error: { message: 'row-level security policy' } },
        ],
      });

      await expect(firstValueFrom(service.crearPeluquero(DATOS))).rejects.toThrow(
        /agregar el perfil.*row-level security/,
      );
    });
  });

  describe('cambiarActivoDePeluquero', () => {
    it('manda el estado nuevo y filtra por id', async () => {
      const { service, consultas } = armar({
        peluqueros: { data: [{ id: 3 }], error: null },
      });

      await firstValueFrom(service.cambiarActivoDePeluquero(3, false));

      expect(consultas[0].tabla).toBe('peluqueros');
      expect(consultas[0].cambios).toEqual({ activo: false });
      expect(consultas[0].filtros).toEqual([['id', 3]]);
      expect(consultas[0].columnas).toBe('id');
    });

    it('si la base no actualiza ninguna fila, FALLA en vez de decir que cambió', async () => {
      const { service } = armar({ peluqueros: { data: [], error: null } });

      await expect(
        firstValueFrom(service.cambiarActivoDePeluquero(3, false)),
      ).rejects.toThrow(/No se cambió el estado del perfil.*no aceptó el cambio/);
    });

    it('si Supabase devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        peluqueros: { data: null, error: { message: 'sin red' } },
      });

      await expect(
        firstValueFrom(service.cambiarActivoDePeluquero(3, false)),
      ).rejects.toThrow(/cambiar el estado del perfil.*sin red/);
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

  describe('getTodaLaGaleria', () => {
    it('trae los trabajos activos e inactivos, sin filtrar por activo y en orden', async () => {
      const { service, consultas } = armar({
        galeria: {
          data: [
            {
              id: 2,
              titulo: 'Color caramelo',
              categoria: 'Color',
              imagen_url: 'https://fotos.test/caramelo.jpg',
              activo: false,
            },
            {
              id: 1,
              titulo: 'Fade moderno',
              categoria: 'Corte',
              imagen_url: 'https://fotos.test/fade.jpg',
              activo: true,
            },
          ],
          error: null,
        },
      });

      const trabajos = await firstValueFrom(service.getTodaLaGaleria());

      expect(trabajos).toEqual([
        {
          id: 2,
          titulo: 'Color caramelo',
          categoria: 'Color',
          imagenUrl: 'https://fotos.test/caramelo.jpg',
          activo: false,
        },
        {
          id: 1,
          titulo: 'Fade moderno',
          categoria: 'Corte',
          imagenUrl: 'https://fotos.test/fade.jpg',
          activo: true,
        },
      ]);

      expect(consultas[0].tabla).toBe('galeria');
      // Sin filtro de activo: el panel necesita ver también lo dado de baja para
      // poder volver a publicarlo.
      expect(consultas[0].filtros).toEqual([]);
      expect(consultas[0].orden).toEqual(['orden', 'id']);
      expect(consultas[0].columnas).toContain('activo');
    });

    it('si Supabase falla, el Observable falla', async () => {
      const { service } = armar({ galeria: { data: null, error: { message: 'sin red' } } });

      await expect(firstValueFrom(service.getTodaLaGaleria())).rejects.toThrow(
        /trabajos.*sin red/,
      );
    });
  });

  describe('crearTrabajoDeGaleria', () => {
    const DATOS: DatosDeTrabajoDeGaleria = {
      titulo: 'Peinado con ondas',
      categoria: 'Peinado',
      imagenUrl: 'https://fotos.test/ondas.jpg',
    };

    it('calcula el orden como el máximo + 1 e inserta activo con los nombres de la base', async () => {
      const { service, consultas } = armar({
        galeria: [
          // Primero la lectura del orden de toda la tabla, después la fila nueva.
          { data: [{ orden: 0 }, { orden: 4 }, { orden: 2 }], error: null },
          { data: [{ id: 9 }], error: null },
        ],
      });

      await firstValueFrom(service.crearTrabajoDeGaleria(DATOS));

      expect(consultas).toHaveLength(2);

      // La lectura del orden es de toda la tabla: sin filtro ni orden, a
      // propósito. Es una tabla de tres filas, no hace falta paginar.
      expect(consultas[0].columnas).toBe('orden');
      expect(consultas[0].filtros).toEqual([]);
      expect(consultas[0].orden).toEqual([]);

      expect(consultas[1].insercion).toEqual({
        titulo: 'Peinado con ondas',
        categoria: 'Peinado',
        imagen_url: 'https://fotos.test/ondas.jpg',
        orden: 5,
        activo: true,
      });
      expect(consultas[1].columnas).toBe('id');
    });

    it('si la base no devuelve la fila insertada, FALLA en vez de decir que agregó', async () => {
      const { service } = armar({
        galeria: [
          { data: [], error: null },
          { data: [], error: null },
        ],
      });

      await expect(firstValueFrom(service.crearTrabajoDeGaleria(DATOS))).rejects.toThrow(
        /No se agregó el trabajo.*no aceptó el cambio/,
      );
    });

    it('si el insert devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        galeria: [
          { data: [], error: null },
          { data: null, error: { message: 'row-level security policy' } },
        ],
      });

      await expect(firstValueFrom(service.crearTrabajoDeGaleria(DATOS))).rejects.toThrow(
        /agregar el trabajo.*row-level security/,
      );
    });
  });

  describe('actualizarTrabajoDeGaleria', () => {
    const DATOS: DatosDeTrabajoDeGaleria = {
      titulo: 'Fade con diseño',
      categoria: 'Barba',
      imagenUrl: 'https://fotos.test/fade-nuevo.jpg',
    };

    it('manda los tres campos editables y filtra por id', async () => {
      const { service, consultas } = armar({
        galeria: { data: [{ id: 7 }], error: null },
      });

      await firstValueFrom(service.actualizarTrabajoDeGaleria(7, DATOS));

      expect(consultas[0].tabla).toBe('galeria');
      expect(consultas[0].cambios).toEqual({
        titulo: 'Fade con diseño',
        categoria: 'Barba',
        imagen_url: 'https://fotos.test/fade-nuevo.jpg',
      });
      expect(consultas[0].filtros).toEqual([['id', 7]]);
      // Pedir la fila de vuelta es lo que distingue "se guardó" de "no se tocó
      // nada": un UPDATE bloqueado por RLS afecta cero filas y no da error.
      expect(consultas[0].columnas).toBe('id');
    });

    it('si la base no actualiza ninguna fila, FALLA en vez de decir que guardó', async () => {
      const { service } = armar({ galeria: { data: [], error: null } });

      await expect(
        firstValueFrom(service.actualizarTrabajoDeGaleria(7, DATOS)),
      ).rejects.toThrow(/No se guardó el trabajo.*no aceptó el cambio/);
    });

    it('si Supabase devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        galeria: { data: null, error: { message: 'row-level security policy' } },
      });

      await expect(
        firstValueFrom(service.actualizarTrabajoDeGaleria(7, DATOS)),
      ).rejects.toThrow(/guardar el trabajo.*row-level security/);
    });
  });

  describe('cambiarActivoDeTrabajoDeGaleria', () => {
    it('manda el estado nuevo y filtra por id', async () => {
      const { service, consultas } = armar({
        galeria: { data: [{ id: 3 }], error: null },
      });

      await firstValueFrom(service.cambiarActivoDeTrabajoDeGaleria(3, false));

      expect(consultas[0].tabla).toBe('galeria');
      expect(consultas[0].cambios).toEqual({ activo: false });
      expect(consultas[0].filtros).toEqual([['id', 3]]);
      expect(consultas[0].columnas).toBe('id');
    });

    it('si la base no actualiza ninguna fila, FALLA en vez de decir que cambió', async () => {
      const { service } = armar({ galeria: { data: [], error: null } });

      await expect(
        firstValueFrom(service.cambiarActivoDeTrabajoDeGaleria(3, false)),
      ).rejects.toThrow(/No se cambió el estado del trabajo.*no aceptó el cambio/);
    });

    it('si Supabase devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        galeria: { data: null, error: { message: 'sin red' } },
      });

      await expect(
        firstValueFrom(service.cambiarActivoDeTrabajoDeGaleria(3, false)),
      ).rejects.toThrow(/cambiar el estado del trabajo.*sin red/);
    });
  });

  describe('getTextos', () => {
    it('devuelve los textos con su etiqueta y su ayuda, en el orden del panel', async () => {
      const { service, consultas } = armar({
        textos_sitio: {
          data: [
            {
              clave: 'hero_titulo',
              valor: 'Peluquería Don Juan',
              etiqueta: 'Nombre del salón',
              ayuda: 'Es el título más grande de la página de inicio.',
            },
            {
              clave: 'servicios_bajada',
              valor: 'Precios claros.',
              etiqueta: 'Frase debajo del título de servicios',
              ayuda: null,
            },
          ],
          error: null,
        },
      });

      const textos = await firstValueFrom(service.getTextos());

      expect(textos).toEqual([
        {
          clave: 'hero_titulo',
          valor: 'Peluquería Don Juan',
          etiqueta: 'Nombre del salón',
          ayuda: 'Es el título más grande de la página de inicio.',
        },
        {
          clave: 'servicios_bajada',
          valor: 'Precios claros.',
          etiqueta: 'Frase debajo del título de servicios',
          ayuda: null,
        },
      ]);
      expect(consultas[0].tabla).toBe('textos_sitio');
      expect(consultas[0].orden).toEqual(['orden']);
    });

    it('si Supabase falla, el Observable falla', async () => {
      const { service } = armar({
        textos_sitio: { data: null, error: { message: 'sin red' } },
      });

      await expect(firstValueFrom(service.getTextos())).rejects.toThrow(/textos.*sin red/);
    });
  });

  describe('guardarTexto', () => {
    it('manda el valor nuevo y filtra por clave', async () => {
      const { service, consultas } = armar({
        textos_sitio: { data: [{ clave: 'hero_titulo' }], error: null },
      });

      await firstValueFrom(service.guardarTexto('hero_titulo', 'Peluquería Don Juan'));

      expect(consultas[0].tabla).toBe('textos_sitio');
      expect(consultas[0].cambios).toEqual({ valor: 'Peluquería Don Juan' });
      expect(consultas[0].filtros).toEqual([['clave', 'hero_titulo']]);
    });

    it('pide la fila actualizada de vuelta, que es lo que distingue guardar de no tocar nada', async () => {
      const { service, consultas } = armar({
        textos_sitio: { data: [{ clave: 'hero_titulo' }], error: null },
      });

      await firstValueFrom(service.guardarTexto('hero_titulo', 'x'));

      expect(consultas[0].columnas).toBe('clave');
    });

    it('si la base no actualiza ninguna fila, FALLA en vez de decir que guardó', async () => {
      // El caso de la política RLS que filtra en silencio: un UPDATE bloqueado
      // no lanza error, afecta cero filas y vuelve como éxito. Sin mirar las
      // filas, el panel diría "guardado" sin haber guardado nada.
      const { service } = armar({
        textos_sitio: { data: [], error: null },
      });

      await expect(
        firstValueFrom(service.guardarTexto('hero_titulo', 'Peluquería Don Juan')),
      ).rejects.toThrow(/no aceptó el cambio/);
    });

    it('si Supabase devuelve error, el Observable falla con ese motivo', async () => {
      const { service } = armar({
        textos_sitio: { data: null, error: { message: 'row-level security policy' } },
      });

      await expect(firstValueFrom(service.guardarTexto('hero_titulo', 'x'))).rejects.toThrow(
        /guardar el texto.*row-level security/,
      );
    });
  });
});
