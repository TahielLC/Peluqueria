import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ServiciosComponent } from './servicios.component';
import { AppointmentService } from '../../services/appointment.service';
import { Servicio } from '../../models/appointment.model';
import { MENSAJES } from '../estados';

const SERVICIO = (id: number, precio: number): Servicio => ({
  id,
  nombre: `Servicio ${id}`,
  descripcion: `Descripcion ${id}`,
  duracionMinutos: 30,
  precio,
});

/**
 * Arma el componente con la respuesta que se le pase.
 *
 * Recibe una función y no un Observable porque el botón de reintentar hace una
 * segunda consulta: así el test puede hacer que falle la primera y funcione la
 * segunda. `setup` es el atajo para el caso común de una lista fija.
 */
function armar(consultar: () => Observable<Servicio[]>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: AppointmentService, useValue: { getServicios: consultar } }],
  });
  const fixture = TestBed.createComponent(ServiciosComponent);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    /** Lo que el usuario realmente ve en pantalla. */
    texto: () => fixture.nativeElement.textContent as string,
  };
}

function setup(items: Servicio[] = [SERVICIO(1, 15), SERVICIO(2, 22)]): ServiciosComponent {
  return armar(() => of(items)).component;
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

  describe('estados de carga, error y contenido vacío', () => {
    it('mientras la respuesta está en camino avisa que está cargando, no que no hay nada', () => {
      const enCamino = new Subject<Servicio[]>();
      const { fixture, texto } = armar(() => enCamino);

      expect(texto()).toContain(MENSAJES.cargando);
      // Lo que importa: no puede afirmar que no hay contenido mientras no sabe.
      expect(texto()).not.toContain('Todavía no hay servicios cargados');
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);

      enCamino.next([SERVICIO(1, 15)]);
      enCamino.complete();
      fixture.detectChanges();

      expect(texto()).not.toContain(MENSAJES.cargando);
      expect(texto()).toContain('Servicio 1');
    });

    it('si la lectura falla muestra el error y NO el estado vacío', () => {
      const { texto } = armar(() => throwError(() => new Error('sin red')));

      expect(texto()).toContain(MENSAJES.errorAlCargar);
      // El error disfrazado de "no hay contenido" es la mentira que se arregla acá.
      expect(texto()).not.toContain('Todavía no hay servicios cargados');
    });

    it('una lista vacía de verdad sigue mostrando el estado vacío', () => {
      const { texto } = armar(() => of([]));

      expect(texto()).toContain('Todavía no hay servicios cargados');
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain(MENSAJES.cargando);
    });

    it('el botón de reintentar vuelve a pedir el contenido y esta vez lo muestra', () => {
      let respuesta: Observable<Servicio[]> = throwError(() => new Error('sin red'));
      const { component, fixture, texto } = armar(() => respuesta);

      expect(texto()).toContain(MENSAJES.errorAlCargar);

      // Ahora la red anda: el usuario aprieta el botón.
      respuesta = of([SERVICIO(9, 30)]);
      const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      boton.click();
      fixture.detectChanges();

      expect(component.servicios()).toHaveLength(1);
      expect(texto()).toContain('Servicio 9');
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
    });
  });
});
