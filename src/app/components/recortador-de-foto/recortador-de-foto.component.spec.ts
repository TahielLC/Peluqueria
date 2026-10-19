import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DIBUJAR_RECORTE,
  RecortadorDeFotoComponent,
} from './recortador-de-foto.component';
import { Rectangulo } from './encuadre';

type DibujarRecorte = (
  imagen: HTMLImageElement,
  origen: Rectangulo,
  salida: { ancho: number; alto: number },
) => Promise<Blob>;

const FOTO = () => new File(['foto'], 'foto.jpg', { type: 'image/jpeg' });

/**
 * Arma el recortador. jsdom no carga imágenes ni tiene layout: la medida
 * natural y el tamaño del marco se simulan a mano. El canvas no se toca porque
 * el dibujo se reemplaza por TestBed; este spec prueba el flujo, no el dibujo.
 */
function armar() {
  const recortar = vi.fn<DibujarRecorte>();

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [RecortadorDeFotoComponent],
    providers: [{ provide: DIBUJAR_RECORTE, useValue: recortar }],
  });

  const fixture = TestBed.createComponent(RecortadorDeFotoComponent);
  fixture.componentRef.setInput('imagen', FOTO());
  fixture.detectChanges();

  const confirmados: Blob[] = [];
  const cancelados: number[] = [];
  fixture.componentInstance.recorteConfirmado.subscribe((blob) => confirmados.push(blob));
  fixture.componentInstance.cancelado.subscribe(() => cancelados.push(1));

  const elemento = (selector: string) =>
    fixture.nativeElement.querySelector(selector) as HTMLElement | null;

  const marco = () => {
    const encontrado = elemento('[data-marco]');
    if (!encontrado) throw new Error('No está el marco del recorte');
    return encontrado;
  };

  const imagen = () => {
    const encontrada = elemento('img') as HTMLImageElement | null;
    if (!encontrada) throw new Error('No está la vista previa');
    return encontrada;
  };

  const boton = (selector: string) => {
    const encontrado = elemento(selector) as HTMLButtonElement | null;
    if (!encontrado) throw new Error(`No está el botón ${selector}`);
    return encontrado;
  };

  const prepararVistaPrevia = () => {
    const vista = imagen();
    Object.defineProperty(vista, 'naturalWidth', { value: 1000, configurable: true });
    Object.defineProperty(vista, 'naturalHeight', { value: 2000, configurable: true });

    vi.spyOn(marco(), 'getBoundingClientRect').mockReturnValue({
      width: 400,
      height: 500,
      top: 0,
      left: 0,
      right: 400,
      bottom: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    vista.dispatchEvent(new Event('load'));
    fixture.detectChanges();
  };

  return {
    fixture,
    component: fixture.componentInstance,
    recortar,
    confirmados,
    cancelados,
    marco,
    imagen,
    boton,
    prepararVistaPrevia,
    texto: () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' '),
  };
}

describe('RecortadorDeFotoComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();

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

  it('muestra una ayuda en castellano que explica cómo encuadrar', () => {
    const { texto } = armar();

    expect(texto()).toContain('Movés la foto con el dedo o el mouse');
  });

  it('centra la vista previa en el marco antes de moverla', () => {
    const { imagen } = armar();

    // Sin estas tres clases la imagen arranca pegada a la esquina y el marco
    // mostraría un recorte distinto al que se guarda. jsdom no calcula layout,
    // así que lo único verificable acá es el contrato de posicionamiento.
    const vista = imagen();
    expect(vista.classList.contains('absolute')).toBe(true);
    expect(vista.classList.contains('left-1/2')).toBe(true);
    expect(vista.classList.contains('top-1/2')).toBe(true);
  });

  it('el botón Cancelar emite cancelado y no recorta', async () => {
    const { boton, cancelados, confirmados, recortar, fixture } = armar();

    boton('[data-cancelar]').click();
    await Promise.resolve();

    expect(cancelados).toHaveLength(1);
    expect(confirmados).toEqual([]);
    expect(recortar).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('confirmar recorta y emite el Blob con las medidas de salida', async () => {
    const { component, prepararVistaPrevia, confirmados, imagen, recortar } = armar();
    const recorte = new Blob(['recorte'], { type: 'image/webp' });
    recortar.mockResolvedValue(recorte);

    prepararVistaPrevia();
    await component.confirmar();

    expect(recortar).toHaveBeenCalledWith(
      imagen(),
      { sx: 0, sy: 375, sw: 1000, sh: 1250 },
      { ancho: 800, alto: 1000 },
    );
    expect(confirmados).toEqual([recorte]);
  });

  it('mientras dibuja deshabilita los botones y avisa que está preparando', async () => {
    let resolver: (blob: Blob) => void = () => {};

    const { component, prepararVistaPrevia, boton, texto, confirmados, recortar, fixture } =
      armar();
    recortar.mockReturnValue(new Promise<Blob>((resolverPromesa) => (resolver = resolverPromesa)));
    prepararVistaPrevia();

    const enCurso = component.confirmar();
    fixture.detectChanges();

    expect(boton('[data-confirmar]').disabled).toBe(true);
    expect(boton('[data-cancelar]').disabled).toBe(true);
    expect(texto()).toContain('Preparando…');

    resolver(new Blob(['recorte'], { type: 'image/webp' }));
    await enCurso;
    fixture.detectChanges();

    expect(confirmados).toHaveLength(1);
    expect(boton('[data-confirmar]').disabled).toBe(false);
  });

  it('si el recorte falla muestra el error y NO emite', async () => {
    const { component, prepararVistaPrevia, confirmados, texto, recortar, fixture } = armar();
    recortar.mockRejectedValue(new Error('sin contexto'));

    prepararVistaPrevia();
    await component.confirmar();
    fixture.detectChanges();

    expect(confirmados).toEqual([]);
    expect(texto()).toContain('No se pudo preparar el recorte');
  });

  it('si la foto no se puede leer muestra el error y no deja confirmar', async () => {
    const { component, imagen, boton, texto, recortar, fixture } = armar();

    imagen().dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos abrir esta foto');
    expect(boton('[data-confirmar]').disabled).toBe(true);

    await component.confirmar();
    expect(recortar).not.toHaveBeenCalled();
  });

  it('libera la vista previa al destruirse', () => {
    const { fixture } = armar();

    fixture.destroy();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:vista-previa');
  });
});
