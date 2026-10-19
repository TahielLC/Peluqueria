import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Observable, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectorDeFotoComponent } from './selector-de-foto.component';
import { RecortadorDeFotoComponent } from '../recortador-de-foto/recortador-de-foto.component';
import {
  CarpetaDeFotos,
  SubidaDeFotosService,
} from '../../services/subida-de-fotos.service';

interface Opciones {
  fotoUrl?: string;
  carpeta?: CarpetaDeFotos;
  subir?: (archivo: Blob, carpeta: CarpetaDeFotos) => Observable<string>;
}

interface Subida {
  archivo: Blob;
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
          subirFoto: (archivo: Blob, carpeta: CarpetaDeFotos) => {
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

  const recortador = () => {
    const encontrado = fixture.debugElement.query(By.directive(RecortadorDeFotoComponent));
    return encontrado ? (encontrado.componentInstance as RecortadorDeFotoComponent) : null;
  };

  return {
    component: fixture.componentInstance,
    fixture,
    subidas,
    emitidas,
    entrada,
    recortador,
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
    /** Confirma el encuadre desde el recortador, como lo haría la persona. */
    confirmarRecorte(blob = new Blob(['recorte'], { type: 'image/webp' })) {
      const componente = recortador();
      if (!componente) throw new Error('No está el recortador');
      componente.recorteConfirmado.emit(blob);
      fixture.detectChanges();
      return blob;
    },
    /** Cancela el encuadre desde el recortador. */
    cancelarRecorte() {
      const componente = recortador();
      if (!componente) throw new Error('No está el recortador');
      componente.cancelado.emit();
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

    // jsdom no implementa las URL de objeto; el recortador las usa para la
    // vista previa, así que se reemplazan por una constante.
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:vista-previa'),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
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

  it('con un archivo válido NO sube nada y abre el recortador', () => {
    const { elegir, subidas, emitidas, recortador, texto } = armar();

    elegir(archivo('image/jpeg'));

    expect(subidas).toEqual([]);
    expect(emitidas).toEqual([]);
    expect(recortador()).not.toBeNull();
    expect(texto()).toContain('Usar esta foto');
  });

  it('al confirmar el recorte sube ese Blob y no el archivo original', () => {
    const { elegir, confirmarRecorte, subidas, emitidas, texto } = armar();
    const original = archivo('image/jpeg');
    const recorte = new Blob(['recorte'], { type: 'image/webp' });

    elegir(original);
    confirmarRecorte(recorte);

    expect(subidas).toHaveLength(1);
    expect(subidas[0].archivo).toBe(recorte);
    expect(subidas[0].archivo).not.toBe(original);
    expect(emitidas).toEqual(['https://fotos.test/nueva.jpg']);
    expect(texto()).toContain('Foto lista. Acordate de guardar.');
  });

  it('usa la carpeta que le indiquen, para poder reusarlo en la galería', () => {
    const { elegir, confirmarRecorte, subidas } = armar({ carpeta: 'galeria' });

    elegir(archivo('image/png', 1024, 'foto.png'));
    confirmarRecorte();

    expect(subidas[0].carpeta).toBe('galeria');
  });

  it('Cancelar no sube nada, no emite y deja la foto anterior', () => {
    const { elegir, cancelarRecorte, subidas, emitidas, recortador, imagen } = armar({
      fotoUrl: 'https://fotos.test/sofia.jpg',
    });

    elegir(archivo('image/jpeg'));
    cancelarRecorte();

    expect(subidas).toEqual([]);
    expect(emitidas).toEqual([]);
    expect(recortador()).toBeNull();
    expect(imagen()?.getAttribute('src')).toBe('https://fotos.test/sofia.jpg');
  });

  it('con un tipo no permitido muestra el error y NO abre el recortador', () => {
    const { elegir, subidas, emitidas, recortador, texto } = armar();

    elegir(archivo('image/gif'));

    expect(subidas).toEqual([]);
    expect(emitidas).toEqual([]);
    expect(recortador()).toBeNull();
    expect(texto()).toContain('JPG, PNG o WebP');
  });

  it('con más de 5 MB muestra el error y NO abre el recortador', () => {
    const { elegir, subidas, emitidas, recortador, texto } = armar();

    elegir(archivo('image/jpeg', CINCO_MB + 1));

    expect(subidas).toEqual([]);
    expect(emitidas).toEqual([]);
    expect(recortador()).toBeNull();
    expect(texto()).toContain('5 MB');
  });

  it('con exactamente 5 MB acepta y abre el recortador: el límite es "hasta 5 MB"', () => {
    const { elegir, subidas, recortador } = armar();

    elegir(archivo('image/jpeg', CINCO_MB));

    expect(subidas).toEqual([]);
    expect(recortador()).not.toBeNull();
  });

  it('mientras sube el recorte deshabilita el selector y avisa que está subiendo', () => {
    const respuesta = new Subject<string>();
    const { elegir, confirmarRecorte, entrada, fixture, texto } = armar({
      subir: () => respuesta,
    });

    elegir(archivo('image/jpeg'));
    confirmarRecorte();

    expect(entrada().disabled).toBe(true);
    expect(texto()).toContain('Subiendo…');

    respuesta.next('https://fotos.test/nueva.jpg');
    respuesta.complete();
    fixture.detectChanges();

    expect(entrada().disabled).toBe(false);
    expect(texto()).not.toContain('Subiendo…');
  });

  it('si la subida del recorte falla muestra el error, no emite y sigue mostrando la foto anterior', () => {
    const { elegir, confirmarRecorte, emitidas, imagen, texto } = armar({
      fotoUrl: 'https://fotos.test/sofia.jpg',
      subir: () => throwError(() => new Error('sin permiso')),
    });

    elegir(archivo('image/jpeg'));
    confirmarRecorte();

    expect(emitidas).toEqual([]);
    expect(texto()).toContain('No se pudo subir la foto');
    // La foto anterior no se reemplaza por una rota ni por un hueco.
    expect(imagen()?.getAttribute('src')).toBe('https://fotos.test/sofia.jpg');
  });
});
