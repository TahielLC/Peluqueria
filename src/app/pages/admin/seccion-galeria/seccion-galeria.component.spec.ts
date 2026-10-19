import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SeccionGaleriaComponent } from './seccion-galeria.component';
import { AppointmentService } from '../../../services/appointment.service';
import { SubidaDeFotosService } from '../../../services/subida-de-fotos.service';
import { RecortadorDeFotoComponent } from '../../../components/recortador-de-foto/recortador-de-foto.component';
import { DatosDeTrabajoDeGaleria, TrabajoDeGaleriaAdministrable } from '../../../models/salon.model';
import { MENSAJES } from '../../../components/estados';

/**
 * Trabajos de prueba con la forma que devuelve la base.
 *
 * Hay uno activo y uno dado de baja a propósito: la pantalla tiene que mostrar
 * los dos y ofrecer una acción distinta para cada uno.
 */
const FADE: TrabajoDeGaleriaAdministrable = {
  id: 1,
  titulo: 'Fade moderno',
  categoria: 'Corte',
  imagenUrl: 'https://fotos.test/fade.jpg',
  activo: true,
};

const CARAMELO: TrabajoDeGaleriaAdministrable = {
  id: 2,
  titulo: 'Color caramelo',
  categoria: 'Color',
  imagenUrl: 'https://fotos.test/caramelo.jpg',
  activo: false,
};

const TRABAJOS = [FADE, CARAMELO];

interface Opciones {
  consultar?: () => Observable<TrabajoDeGaleriaAdministrable[]>;
  actualizar?: () => Observable<void>;
  cambiarActivo?: () => Observable<void>;
  crear?: () => Observable<void>;
}

interface Actualizacion {
  id: number;
  datos: DatosDeTrabajoDeGaleria;
}

interface CambioDeActivo {
  id: number;
  activo: boolean;
}

/** Arma el editor con trabajos falsos y registra lo que se le pide. */
function armar(opciones: Opciones = {}) {
  const consultar = opciones.consultar ?? (() => of(TRABAJOS));
  const actualizaciones: Actualizacion[] = [];
  const cambiosDeActivo: CambioDeActivo[] = [];
  const creados: DatosDeTrabajoDeGaleria[] = [];
  let consultas = 0;

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AppointmentService,
        useValue: {
          getTodaLaGaleria: () => {
            consultas += 1;
            return consultar();
          },
          actualizarTrabajoDeGaleria: (id: number, datos: DatosDeTrabajoDeGaleria) => {
            actualizaciones.push({ id, datos });
            return (opciones.actualizar ?? (() => of(void 0)))();
          },
          cambiarActivoDeTrabajoDeGaleria: (id: number, activo: boolean) => {
            cambiosDeActivo.push({ id, activo });
            return (opciones.cambiarActivo ?? (() => of(void 0)))();
          },
          crearTrabajoDeGaleria: (datos: DatosDeTrabajoDeGaleria) => {
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

  const fixture = TestBed.createComponent(SeccionGaleriaComponent);
  fixture.detectChanges();

  /** Las filas de trabajos (el formulario de alta no es un `li`). */
  const filas = () =>
    Array.from(fixture.nativeElement.querySelectorAll('li')) as HTMLElement[];

  const seccionAlta = () =>
    fixture.nativeElement.querySelector(
      'section[aria-label="Agregar un trabajo"]',
    ) as HTMLElement | null;

  /** Busca un botón por su texto y falla con un mensaje claro si no está. */
  const botonCon = (raiz: ParentNode, texto: string): HTMLButtonElement => {
    const boton = Array.from(raiz.querySelectorAll('button')).find((candidato) =>
      candidato.textContent?.includes(texto),
    ) as HTMLButtonElement | undefined;

    if (!boton) throw new Error(`No hay ningún botón que diga "${texto}"`);
    return boton;
  };

  const campo = (id: number, nombre: 'titulo') => {
    const encontrado = fixture.nativeElement.querySelector(
      `#trabajo-${id}-${nombre}`,
    ) as HTMLInputElement | null;
    if (!encontrado) throw new Error(`No existe el campo "${nombre}" del trabajo ${id}`);
    return encontrado;
  };

  const categoria = (id: number) => {
    const encontrado = fixture.nativeElement.querySelector(
      `#trabajo-${id}-categoria`,
    ) as HTMLSelectElement | null;
    if (!encontrado) throw new Error(`No existe la categoría del trabajo ${id}`);
    return encontrado;
  };

  const botonGuardar = (id: number) => {
    const fila = filas().find((candidata) =>
      candidata.querySelector(`#trabajo-${id}-titulo`),
    );
    if (!fila) throw new Error(`No está la fila del trabajo ${id}`);
    return botonCon(fila, 'Guardar');
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
      candidata.querySelector(`#trabajo-${id}-titulo`),
    );
    const entrada = fila?.querySelector('input[type="file"]') as HTMLInputElement | null;
    if (!entrada) throw new Error(`No hay selector de foto en el trabajo ${id}`);

    Object.defineProperty(entrada, 'files', {
      value: [new File(['x'], 'foto.jpg', { type: 'image/jpeg' })],
      configurable: true,
    });
    entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    confirmarRecorte();
  };

  /** Abre el formulario de alta. */
  const abrirAlta = () => {
    botonCon(fixture.nativeElement, 'Agregar trabajo').click();
    fixture.detectChanges();
  };

  const nuevoCampo = (nombre: 'titulo') => {
    const encontrado = fixture.nativeElement.querySelector(
      `#nuevo-trabajo-${nombre}`,
    ) as HTMLInputElement | null;
    if (!encontrado) throw new Error(`No existe el campo de alta "${nombre}"`);
    return encontrado;
  };

  const nuevaCategoria = () => {
    const encontrado = fixture.nativeElement.querySelector(
      '#nuevo-trabajo-categoria',
    ) as HTMLSelectElement | null;
    if (!encontrado) throw new Error('No existe la categoría del alta');
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
    categoria,
    botonGuardar,
    botonDe: (fila: HTMLElement, texto: string) => botonCon(fila, texto),
    elegirFoto,
    seccionAlta,
    abrirAlta,
    nuevoCampo,
    nuevaCategoria,
    botonAgregar,
    elegirFotoNueva,
    /** Lo que la persona realmente ve. */
    texto: () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' '),
  };
}

/** Escribe en un campo como lo haría la persona. */
function escribir(campo: HTMLInputElement, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

/** Elige una opción de un `<select>` como lo haría la persona. */
function elegir(select: HTMLSelectElement, valor: string): void {
  select.value = valor;
  select.dispatchEvent(new Event('change'));
}

describe('SeccionGaleriaComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('la lista de trabajos', () => {
    it('muestra los activos y los inactivos, con la acción que corresponde a cada uno', () => {
      const { filas, botonDe, texto } = armar();

      expect(filas()).toHaveLength(2);
      expect(filas()[0].textContent).toContain('Fade moderno');
      expect(filas()[1].textContent).toContain('Color caramelo');

      // Lo dado de baja se distingue a la vista y se puede volver a publicar:
      // si no, una baja por error no tendría vuelta desde la pantalla.
      expect(filas()[1].textContent).toContain('Dado de baja');
      expect(filas()[0].textContent).not.toContain('Dado de baja');

      expect(botonDe(filas()[0], 'Dar de baja')).toBeDefined();
      expect(botonDe(filas()[1], 'Volver a publicar')).toBeDefined();

      // No se muestra jerga técnica en ningún lado.
      expect(texto()).not.toContain('imagen_url');
      expect(texto()).not.toContain('categoria');
      expect(texto()).not.toContain('activo');
    });

    it('arranca con los valores de la base y el botón de guardar deshabilitado porque nada cambió', () => {
      const { filas, campo, categoria, botonGuardar } = armar();

      expect(filas()).toHaveLength(2);
      expect(campo(1, 'titulo').value).toBe('Fade moderno');
      expect(categoria(1).value).toBe('Corte');
      expect(campo(2, 'titulo').value).toBe('Color caramelo');
      expect(categoria(2).value).toBe('Color');

      for (const fila of filas()) {
        expect(botonGuardar(Number(fila.querySelector('input')?.id?.split('-')[1]))).toBeDefined();
      }

      expect(botonGuardar(1).disabled).toBe(true);
      expect(botonGuardar(2).disabled).toBe(true);
    });

    it('el select ofrece las cuatro categorías y manda la elegida', () => {
      const { categoria, botonGuardar, actualizaciones, fixture } = armar();

      expect(Array.from(categoria(1).options).map((opcion) => opcion.value)).toEqual([
        'Corte',
        'Peinado',
        'Barba',
        'Color',
      ]);

      elegir(categoria(1), 'Barba');
      fixture.detectChanges();

      expect(botonGuardar(1).disabled).toBe(false);
      botonGuardar(1).click();
      fixture.detectChanges();

      expect(actualizaciones).toEqual([
        {
          id: 1,
          datos: {
            titulo: 'Fade moderno',
            categoria: 'Barba',
            imagenUrl: 'https://fotos.test/fade.jpg',
          },
        },
      ]);
    });
  });

  describe('guardar un trabajo', () => {
    it('manda el título, la categoría y la foto, y confirma que ya se ve en el sitio', () => {
      const { filas, campo, botonGuardar, actualizaciones, fixture, texto } = armar();
      const fila = filas()[0];

      escribir(campo(1, 'titulo'), 'Fade con diseño');
      fixture.detectChanges();

      expect(botonGuardar(1).disabled).toBe(false);
      botonGuardar(1).click();
      fixture.detectChanges();

      expect(actualizaciones).toEqual([
        {
          id: 1,
          datos: {
            titulo: 'Fade con diseño',
            categoria: 'Corte',
            imagenUrl: 'https://fotos.test/fade.jpg',
          },
        },
      ]);

      expect(fila.textContent).toContain('Guardado. Ya se ve en el sitio.');
      expect(texto()).toContain('Ya se ve en el sitio');

      // La confirmación es de esa fila, no de la pantalla entera.
      expect(filas()[1].textContent).not.toContain('Guardado');
      expect(botonGuardar(1).disabled).toBe(true);
    });

    it('al guardar un trabajo dado de baja confirma que ya no se ve', () => {
      const { filas, botonGuardar, fixture } = armar();

      escribir(
        filas()[1].querySelector('input') as HTMLInputElement,
        'Color caramelo nuevo',
      );
      fixture.detectChanges();
      botonGuardar(2).click();
      fixture.detectChanges();

      expect(filas()[1].textContent).toContain('Guardado. Ya no se ve en el sitio.');
      expect(filas()[1].textContent).not.toContain('Guardado. Ya se ve en el sitio.');
    });

    it('mientras guarda avisa que está guardando y no deja mandar dos veces', () => {
      const respuesta = new Subject<void>();
      const { filas, botonGuardar, actualizaciones, fixture } = armar({
        actualizar: () => respuesta,
      });
      const fila = filas()[0];

      escribir(fila.querySelector('input') as HTMLInputElement, 'Fade con diseño');
      fixture.detectChanges();
      botonGuardar(1).click();
      fixture.detectChanges();

      expect(fila.textContent).toContain('Guardando…');
      expect(botonGuardar(1).disabled).toBe(true);

      botonGuardar(1).click();
      expect(actualizaciones).toHaveLength(1);

      respuesta.next();
      respuesta.complete();
      fixture.detectChanges();

      expect(fila.textContent).not.toContain('Guardando…');
    });

    it('si falla muestra el error a la vista y NO muestra ninguna confirmación', () => {
      const { filas, botonGuardar, fixture, texto } = armar({
        actualizar: () =>
          throwError(() => new Error('new row violates row-level security policy')),
      });
      const fila = filas()[0];

      escribir(fila.querySelector('input') as HTMLInputElement, 'Fade con diseño');
      fixture.detectChanges();
      botonGuardar(1).click();
      fixture.detectChanges();

      expect(fila.textContent).toContain('No se pudo guardar este trabajo');
      expect(fila.textContent).not.toContain('Guardado');
      expect(texto()).not.toContain('Ya se ve en el sitio');

      // El error de la base nunca se muestra crudo.
      expect(texto()).not.toContain('row-level security');

      // Y se puede reintentar sin recargar.
      expect(botonGuardar(1).disabled).toBe(false);
    });
  });

  describe('cambiar la foto de un trabajo', () => {
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
      expect(actualizaciones[0].datos.imagenUrl).toBe('https://fotos.test/nueva.jpg');

      // Los otros dos campos viajan tal como estaban.
      expect(actualizaciones[0].datos).toMatchObject({
        titulo: 'Fade moderno',
        categoria: 'Corte',
      });
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

  describe('agregar un trabajo', () => {
    it('exige título y foto antes de crear', () => {
      const { abrirAlta, botonAgregar, creados, fixture, texto } = armar();

      abrirAlta();
      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toEqual([]);
      expect(texto()).toContain('Escribí un título para el trabajo');
      expect(texto()).toContain('Subí una foto para el trabajo');
    });

    it('no crea un trabajo sin foto aunque el título esté completo', () => {
      const { abrirAlta, nuevoCampo, botonAgregar, creados, fixture, texto } = armar();

      abrirAlta();
      escribir(nuevoCampo('titulo'), 'Peinado con ondas');
      fixture.detectChanges();

      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toEqual([]);
      expect(texto()).toContain('Subí una foto para el trabajo');
      expect(texto()).not.toContain('Escribí un título para el trabajo');
    });

    it('crea con los datos elegidos, recarga la lista y cierra el formulario', () => {
      const {
        abrirAlta,
        nuevoCampo,
        nuevaCategoria,
        botonAgregar,
        elegirFotoNueva,
        creados,
        consultas,
        seccionAlta,
        fixture,
        texto,
      } = armar();

      abrirAlta();

      escribir(nuevoCampo('titulo'), 'Peinado con ondas');
      elegir(nuevaCategoria(), 'Peinado');
      elegirFotoNueva();

      expect(consultas()).toBe(1);

      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toEqual([
        {
          titulo: 'Peinado con ondas',
          categoria: 'Peinado',
          imagenUrl: 'https://fotos.test/nueva.jpg',
        },
      ]);

      // Recarga la lista para que el trabajo nuevo aparezca.
      expect(consultas()).toBe(2);
      expect(texto()).toContain('Trabajo agregado. Ya se ve en el sitio.');

      // El formulario se destruye al terminar bien: así el selector de foto se
      // recrea limpio y no queda mostrando la foto anterior como si fuera nueva.
      expect(seccionAlta()).toBeNull();

      abrirAlta();
      expect(seccionAlta()?.querySelector('img')).toBeNull();
      expect(seccionAlta()?.textContent).toContain('Sin foto');
    });

    it('si falla, muestra el error, no confirma y no recarga ni cierra el formulario', () => {
      const {
        abrirAlta,
        nuevoCampo,
        botonAgregar,
        elegirFotoNueva,
        creados,
        consultas,
        seccionAlta,
        fixture,
        texto,
      } = armar({
        crear: () => throwError(() => new Error('row-level security policy')),
      });

      abrirAlta();
      escribir(nuevoCampo('titulo'), 'Peinado con ondas');
      elegirFotoNueva();

      botonAgregar().click();
      fixture.detectChanges();

      expect(creados).toHaveLength(1);
      expect(consultas()).toBe(1);
      expect(texto()).toContain('No se pudo agregar el trabajo');
      expect(texto()).not.toContain('Trabajo agregado');
      expect(texto()).not.toContain('row-level security');

      // El formulario sigue abierto para reintentar sin volver a escribir todo.
      expect(seccionAlta()).not.toBeNull();
    });

    it('el botón de alta abre y cierra el formulario', () => {
      const { abrirAlta, seccionAlta, fixture } = armar();

      expect(seccionAlta()).toBeNull();

      abrirAlta();
      expect(seccionAlta()).not.toBeNull();

      const cerrar = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((boton) => (boton as HTMLButtonElement).textContent?.includes('Cancelar')) as
        | HTMLButtonElement
        | undefined;

      (cerrar as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(seccionAlta()).toBeNull();
    });
  });

  describe('validaciones', () => {
    it('no deja guardar un título vacío y lo dice junto al campo', () => {
      const { filas, botonGuardar, actualizaciones, fixture, texto } = armar();
      const fila = filas()[0];

      escribir(fila.querySelector('input') as HTMLInputElement, '   ');
      fixture.detectChanges();
      botonGuardar(1).click();
      fixture.detectChanges();

      expect(actualizaciones).toEqual([]);
      expect(fila.textContent).toContain('Escribí un título para el trabajo');
      expect(texto()).not.toContain('Guardado');
    });
  });

  describe('estados de carga, error y vacío', () => {
    it('mientras la lista está en camino avisa que está cargando y no muestra filas', () => {
      const enCamino = new Subject<TrabajoDeGaleriaAdministrable[]>();
      const { texto, filas, fixture } = armar({ consultar: () => enCamino });

      expect(texto()).toContain(MENSAJES.cargando);
      expect(filas()).toHaveLength(0);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);

      enCamino.next(TRABAJOS);
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
      let respuesta: Observable<TrabajoDeGaleriaAdministrable[]> = throwError(
        () => new Error('sin red'),
      );
      const { texto, filas, fixture } = armar({ consultar: () => respuesta });

      expect(texto()).toContain(MENSAJES.errorAlCargar);

      respuesta = of(TRABAJOS);
      const reintentar = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((boton) => (boton as HTMLButtonElement).textContent?.includes(MENSAJES.reintentar));

      (reintentar as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(filas()).toHaveLength(2);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
    });

    it('una lista vacía de verdad dice que no hay trabajos, no que hubo un error', () => {
      const { texto, filas } = armar({ consultar: () => of([]) });

      expect(texto()).toContain('Todavía no hay trabajos');
      expect(filas()).toHaveLength(0);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain(MENSAJES.cargando);
    });
  });
});
