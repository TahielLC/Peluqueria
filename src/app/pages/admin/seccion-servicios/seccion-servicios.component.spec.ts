import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SeccionServiciosComponent } from './seccion-servicios.component';
import { AppointmentService } from '../../../services/appointment.service';
import { DatosDeServicio, ServicioAdministrable } from '../../../models/appointment.model';
import { MENSAJES } from '../../../components/estados';

/**
 * Servicios de prueba con la forma que devuelve la base.
 *
 * Hay uno activo y uno dado de baja a propósito: la pantalla tiene que mostrar
 * los dos y ofrecer una acción distinta para cada uno.
 */
const CORTE: ServicioAdministrable = {
  id: 1,
  nombre: 'Corte Clásico',
  descripcion: 'Corte tradicional.',
  duracionMinutos: 30,
  precio: 15,
  activo: true,
};

const BARBA: ServicioAdministrable = {
  id: 2,
  nombre: 'Perfilado de barba',
  descripcion: 'Con toalla caliente.',
  duracionMinutos: 20,
  precio: 12.5,
  activo: false,
};

const SERVICIOS = [CORTE, BARBA];

interface Opciones {
  consultar?: () => Observable<ServicioAdministrable[]>;
  actualizar?: () => Observable<void>;
  cambiarActivo?: () => Observable<void>;
  crear?: () => Observable<void>;
}

interface Actualizacion {
  id: number;
  datos: DatosDeServicio;
}

interface CambioDeActivo {
  id: number;
  activo: boolean;
}

/** Arma el editor con un servicio falso y registra lo que se le pide. */
function armar(opciones: Opciones = {}) {
  const consultar = opciones.consultar ?? (() => of(SERVICIOS));
  const actualizaciones: Actualizacion[] = [];
  const cambiosDeActivo: CambioDeActivo[] = [];
  const creados: DatosDeServicio[] = [];
  let consultas = 0;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AppointmentService,
        useValue: {
          getTodosLosServicios: () => {
            consultas += 1;
            return consultar();
          },
          actualizarServicio: (id: number, datos: DatosDeServicio) => {
            actualizaciones.push({ id, datos });
            return (opciones.actualizar ?? (() => of(void 0)))();
          },
          cambiarActivoDeServicio: (id: number, activo: boolean) => {
            cambiosDeActivo.push({ id, activo });
            return (opciones.cambiarActivo ?? (() => of(void 0)))();
          },
          crearServicio: (datos: DatosDeServicio) => {
            creados.push(datos);
            return (opciones.crear ?? (() => of(void 0)))();
          },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(SeccionServiciosComponent);
  fixture.detectChanges();

  /** Las filas de servicios (el formulario de alta no es un `li`). */
  const filas = () =>
    Array.from(fixture.nativeElement.querySelectorAll('li')) as HTMLElement[];

  const nuevoCampo = (nombre: 'nombre' | 'descripcion' | 'duracion' | 'precio') => {
    const campo = fixture.nativeElement.querySelector(`#nuevo-${nombre}`) as
      | HTMLInputElement
      | null;
    if (!campo) throw new Error(`No existe el campo de alta "${nombre}"`);
    return campo;
  };

  const botonAgregar = () => {
    const seccion = fixture.nativeElement.querySelector(
      'section[aria-label="Agregar un servicio"]',
    ) as HTMLElement | null;
    if (!seccion) throw new Error('No está el formulario de alta');
    return botonCon(seccion, 'Agregar');
  };

  return {
    component: fixture.componentInstance,
    fixture,
    actualizaciones,
    cambiosDeActivo,
    creados,
    consultas: () => consultas,
    filas,
    camposDe: (fila: HTMLElement) =>
      Array.from(fila.querySelectorAll('input')) as HTMLInputElement[],
    botonDe: (fila: HTMLElement, texto: string) => botonCon(fila, texto),
    nuevoCampo,
    botonAgregar,
    /** Lo que la persona realmente ve. */
    texto: () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' '),
  };
}

/** Busca un botón por su texto y falla con un mensaje claro si no está. */
function botonCon(raiz: ParentNode, texto: string): HTMLButtonElement {
  const boton = Array.from(raiz.querySelectorAll('button')).find((candidato) =>
    candidato.textContent?.includes(texto),
  ) as HTMLButtonElement | undefined;

  if (!boton) throw new Error(`No hay ningún botón que diga "${texto}"`);
  return boton;
}

/** Escribe en un campo como lo haría la persona. */
function escribir(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

/** Escribe varios campos de una fila, en el orden en que se muestran. */
function escribirEnFila(
  fila: HTMLElement,
  valores: Partial<Record<'nombre' | 'descripcion' | 'duracion' | 'precio', string>>,
): void {
  const [nombre, descripcion, duracion, precio] = Array.from(
    fila.querySelectorAll('input'),
  ) as HTMLInputElement[];

  if (valores.nombre !== undefined) escribir(nombre, valores.nombre);
  if (valores.descripcion !== undefined) escribir(descripcion, valores.descripcion);
  if (valores.duracion !== undefined) escribir(duracion, valores.duracion);
  if (valores.precio !== undefined) escribir(precio, valores.precio);
}

describe('SeccionServiciosComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('la lista de servicios', () => {
    it('muestra los activos y los inactivos, con la acción que corresponde a cada uno', () => {
      const { filas, botonDe, texto } = armar();

      expect(filas()).toHaveLength(2);
      expect(filas()[0].textContent).toContain('Corte Clásico');
      expect(filas()[1].textContent).toContain('Perfilado de barba');

      // Lo dado de baja se distingue a la vista y se puede volver a publicar:
      // si no, una baja por error no tendría vuelta desde la pantalla.
      expect(filas()[1].textContent).toContain('Dado de baja');
      expect(filas()[0].textContent).not.toContain('Dado de baja');

      expect(botonDe(filas()[0], 'Dar de baja')).toBeDefined();
      expect(botonDe(filas()[1], 'Volver a publicar')).toBeDefined();

      // No se muestra jerga técnica en ningún lado.
      expect(texto()).not.toContain('duracion_minutos');
      expect(texto()).not.toContain('activo');
    });

    it('arranca con los valores de la base y el botón de guardar deshabilitado porque nada cambió', () => {
      const { filas, camposDe, botonDe } = armar();

      expect(filas()).toHaveLength(2);
      expect(camposDe(filas()[0]).map((campo) => campo.value)).toEqual([
        'Corte Clásico',
        'Corte tradicional.',
        '30',
        '15',
      ]);

      for (const fila of filas()) {
        expect(botonDe(fila, 'Guardar').disabled).toBe(true);
      }
    });

    it('el precio se edita en un campo de texto, no en uno numérico', () => {
      const { filas, camposDe } = armar();

      // `type="number"` rechaza la coma decimal, que es como escribe la
      // administradora. El campo es de texto y acepta coma o punto.
      const precio = camposDe(filas()[0])[3];
      expect(precio.type).toBe('text');
      expect(precio.getAttribute('inputmode')).toBe('decimal');
    });
  });

  describe('guardar un servicio', () => {
    it('manda los cuatro campos y confirma que ya se ve en el sitio', () => {
      const { filas, botonDe, actualizaciones, fixture, texto } = armar();
      const fila = filas()[0];

      escribirEnFila(fila, {
        nombre: 'Corte Premium',
        descripcion: 'Con lavado incluido.',
        duracion: '45',
        precio: '18,75',
      });
      fixture.detectChanges();

      expect(botonDe(fila, 'Guardar').disabled).toBe(false);
      botonDe(fila, 'Guardar').click();
      fixture.detectChanges();

      // La coma decimal se acepta y se normaliza a número.
      expect(actualizaciones).toEqual([
        {
          id: 1,
          datos: {
            nombre: 'Corte Premium',
            descripcion: 'Con lavado incluido.',
            duracionMinutos: 45,
            precio: 18.75,
          },
        },
      ]);

      expect(fila.textContent).toContain('Guardado. Ya se ve en el sitio.');
      expect(texto()).toContain('Ya se ve en el sitio');

      // La confirmación es de esa fila, no de la pantalla entera.
      expect(filas()[1].textContent).not.toContain('Guardado');
      expect(botonDe(fila, 'Guardar').disabled).toBe(true);
    });

    it('mientras guarda avisa que está guardando y no deja mandar dos veces', () => {
      const respuesta = new Subject<void>();
      const { filas, botonDe, actualizaciones, fixture } = armar({
        actualizar: () => respuesta,
      });
      const fila = filas()[0];

      escribirEnFila(fila, { nombre: 'Corte Premium' });
      fixture.detectChanges();
      botonDe(fila, 'Guardar').click();
      fixture.detectChanges();

      expect(fila.textContent).toContain('Guardando…');
      expect(botonDe(fila, 'Guardar').disabled).toBe(true);

      botonDe(fila, 'Guardar').click();
      expect(actualizaciones).toHaveLength(1);

      respuesta.next();
      respuesta.complete();
      fixture.detectChanges();

      expect(fila.textContent).not.toContain('Guardando…');
    });

    it('si falla muestra el error a la vista y NO muestra ninguna confirmación', () => {
      const { filas, botonDe, fixture, texto } = armar({
        actualizar: () =>
          throwError(() => new Error('new row violates row-level security policy')),
      });
      const fila = filas()[0];

      escribirEnFila(fila, { nombre: 'Corte Premium' });
      fixture.detectChanges();
      botonDe(fila, 'Guardar').click();
      fixture.detectChanges();

      expect(fila.textContent).toContain('No se pudo guardar');
      expect(fila.textContent).not.toContain('Guardado');
      expect(texto()).not.toContain('Ya se ve en el sitio');

      // El error de la base nunca se muestra crudo.
      expect(texto()).not.toContain('row-level security');

      // Y se puede reintentar sin recargar.
      expect(botonDe(fila, 'Guardar').disabled).toBe(false);
    });
  });

  describe('dar de baja y volver a publicar', () => {
    it('dar de baja manda activo en false y lo muestra como dado de baja', () => {
      const { filas, botonDe, cambiosDeActivo, fixture } = armar();

      botonDe(filas()[0], 'Dar de baja').click();
      fixture.detectChanges();

      expect(cambiosDeActivo).toEqual([{ id: 1, activo: false }]);

      expect(filas()[0].textContent).toContain('Dado de baja');
      expect(botonDe(filas()[0], 'Volver a publicar')).toBeDefined();
    });

    it('volver a publicar manda activo en true y vuelve a ofrecer la baja', () => {
      const { filas, botonDe, cambiosDeActivo, fixture } = armar();

      botonDe(filas()[1], 'Volver a publicar').click();
      fixture.detectChanges();

      expect(cambiosDeActivo).toEqual([{ id: 2, activo: true }]);

      expect(filas()[1].textContent).not.toContain('Dado de baja');
      expect(botonDe(filas()[1], 'Dar de baja')).toBeDefined();
    });

    it('si el cambio de estado falla, no lo da por hecho y muestra el error', () => {
      const { filas, botonDe, fixture, texto } = armar({
        cambiarActivo: () => throwError(() => new Error('sin red')),
      });

      botonDe(filas()[0], 'Dar de baja').click();
      fixture.detectChanges();

      expect(filas()[0].textContent).toContain('No se pudo cambiar');
      expect(botonDe(filas()[0], 'Dar de baja')).toBeDefined();
      expect(texto()).not.toContain('Ya no se ve en el sitio');
    });
  });

  describe('agregar un servicio', () => {
    it('crea con los datos escritos, recarga la lista y confirma', () => {
      const {
        nuevoCampo,
        botonAgregar,
        creados,
        consultas,
        fixture,
        texto,
      } = armar();

      escribir(nuevoCampo('nombre'), 'Color completo');
      escribir(nuevoCampo('descripcion'), 'Coloración y brushing.');
      escribir(nuevoCampo('duracion'), '90');
      escribir(nuevoCampo('precio'), '42,50');
      fixture.detectChanges();

      expect(consultas()).toBe(1);

      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toEqual([
        {
          nombre: 'Color completo',
          descripcion: 'Coloración y brushing.',
          duracionMinutos: 90,
          precio: 42.5,
        },
      ]);

      // Recarga la lista para que el servicio nuevo aparezca.
      expect(consultas()).toBe(2);
      expect(texto()).toContain('Servicio agregado. Ya se ve en el sitio.');
    });

    it('si falla, muestra el error, no confirma y no recarga', () => {
      const {
        nuevoCampo,
        botonAgregar,
        creados,
        consultas,
        fixture,
        texto,
      } = armar({
        crear: () => throwError(() => new Error('row-level security policy')),
      });

      escribir(nuevoCampo('nombre'), 'Color completo');
      escribir(nuevoCampo('descripcion'), 'Coloración y brushing.');
      escribir(nuevoCampo('duracion'), '90');
      escribir(nuevoCampo('precio'), '42,50');
      fixture.detectChanges();

      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toHaveLength(1);
      expect(consultas()).toBe(1);
      expect(texto()).toContain('No se pudo agregar el servicio');
      expect(texto()).not.toContain('Servicio agregado');
      expect(texto()).not.toContain('row-level security');
    });
  });

  describe('validaciones', () => {
    it('no deja guardar un nombre vacío y lo dice junto al campo', () => {
      const { filas, botonDe, actualizaciones, fixture, texto } = armar();
      const fila = filas()[0];

      escribirEnFila(fila, { nombre: '   ' });
      fixture.detectChanges();
      botonDe(fila, 'Guardar').click();
      fixture.detectChanges();

      expect(actualizaciones).toEqual([]);
      expect(fila.textContent).toContain('Escribí un nombre para el servicio');
      expect(texto()).not.toContain('Guardado');
    });

    it('no deja guardar una duración con decimales, en cero o negativa', () => {
      const { filas, botonDe, actualizaciones, fixture } = armar();

      for (const duracion of ['12.5', '2,5', '0', '-3']) {
        escribirEnFila(filas()[0], { duracion });
        fixture.detectChanges();
        botonDe(filas()[0], 'Guardar').click();
        fixture.detectChanges();
      }

      expect(actualizaciones).toEqual([]);
      expect(filas()[0].textContent).toContain('sin decimales');
      expect(filas()[0].textContent).toContain('mayor que cero');
    });

    it('no deja guardar un precio con letras ni negativo', () => {
      const { filas, botonDe, actualizaciones, fixture } = armar();

      for (const precio of ['abc', '-5']) {
        escribirEnFila(filas()[0], { precio });
        fixture.detectChanges();
        botonDe(filas()[0], 'Guardar').click();
        fixture.detectChanges();
      }

      expect(actualizaciones).toEqual([]);
      expect(filas()[0].textContent).toContain('Poné el precio con números');
    });

    it('las mismas reglas frenan el alta de un servicio', () => {
      const { botonAgregar, creados, fixture, texto } = armar();

      // El formulario de alta arranca vacío: no hay que inventarle nada.
      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toEqual([]);
      expect(texto()).toContain('Escribí un nombre para el servicio');
      expect(texto()).toContain('sin decimales');
      expect(texto()).toContain('Poné el precio con números');
    });
  });

  describe('estados de carga, error y vacío', () => {
    it('mientras la lista está en camino avisa que está cargando y no muestra filas', () => {
      const enCamino = new Subject<ServicioAdministrable[]>();
      const { texto, filas, fixture } = armar({ consultar: () => enCamino });

      expect(texto()).toContain(MENSAJES.cargando);
      expect(filas()).toHaveLength(0);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);

      enCamino.next(SERVICIOS);
      enCamino.complete();
      fixture.detectChanges();

      expect(texto()).not.toContain(MENSAJES.cargando);
      expect(filas()).toHaveLength(2);
    });

    it('si la lectura falla muestra el error con su botón de reintentar', () => {
      const { texto, filas, fixture } = armar({
        consultar: () => throwError(() => new Error('sin red')),
      });

      expect(texto()).toContain(MENSAJES.errorAlCargar);
      expect(filas()).toHaveLength(0);

      const reintentar = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((boton) => (boton as HTMLButtonElement).textContent?.includes(MENSAJES.reintentar));

      expect(reintentar).toBeDefined();
    });

    it('el botón de reintentar vuelve a pedir la lista y esta vez la muestra', () => {
      let respuesta: Observable<ServicioAdministrable[]> = throwError(
        () => new Error('sin red'),
      );
      const { texto, filas, fixture } = armar({ consultar: () => respuesta });

      expect(texto()).toContain(MENSAJES.errorAlCargar);

      respuesta = of(SERVICIOS);
      const reintentar = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((boton) => (boton as HTMLButtonElement).textContent?.includes(MENSAJES.reintentar));

      (reintentar as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(filas()).toHaveLength(2);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
    });

    it('una lista vacía de verdad dice que no hay servicios, no que hubo un error', () => {
      const { texto, filas } = armar({ consultar: () => of([]) });

      expect(texto()).toContain('Todavía no hay servicios');
      expect(filas()).toHaveLength(0);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain(MENSAJES.cargando);
    });
  });
});
