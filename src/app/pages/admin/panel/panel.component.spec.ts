import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminPanelComponent } from './panel.component';
import { AuthService } from '../../../services/auth.service';

/** Deja correr las promesas pendientes antes de mirar la pantalla. */
const esperarPromesas = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function crearAutenticacionFalsa(correo: string | null, fallaAlLeerCorreo = false) {
  let salidas = 0;

  return {
    service: {
      async correoDeLaSesion() {
        if (fallaAlLeerCorreo) {
          throw new Error('no se pudo leer la sesión');
        }
        return correo;
      },
      async cerrarSesion() {
        salidas += 1;
      },
    },
    salidas: () => salidas,
  };
}

describe('AdminPanelComponent', () => {
  function armar(correo: string | null = 'admin@salon.test', fallaAlLeerCorreo = false) {
    const autenticacionFalsa = crearAutenticacionFalsa(correo, fallaAlLeerCorreo);
    const navegaciones: string[] = [];

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: autenticacionFalsa.service },
        {
          provide: Router,
          useValue: {
            async navigateByUrl(url: string) {
              navegaciones.push(url);
              return true;
            },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AdminPanelComponent);
    fixture.detectChanges();

    return {
      component: fixture.componentInstance,
      fixture,
      navegaciones,
      salidas: autenticacionFalsa.salidas,
      /** Lo que la persona realmente ve. */
      texto: () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' '),
      /**
       * Los botones de pestaña, en el orden en que se ven.
       * Se filtran por `aria-pressed` para no agarrar el botón de cerrar sesión.
       */
      pestanias: () =>
        Array.from(
          fixture.nativeElement.querySelectorAll('button[aria-pressed]'),
        ) as HTMLButtonElement[],
      /**
       * El panel de la sección visible. Usa el `aria-label` que ya tiene por
       * semántica, así que no hay que agregar marcas sólo para el test.
       */
      panelVisible: () =>
        Array.from(
          fixture.nativeElement.querySelectorAll('main section[aria-label]'),
        ) as HTMLElement[],
    };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('muestra con qué cuenta se entró', async () => {
    const { fixture } = armar('ana@salon.test');

    await esperarPromesas();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('ana@salon.test');
  });

  it('cerrar sesión cierra la sesión y vuelve al login', async () => {
    const { component, navegaciones, salidas } = armar();

    await component.salir();

    expect(salidas()).toBe(1);
    expect(navegaciones).toEqual(['/admin/login']);
  });

  it('si leer el correo falla, el panel igual se muestra y no queda una promesa suelta', async () => {
    const { component, fixture } = armar('admin@salon.test', true);

    // Un dato decorativo no justifica romper una pantalla que ya está autorizada,
    // ni dejar una promesa rechazada sin dueño.
    await expect(component.cargarCorreo()).resolves.toBeUndefined();
    expect(component.correo()).toBeNull();

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Panel de administración');
  });

  describe('las 4 secciones', () => {
    it('están todas a la vista, con su nombre en castellano', () => {
      const { pestanias } = armar();

      expect(pestanias().map((boton) => boton.textContent?.trim())).toEqual([
        'Textos',
        'Servicios',
        'Equipo',
        'Galería',
      ]);
    });

    it('arranca en la primera y no mezcla contenido de las otras', () => {
      const { panelVisible, texto } = armar();

      // Que haya exactamente un panel visible es el punto: en una sola pantalla
      // con pestañas, toda la información de las otras secciones no se muestra.
      expect(panelVisible()).toHaveLength(1);
      expect(panelVisible()[0].getAttribute('aria-label')).toBe('Textos del sitio');
      expect(texto()).not.toContain('Las fotos de trabajos que se ven en la portada');
    });

    it('al elegir otra pestaña cambia lo que se muestra y no queda nada de la anterior', () => {
      const { fixture, panelVisible, pestanias } = armar();

      pestanias()[3].click();
      fixture.detectChanges();

      expect(panelVisible()).toHaveLength(1);
      expect(panelVisible()[0].getAttribute('aria-label')).toBe('Galería de trabajos');
      expect(fixture.nativeElement.textContent).not.toContain('Textos del sitio');
    });

    it('marca la elegida y desmarca las otras', () => {
      const { fixture, pestanias } = armar();

      expect(pestanias().map((boton) => boton.getAttribute('aria-pressed'))).toEqual([
        'true',
        'false',
        'false',
        'false',
      ]);

      pestanias()[1].click();
      fixture.detectChanges();

      expect(pestanias().map((boton) => boton.getAttribute('aria-pressed'))).toEqual([
        'false',
        'true',
        'false',
        'false',
      ]);
    });

    it('cada sección explica qué se va a poder editar ahí', () => {
      const { fixture, panelVisible, pestanias } = armar();

      // La explicación no es decorativa: es para alguien que no sabe de apps y
      // tiene que entender qué toca cada pestaña antes de animarse.
      expect(fixture.nativeElement.textContent).toContain('El título y el subtítulo de la portada');

      pestanias()[1].click();
      fixture.detectChanges();

      expect(panelVisible()[0].textContent).toContain('lo que dura y lo que sale');
    });

    it('el panel dice con qué cuenta se está editando aunque el correo no se pueda leer', () => {
      const { fixture } = armar(null);
      fixture.detectChanges();

      // Sin correo, en vez de un hueco en blanco hay una marca de espera: el
      // hueco parece un error.
      expect(fixture.nativeElement.textContent).toContain('…');
      expect(fixture.nativeElement.textContent).toContain('Panel de administración');
    });
  });
});
