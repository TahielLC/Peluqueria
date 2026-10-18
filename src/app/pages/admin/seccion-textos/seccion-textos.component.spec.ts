import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SeccionTextosComponent } from './seccion-textos.component';
import { AppointmentService } from '../../../services/appointment.service';
import { TextosSitioService } from '../../../services/textos-sitio.service';
import { TextoDeSitio } from '../../../models/salon.model';
import { MENSAJES } from '../../../components/estados';

/**
 * Textos de prueba con la forma que devuelve la base.
 *
 * Los valores no se parecen a los de fábrica a propósito: si el editor los
 * escribiera en la plantilla en vez de mostrar los que llegan, los tests lo
 * verían.
 */
const CON_AYUDA: TextoDeSitio = {
  clave: 'hero_titulo',
  valor: 'Peluquería Estilo & Arte',
  etiqueta: 'Nombre del salón',
  ayuda: 'Es el título grande que se ve primero en la portada.',
};

const SIN_AYUDA: TextoDeSitio = {
  clave: 'hero_badge',
  valor: 'Estilo & Vanguardia',
  etiqueta: 'Texto del badge',
  ayuda: null,
};

const OTRO: TextoDeSitio = {
  clave: 'hero_subtitulo',
  valor: 'Cortes, barbas y color.',
  etiqueta: 'Subtítulo de la portada',
  ayuda: 'Una línea que acompaña al título.',
};

const TEXTOS = [CON_AYUDA, SIN_AYUDA, OTRO];

interface Guardado {
  clave: string;
  valor: string;
}

/**
 * Arma el editor con las respuestas que se le pasen.
 *
 * Recibe funciones y no Observables porque el reintento hace una segunda
 * consulta: así un test puede hacer que la primera falle y la segunda ande.
 *
 * El doble de `AppointmentService` expone **sólo** `getTextos`. Si el editor
 * intentara guardar por ahí (`guardarTexto`), la llamada explotaría en vez de
 * pasar en silencio: la regla es que toda escritura pasa por `TextosSitioService`,
 * que es el que mantiene al día lo que muestra el sitio.
 */
function armar(
  consultar: () => Observable<TextoDeSitio[]>,
  escribir: () => Observable<void> = () => of(void 0),
) {
  const guardados: Guardado[] = [];

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AppointmentService, useValue: { getTextos: consultar } },
      {
        provide: TextosSitioService,
        useValue: {
          guardar(clave: string, valor: string): Observable<void> {
            guardados.push({ clave, valor });
            return escribir();
          },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(SeccionTextosComponent);
  fixture.detectChanges();

  const filas = () =>
    Array.from(fixture.nativeElement.querySelectorAll('li')) as HTMLElement[];

  return {
    component: fixture.componentInstance,
    fixture,
    guardados,
    filas,
    campos: () =>
      Array.from(fixture.nativeElement.querySelectorAll('textarea')) as HTMLTextAreaElement[],
    botonDe: (fila: HTMLElement) => fila.querySelector('button') as HTMLButtonElement,
    /** Lo que la persona realmente ve. */
    texto: () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' '),
  };
}

/** Escribe en el campo de una fila como lo haría la persona. */
function escribirEn(fila: HTMLElement, valor: string): void {
  const campo = fila.querySelector('textarea') as HTMLTextAreaElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

describe('SeccionTextosComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('la lista de textos', () => {
    it('muestra la etiqueta de la base y nunca la clave técnica', () => {
      const { texto, filas } = armar(() => of(TEXTOS));

      expect(texto()).toContain('Nombre del salón');
      expect(texto()).toContain('Texto del badge');

      // La administradora no tiene por qué ver `hero_titulo` ni ninguna clave.
      expect(texto()).not.toContain('hero_titulo');
      expect(texto()).not.toContain('hero_badge');
      expect(texto()).not.toContain('hero_subtitulo');

      // El orden es el que devuelve el servicio, no uno inventado en la pantalla.
      expect(filas()).toHaveLength(3);
      expect(filas()[0].textContent).toContain('Nombre del salón');
      expect(filas()[1].textContent).toContain('Texto del badge');
    });

    it('asocia cada etiqueta con su campo y muestra el valor actual en un textarea de dos filas', () => {
      const { filas, campos } = armar(() => of(TEXTOS));

      for (const fila of filas()) {
        const etiqueta = fila.querySelector('label') as HTMLLabelElement;
        const campo = fila.querySelector('textarea') as HTMLTextAreaElement;

        expect(etiqueta).not.toBeNull();
        expect(campo).not.toBeNull();
        expect(campo.id).not.toBe('');
        expect(etiqueta.getAttribute('for')).toBe(campo.id);
        expect(campo.getAttribute('rows')).toBe('2');
      }

      // El valor vive en el campo, no en el texto de la fila: `textContent` no
      // incluye lo que está escrito dentro de un textarea.
      expect(campos().map((campo) => campo.value)).toEqual([
        'Peluquería Estilo & Arte',
        'Estilo & Vanguardia',
        'Cortes, barbas y color.',
      ]);
    });

    it('muestra la ayuda sólo cuando existe', () => {
      const { filas, campos } = armar(() => of(TEXTOS));

      expect(filas()[0].textContent).toContain(
        'Es el título grande que se ve primero en la portada.',
      );
      expect(campos()[0].getAttribute('aria-describedby')).not.toBeNull();

      // Sin ayuda no hay línea de apoyo ni una referencia vacía que un lector de
      // pantalla anunciaría como un texto que no existe.
      expect(filas()[1].textContent).not.toContain(
        'Es el título grande que se ve primero en la portada.',
      );
      expect(campos()[1].getAttribute('aria-describedby')).toBeNull();
    });

    it('el botón de guardar de una fila arranca deshabilitado porque nada cambió todavía', () => {
      const { filas, botonDe } = armar(() => of(TEXTOS));

      // Sin esta afirmación, el `for` de abajo no correría nunca con una lista
      // vacía y el test pasaría sin probar nada (misma trampa que L37).
      expect(filas()).toHaveLength(3);

      for (const fila of filas()) {
        expect(botonDe(fila).disabled).toBe(true);
        expect(botonDe(fila).textContent).toContain('Guardar');
      }
    });
  });

  describe('guardar un texto', () => {
    it('manda la clave y el valor escritos, a través de TextosSitioService', () => {
      const { filas, botonDe, guardados, fixture } = armar(() => of(TEXTOS));
      const fila = filas()[0];

      escribirEn(fila, 'Peluquería Nueva');
      fixture.detectChanges();

      expect(botonDe(fila).disabled).toBe(false);

      botonDe(fila).click();

      expect(guardados).toEqual([{ clave: 'hero_titulo', valor: 'Peluquería Nueva' }]);
    });

    it('mientras guarda avisa que está guardando y no deja apretar de nuevo', () => {
      const respuesta = new Subject<void>();
      const { filas, botonDe, guardados, fixture } = armar(() => of(TEXTOS), () => respuesta);
      const fila = filas()[0];

      escribirEn(fila, 'Peluquería Nueva');
      fixture.detectChanges();
      botonDe(fila).click();
      fixture.detectChanges();

      expect(fila.textContent).toContain('Guardando…');
      expect(botonDe(fila).disabled).toBe(true);

      botonDe(fila).click();
      expect(guardados).toHaveLength(1);

      respuesta.next();
      respuesta.complete();
      fixture.detectChanges();

      expect(fila.textContent).not.toContain('Guardando…');
    });

    it('al salir bien confirma que ese texto quedó guardado, y sólo en esa fila', () => {
      const { filas, botonDe, texto, fixture } = armar(() => of(TEXTOS));
      const fila = filas()[0];

      escribirEn(fila, 'Peluquería Nueva');
      fixture.detectChanges();
      botonDe(fila).click();
      fixture.detectChanges();

      expect(fila.textContent).toContain('Guardado');
      expect(texto()).toContain('Ya se ve en el sitio');

      // La confirmación es de la fila guardada: las otras no cambiaron.
      expect(filas()[1].textContent).not.toContain('Guardado');
      expect(filas()[2].textContent).not.toContain('Guardado');

      // Y como el valor coincide con el guardado, no hay nada más que mandar.
      expect(botonDe(fila).disabled).toBe(true);
    });

    it('si falla muestra el error a la vista y NO muestra ninguna confirmación', () => {
      const { filas, botonDe, texto, fixture } = armar(
        () => of(TEXTOS),
        () => throwError(() => new Error('new row violates row-level security policy')),
      );
      const fila = filas()[0];

      escribirEn(fila, 'Peluquería Nueva');
      fixture.detectChanges();
      botonDe(fila).click();
      fixture.detectChanges();

      // El aviso tiene que quedar a la vista: una escritura bloqueada no puede
      // parecer exitosa.
      expect(fila.textContent).toContain('No se pudo guardar');
      expect(fila.textContent).not.toContain('Guardado');
      expect(texto()).not.toContain('Ya se ve en el sitio');

      // Y se puede reintentar sin recargar: el botón vuelve a estar disponible.
      expect(botonDe(fila).disabled).toBe(false);
    });

    it('deja guardar un valor vacío: el texto es de la administradora, no del formulario', () => {
      const { filas, botonDe, guardados, fixture } = armar(() => of(TEXTOS));
      const fila = filas()[1];

      escribirEn(fila, '');
      fixture.detectChanges();
      botonDe(fila).click();

      expect(guardados).toEqual([{ clave: 'hero_badge', valor: '' }]);
    });

    it('después de un fallo, reintentar el mismo guardado funciona y el error se va', () => {
      let respuesta: Observable<void> = throwError(() => new Error('sin red'));
      const { filas, botonDe, guardados, fixture } = armar(() => of(TEXTOS), () => respuesta);
      const fila = filas()[0];

      escribirEn(fila, 'Peluquería Nueva');
      fixture.detectChanges();
      botonDe(fila).click();
      fixture.detectChanges();
      expect(fila.textContent).toContain('No se pudo guardar');

      respuesta = of(void 0);
      botonDe(fila).click();
      fixture.detectChanges();

      expect(guardados).toHaveLength(2);
      expect(fila.textContent).toContain('Guardado');
      expect(fila.textContent).not.toContain('No se pudo guardar');
    });
  });

  describe('estados de carga, error y vacío', () => {
    it('mientras la lista está en camino avisa que está cargando y no muestra filas', () => {
      const enCamino = new Subject<TextoDeSitio[]>();
      const { texto, filas, fixture } = armar(() => enCamino);

      expect(texto()).toContain(MENSAJES.cargando);
      expect(filas()).toHaveLength(0);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);

      enCamino.next(TEXTOS);
      enCamino.complete();
      fixture.detectChanges();

      expect(texto()).not.toContain(MENSAJES.cargando);
      expect(filas()).toHaveLength(3);
    });

    it('si la lectura falla muestra el error con su botón de reintentar', () => {
      const { texto, filas, fixture } = armar(() => throwError(() => new Error('sin red')));

      expect(texto()).toContain(MENSAJES.errorAlCargar);
      expect(filas()).toHaveLength(0);

      const reintentar = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((boton) => (boton as HTMLButtonElement).textContent?.includes(MENSAJES.reintentar));

      expect(reintentar).toBeDefined();
    });

    it('el botón de reintentar vuelve a pedir la lista y esta vez la muestra', () => {
      let respuesta: Observable<TextoDeSitio[]> = throwError(() => new Error('sin red'));
      const { texto, filas, fixture } = armar(() => respuesta);

      expect(texto()).toContain(MENSAJES.errorAlCargar);

      respuesta = of(TEXTOS);
      const reintentar = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((boton) => (boton as HTMLButtonElement).textContent?.includes(MENSAJES.reintentar));

      (reintentar as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(filas()).toHaveLength(3);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
    });

    it('una lista vacía de verdad dice que no hay textos, no que hubo un error', () => {
      const { texto, filas } = armar(() => of([]));

      expect(texto()).toContain('Todavía no hay textos para editar');
      expect(filas()).toHaveLength(0);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain(MENSAJES.cargando);
    });
  });
});
