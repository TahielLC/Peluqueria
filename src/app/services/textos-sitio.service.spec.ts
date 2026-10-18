import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ClaveDeTexto, TextoDeSitio } from '../models/salon.model';
import { AppointmentService } from './appointment.service';
import { TEXTOS_POR_DEFECTO, TextosSitioService } from './textos-sitio.service';

/**
 * Doble de `AppointmentService`.
 *
 * No se usa el cliente falso de Supabase acá a propósito: lo que se prueba en
 * este archivo no es cómo se lee la base —eso ya lo prueban los tests de
 * `AppointmentService`— sino qué hace el sitio cuando la base contesta bien, no
 * contesta, o contesta tarde. Contar cuántas veces se pidió es parte de la
 * prueba.
 */
class DatosFalsos {
  /** Cuántas veces se pidieron los textos. */
  pedidos = 0;

  /** Lo que va a devolver el próximo `getTextos()`. */
  respuesta: Observable<TextoDeSitio[]> = of([]);

  /** Lo último que se mandó a guardar, o `null` si no se guardó nada. */
  guardado: { clave: ClaveDeTexto; valor: string } | null = null;

  /** Lo que va a devolver el próximo `guardarTexto()`. */
  resultadoGuardar: Observable<void> = of(undefined);

  getTextos(): Observable<TextoDeSitio[]> {
    this.pedidos++;
    return this.respuesta;
  }

  guardarTexto(clave: ClaveDeTexto, valor: string): Observable<void> {
    this.guardado = { clave, valor };
    return this.resultadoGuardar;
  }
}

function textoDeLaBase(clave: ClaveDeTexto, valor: string): TextoDeSitio {
  return { clave, valor, etiqueta: 'Una etiqueta', ayuda: null };
}

describe('TextosSitioService', () => {
  let datos: DatosFalsos;
  let service: TextosSitioService;

  function armar() {
    datos = new DatosFalsos();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: AppointmentService, useValue: datos }],
    });

    service = TestBed.inject(TextosSitioService);
  }

  beforeEach(() => {
    armar();
  });

  describe('texto', () => {
    it('antes de que llegue nada, devuelve el valor de fábrica', () => {
      // El primer pintado de la página tiene que mostrar algo que se vea bien,
      // no un hueco: por eso hay un juego de textos de fábrica.
      expect(service.texto('hero_titulo')).toBe(TEXTOS_POR_DEFECTO.hero_titulo);
      expect(service.texto('servicios_titulo')).toBe('Nuestros Servicios');
    });

    it('después de cargar, devuelve el valor de la base', () => {
      datos.respuesta = of([textoDeLaBase('hero_titulo', 'Peluquería Don Juan')]);

      service.cargar();

      expect(service.texto('hero_titulo')).toBe('Peluquería Don Juan');
    });

    it('deja el valor de fábrica en las claves que la base no mandó', () => {
      // Si una clave falta —una fila borrada, una base a medio migrar— el sitio
      // no puede quedarse con un hueco en esa parte.
      datos.respuesta = of([textoDeLaBase('hero_titulo', 'Peluquería Don Juan')]);

      service.cargar();

      expect(service.texto('galeria_titulo')).toBe(TEXTOS_POR_DEFECTO.galeria_titulo);
    });
  });

  describe('cargar', () => {
    it('pide los textos una sola vez aunque lo llamen las cuatro secciones', () => {
      // El home y las tres secciones arrancan juntos: sin esta guarda, serían
      // cuatro pedidos de las mismas diez filas.
      service.cargar();
      service.cargar();
      service.cargar();

      expect(datos.pedidos).toBe(1);
    });

    it('si el pedido falla, se queda con los de fábrica y deja reintentar', () => {
      datos.respuesta = throwError(() => new Error('se cayó la red'));

      service.cargar();
      expect(service.texto('hero_titulo')).toBe(TEXTOS_POR_DEFECTO.hero_titulo);

      // El segundo intento ya anda: sin esto, un corte de red al abrir la página
      // dejaría los textos de fábrica hasta que alguien recargue a mano.
      datos.respuesta = of([textoDeLaBase('hero_titulo', 'Peluquería Don Juan')]);
      service.cargar();

      expect(datos.pedidos).toBe(2);
      expect(service.texto('hero_titulo')).toBe('Peluquería Don Juan');
    });
  });

  describe('guardar', () => {
    it('manda la clave y el valor a la base', async () => {
      await firstValueFrom(service.guardar('hero_badge', 'Nueva frase'));

      expect(datos.guardado).toEqual({ clave: 'hero_badge', valor: 'Nueva frase' });
    });

    it('deja el sitio mostrando el valor nuevo sin volver a pedir los textos', async () => {
      // Este es el punto de guardar desde el panel y volver al home: si la copia
      // no se actualizara, la administradora vería el texto viejo y creería que
      // no se guardó.
      await firstValueFrom(service.guardar('hero_titulo', 'Peluquería Don Juan'));

      expect(service.texto('hero_titulo')).toBe('Peluquería Don Juan');
      expect(datos.pedidos).toBe(0);
    });

    it('si la base rechaza el cambio, el error sube y la copia no se toca', async () => {
      datos.resultadoGuardar = throwError(() => new Error('no se guardó nada'));

      await expect(firstValueFrom(service.guardar('hero_titulo', 'Peluquería Don Juan'))).rejects.toThrow(
        'no se guardó nada',
      );

      // Mostrar como guardado algo que la base rechazó es peor que no guardar:
      // acá tiene que quedar el valor de fábrica, que es el que se ve de verdad.
      expect(service.texto('hero_titulo')).toBe(TEXTOS_POR_DEFECTO.hero_titulo);
    });
  });
});
