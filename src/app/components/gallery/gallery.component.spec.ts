import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GalleryComponent } from './gallery.component';
import { AppointmentService } from '../../services/appointment.service';
import { ClaveDeTexto, TrabajoGaleria } from '../../models/salon.model';
import { TextosSitioService } from '../../services/textos-sitio.service';
import { MENSAJES } from '../estados';

const FOTO = (id: number): TrabajoGaleria => ({
  id,
  titulo: `Trabajo ${id}`,
  categoria: 'Corte',
  imagenUrl: `https://example.test/${id}.jpg`,
});

/** Valores de prueba: no se parecen a los que la sección tiene en su plantilla. */
const TITULO_DE_LA_BASE = 'Título de galería que viene de la base';
const BAJADA_DE_LA_BASE = 'Bajada de galería que viene de la base';

/**
 * Doble de `TextosSitioService`.
 *
 * Se dobla el servicio, y no se usa el real, para que la prueba falle si el
 * componente vuelve a escribir su título o su bajada en la plantilla: en ese
 * caso la pantalla mostraría la frase vieja y no la de este doble.
 *
 * La clave dice `galeria` y el archivo dice `gallery`: la diferencia es la que
 * haría que la sección pidiera un texto que no existe.
 */
function textosFalsos(valores: Partial<Record<ClaveDeTexto, string>>) {
  return {
    cargar(): void {},
    texto(clave: ClaveDeTexto): string {
      return valores[clave] ?? '';
    },
  };
}

/**
 * Arma el componente con la respuesta que se le pase.
 *
 * Recibe una función y no un Observable porque el botón de reintentar hace una
 * segunda consulta: así el test puede hacer que falle la primera y funcione la
 * segunda. `setup` es el atajo para el caso común de una cantidad fija de fotos.
 */
function armar(consultar: () => Observable<TrabajoGaleria[]>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: AppointmentService, useValue: { getGaleria: consultar } },
      {
        provide: TextosSitioService,
        useValue: textosFalsos({
          galeria_titulo: TITULO_DE_LA_BASE,
          galeria_bajada: BAJADA_DE_LA_BASE,
        }),
      },
    ],
  });
  const fixture = TestBed.createComponent(GalleryComponent);
  fixture.detectChanges();
  return {
    component: fixture.componentInstance,
    fixture,
    /** Lo que el usuario realmente ve en pantalla. */
    texto: () => fixture.nativeElement.textContent as string,
  };
}

/** Arma el componente con una cantidad de fotos controlada. */
function setup(cantidad: number): GalleryComponent {
  const items = Array.from({ length: cantidad }, (_, i) => FOTO(i + 1));
  return armar(() => of(items)).component;
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

    it('los paneles lejanos quedan mas transparentes que un vecino directo', () => {
      // Con 3 fotos la distancia angular maxima es 1, asi que el coeficiente
      // que separa a los paneles lejanos nunca se ejerce. Hacen falta 5 fotos.
      const component = setup(5);

      expect(component.panelOpacity(1)).toBeCloseTo(0.3, 5);
      expect(component.panelOpacity(2)).toBeCloseTo(0.21, 5);
    });

    it('con 2 fotos usa el radio fijo de 260px', () => {
      const component = setup(2);

      expect(component.radius()).toBe(260);
      expect(component.step()).toBe(180);
    });
  });

  describe('estado activo', () => {
    it('isActive solo marca el indice actual', () => {
      const component = setup(3);

      expect(component.isActive(0)).toBe(true);
      expect(component.isActive(1)).toBe(false);

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

  describe('estados de carga, error y contenido vacío', () => {
    it('mientras la respuesta está en camino avisa que está cargando, no que no hay nada', () => {
      const enCamino = new Subject<TrabajoGaleria[]>();
      const { fixture, texto } = armar(() => enCamino);

      expect(texto()).toContain(MENSAJES.cargando);
      expect(texto()).not.toContain('Todavía no hay trabajos para mostrar');

      enCamino.next([FOTO(1)]);
      enCamino.complete();
      fixture.detectChanges();

      expect(texto()).not.toContain(MENSAJES.cargando);
      expect(texto()).not.toContain('Todavía no hay trabajos para mostrar');
    });

    it('si la lectura falla muestra el error y NO el estado vacío', () => {
      const { texto } = armar(() => throwError(() => new Error('sin red')));

      expect(texto()).toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain('Todavía no hay trabajos para mostrar');
    });

    it('una galería vacía de verdad sigue mostrando el estado vacío', () => {
      const { texto } = armar(() => of([]));

      expect(texto()).toContain('Todavía no hay trabajos para mostrar');
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
      expect(texto()).not.toContain(MENSAJES.cargando);
    });

    it('el botón de reintentar vuelve a pedir el contenido y esta vez lo muestra', () => {
      let respuesta: Observable<TrabajoGaleria[]> = throwError(() => new Error('sin red'));
      const { component, fixture, texto } = armar(() => respuesta);

      expect(texto()).toContain(MENSAJES.errorAlCargar);

      respuesta = of([FOTO(9)]);
      const boton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      boton.click();
      fixture.detectChanges();

      expect(component.galeria()).toHaveLength(1);
      expect(texto()).not.toContain(MENSAJES.errorAlCargar);
    });
  });

  describe('textos de la sección', () => {
    it('muestra el título y la bajada que dice el servicio, no los escritos en la plantilla', () => {
      const { texto } = armar(() => of([]));

      expect(texto()).toContain(TITULO_DE_LA_BASE);
      expect(texto()).toContain(BAJADA_DE_LA_BASE);

      // Si la sección volviera a hardcodearlos, aparecerían estas frases.
      expect(texto()).not.toContain('Galería de Trabajos');
      expect(texto()).not.toContain('Echale un vistazo a nuestros últimos cortes y estilos.');
    });
  });
});
