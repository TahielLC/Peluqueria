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
});
