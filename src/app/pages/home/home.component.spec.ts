import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { HomeComponent } from './home.component';
import { ClaveDeTexto } from '../../models/salon.model';
import { AppointmentService } from '../../services/appointment.service';
import { TextosSitioService } from '../../services/textos-sitio.service';

/**
 * Doble de `TextosSitioService`.
 *
 * Devuelve, para cada clave, el valor que se le pase. En las pruebas se le pasan
 * frases que no se parecen a ninguna de las que el home tiene escritas en su
 * plantilla, a propósito: si el hero volviera a hardcodear un texto, la pantalla
 * mostraría su propia frase y la prueba dejaría de ver el valor del servicio.
 *
 * Cuenta los pedidos para poder afirmar que los textos se piden una sola vez.
 */
class TextosFalsos {
  pedidos = 0;

  constructor(private readonly valores: Partial<Record<ClaveDeTexto, string>>) {}

  cargar(): void {
    this.pedidos++;
  }

  texto(clave: ClaveDeTexto): string {
    return this.valores[clave] ?? '';
  }
}

/** Prefijo de los valores de prueba: hace obvio que el texto vino del servicio. */
const DE_LA_BASE = 'Texto que viene de la base';

/**
 * Arma el home con los textos que le pase y con las tres secciones vacías.
 *
 * Las secciones piden su contenido por `AppointmentService`, así que se dobla
 * también: el objeto de esta prueba son los textos del hero, no la lista de
 * servicios.
 */
function armar(valores: Partial<Record<ClaveDeTexto, string>> = {}) {
  const textos = new TextosFalsos(valores);

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: TextosSitioService, useValue: textos },
      {
        provide: AppointmentService,
        useValue: {
          getServicios: () => of([]),
          getPeluqueros: () => of([]),
          getGaleria: () => of([]),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(HomeComponent);
  fixture.detectChanges();

  return {
    textos,
    fixture,
    /** Lo que el usuario realmente ve en pantalla. */
    texto: () => fixture.nativeElement.textContent as string,
  };
}

describe('HomeComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  describe('textos del hero', () => {
    it('muestra los cuatro textos que dice el servicio y ninguno escrito en la plantilla', () => {
      const { texto } = armar({
        hero_badge: `${DE_LA_BASE}: badge`,
        hero_titulo: `${DE_LA_BASE}: título`,
        hero_subtitulo: `${DE_LA_BASE}: subtítulo`,
        hero_cta: `${DE_LA_BASE}: botón`,
      });

      expect(texto()).toContain(`${DE_LA_BASE}: badge`);
      expect(texto()).toContain(`${DE_LA_BASE}: título`);
      expect(texto()).toContain(`${DE_LA_BASE}: subtítulo`);
      expect(texto()).toContain(`${DE_LA_BASE}: botón`);

      // Lo que el hero tenía escrito a mano no puede seguir apareciendo.
      expect(texto()).not.toContain('Estilo & Vanguardia');
      expect(texto()).not.toContain('Peluquería Estilo & Arte');
      expect(texto()).not.toContain('Ver Trabajos');
    });

    it('si el servicio cambia el título, el hero cambia con él', () => {
      // La contracara de la prueba anterior: el hero no es un cartel fijo sino
      // una copia viva de lo que dice el servicio.
      const { texto } = armar({ hero_titulo: 'Peluquería Don Juan' });

      expect(texto()).toContain('Peluquería Don Juan');
      expect(texto()).not.toContain('Peluquería Estilo & Arte');
    });
  });

  describe('pedido de los textos', () => {
    it('los pide una sola vez al arrancar', () => {
      const { textos } = armar();

      expect(textos.pedidos).toBe(1);
    });
  });
});
