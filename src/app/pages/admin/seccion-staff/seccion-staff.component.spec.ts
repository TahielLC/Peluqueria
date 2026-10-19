import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SeccionStaffComponent } from './seccion-staff.component';
import { AppointmentService } from '../../../services/appointment.service';
import { SubidaDeFotosService } from '../../../services/subida-de-fotos.service';
import { RecortadorDeFotoComponent } from '../../../components/recortador-de-foto/recortador-de-foto.component';
import { DatosDePeluquero, PeluqueroAdministrable } from '../../../models/appointment.model';
import { MENSAJES } from '../../../components/estados';

/**
 * Perfiles de prueba con la forma que devuelve la base.
 *
 * Hay uno activo y uno dado de baja a propósito: la pantalla tiene que mostrar
 * los dos y ofrecer una acción distinta para cada uno.
 */
const SOFIA: PeluqueroAdministrable = {
  id: 1,
  nombre: 'Sofía Martínez',
  rol: 'Colorimetría',
  experiencia: 'Arrancó en 2020 y se especializó en color.',
  titulo: 'Tecnicatura (2021)',
  fotoUrl: 'https://fotos.test/sofia.jpg',
  activo: true,
};

const LUCAS: PeluqueroAdministrable = {
  id: 2,
  nombre: 'Lucas Pérez',
  rol: 'Fade',
  experiencia: 'Trabaja desde 2022.',
  fotoUrl: 'https://fotos.test/lucas.jpg',
  activo: false,
};

const PERFILES = [SOFIA, LUCAS];

interface Opciones {
  consultar?: () => Observable<PeluqueroAdministrable[]>;
  actualizar?: () => Observable<void>;
  cambiarActivo?: () => Observable<void>;
  crear?: () => Observable<void>;
}

interface Actualizacion {
  id: number;
  datos: DatosDePeluquero;
}

interface CambioDeActivo {
  id: number;
  activo: boolean;
}

/** Arma el editor con perfiles falsos y registra lo que se le pide. */
function armar(opciones: Opciones = {}) {
  const consultar = opciones.consultar ?? (() => of(PERFILES));
  const actualizaciones: Actualizacion[] = [];
  const cambiosDeActivo: CambioDeActivo[] = [];
  const creados: DatosDePeluquero[] = [];
  let consultas = 0;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AppointmentService,
        useValue: {
          getTodosLosPeluqueros: () => {
            consultas += 1;
            return consultar();
          },
          actualizarPeluquero: (id: number, datos: DatosDePeluquero) => {
            actualizaciones.push({ id, datos });
            return (opciones.actualizar ?? (() => of(void 0)))();
          },
          cambiarActivoDePeluquero: (id: number, activo: boolean) => {
            cambiosDeActivo.push({ id, activo });
            return (opciones.cambiarActivo ?? (() => of(void 0)))();
          },
          crearPeluquero: (datos: DatosDePeluquero) => {
            creados.push(datos);
            return (opciones.crear ?? (() => of(void 0)))();
          },
        },
      },
      {
        // El selector de foto es real y se monta en cada fila y en el alta. Sólo
        // se dobla la subida, para no salir a la red.
        provide: SubidaDeFotosService,
        useValue: {
          subirFoto: () => of('https://fotos.test/nueva.jpg'),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(SeccionStaffComponent);
  fixture.detectChanges();

  const filas = () =>
    Array.from(fixture.nativeElement.querySelectorAll('li')) as HTMLElement[];

  const campo = (id: number, nombre: 'nombre' | 'rol' | 'titulo') => {
    const encontrado = fixture.nativeElement.querySelector(
      `#perfil-${id}-${nombre}`,
    ) as HTMLInputElement | null;
    if (!encontrado) throw new Error(`No existe el campo "${nombre}" del perfil ${id}`);
    return encontrado;
  };

  const experiencia = (id: number) => {
    const encontrado = fixture.nativeElement.querySelector(
      `#perfil-${id}-experiencia`,
    ) as HTMLTextAreaElement | null;
    if (!encontrado) throw new Error(`No existe la trayectoria del perfil ${id}`);
    return encontrado;
  };

  const botonGuardar = (id: number) => {
    const fila = filas().find((candidata) =>
      candidata.querySelector(`#perfil-${id}-nombre`),
    );
    if (!fila) throw new Error(`No está la fila del perfil ${id}`);

    const boton = Array.from(fila.querySelectorAll('button')).find((candidato) =>
      candidato.textContent?.includes('Guardar'),
    ) as HTMLButtonElement | undefined;

    if (!boton) throw new Error(`No hay botón de guardar en el perfil ${id}`);
    return boton;
  };

  /**
   * Confirma el encuadre con un recorte de prueba.
   *
   * jsdom no dibuja canvas, así que en vez de apretar "Usar esta foto" se
   * emite el recorte que ese botón produciría.
   */
  const confirmarRecorte = () => {
    const recortadores = fixture.debugElement.queryAll(
      By.directive(RecortadorDeFotoComponent),
    );
    const recortador = recortadores[recortadores.length - 1];
    if (!recortador) throw new Error('No se abrió el recortador de foto');

    recortador.componentInstance.recorteConfirmado.emit(
      new Blob(['recorte'], { type: 'image/webp' }),
    );
    fixture.detectChanges();
  };

  /** Elige una foto nueva en la fila, a través del selector real. */
  const elegirFoto = (id: number) => {
    const fila = filas().find((candidata) =>
      candidata.querySelector(`#perfil-${id}-nombre`),
    );
    const entrada = fila?.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!entrada) throw new Error(`No hay selector de foto en el perfil ${id}`);

    Object.defineProperty(entrada, 'files', {
      value: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })],
      configurable: true,
    });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    confirmarRecorte();
  };

  /** Busca un botón por su texto y falla con un mensaje claro si no está. */
  const botonCon = (raiz: ParentNode, texto: string): HTMLButtonElement => {
    const boton = Array.from(raiz.querySelectorAll('button')).find((candidato) =>
      candidato.textContent?.includes(texto),
    ) as HTMLButtonElement | undefined;

    if (!boton) throw new Error(`No hay ningún botón que diga "${texto}"`);
    return boton;
  };

  const seccionAlta = () =>
    fixture.nativeElement.querySelector(
      'section[aria-label="Agregar una persona"]',
    ) as HTMLElement | null;

  /** Abre el formulario de alta. */
  const abrirAlta = () => {
    botonCon(fixture.nativeElement, 'Agregar una persona').click();
    fixture.detectChanges();
  };

  const nuevoCampo = (nombre: 'nombre' | 'rol' | 'experiencia' | 'titulo') => {
    const encontrado = fixture.nativeElement.querySelector(
      `#nueva-persona-${nombre}`,
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!encontrado) throw new Error(`No existe el campo de alta "${nombre}"`);
    return encontrado;
  };

  const botonAgregar = () => {
    const seccion = seccionAlta();
    if (!seccion) throw new Error('No está el formulario de alta');
    return botonCon(seccion, 'Agregar');
  };

  /** Elige la foto del formulario de alta, a través del selector real. */
  const elegirFotoNueva = () => {
    const seccion = seccionAlta();
    const entrada = seccion?.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!entrada) throw new Error('No hay selector de foto en el alta');

    Object.defineProperty(entrada, 'files', {
      value: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })],
      configurable: true,
    });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    confirmarRecorte();
  };

  return {
    component: fixture.componentInstance,
    fixture,
    actualizaciones,
    cambiosDeActivo,
    creados,
    consultas: () => consultas,
    filas,
    campo,
    experiencia,
    botonGuardar,
    botonDe: (fila: HTMLElement, texto: string) => botonCon(fila, texto),
    elegirFoto,
    seccionAlta,
    abrirAlta,
    nuevoCampo,
    botonAgregar,
    elegirFotoNueva,
    /** Lo que la persona realmente ve. */
    texto: () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' '),
  };
}

/** Escribe en un campo como lo haría la persona. */
function escribir(campo: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

describe('SeccionStaffComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('la lista de perfiles', () => {
    it('muestra los cinco campos editables de cada perfil', () => {
      const { filas, campo, experiencia, texto } = armar();

      expect(filas()).toHaveLength(2);

      expect(campo(1, 'nombre').value).toBe('Sofía Martínez');
      expect(campo(1, 'rol').value).toBe('Colorimetría');
      expect(experiencia(1).value).toBe('Arrancó en 2020 y se especializó en color.');
      expect(campo(1, 'titulo').value).toBe('Tecnicatura (2021)');

      // La trayectoria es un texto largo: se edita en un área de varias líneas.
      expect(experiencia(1).tagName).toBe('TEXTAREA');
      expect(experiencia(1).getAttribute('rows')).toBe('3');

      // El perfil sin título se puede editar igual, con el campo vacío.
      expect(campo(2, 'titulo').value).toBe('');
      expect(filas()[1].querySelector('input[type="file"]')).not.toBeNull();

      // La ayuda explica qué pasa si el título queda vacío.
      expect(texto()).toContain('Si lo dejás vacío, no se muestra en el sitio');

      // La persona se administra desde esta misma pantalla: hay alta y baja.
      expect(texto()).toContain('Agregar una persona');
      expect(texto()).toContain('Dar de baja');
    });

    it('arranca sin cambios pendientes y con guardar deshabilitado en cada fila', () => {
      const { botonGuardar } = armar();

      expect(botonGuardar(1).disabled).toBe(true);
      expect(botonGuardar(2).disabled).toBe(true);
    });
  });

  describe('guardar un perfil', () => {
    it('manda los cinco campos, confirma y deja de ofrecer guardar', () => {
      const { campo, experiencia, botonGuardar, actualizaciones, filas, fixture, texto } =
        armar();

      escribir(campo(1, 'nombre'), 'Sofía G. Martínez');
      escribir(campo(1, 'rol'), 'Color y peinado');
      escribir(experiencia(1), 'Arrancó en 2020 y hoy dicta talleres de color.');
      escribir(campo(1, 'titulo'), '');
      fixture.detectChanges();

      expect(botonGuardar(1).disabled).toBe(false);
      botonGuardar(1).click();
      fixture.detectChanges();

      expect(actualizaciones).toEqual([
        {
          id: 1,
          datos: {
            nombre: 'Sofía G. Martínez',
            rol: 'Color y peinado',
            experiencia: 'Arrancó en 2020 y hoy dicta talleres de color.',
            titulo: '',
            fotoUrl: 'https://fotos.test/sofia.jpg',
          },
        },
      ]);

      expect(texto()).toContain('Guardado. Ya se ve en el sitio.');
      expect(botonGuardar(1).disabled).toBe(true);

      // La confirmación es de esa fila, no de la pantalla entera.
      expect(filas()[1].textContent).not.toContain('Guardado');
    });

    it('mientras guarda avisa y no deja mandar dos veces', () => {
      const respuesta = new Subject<void>();
      const { campo, botonGuardar, actualizaciones, fixture, texto } = armar({
        actualizar: () => respuesta,
      });

      escribir(campo(1, 'nombre'), 'Sofía G. Martínez');
      fixture.detectChanges();
      botonGuardar(1).click();
      fixture.detectChanges();

      expect(texto()).toContain('Guardando…');
      expect(botonGuardar(1).disabled).toBe(true);

      botonGuardar(1).click();
      expect(actualizaciones).toHaveLength(1);

      respuesta.next();
      respuesta.complete();
      fixture.detectChanges();

      expect(texto()).not.toContain('Guardando…');
    });

    it('si falla muestra el error a la vista y NO muestra ninguna confirmación', () => {
      const { campo, botonGuardar, fixture, texto } = armar({
        actualizar: () =>
          throwError(() => new Error('new row violates row-level security policy')),
      });

      escribir(campo(1, 'nombre'), 'Sofía G. Martínez');
      fixture.detectChanges();
      botonGuardar(1).click();
      fixture.detectChanges();

      expect(texto()).toContain('No se pudo guardar este perfil');
      expect(texto()).not.toContain('Guardado. Ya se ve en el sitio.');
      expect(texto()).not.toContain('row-level security');

      // Y se puede reintentar sin recargar.
      expect(botonGuardar(1).disabled).toBe(false);
    });
  });

  describe('cambiar la foto', () => {
    it('cuenta como cambio pendiente y guarda la URL nueva', () => {
      const { elegirFoto, botonGuardar, actualizaciones, fixture } = armar();

      expect(botonGuardar(1).disabled).toBe(true);

      elegirFoto(1);

      // La foto nueva no está en el sitio hasta que se guarde la fila.
      expect(botonGuardar(1).disabled).toBe(false);
      expect(fixture.nativeElement.textContent).toContain('Acordate de guardar');

      botonGuardar(1).click();
      fixture.detectChanges();

      expect(actualizaciones).toHaveLength(1);
      expect(actualizaciones[0].datos.fotoUrl).toBe('https://fotos.test/nueva.jpg');

      // Los otros cuatro campos viajan tal como estaban.
      expect(actualizaciones[0].datos).toMatchObject({
        nombre: 'Sofía Martínez',
        rol: 'Colorimetría',
        experiencia: 'Arrancó en 2020 y se especializó en color.',
        titulo: 'Tecnicatura (2021)',
      });
    });
  });

  describe('dar de baja y volver a publicar', () => {
    it('lista los perfiles dados de baja apagados y con la acción de volver a publicar', () => {
      const { filas, botonDe } = armar();

      expect(filas()).toHaveLength(2);

      expect(filas()[1].className).toContain('opacity-60');
      expect(filas()[1].textContent).toContain('Dado de baja');
      expect(filas()[0].className).not.toContain('opacity-60');
      expect(filas()[0].textContent).not.toContain('Dado de baja');

      expect(botonDe(filas()[0], 'Dar de baja')).toBeDefined();
      expect(botonDe(filas()[1], 'Volver a publicar')).toBeDefined();
    });

    it('dar de baja manda activo en false y deja la fila apagada con volver a publicar', () => {
      const { filas, botonDe, cambiosDeActivo, fixture } = armar();

      botonDe(filas()[0], 'Dar de baja').click();
      fixture.detectChanges();

      expect(cambiosDeActivo).toEqual([{ id: 1, activo: false }]);

      expect(filas()[0].className).toContain('opacity-60');
      expect(filas()[0].textContent).toContain('Dado de baja');
      expect(filas()[0].textContent).toContain('Dado de baja. Ya no se ve en el sitio.');
      expect(botonDe(filas()[0], 'Volver a publicar')).toBeDefined();
    });

    it('volver a publicar manda activo en true y vuelve a ofrecer la baja', () => {
      const { filas, botonDe, cambiosDeActivo, fixture } = armar();

      botonDe(filas()[1], 'Volver a publicar').click();
      fixture.detectChanges();

      expect(cambiosDeActivo).toEqual([{ id: 2, activo: true }]);

      expect(filas()[1].className).not.toContain('opacity-60');
      expect(filas()[1].textContent).not.toContain('Dado de baja');
      expect(filas()[1].textContent).toContain('Publicado. Ya se ve en el sitio.');
      expect(botonDe(filas()[1], 'Dar de baja')).toBeDefined();
    });
  });

  describe('agregar una persona', () => {
    it('crea con los datos elegidos, recarga la lista y deja la persona al final', () => {
      const lista = [...PERFILES];
      const {
        abrirAlta,
        nuevoCampo,
        botonAgregar,
        elegirFotoNueva,
        creados,
        consultas,
        seccionAlta,
        filas,
        fixture,
        texto,
      } = armar({
        consultar: () => of(lista),
        crear: () => {
          lista.push({
            id: 3,
            nombre: 'Martina López',
            rol: 'Corte y color',
            experiencia: 'Trabaja desde 2019.',
            titulo: 'Tecnicatura (2020)',
            fotoUrl: 'https://fotos.test/nueva.jpg',
            activo: true,
          });
          return of(void 0);
        },
      });

      abrirAlta();

      escribir(nuevoCampo('nombre'), 'Martina López');
      escribir(nuevoCampo('rol'), 'Corte y color');
      escribir(nuevoCampo('experiencia'), 'Trabaja desde 2019.');
      escribir(nuevoCampo('titulo'), 'Tecnicatura (2020)');
      elegirFotoNueva();
      fixture.detectChanges();

      expect(consultas()).toBe(1);

      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toEqual([
        {
          nombre: 'Martina López',
          rol: 'Corte y color',
          experiencia: 'Trabaja desde 2019.',
          titulo: 'Tecnicatura (2020)',
          fotoUrl: 'https://fotos.test/nueva.jpg',
        },
      ]);

      // Recarga la lista para que la persona nueva aparezca.
      expect(consultas()).toBe(2);
      expect(texto()).toContain('Persona agregada. Ya se ve en el sitio.');

      // El formulario se destruye al terminar bien: así el selector de foto se
      // recrea limpio y no queda mostrando la foto anterior como si fuera nueva.
      expect(seccionAlta()).toBeNull();

      // La persona nueva queda al final de la lista.
      expect(filas()).toHaveLength(3);
      expect(filas()[2].textContent).toContain('Martina López');
    });

    it('no crea una persona sin foto aunque el nombre esté completo', () => {
      const { abrirAlta, nuevoCampo, botonAgregar, creados, fixture, texto } = armar();

      abrirAlta();
      escribir(nuevoCampo('nombre'), 'Martina López');
      fixture.detectChanges();

      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toEqual([]);
      expect(texto()).toContain('Subí una foto para la persona.');
      expect(texto()).not.toContain('Escribí un nombre para la persona.');
    });

    it('no crea una persona sin nombre aunque la foto esté elegida', () => {
      const { abrirAlta, botonAgregar, elegirFotoNueva, creados, fixture, texto } = armar();

      abrirAlta();
      elegirFotoNueva();

      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toEqual([]);
      expect(texto()).toContain('Escribí un nombre para la persona.');
      expect(texto()).not.toContain('Subí una foto para la persona.');
    });

    it('cancelar cierra el formulario sin crear ni recargar', () => {
      const { abrirAlta, botonDe, creados, consultas, seccionAlta, fixture } = armar();

      abrirAlta();
      const seccion = seccionAlta();
      if (!seccion) throw new Error('No se abrió el formulario de alta');

      botonDe(seccion, 'Cancelar').click();
      fixture.detectChanges();

      expect(creados).toEqual([]);
      expect(consultas()).toBe(1);
      expect(seccionAlta()).toBeNull();
    });
  });

  describe('estados de carga, error y vacío', () => {
    it('mientras la lista está en camino avisa que está cargando y no muestra filas', () => {
      const enCamino = new Subject<PeluqueroAdministrable[]>();
      const { texto, filas, fixture } = armar({ consultar: () => enCamino });

      expect(texto()).toContain(MENSAJES.cargando);
      expect(filas()).toHaveLength(0);

      enCamino.next(PERFILES);
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

    it('el botón de reintentar vuelve a pedir los perfiles y esta vez los muestra', () => {
      let respuesta: Observable<PeluqueroAdministrable[]> = throwError(
        () => new Error('sin red'),
      );
      const { texto, filas, fixture } = armar({ consultar: () => respuesta });

      expect(texto()).toContain(MENSAJES.errorAlCargar);

      respuesta = of(PERFILES);
      const reintentar = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((boton) => (boton as HTMLButtonElement).textContent?.includes(MENSAJES.reintentar));

      (reintentar as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(filas()).toHaveLength(2);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
    });

    it('una lista vacía de verdad dice que no hay perfiles, no que hubo un error', () => {
      const { texto, filas } = armar({ consultar: () => of([]) });

      expect(texto()).toContain('Todavía no hay perfiles');
      expect(filas()).toHaveLength(0);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain(MENSAJES.cargando);
    });
  });
});
