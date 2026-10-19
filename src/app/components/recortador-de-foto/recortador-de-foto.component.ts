import { Component, ElementRef, InjectionToken, OnDestroy, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import {
  ANCHO_DE_SALIDA,
  ALTO_DE_SALIDA,
  Encuadre,
  Imagen,
  Marco,
  Rectangulo,
  encuadreInicial,
  limitarEncuadre,
  rectanguloDeOrigen,
} from './encuadre';
import { dibujarRecorte } from './dibujar-recorte';

type DibujarRecorte = (
  imagen: HTMLImageElement,
  origen: Rectangulo,
  salida: { ancho: number; alto: number },
) => Promise<Blob>;

/**
 * El dibujo se resuelve por inyección para poder reemplazarlo en los tests.
 *
 * El entorno de tests de Angular no soporta `vi.mock` sobre imports relativos
 * (lo rechaza el propio builder), así que el colaborador se dobla por TestBed,
 * que es el mecanismo que el proyecto usa en todos los specs.
 */
export const DIBUJAR_RECORTE = new InjectionToken<DibujarRecorte>('DIBUJAR_RECORTE', {
  providedIn: 'root',
  factory: () => dibujarRecorte,
});

const TEXTOS = {
  ayuda: 'Movés la foto con el dedo o el mouse y la acercás con el control.',
  acercar: 'Acercar',
  usar: 'Usar esta foto',
  preparando: 'Preparando…',
  cancelar: 'Cancelar',
  noSePudoLeer: 'No pudimos abrir esta foto. Probá con otra.',
  errorAlRecortar: 'No se pudo preparar el recorte. Probá de nuevo.',
} as const;

/** Lo que dura un arrastre: el punto de partida y el encuadre de ese momento. */
interface Arrastre {
  pointerId: number;
  inicioX: number;
  inicioY: number;
  base: Encuadre;
}

/**
 * Encuadre de la foto antes de subirla.
 *
 * El marco tiene la proporción 4:5 del sitio, así que lo que se ve acá es
 * exactamente lo que se guarda. La vista previa y el recorte usan la misma
 * matemática (`encuadre.ts`): si divergieran, la persona elegiría un encuadre y
 * subiría otro.
 *
 * El archivo que sale de acá es un Blob recortado; la imagen original nunca se
 * sube.
 */
@Component({
  selector: 'app-recortador-de-foto',
  standalone: true,
  template: `
    <div class="mt-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-medium text-gray-800">{{ textos.acercar }}</p>
        <span class="text-xs text-gray-500">{{ encuadre().acercamiento.toFixed(2) }}×</span>
      </div>

      <input
        type="range"
        min="1"
        max="3"
        step="0.05"
        class="mt-1 w-full"
        [value]="encuadre().acercamiento"
        (input)="acercar($event)"
        [attr.aria-label]="textos.acercar"
      />

      @if (vistaUrl(); as url) {
        <div
          #marco
          data-marco
          class="relative mx-auto mt-3 w-full max-w-[340px] select-none overflow-hidden rounded-xl bg-gray-900"
          style="aspect-ratio: 4 / 5; touch-action: none;"
          (pointerdown)="empezarArrastre($event)"
          (pointermove)="moverArrastre($event)"
          (pointerup)="terminarArrastre($event)"
          (pointercancel)="terminarArrastre($event)"
        >
          <img
            #imagen
            [src]="url"
            alt="Foto para encuadrar"
            draggable="false"
            class="absolute left-1/2 top-1/2 h-full w-full max-w-none object-cover"
            [style.width.px]="tamanoDeLaImagen().ancho || null"
            [style.height.px]="tamanoDeLaImagen().alto || null"
            [style.transform]="transformacion()"
            (load)="alCargar()"
            (error)="alFallarLaCarga()"
          />
        </div>
      }

      <p class="mt-2 text-xs text-gray-500">{{ textos.ayuda }}</p>

      @if (error()) {
        <p class="mt-2 text-sm text-red-700" role="alert">{{ error() }}</p>
      }

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-confirmar
          [disabled]="preparando() || !natural()"
          (click)="confirmar()"
          class="rounded-full bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {{ preparando() ? textos.preparando : textos.usar }}
        </button>
        <button
          type="button"
          data-cancelar
          [disabled]="preparando()"
          (click)="cancelar()"
          class="rounded-full border border-gray-300 px-5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {{ textos.cancelar }}
        </button>
      </div>
    </div>
  `,
})
export class RecortadorDeFotoComponent implements OnInit, OnDestroy {
  private readonly dibujar = inject(DIBUJAR_RECORTE);

  /** El archivo elegido en el selector, todavía sin recortar. */
  readonly imagen = input.required<File>();

  /** El recorte listo para subir. Sólo se emite si el canvas anduvo. */
  readonly recorteConfirmado = output<Blob>();

  /** La persona decidió no cambiar la foto. */
  readonly cancelado = output<void>();

  readonly textos = TEXTOS;
  readonly vistaUrl = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly preparando = signal(false);
  readonly encuadre = signal<Encuadre>(encuadreInicial());
  readonly natural = signal<Imagen | null>(null);

  private readonly marcoRef = viewChild<ElementRef<HTMLElement>>('marco');
  private readonly imagenRef = viewChild<ElementRef<HTMLImageElement>>('imagen');
  private readonly marcoMedido = signal<Marco | null>(null);
  private urlDeVista: string | null = null;
  private arrastre: Arrastre | null = null;

  ngOnInit(): void {
    const url = URL.createObjectURL(this.imagen());
    this.urlDeVista = url;
    this.vistaUrl.set(url);
  }

  ngOnDestroy(): void {
    if (this.urlDeVista) {
      URL.revokeObjectURL(this.urlDeVista);
      this.urlDeVista = null;
    }
  }

  /**
   * Tamaño al que hay que pintar la imagen para que la escala base cubra el
   * marco.
   *
   * No alcanza con `object-cover` sobre un elemento del tamaño del marco: al
   * arrastrarlo, la caja se movería y dejaría ver el fondo. Con la caja del
   * tamaño real de la imagen cubierta, moverla descubre otra parte de la foto.
   */
  readonly tamanoDeLaImagen = computed(() => {
    const imagen = this.natural();
    const marco = this.marcoMedido();
    if (!imagen || !marco) return { ancho: 0, alto: 0 };

    const escala = Math.max(marco.ancho / imagen.ancho, marco.alto / imagen.alto);
    return { ancho: imagen.ancho * escala, alto: imagen.alto * escala };
  });

  readonly transformacion = computed(() => {
    const { x, y, acercamiento } = this.encuadre();
    return `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${acercamiento})`;
  });

  empezarArrastre(evento: PointerEvent): void {
    if (this.preparando() || !this.natural() || !this.marcoMedido()) return;

    this.arrastre = {
      pointerId: evento.pointerId,
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      base: this.encuadre(),
    };

    const marco = this.marcoRef()?.nativeElement;
    marco?.setPointerCapture?.(evento.pointerId);
    evento.preventDefault();
  }

  moverArrastre(evento: PointerEvent): void {
    const arrastre = this.arrastre;
    if (!arrastre || arrastre.pointerId !== evento.pointerId) return;

    const imagen = this.natural();
    const marco = this.marcoMedido();
    if (!imagen || !marco) return;

    const candidato: Encuadre = {
      x: arrastre.base.x + (evento.clientX - arrastre.inicioX),
      y: arrastre.base.y + (evento.clientY - arrastre.inicioY),
      acercamiento: arrastre.base.acercamiento,
    };

    this.encuadre.set(limitarEncuadre(candidato, imagen, marco));
  }

  terminarArrastre(evento: PointerEvent): void {
    const arrastre = this.arrastre;
    if (!arrastre || arrastre.pointerId !== evento.pointerId) return;

    const marco = this.marcoRef()?.nativeElement;
    if (marco?.hasPointerCapture?.(evento.pointerId)) {
      marco.releasePointerCapture(evento.pointerId);
    }
    this.arrastre = null;
  }

  acercar(evento: Event): void {
    const control = evento.target as HTMLInputElement;
    const valor = control.valueAsNumber;
    if (!Number.isFinite(valor)) return;

    const imagen = this.natural();
    const marco = this.marcoMedido();
    if (!imagen || !marco) return;

    const candidato: Encuadre = { ...this.encuadre(), acercamiento: valor };
    this.encuadre.set(limitarEncuadre(candidato, imagen, marco));
  }

  alCargar(): void {
    const elemento = this.imagenRef()?.nativeElement;
    if (!elemento) return;

    const ancho = elemento.naturalWidth;
    const alto = elemento.naturalHeight;
    if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) {
      this.natural.set(null);
      this.error.set(TEXTOS.noSePudoLeer);
      return;
    }

    const imagen: Imagen = { ancho, alto };
    this.natural.set(imagen);
    this.error.set(null);

    const marco = this.medirMarco();
    if (marco) {
      this.encuadre.set(limitarEncuadre(this.encuadre(), imagen, marco));
    }
  }

  alFallarLaCarga(): void {
    this.natural.set(null);
    this.error.set(TEXTOS.noSePudoLeer);
  }

  async confirmar(): Promise<void> {
    if (this.preparando()) return;

    const imagen = this.natural();
    const elemento = this.imagenRef()?.nativeElement;
    const marco = this.medirMarco();

    if (!imagen || !elemento || !marco) {
      this.error.set(TEXTOS.noSePudoLeer);
      return;
    }

    this.error.set(null);
    this.preparando.set(true);

    try {
      const seguro = limitarEncuadre(this.encuadre(), imagen, marco);
      this.encuadre.set(seguro);

      const origen = rectanguloDeOrigen(seguro, imagen, marco);
      const recorte = await this.dibujar(elemento, origen, {
        ancho: ANCHO_DE_SALIDA,
        alto: ALTO_DE_SALIDA,
      });

      this.recorteConfirmado.emit(recorte);
    } catch {
      // Sin emisión: si el recorte falló, no se sube nada ni se reemplaza la
      // foto anterior.
      this.error.set(TEXTOS.errorAlRecortar);
    } finally {
      this.preparando.set(false);
    }
  }

  cancelar(): void {
    if (this.preparando()) return;
    this.cancelado.emit();
  }

  private medirMarco(): Marco | null {
    const elemento = this.marcoRef()?.nativeElement;
    if (!elemento) return null;

    const rect = elemento.getBoundingClientRect();
    if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
    if (rect.width <= 0 || rect.height <= 0) return null;

    const marco: Marco = { ancho: rect.width, alto: rect.height };
    this.marcoMedido.set(marco);
    return marco;
  }
}
