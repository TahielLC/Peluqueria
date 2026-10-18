import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { StaffComponent } from './staff.component';
import { AppointmentService } from '../../services/appointment.service';
import { Peluquero } from '../../models/appointment.model';
import { MENSAJES } from '../estados';

const PERSONA = (id: number, titulo?: string): Peluquero => ({
  id,
  nombre: `Persona ${id}`,
  rol: 'Barbero',
  experiencia: `Trayectoria de la persona ${id}.`,
  ...(titulo === undefined ? {} : { titulo }),
  fotoUrl: `https://example.test/${id}.jpg`,
});

/**
 * Arma el componente con la respuesta que se le pase.
 *
 * Recibe una función y no un Observable porque el botón de reintentar hace una
 * segunda consulta: así el test puede hacer que falle la primera y funcione la
 * segunda. `setup` es el atajo para el caso común de una cantidad fija de gente.
 */
function armar(consultar: () => Observable<Peluquero[]>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AppointmentService, useValue: { getPeluqueros: consultar } }],
  });
  const fixture = TestBed.createComponent(StaffComponent);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    /** Lo que el usuario realmente ve en pantalla. */
    texto: () => fixture.nativeElement.textContent as string,
  };
}

function setup(cantidad: number): StaffComponent {
  const items = Array.from({ length: cantidad }, (_, i) => PERSONA(i + 1));
  return armar(() => of(items)).component;
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

  describe('estados de carga, error y contenido vacío', () => {
    it('mientras la respuesta está en camino avisa que está cargando, no que no hay nada', () => {
      const enCamino = new Subject<Peluquero[]>();
      const { fixture, texto } = armar(() => enCamino);

      expect(texto()).toContain(MENSAJES.cargando);
      expect(texto()).not.toContain('Todavía no hay profesionales cargados');

      enCamino.next([PERSONA(1)]);
      enCamino.complete();
      fixture.detectChanges();

      expect(texto()).not.toContain(MENSAJES.cargando);
      expect(texto()).not.toContain('Todavía no hay profesionales cargados');
    });

    it('si la lectura falla muestra el error y NO el estado vacío', () => {
      const { texto } = armar(() => throwError(() => new Error('sin red')));

      expect(texto()).toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain('Todavía no hay profesionales cargados');
    });

    it('un equipo vacío de verdad sigue mostrando el estado vacío', () => {
      const { texto } = armar(() => of([]));

      expect(texto()).toContain('Todavía no hay profesionales cargados');
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain(MENSAJES.cargando);
    });

    it('el botón de reintentar vuelve a pedir el contenido y esta vez lo muestra', () => {
      let respuesta: Observable<Peluquero[]> = throwError(() => new Error('sin red'));
      const { component, fixture, texto } = armar(() => respuesta);

      expect(texto()).toContain(MENSAJES.errorAlCargar);

      respuesta = of([PERSONA(9)]);
      const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      boton.click();
      fixture.detectChanges();

      expect(component.peluqueros()).toHaveLength(1);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
    });
  });
});
