import { describe, expect, it } from 'vitest';
import {
  encuadreInicial,
  limitarEncuadre,
  rectanguloDeOrigen,
} from './encuadre';

/** Marco de 4:5, como el panel de la galería. */
const MARCO = { ancho: 400, alto: 500 };

/** Foto vertical de teléfono. */
const VERTICAL = { ancho: 1000, alto: 2000 };

/** Foto horizontal, para comprobar que el eje que sobra cambia. */
const HORIZONTAL = { ancho: 2000, alto: 1000 };

describe('encuadre', () => {
  describe('encuadreInicial', () => {
    it('arranca centrado y sin acercamiento', () => {
      expect(encuadreInicial()).toEqual({ x: 0, y: 0, acercamiento: 1 });
    });
  });

  describe('limitarEncuadre', () => {
    it('con una foto vertical y sin zoom no deja mover el eje horizontal', () => {
      const limitado = limitarEncuadre(
        { x: 999, y: 0, acercamiento: 1 },
        VERTICAL,
        MARCO,
      );

      expect(limitado).toEqual({ x: 0, y: 0, acercamiento: 1 });
    });

    it('con una foto vertical y sin zoom frena el arrastre en los dos bordes verticales', () => {
      // La imagen mide 400x800 en pantalla: sobran 300 px, o sea 150 por lado.
      const abajo = limitarEncuadre({ x: 0, y: 999, acercamiento: 1 }, VERTICAL, MARCO);
      const arriba = limitarEncuadre({ x: 0, y: -999, acercamiento: 1 }, VERTICAL, MARCO);

      expect(abajo).toEqual({ x: 0, y: 150, acercamiento: 1 });
      expect(arriba).toEqual({ x: 0, y: -150, acercamiento: 1 });
    });

    it('con una foto horizontal y sin zoom frena el arrastre en los dos bordes horizontales', () => {
      // La imagen mide 1000x500 en pantalla: sobran 600 px, o sea 300 por lado.
      const derecha = limitarEncuadre({ x: 999, y: 0, acercamiento: 1 }, HORIZONTAL, MARCO);
      const izquierda = limitarEncuadre({ x: -999, y: 0, acercamiento: 1 }, HORIZONTAL, MARCO);

      expect(derecha).toEqual({ x: 300, y: 0, acercamiento: 1 });
      expect(izquierda).toEqual({ x: -300, y: 0, acercamiento: 1 });
    });

    it('con zoom frena los cuatro bordes con el margen que agrega el acercamiento', () => {
      // A k=2 la imagen vertical mide 800x1600: sobran 400 en horizontal y 1100
      // en vertical, o sea 200 y 550 por lado.
      const abajoDerecha = limitarEncuadre({ x: 999, y: 999, acercamiento: 2 }, VERTICAL, MARCO);
      const arribaIzquierda = limitarEncuadre(
        { x: -999, y: -999, acercamiento: 2 },
        VERTICAL,
        MARCO,
      );

      expect(abajoDerecha).toEqual({ x: 200, y: 550, acercamiento: 2 });
      expect(arribaIzquierda).toEqual({ x: -200, y: -550, acercamiento: 2 });
    });

    it('deja intacto un encuadre que ya está dentro de los límites', () => {
      const valido = { x: 100, y: 0, acercamiento: 1 };

      expect(limitarEncuadre(valido, HORIZONTAL, MARCO)).toEqual(valido);
    });

    it('un acercamiento menor a 1 no puede dejar huecos: se lleva a 1', () => {
      const limitado = limitarEncuadre({ x: 0, y: 0, acercamiento: 0.5 }, VERTICAL, MARCO);

      expect(limitado.acercamiento).toBe(1);
    });

    it('una imagen de 0 px no divide por cero y devuelve un encuadre neutro', () => {
      const limitado = limitarEncuadre(
        { x: 10, y: 20, acercamiento: 2 },
        { ancho: 0, alto: 0 },
        MARCO,
      );

      expect(limitado).toEqual({ x: 0, y: 0, acercamiento: 1 });
    });
  });

  describe('rectanguloDeOrigen', () => {
    it('con una foto vertical centrada toma todo el ancho y recorta el alto', () => {
      // Escala base 0,4: el marco de 500 px de alto equivale a 1250 px de la
      // imagen, centrados en sus 2000 px.
      expect(rectanguloDeOrigen(encuadreInicial(), VERTICAL, MARCO)).toEqual({
        sx: 0,
        sy: 375,
        sw: 1000,
        sh: 1250,
      });
    });

    it('con una foto horizontal centrada recorta el ancho y toma todo el alto', () => {
      // Escala base 0,5: el marco de 400 px de ancho equivale a 800 px de la
      // imagen, centrados en sus 2000 px.
      expect(rectanguloDeOrigen(encuadreInicial(), HORIZONTAL, MARCO)).toEqual({
        sx: 600,
        sy: 0,
        sw: 800,
        sh: 1000,
      });
    });

    it('al mover la foto a la derecha, el recorte se corre a la izquierda', () => {
      // Desplazar la imagen 100 px a la derecha muestra 200 px más a la
      // izquierda del original (100 / 0,5).
      const movido = rectanguloDeOrigen({ x: 100, y: 0, acercamiento: 1 }, HORIZONTAL, MARCO);

      expect(movido).toEqual({ sx: 400, sy: 0, sw: 800, sh: 1000 });
    });

    it('acercar reduce proporcionalmente el recorte', () => {
      const sinZoom = rectanguloDeOrigen(encuadreInicial(), VERTICAL, MARCO);
      const conZoom = rectanguloDeOrigen({ x: 0, y: 0, acercamiento: 2 }, VERTICAL, MARCO);

      expect(conZoom.sw).toBe(sinZoom.sw / 2);
      expect(conZoom.sh).toBe(sinZoom.sh / 2);
    });

    it('una imagen de 0 px no divide por cero y devuelve un rectángulo vacío', () => {
      expect(
        rectanguloDeOrigen(
          encuadreInicial(),
          { ancho: 0, alto: 0 },
          MARCO,
        ),
      ).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
    });
  });
});
