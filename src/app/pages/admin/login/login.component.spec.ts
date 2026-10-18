import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService, ResultadoLogin } from '../../../services/auth.service';

/** Router falso: lo único que interesa es a dónde se navegó. */
function crearRouterFalso() {
  const navegaciones: string[] = [];

  return {
    router: {
      async navigateByUrl(url: string) {
        navegaciones.push(url);
        return true;
      },
    },
    navegaciones,
  };
}

function crearAutenticacionFalsa(entrar: () => Promise<ResultadoLogin>) {
  const intentos: Array<{ correo: string; contrasena: string }> = [];

  return {
    service: {
      async iniciarSesion(credenciales: { correo: string; contrasena: string }) {
        intentos.push(credenciales);
        return entrar();
      },
    },
    intentos,
  };
}

describe('LoginComponent', () => {
  function armar(entrar: () => Promise<ResultadoLogin> = async () => ({ ok: true })) {
    const routerFalso = crearRouterFalso();
    const autenticacionFalsa = crearAutenticacionFalsa(entrar);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: autenticacionFalsa.service },
        { provide: Router, useValue: routerFalso.router },
      ],
    });

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    return {
      component: fixture.componentInstance,
      fixture,
      navegaciones: routerFalso.navegaciones,
      intentos: autenticacionFalsa.intentos,
      /** Lo que la persona realmente ve. */
      texto: () => fixture.nativeElement.textContent as string,
    };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('pide correo y contraseña, con etiquetas en castellano', () => {
    const { texto } = armar();

    expect(texto()).toContain('Correo electrónico');
    expect(texto()).toContain('Contraseña');
    expect(texto()).toContain('Entrar');
  });

  it('lo que se escribe en los campos llega al formulario, y lo del formulario a los campos', () => {
    const { component, fixture } = armar();
    const campoCorreo = fixture.nativeElement.querySelector('#correo') as HTMLInputElement;

    // Del DOM al componente (escribir).
    campoCorreo.value = 'admin@salon.test';
    campoCorreo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.correo()).toBe('admin@salon.test');

    // Del componente al DOM (el campo no arranca ciego).
    component.contrasena.set('secreta');
    fixture.detectChanges();
    const campoContrasena = fixture.nativeElement.querySelector('#contrasena') as HTMLInputElement;
    expect(campoContrasena.value).toBe('secreta');
  });

  it('con las credenciales correctas entra al panel', async () => {
    const { component, navegaciones, intentos } = armar();
    component.correo.set('admin@salon.test');
    component.contrasena.set('secreta');

    await component.entrar();

    expect(intentos).toEqual([{ correo: 'admin@salon.test', contrasena: 'secreta' }]);
    expect(navegaciones).toEqual(['/admin']);
  });

  it('saca los espacios de más del correo antes de mandarlo', async () => {
    const { component, intentos } = armar();
    component.correo.set('  admin@salon.test  ');
    component.contrasena.set('secreta');

    await component.entrar();

    // Un espacio pegado al copiar el correo es un fallo de ingreso que la
    // persona no puede diagnosticar sola: se limpia acá.
    expect(intentos[0].correo).toBe('admin@salon.test');
  });

  it('con credenciales incorrectas muestra el motivo y NO navega', async () => {
    const { component, fixture, navegaciones, texto } = armar(async () => ({
      ok: false,
      motivo: 'credenciales',
    }));
    component.correo.set('admin@salon.test');
    component.contrasena.set('mala');

    await component.entrar();
    fixture.detectChanges();

    expect(texto()).toContain('El correo o la contraseña no son correctos');
    expect(navegaciones).toEqual([]);
  });

  it('no le muestra a la administradora el mensaje técnico de Supabase', async () => {
    const { component, fixture, texto } = armar(async () => ({
      ok: false,
      motivo: 'desconocido',
    }));
    component.correo.set('a@b.test');
    component.contrasena.set('x');

    await component.entrar();
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos iniciar sesión');
    expect(texto()).not.toContain('credentials');
  });

  it('mientras espera avisa que está entrando y no dispara dos veces', async () => {
    let resolver!: (resultado: ResultadoLogin) => void;
    const pendiente = new Promise<ResultadoLogin>((resolve) => {
      resolver = resolve;
    });
    const { component, fixture, texto, intentos } = armar(() => pendiente);
    component.correo.set('admin@salon.test');
    component.contrasena.set('secreta');

    const enCurso = component.entrar();
    fixture.detectChanges();

    expect(texto()).toContain('Entrando…');

    // Un segundo intento mientras está en curso no puede generar otra consulta.
    await component.entrar();
    expect(intentos).toHaveLength(1);

    resolver({ ok: true });
    await enCurso;
  });

  it('si el ingreso revienta, destraba la pantalla en vez de girar para siempre', async () => {
    const { component, fixture, texto } = armar(async () => {
      throw new Error('se cayó de par en par');
    });
    component.correo.set('admin@salon.test');
    component.contrasena.set('secreta');

    await component.entrar();
    fixture.detectChanges();

    // Un "Entrando…" eterno con el botón deshabilitado es un callejón sin
    // salida para alguien que no sabe de apps: tiene que poder volver a intentar.
    expect(component.cargando()).toBe(false);
    expect(texto()).not.toContain('Entrando…');
    expect(texto()).toContain('No pudimos iniciar sesión');
  });

  it('borra la contraseña del formulario después de entrar', async () => {
    const { component } = armar();
    component.correo.set('admin@salon.test');
    component.contrasena.set('secreta');

    await component.entrar();

    // No tiene por qué quedar la contraseña dando vueltas en memoria ni en pantalla.
    expect(component.contrasena()).toBe('');
  });
});
