import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminPanelComponent } from './panel.component';
import { AuthService } from '../../../services/auth.service';
import { AppointmentService } from '../../../services/appointment.service';
import { TextosSitioService } from '../../../services/textos-sitio.service';

/** Deja correr las promesas pendientes antes de mirar la pantalla. */
const esperarPromesas = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface OpcionesDelPanel {
  correo?: string | null;
  fallaAlLeerCorreo?: boolean;
  /**
   * Si `cerrarSesion()` devuelve que NO se pudo cerrar.
   *
   * Va dentro de este objeto y no como valor fijo a propósito: la misma
   * referencia se devuelve desde `armar()`, así que un test puede darla vuelta a
   * mitad de camino y probar que **reintentar funciona**.
   */
  fallaElCierre?: boolean;
  /** Si, después de un cierre fallido, la sesión local sigue viva. */
  quedaSesion?: boolean;
  /** Si preguntar por la sesión falla, para el caso "ni se pudo averiguar". */
  fallaAlConsultarSesion?: boolean;
}

function crearAutenticacionFalsa(opciones: OpcionesDelPanel) {
  let salidas = 0;

  return {
    service: {
      async correoDeLaSesion() {
        if (opciones.fallaAlLeerCorreo) {
          throw new Error('no se pudo leer la sesión');
        }
        return opciones.correo ?? null;
      },
      async cerrarSesion() {
        salidas += 1;
        return !opciones.fallaElCierre;
      },
      async haySesion() {
        if (opciones.fallaAlConsultarSesion) {
          throw new Error('no se pudo leer la sesión');
        }
        return opciones.quedaSesion ?? false;
      },
    },
    salidas: () => salidas,
  };
}

describe('AdminPanelComponent', () => {
  function armar(opciones: OpcionesDelPanel = {}) {
    // El correo por defecto es el de casi todos los tests; pasar `correo: null`
    // lo pisa, porque el spread va después.
    const opcionesEfectivas: OpcionesDelPanel = { correo: 'admin@salon.test', ...opciones };
    const autenticacionFalsa = crearAutenticacionFalsa(opcionesEfectivas);
    const navegaciones: string[] = [];

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: autenticacionFalsa.service },
        // El panel monta el editor de textos en su primera pestaña, así que sus
        // dos colaboradores tienen que estar doblados aunque el test no los mire:
        // sin esto, la pestaña intentaría hablar con Supabase.
        {
          provide: AppointmentService,
          useValue: {
            getTextos: () => of([]),
            getTodosLosServicios: () => of([]),
            actualizarServicio: () => of(void 0),
            cambiarActivoDeServicio: () => of(void 0),
            crearServicio: () => of(void 0),
            getPeluqueros: () => of([]),
            getTodosLosPeluqueros: () => of([]),
            actualizarPeluquero: () => of(void 0),
            getTodaLaGaleria: () => of([]),
          },
        },
        { provide: TextosSitioService, useValue: { guardar: () => of(void 0) } },
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
      /** La misma referencia que usa el falso: mutarla cambia el próximo intento. */
      opciones: opcionesEfectivas,
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
    const { fixture } = armar({ correo: 'ana@salon.test' });

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

  it('si el cierre falla y la sesión sigue viva, NO navega y lo dice en pantalla', async () => {
    const { component, fixture, navegaciones } = armar({
      fallaElCierre: true,
      quedaSesion: true,
    });

    await component.salir();
    fixture.detectChanges();

    // Navegar acá sería mentir: al volver a /admin el guard la dejaría pasar sin
    // contraseña, y la persona creería que cerró algo que sigue abierto.
    expect(navegaciones).toEqual([]);

    const alerta = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alerta?.textContent).toContain('No se pudo cerrar la sesión');
  });

  it('si el cierre falla pero la sesión local ya no está, igual va al login', async () => {
    const { component, fixture, navegaciones } = armar({
      fallaElCierre: true,
      quedaSesion: false,
    });

    await component.salir();
    fixture.detectChanges();

    // Supabase borra la sesión local ANTES de avisarle al servidor. Si la red
    // falla, de este lado la persona ya quedó afuera: dejarla en el panel sería
    // peor que navegar.
    expect(navegaciones).toEqual(['/admin/login']);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('si ni siquiera se puede averiguar si hay sesión, NO navega: el error cae del lado cerrado', async () => {
    const { component, fixture, navegaciones } = armar({
      fallaElCierre: true,
      fallaAlConsultarSesion: true,
    });

    await component.salir();
    fixture.detectChanges();

    // Afirmar "la sesión se cerró" sin poder comprobarlo es la única respuesta
    // que no se puede dar. Mismo criterio que el guard, que ante la duda manda
    // al login: acá la duda no puede dejar a la persona adentro creyendo que salió.
    expect(navegaciones).toEqual([]);

    // Y el aviso no puede decir que la sesión "sigue abierta": en esta rama
    // justamente no se pudo averiguar. Dice que *puede* que siga, que es lo único
    // que se sabe. Fue el hallazgo CRITICAL de la revisión nativa.
    const alerta = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alerta).not.toBeNull();
    expect(alerta?.textContent).toContain('puede que siga abierta');
  });

  it('después de un fallo, reintentar funciona y el aviso se va', async () => {
    const { component, fixture, opciones, navegaciones } = armar({
      fallaElCierre: true,
      quedaSesion: true,
    });

    await component.salir();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();

    // El botón sigue ahí y sigue sirviendo. Si el aviso fuera un cartel muerto,
    // la persona quedaría encerrada en el panel sin forma de salir.
    opciones.fallaElCierre = false;
    opciones.quedaSesion = false;

    await component.salir();
    fixture.detectChanges();

    expect(navegaciones).toEqual(['/admin/login']);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('si leer el correo falla, el panel igual se muestra y no queda una promesa suelta', async () => {
    const { component, fixture } = armar({ fallaAlLeerCorreo: true });

    // Un dato decorativo no justifica romper una pantalla que ya está autorizada,
    // ni dejar una promesa rechazada sin dueño.
    await expect(component.cargarCorreo()).resolves.toBeUndefined();
    expect(component.correo()).toBeNull();

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Panel de administración');
  });

  describe('la sección Textos', () => {
    it('muestra el editor de textos y ya no el cartel de próximamente', () => {
      const { panelVisible, texto } = armar();

      expect(panelVisible()[0].querySelector('app-seccion-textos')).not.toBeNull();
      expect(texto()).not.toContain('Llega en la próxima entrega');
    });

  });

  describe('la sección Galería', () => {
    it('muestra el editor de galería y ya no el cartel de próximamente', () => {
      const { fixture, panelVisible, pestanias, texto } = armar();

      pestanias()[3].click();
      fixture.detectChanges();

      expect(panelVisible()[0].querySelector('app-seccion-galeria')).not.toBeNull();
      expect(panelVisible()[0].querySelector('app-seccion-textos')).toBeNull();
      expect(panelVisible()[0].querySelector('app-seccion-servicios')).toBeNull();
      expect(panelVisible()[0].querySelector('app-seccion-staff')).toBeNull();
      expect(texto()).not.toContain('Llega en la próxima entrega');
    });
  });

  describe('la sección Equipo', () => {
    it('muestra el editor de perfiles y ya no el cartel de próximamente', () => {
      const { fixture, panelVisible, pestanias, texto } = armar();

      pestanias()[2].click();
      fixture.detectChanges();

      expect(panelVisible()[0].querySelector('app-seccion-staff')).not.toBeNull();
      expect(panelVisible()[0].querySelector('app-seccion-textos')).toBeNull();
      expect(panelVisible()[0].querySelector('app-seccion-servicios')).toBeNull();
      expect(texto()).not.toContain('Llega en la próxima entrega');
    });
  });

  describe('la sección Servicios', () => {
    it('muestra el editor de servicios y ya no el cartel de próximamente', () => {
      const { fixture, panelVisible, pestanias, texto } = armar();

      pestanias()[1].click();
      fixture.detectChanges();

      expect(panelVisible()[0].querySelector('app-seccion-servicios')).not.toBeNull();
      expect(panelVisible()[0].querySelector('app-seccion-textos')).toBeNull();
      expect(texto()).not.toContain('Llega en la próxima entrega');
    });
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
      const { fixture } = armar({ correo: null });
      fixture.detectChanges();

      // Sin correo, en vez de un hueco en blanco hay una marca de espera: el
      // hueco parece un error.
      expect(fixture.nativeElement.textContent).toContain('…');
      expect(fixture.nativeElement.textContent).toContain('Panel de administración');
    });
  });
});
