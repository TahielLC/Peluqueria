import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ServiciosComponent } from './servicios.component';
import { AppointmentService } from '../../services/appointment.service';
import { Servicio } from '../../models/appointment.model';

const SERVICIO = (id: number, precio: number): Servicio => ({
  id,
  nombre: `Servicio ${id}`,
  descripcion: `Descripcion ${id}`,
  duracionMinutos: 30,
  precio,
});

function setup(items: Servicio[] = [SERVICIO(1, 15), SERVICIO(2, 22)]): ServiciosComponent {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AppointmentService, useValue: { getServicios: () => of(items) } }],
  });
  const fixture = TestBed.createComponent(ServiciosComponent);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('ServiciosComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('carga', () => {
    it('carga los servicios', () => {
      const component = setup();

      expect(component.servicios().length).toBe(2);
    });

    it('sin servicios queda vacio', () => {
      const component = setup([]);

      expect(component.servicios().length).toBe(0);
    });
  });

  describe('formato de precio', () => {
    it('un precio entero se muestra sin decimales', () => {
      const component = setup();

      expect(component.precio(15)).toBe('$15');
      expect(component.precio(22)).toBe('$22');
      expect(component.precio(40)).toBe('$40');
    });

    it('un precio con decimales conserva los dos decimales', () => {
      const component = setup();

      expect(component.precio(15.5)).toBe('$15.50');
      expect(component.precio(15.99)).toBe('$15.99');
    });

    it('el cero se muestra como $0 y no como cadena vacia', () => {
      const component = setup();

      expect(component.precio(0)).toBe('$0');
    });
  });
});
