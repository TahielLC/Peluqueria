import { Component, OnInit, inject, signal } from '@angular/core';
import { ClaveDeTexto, TextoDeSitio } from '../../../models/salon.model';
import { AppointmentService } from '../../../services/appointment.service';
import { TextosSitioService } from '../../../services/textos-sitio.service';
import { CargaDeContenido, MENSAJES } from '../../../components/estados';

/**
 * Lo que el editor dice en pantalla.
 *
 * Vive acá y no en `components/estados.ts` porque es texto de este editor, no de
 * la máquina compartida de cargando / error / vacío. Los tres textos que sí son
 * de todos (`MENSAJES`) se usan tal cual, para que un fallo de lectura se lea
 * igual que en el resto del sitio.
 */
const TEXTOS_DEL_EDITOR = {
  vacio: 'Todavía no hay textos para editar.',
  guardar: 'Guardar',
  guardando: 'Guardando…',
  // La confirmación nombra el efecto, no la operación: "se guardó" no le dice
  // nada a quien no sabe de apps; "ya se ve en el sitio" sí.
  guardado: 'Guardado. Ya se ve en el sitio.',
  // No se muestra el error crudo de la base, ni se adivina la causa. Puede ser
  // la conexión, pero también que la cuenta haya dejado de ser la
  // administradora; mandar a revisar el wifi cuando el problema es otro le hace
  // perder tiempo a quien no puede resolverlo. Lo que importa es que el fallo
  // quede a la vista y que ofrezca una salida.
  errorAlGuardar:
    'No se pudo guardar este texto. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
} as const;

/**
 * Una fila del editor: el texto de la base más lo que hace falta para editarlo.
 */
interface FilaDeTexto extends TextoDeSitio {
  /** Lo último que la base confirmó. El botón compara contra esto. */
  guardado: string;
  guardando: boolean;
  /**
   * `true` recién después del primer guardado exitoso. Sin esta marca, todas las
   * filas dirían "guardado" al abrirse, cuando en realidad nadie guardó nada.
   */
  seGuardo: boolean;
  error: string | null;
}

/**
 * Edición de los textos del sitio desde el panel.
 *
 * **Una fila por texto y un botón por fila**, no un botón global: así la
 * confirmación es de ese campo. Con un solo botón habría que reportar éxitos y
 * fracasos parciales, y la persona tendría que adivinar cuál de los diez textos
 * quedó y cuál no.
 *
 * **Para leer** se usa `AppointmentService.getTextos()`, que es el que trae la
 * etiqueta y la ayuda de la base. **Para escribir** se usa siempre
 * `TextosSitioService.guardar()` y nunca `AppointmentService.guardarTexto()`:
 * el primero deja al día la copia que muestra el sitio, así que al volver a la
 * portada el texto nuevo ya se ve. Si se guardara por el segundo, la base
 * quedaría bien y el home mostraría lo viejo hasta recargar.
 *
 * **Sin `@angular/forms`**: no es dependencia del proyecto y dos campos de texto
 * no justifican agregarla. Se usan textareas nativos con señales. Son textareas
 * para todos los textos, incluso los cortos, por uniformidad y porque los largos
 * (subtítulo, bajadas) se tienen que leer enteros.
 *
 * **No hay validaciones propias**: la base acepta un valor vacío y el texto es
 * de la administradora. El formulario no opina sobre lo que ella quiere publicar.
 */
@Component({
  selector: 'app-seccion-textos',
  standalone: true,
  template: `
    <div>
      @if (cargando()) {
        <p class="py-8 text-center text-gray-400" role="status">{{ mensajes.cargando }}</p>
      } @else if (error()) {
        <div class="py-8 text-center">
          <p class="mb-4 text-gray-600">{{ error() }}</p>
          <button
            type="button"
            (click)="cargar()"
            class="rounded-full bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {{ mensajes.reintentar }}
          </button>
        </div>
      } @else if (filas().length === 0) {
        <p class="py-8 text-center text-gray-400">{{ textos.vacio }}</p>
      } @else {
        <ul class="space-y-4">
          @for (fila of filas(); track fila.clave) {
            <li class="rounded-xl border border-gray-200 bg-white p-4">
              <label
                [for]="campoDe(fila.clave)"
                class="block text-sm font-medium text-gray-800"
              >
                {{ fila.etiqueta }}
              </label>

              <textarea
                [id]="campoDe(fila.clave)"
                rows="2"
                [value]="fila.valor"
                [attr.aria-describedby]="fila.ayuda ? ayudaDe(fila.clave) : null"
                (input)="cambiar(fila.clave, $event)"
                class="mt-2 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
              ></textarea>

              @if (fila.ayuda) {
                <p [id]="ayudaDe(fila.clave)" class="mt-1 text-xs text-gray-500">
                  {{ fila.ayuda }}
                </p>
              }

              <div class="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  [disabled]="fila.guardando || fila.valor === fila.guardado"
                  (click)="guardar(fila.clave)"
                  class="rounded-full bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {{ textos.guardar }}
                </button>

                @if (fila.guardando) {
                  <p class="text-sm text-gray-500" role="status">{{ textos.guardando }}</p>
                } @else if (fila.error) {
                  <p class="text-sm text-red-700" role="alert">{{ fila.error }}</p>
                } @else if (fila.seGuardo && fila.valor === fila.guardado) {
                  <p class="text-sm text-green-700" role="status">{{ textos.guardado }}</p>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class SeccionTextosComponent implements OnInit {
  private readonly datos = inject(AppointmentService);
  private readonly textosDelSitio = inject(TextosSitioService);

  readonly filas = signal<FilaDeTexto[]>([]);

  readonly mensajes = MENSAJES;
  readonly textos = TEXTOS_DEL_EDITOR;

  /**
   * Las mismas tres reglas de cargando / error / vacío que las secciones del
   * sitio, tomadas de `components/estados.ts` y no reimplementadas acá.
   */
  private readonly carga = new CargaDeContenido<TextoDeSitio[]>(
    () => this.datos.getTextos(),
    (datos) => this.filas.set(datos.map((texto) => this.aFila(texto))),
  );

  readonly cargando = this.carga.cargando;
  readonly error = this.carga.error;

  ngOnInit(): void {
    this.cargar();
  }

  /** Pide la lista. Separado del arranque para que "Reintentar" lo repita. */
  cargar(): void {
    this.carga.cargar();
  }

  /** Actualiza el valor mientras la persona escribe. */
  cambiar(clave: ClaveDeTexto, evento: Event): void {
    const valor = (evento.target as HTMLTextAreaElement).value;
    this.actualizar(clave, { valor });
  }

  /**
   * Guarda el valor actual de esa fila, sólo si cambió respecto del guardado.
   *
   * El `guardando` repele un segundo clic aunque el botón esté deshabilitado: el
   * estado de la pantalla no es la única defensa, y un doble envío no tiene que
   * llegar a la base.
   */
  guardar(clave: ClaveDeTexto): void {
    const fila = this.filas().find((candidata) => candidata.clave === clave);
    if (!fila || fila.guardando || fila.valor === fila.guardado) return;

    const valorEnviado = fila.valor;
    this.actualizar(clave, { guardando: true, seGuardo: false, error: null });

    this.textosDelSitio.guardar(clave, valorEnviado).subscribe({
      next: () => {
        // Se confirma recién cuando la base aceptó. Y se guarda el valor enviado,
        // no el que haya en el textarea ahora: si la persona siguió escribiendo,
        // ese cambio todavía no está guardado.
        this.actualizar(clave, {
          guardando: false,
          guardado: valorEnviado,
          seGuardo: true,
        });
      },
      error: () => {
        // El aviso queda a la vista. Una escritura bloqueada (por ejemplo por
        // RLS) no puede parecer exitosa: sería peor que fallar en silencio
        // mostrando una confirmación falsa.
        this.actualizar(clave, {
          guardando: false,
          error: TEXTOS_DEL_EDITOR.errorAlGuardar,
        });
      },
    });
  }

  /** Id del campo, para asociar la etiqueta y la ayuda. */
  campoDe(clave: ClaveDeTexto): string {
    return `texto-${clave}`;
  }

  /** Id de la línea de ayuda. Sólo se usa cuando la ayuda existe. */
  ayudaDe(clave: ClaveDeTexto): string {
    return `ayuda-${clave}`;
  }

  private aFila(texto: TextoDeSitio): FilaDeTexto {
    return {
      ...texto,
      guardado: texto.valor,
      guardando: false,
      seGuardo: false,
      error: null,
    };
  }

  /**
   * Cambia una sola fila sin tocar las demás.
   *
   * Se reemplaza el array entero porque es un `signal`: mutar el objeto de
   * adentro no avisaría del cambio y la pantalla quedaría mostrando lo viejo.
   */
  private actualizar(clave: ClaveDeTexto, cambios: Partial<FilaDeTexto>): void {
    this.filas.update((actuales) =>
      actuales.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)),
    );
  }
}
