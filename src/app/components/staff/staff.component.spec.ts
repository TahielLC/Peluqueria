import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { StaffComponent } from './staff.component';
import { AppointmentService } from '../../services/appointment.service';
import { Peluquero } from '../../models/appointment.model';

const PERSONA = (id: number, titulo?: string): Peluquero => ({
  id,
  nombre: `Persona ${id}`,
  rol: 'Barbero',
  experiencia: `Trayectoria de la persona ${id}.`,
  ...(titulo === undefined ? {} : { titulo }),
  fotoUrl: `https://example.test/${id}.jpg`,
});

function setup(cantidad: number): StaffComponent {
  const items = Array.from({ length: cantidad }, (_, i) => PERSONA(i + 1));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AppointmentService, useValue: { getPeluqueros: () => of(items) } }],
  });
  const fixture = TestBed.createComponent(StaffComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

const touch = (clientX: number) => ({ changedTouches: [{ clientX }] }) as unknown as TouchEvent;

describe('StaffComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('carga', () => {
    it('carga los profesionales', () => {
      const component = setup(3);

      expect(component.total()).toBe(3);
      expect(component.hasMultiple()).toBe(true);
    });

    it('con un solo profesional no ofrece navegacion', () => {
      const component = setup(1);

      expect(component.hasMultiple()).toBe(false);
    });

    it('sin profesionales queda vacio', () => {
      const component = setup(0);

      expect(component.total()).toBe(0);
    });
  });

  describe('desplazamiento horizontal', () => {
    it('arranca en el primer perfil sin desplazar', () => {
      const component = setup(3);

      expect(component.trackTransform()).toBe('translateX(-0%)');
    });

    it('avanza exactamente un ancho de ventana por perfil', () => {
      const component = setup(3);

      component.next();
      expect(component.trackTransform()).toBe('translateX(-100%)');

      component.next();
      expect(component.trackTransform()).toBe('translateX(-200%)');
    });

    it('el desplazamiento es lateral, no rotativo', () => {
      const component = setup(3);

      component.next();

      expect(component.trackTransform()).toContain('translateX');
      expect(component.trackTransform()).not.toContain('rotate');
    });
  });

  describe('estado activo', () => {
    it('isActive solo marca el perfil actual', () => {
      const component = setup(3);

      expect(component.isActive(0)).toBe(true);
      expect(component.isActive(2)).toBe(false);

      component.next();

      expect(component.isActive(0)).toBe(false);
      expect(component.isActive(1)).toBe(true);
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

    it('goTo ignora indices fuera de rango', () => {
      const component = setup(3);

      component.goTo(99);
      expect(component.currentIndex()).toBe(0);

      component.goTo(-1);
      expect(component.currentIndex()).toBe(0);
    });

    it('con un solo profesional la navegacion no hace nada', () => {
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
  });
});
