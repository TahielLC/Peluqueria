import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GalleryComponent } from './gallery.component';
import { AppointmentService } from '../../services/appointment.service';
import { TrabajoGaleria } from '../../models/salon.model';

const FOTO = (id: number): TrabajoGaleria => ({
  id,
  titulo: `Trabajo ${id}`,
  categoria: 'Corte',
  imagenUrl: `https://example.test/${id}.jpg`,
});

/** Arma el componente con una cantidad de fotos controlada. */
function setup(cantidad: number): GalleryComponent {
  const items = Array.from({ length: cantidad }, (_, i) => FOTO(i + 1));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AppointmentService, useValue: { getGaleria: () => of(items) } }],
  });
  const fixture = TestBed.createComponent(GalleryComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

/** TouchEvent falso: jsdom no implementa la interfaz real. */
const touch = (clientX: number) => ({ changedTouches: [{ clientX }] }) as unknown as TouchEvent;

describe('GalleryComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('carga', () => {
    it('carga los trabajos de la galeria', () => {
      const component = setup(3);

      expect(component.total()).toBe(3);
      expect(component.hasMultiple()).toBe(true);
    });

    it('con un solo trabajo no ofrece navegacion', () => {
      const component = setup(1);

      expect(component.total()).toBe(1);
      expect(component.hasMultiple()).toBe(false);
    });

    it('sin trabajos queda vacio y no rompe la geometria', () => {
      const component = setup(0);

      expect(component.total()).toBe(0);
      expect(component.radius()).toBe(0);
      expect(Number.isFinite(Number(component.step()))).toBe(true);
    });
  });

  describe('geometria del cilindro', () => {
    it('reparte los paneles en 360 grados: 3 fotos dan 120 grados cada una', () => {
      const component = setup(3);

      expect(component.step()).toBe(120);
    });

    it('el radio supera el ancho del panel para que los vecinos asomen', () => {
      // Regresion: con radio 177px los paneles vecinos quedaban a +-126px,
      // tapados detras del panel frontal que cubre +-170px. La puerta no se
      // leia como objeto 3D. El radio debe superar el ancho del panel.
      for (const cantidad of [3, 4, 6]) {
        const component = setup(cantidad);

        expect(component.radius()).toBeGreaterThanOrEqual(component.panelWidth);
      }
    });

    it('con 3 fotos el radio es 393px', () => {
      const component = setup(3);

      expect(component.radius()).toBe(393);
    });

    it('el anillo arranca sin rotacion en el primer trabajo', () => {
      const component = setup(3);

      expect(component.ringTransform()).toBe('translateZ(-393px) rotateY(0deg)');
    });

    it('cada panel se ubica en su angulo sobre el anillo', () => {
      const component = setup(3);

      expect(component.panelTransform(0)).toBe('rotateY(0deg) translateZ(393px)');
      expect(component.panelTransform(1)).toBe('rotateY(120deg) translateZ(393px)');
      expect(component.panelTransform(2)).toBe('rotateY(240deg) translateZ(393px)');
    });

    it('girar un paso rota el anillo 120 grados', () => {
      const component = setup(3);
      component.next();

      expect(component.ringTransform()).toBe('translateZ(-393px) rotateY(-120deg)');
    });

    it('el panel activo es el unico opaco', () => {
      const component = setup(3);

      expect(component.panelOpacity(0)).toBe(1);
      expect(component.panelOpacity(1)).toBeLessThan(1);
      expect(component.panelOpacity(1)).toBeGreaterThan(0);
    });
  });

  describe('navegacion', () => {
    it('avanza y vuelve al principio al pasarse', () => {
      const component = setup(3);

      component.next();
      component.next();
      component.next();

      expect(component.currentIndex()).toBe(0);
    });

    it('retrocede y da la vuelta hacia el final', () => {
      const component = setup(3);

      component.prev();

      expect(component.currentIndex()).toBe(2);
    });

    it('goTo salta a un indice valido', () => {
      const component = setup(3);

      component.goTo(2);

      expect(component.currentIndex()).toBe(2);
    });

    it('goTo ignora indices fuera de rango', () => {
      const component = setup(3);

      component.goTo(99);
      expect(component.currentIndex()).toBe(0);

      component.goTo(-1);
      expect(component.currentIndex()).toBe(0);
    });

    it('con un solo trabajo la navegacion no hace nada', () => {
      const component = setup(1);

      component.next();
      component.prev();

      expect(component.currentIndex()).toBe(0);
    });
  });

  describe('swipe', () => {
    it('deslizar a la izquierda avanza', () => {
      const component = setup(3);

      component.onTouchStart(touch(200));
      component.onTouchEnd(touch(140));

      expect(component.currentIndex()).toBe(1);
    });

    it('deslizar a la derecha retrocede', () => {
      const component = setup(3);

      component.onTouchStart(touch(140));
      component.onTouchEnd(touch(200));

      expect(component.currentIndex()).toBe(2);
    });

    it('un movimiento menor al umbral no cambia nada', () => {
      const component = setup(3);

      component.onTouchStart(touch(200));
      component.onTouchEnd(touch(151));

      expect(component.currentIndex()).toBe(0);
    });

    it('exactamente el umbral ya cambia', () => {
      const component = setup(3);

      component.onTouchStart(touch(200));
      component.onTouchEnd(touch(150));

      expect(component.currentIndex()).toBe(1);
    });
  });
});
