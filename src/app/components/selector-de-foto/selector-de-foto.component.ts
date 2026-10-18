import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CarpetaDeFotos, SubidaDeFotosService } from '../../services/subida-de-fotos.service';

/**
 * Lo que el selector dice en pantalla.
 *
 * El aviso de éxito aclara que la foto todavía no está publicada: subirla sólo
 * la deja lista. Hasta que se guarde la fila, el sitio sigue mostrando la foto
 * anterior, y decirlo evita que la persona cierre el panel creyendo que terminó.
 */
const TEXTOS = {
  etiqueta: 'Foto',
  sinFoto: 'Sin foto',
  cambiar: 'Cambiar foto',
  subiendo: 'Subiendo…',
  lista: 'Foto lista. Acordate de guardar.',
  tipoInvalido: 'La foto tiene que ser un archivo JPG, PNG o WebP.',
  pesoSobrado: 'La foto no puede pesar más de 5 MB.',
  errorAlSubir: 'No se pudo subir la foto. Probá de nuevo.',
} as const;

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO = 5 * 1024 * 1024;

/**
 * Selector de foto reutilizable por el staff y por la galería.
 *
 * **Valida antes de subir.** El tipo y el tamaño se revisan acá, junto al campo,
 * porque es el único lugar donde el error se puede mostrar donde la persona está
 * mirando. El servicio de subida no valida: sólo sube lo que le dan.
 *
 * **No guarda nada en la base.** Sólo sube el archivo y emite la URL nueva; la
 * fila se guarda desde el editor. Por eso el aviso dice "acordate de guardar".
 */
@Component({
  selector: 'app-selector-de-foto',
  standalone: true,
  template: `
    <div>
      <p class="block text-sm font-medium text-gray-800">{{ textos.etiqueta }}</p>

      <div class="mt-2 flex flex-wrap items-center gap-3">
        @if (foto()) {
          <img
            [src]="foto()"
            alt="Foto actual"
            class="h-16 w-16 rounded-full border border-gray-200 object-cover"
          />
        } @else {
          <span
            class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-center text-xs text-gray-500"
          >
            {{ textos.sinFoto }}
          </span>
        }

        <label
          class="cursor-pointer rounded-full border border-gray-300 px-5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          [class.cursor-not-allowed]="subiendo()"
          [class.text-gray-400]="subiendo()"
        >
          {{ subiendo() ? textos.subiendo : textos.cambiar }}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            [disabled]="subiendo()"
            (change)="elegir($event)"
          />
        </label>
      </div>

      @if (error()) {
        <p class="mt-2 text-sm text-red-700" role="alert">{{ error() }}</p>
      } @else if (aviso()) {
        <p class="mt-2 text-sm text-green-700" role="status">{{ aviso() }}</p>
      }
    </div>
  `,
})
export class SelectorDeFotoComponent {
  private readonly subida = inject(SubidaDeFotosService);

  /** La foto que ya está guardada en la fila. */
  readonly fotoUrl = input<string>('');

  /** Carpeta del bucket donde se sube. La galería usa `galeria`. */
  readonly carpeta = input<CarpetaDeFotos>('peluqueros');

  /** La URL nueva, sólo si la subida salió bien. */
  readonly fotoSubida = output<string>();

  readonly subiendo = signal(false);
  readonly error = signal<string | null>(null);
  readonly aviso = signal<string | null>(null);

  /**
   * La foto que se muestra: la recién subida si la hay, si no la guardada.
   *
   * Sin esto, después de subir una foto la pantalla seguiría mostrando la
   * anterior hasta que el padre actualice el input, y parecería que no pasó nada.
   */
  private readonly fotoNueva = signal<string | null>(null);

  readonly foto = computed(() => this.fotoNueva() ?? this.fotoUrl());

  readonly textos = TEXTOS;

  elegir(evento: Event): void {
    if (this.subiendo()) return;

    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0] ?? null;

    // Se limpia el valor para que elegir el mismo archivo otra vez vuelva a
    // disparar el evento: sin esto, el segundo intento no haría nada.
    entrada.value = '';

    if (!archivo) return;

    this.aviso.set(null);

    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      this.error.set(TEXTOS.tipoInvalido);
      return;
    }

    if (archivo.size > TAMANO_MAXIMO) {
      this.error.set(TEXTOS.pesoSobrado);
      return;
    }

    this.error.set(null);
    this.subiendo.set(true);

    this.subida.subirFoto(archivo, this.carpeta()).subscribe({
      next: (url) => {
        this.subiendo.set(false);
        this.fotoNueva.set(url);
        this.aviso.set(TEXTOS.lista);
        this.fotoSubida.emit(url);
      },
      error: () => {
        this.subiendo.set(false);
        // La foto anterior sigue a la vista: un fallo no la reemplaza por un
        // hueco ni por una imagen rota.
        this.error.set(TEXTOS.errorAlSubir);
      },
    });
  }
}
