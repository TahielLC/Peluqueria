import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SelectorDeFotoComponent } from './selector-de-foto.component';
import {
  CarpetaDeFotos,
  SubidaDeFotosService,
} from '../../services/subida-de-fotos.service';

interface Opciones {
  fotoUrl?: string;
  carpeta?: CarpetaDeFotos;
  subir?: (archivo: File, carpeta: CarpetaDeFotos) => Observable<string>;
}

interface Subida {
  archivo: File;
  carpeta: CarpetaDeFotos;
}

/** Arma el selector con un servicio de subida falso y registra lo que se le pide. */
function armar(opciones: Opciones = {}) {
  const subidas: Subida[] = [];
  const subir = opciones.subir ?? (() => of('https://fotos.test/nueva.jpg'));

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: SubidaDeFotosService,
        useValue: {
          subirFoto: (archivo: File, carpeta: CarpetaDeFotos) => {
            subidas.push({ archivo, carpeta });
            return subir(archivo, carpeta);
          },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(SelectorDeFotoComponent);
  fixture.componentRef.setInput('fotoUrl', opciones.fotoUrl ?? '');
  if (opciones.carpeta) fixture.componentRef.setInput('carpeta', opciones.carpeta);
  fixture.detectChanges();

  const emitidas: string[] = [];
  fixture.componentInstance.fotoSubida.subscribe((url) => emitidas.push(url));

  const entrada = () => {
    const campo = fixture.nativeElement.querySelector('input[type="file"]') as
      | HTMLInputElement
      | null;
    if (!campo) throw new Error('No está el selector de archivos');
    return campo;
  };

  return {
    component: fixture.componentInstance,
    fixture,
    subidas,
    emitidas,
    entrada,
    /** Lo que la persona realmente ve. */
    texto: () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' '),
    imagen: () => fixture.nativeElement.querySelector('img') as HTMLImageElement | null,
    /** Elige un archivo como lo haría el selector nativo. */
    elegir(archivo: File) {
      const campo = entrada();
      Object.defineProperty(campo, 'files', {
        value: [archivo],
        configurable: true,
      });
      campo.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    },
  };
}

/** Archivo de prueba con el tipo y el tamaño indicados. */
function archivo(tipo: string, tamano = 1024, nombre = 'foto.jpg'): File {
  const creado = new File(['x'], nombre, { type: tipo });
  Object.defineProperty(creado, 'size', { value: tamano });
  return creado;
}

const CINCO_MB = 5 * 1024 * 1024;

describe('SelectorDeFotoComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('muestra la foto actual', () => {
    const { imagen } = armar({ fotoUrl: 'https://fotos.test/sofia.jpg' });

    expect(imagen()?.getAttribute('src')).toBe('https://fotos.test/sofia.jpg');
  });

  it('sin foto muestra un cartel en castellano en vez de una imagen rota', () => {
    const { imagen, texto } = armar({ fotoUrl: '' });

    expect(imagen()).toBeNull();
    expect(texto()).toContain('Sin foto');
  });

  it('el selector acepta sólo las imágenes que el servicio sabe subir', () => {
    const { entrada } = armar();

    expect(entrada().type).toBe('file');
    expect(entrada().accept).toBe('image/jpeg,image/png,image/webp');
  });

  it('con un archivo válido sube, emite la URL nueva y avisa que falta guardar', () => {
    const { elegir, subidas, emitidas, texto } = armar();
    const foto = archivo('image/jpeg');

    elegir(foto);

    expect(subidas).toEqual([{ archivo: foto, carpeta: 'peluqueros' }]);
    expect(emitidas).toEqual(['https://fotos.test/nueva.jpg']);
    expect(texto()).toContain('Foto lista. Acordate de guardar.');
  });

  it('usa la carpeta que le indiquen, para poder reusarlo en la galería', () => {
    const { elegir, subidas } = armar({ carpeta: 'galeria' });

    elegir(archivo('image/png', 1024, 'foto.png'));

    expect(subidas[0].carpeta).toBe('galeria');
  });

  it('con un tipo no permitido muestra el error y NO sube nada', () => {
    const { elegir, subidas, emitidas, texto } = armar();

    elegir(archivo('image/gif'));

    expect(subidas).toEqual([]);
    expect(emitidas).toEqual([]);
    expect(texto()).toContain('JPG, PNG o WebP');
  });

  it('con más de 5 MB muestra el error y NO sube nada', () => {
    const { elegir, subidas, emitidas, texto } = armar();

    elegir(archivo('image/jpeg', CINCO_MB + 1));

    expect(subidas).toEqual([]);
    expect(emitidas).toEqual([]);
    expect(texto()).toContain('5 MB');
  });

  it('con exactamente 5 MB acepta: el límite es "hasta 5 MB"', () => {
    const { elegir, subidas } = armar();

    elegir(archivo('image/jpeg', CINCO_MB));

    expect(subidas).toHaveLength(1);
  });

  it('mientras sube deshabilita el selector y avisa que está subiendo', () => {
    const respuesta = new Subject<string>();
    const { elegir, entrada, fixture, texto } = armar({
      subir: () => respuesta,
    });

    elegir(archivo('image/jpeg'));

    expect(entrada().disabled).toBe(true);
    expect(texto()).toContain('Subiendo…');

    respuesta.next('https://fotos.test/nueva.jpg');
    respuesta.complete();
    fixture.detectChanges();

    expect(entrada().disabled).toBe(false);
    expect(texto()).not.toContain('Subiendo…');
  });

  it('si la subida falla muestra el error, no emite y sigue mostrando la foto anterior', () => {
    const { elegir, emitidas, imagen, texto } = armar({
      fotoUrl: 'https://fotos.test/sofia.jpg',
      subir: () => throwError(() => new Error('sin permiso')),
    });

    elegir(archivo('image/jpeg'));

    expect(emitidas).toEqual([]);
    expect(texto()).toContain('No se pudo subir la foto');
    // La foto anterior no se reemplaza por una rota ni por un hueco.
    expect(imagen()?.getAttribute('src')).toBe('https://fotos.test/sofia.jpg');
  });
});
