import { Component, OnInit, inject, signal } from '@angular/core';
import {
  CategoriaDeTrabajo,
  DatosDeTrabajoDeGaleria,
  TrabajoDeGaleriaAdministrable,
} from '../../../models/salon.model';
import { AppointmentService } from '../../../services/appointment.service';
import { CargaDeContenido, MENSAJES } from '../../../components/estados';
import { SelectorDeFotoComponent } from '../../../components/selector-de-foto/selector-de-foto.component';

/**
 * Lo que el editor dice en pantalla.
 *
 * Vive acá y no en `components/estados.ts` porque es texto de esta pantalla, no
 * de la máquina compartida de cargando / error / vacío. Los tres textos que sí
 * son de todos (`MENSAJES`) se usan tal cual, para que un fallo de lectura se
 * lea igual que en el resto del panel.
 */
const TEXTOS_DEL_EDITOR = {
  vacio: 'Todavía no hay trabajos cargados.',
  etiquetaTitulo: 'Título',
  etiquetaCategoria: 'Categoría',
  ayudaCategoria: 'Elegí el grupo en el que se va a ver el trabajo.',
  guardar: 'Guardar',
  guardando: 'Guardando…',
  // La confirmación nombra el efecto, no la operación: "se guardó" no le dice
  // nada a quien no sabe de apps; "ya se ve en el sitio" sí.
  guardado: 'Guardado. Ya se ve en el sitio.',
  guardadoDadoDeBaja: 'Guardado. Ya no se ve en el sitio.',
  // No se muestra el error crudo de la base ni se adivina la causa. Puede ser
  // la conexión, pero también que la cuenta haya dejado de ser la
  // administradora; mandar a revisar el wifi cuando el problema es otro le hace
  // perder tiempo a quien no puede resolverlo.
  errorAlGuardar:
    'No se pudo guardar este trabajo. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  darDeBaja: 'Dar de baja',
  volverAPublicar: 'Volver a publicar',
  cambiandoEstado: 'Cambiando…',
  dadoDeBaja: 'Dado de baja',
  yaNoSeVe: 'Dado de baja. Ya no se ve en el sitio.',
  yaSeVe: 'Publicado. Ya se ve en el sitio.',
  errorAlCambiarEstado:
    'No se pudo cambiar si este trabajo se ve en el sitio. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  agregarTitulo: 'Agregar trabajo',
  agregar: 'Agregar',
  agregando: 'Agregando…',
  agregado: 'Trabajo agregado. Ya se ve en el sitio.',
  errorAlAgregar:
    'No se pudo agregar el trabajo. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  cancelar: 'Cancelar',
  errorTitulo: 'Escribí un título para el trabajo.',
  errorFoto: 'Subí una foto para el trabajo.',
} as const;

/** Las cuatro categorías, en el orden en que se ofrecen. */
const CATEGORIAS: CategoriaDeTrabajo[] = ['Corte', 'Peinado', 'Barba', 'Color'];

/** Los campos editables de un trabajo. */
type CampoDeTrabajo = 'titulo' | 'categoria';

/** Una fila del editor: el trabajo de la base más lo que hace falta para editarlo. */
interface FilaDeTrabajo {
  id: number;
  titulo: string;
  categoria: CategoriaDeTrabajo;
  imagenUrl: string;
  activo: boolean;
  /** Lo último que la base confirmó. El botón compara contra esto. */
  original: DatosDeTrabajoDeGaleria;
  guardando: boolean;
  /** `true` recién después del primer guardado exitoso. */
  seGuardo: boolean;
  error: string | null;
  errorTitulo: string | null;
  cambiandoEstado: boolean;
  avisoEstado: string | null;
  errorDeEstado: string | null;
}

/** Lo que hay escrito en el formulario de alta. */
interface ValoresDeTrabajo {
  titulo: string;
  categoria: CategoriaDeTrabajo;
}

interface ErroresDeAlta {
  titulo?: string;
  foto?: string;
}

/**
 * Edición de la galería de trabajos desde el panel.
 *
 * **Una fila por trabajo y un botón por fila**, igual que los editores de
 * textos, servicios y equipo: así la confirmación es de ese trabajo y no hay
 * que reportar éxitos y fracasos parciales.
 *
 * **Se ven los activos y los inactivos.** Los inactivos quedan atenuados, con
 * la leyenda "Dado de baja" y la acción "Volver a publicar". Sin eso, una baja
 * por error no tendría vuelta desde la pantalla, que es justo lo que hay que
 * evitar con alguien que no sabe de apps.
 *
 * **La baja es lógica**: se cambia `activo`, nunca se borra la fila. El sitio
 * público ya filtra los inactivos.
 *
 * **La foto se reemplaza subiendo un archivo**, nunca pegando una URL. El alta
 * exige foto: un trabajo sin foto no se puede mostrar en el cilindro del sitio.
 * Por eso el formulario se destruye al cerrarse y al terminar bien, para que el
 * selector se recree limpio y no quede mostrando la foto anterior como si fuera
 * nueva.
 *
 * **Sin `@angular/forms`**: no es dependencia del proyecto. Se usan inputs,
 * un `select` nativo y señales, como el resto del panel.
 */
@Component({
  selector: 'app-seccion-galeria',
  standalone: true,
  imports: [SelectorDeFotoComponent],
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
          @for (fila of filas(); track fila.id) {
            <li
              class="rounded-xl border border-gray-200 bg-white p-4"
              [class.opacity-60]="!fila.activo"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-medium text-gray-800">{{ fila.titulo }}</p>

                @if (!fila.activo) {
                  <span class="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                    {{ textos.dadoDeBaja }}
                  </span>
                }
              </div>

              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    [for]="campoDe(fila.id, 'titulo')"
                    class="block text-sm font-medium text-gray-800"
                  >
                    {{ textos.etiquetaTitulo }}
                  </label>
                  <input
                    [id]="campoDe(fila.id, 'titulo')"
                    type="text"
                    [value]="fila.titulo"
                    (input)="cambiar(fila.id, 'titulo', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  />
                  @if (fila.errorTitulo; as mensaje) {
                    <p class="mt-1 text-sm text-red-700" role="alert">{{ mensaje }}</p>
                  }
                </div>

                <div>
                  <label
                    [for]="campoDe(fila.id, 'categoria')"
                    class="block text-sm font-medium text-gray-800"
                  >
                    {{ textos.etiquetaCategoria }}
                  </label>
                  <select
                    [id]="campoDe(fila.id, 'categoria')"
                    [value]="fila.categoria"
                    [attr.aria-describedby]="ayudaDe(fila.id)"
                    (change)="cambiar(fila.id, 'categoria', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  >
                    @for (categoria of categorias; track categoria) {
                      <option [value]="categoria" [selected]="categoria === fila.categoria">
                        {{ categoria }}
                      </option>
                    }
                  </select>
                  <p [id]="ayudaDe(fila.id)" class="mt-1 text-xs text-gray-500">
                    {{ textos.ayudaCategoria }}
                  </p>
                </div>

                <app-selector-de-foto
                  [fotoUrl]="fila.imagenUrl"
                  [carpeta]="'galeria'"
                  (fotoSubida)="cambiarFoto(fila.id, $event)"
                />
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  [disabled]="fila.guardando || !hayCambios(fila)"
                  (click)="guardar(fila.id)"
                  class="rounded-full bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {{ textos.guardar }}
                </button>

                <button
                  type="button"
                  [disabled]="fila.cambiandoEstado"
                  (click)="cambiarEstado(fila.id)"
                  class="rounded-full border border-gray-300 px-5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
                >
                  {{ fila.activo ? textos.darDeBaja : textos.volverAPublicar }}
                </button>

                @if (fila.guardando) {
                  <p class="text-sm text-gray-500" role="status">{{ textos.guardando }}</p>
                } @else if (fila.error) {
                  <p class="text-sm text-red-700" role="alert">{{ fila.error }}</p>
                } @else if (fila.seGuardo) {
                  <p class="text-sm text-green-700" role="status">
                    {{ fila.activo ? textos.guardado : textos.guardadoDadoDeBaja }}
                  </p>
                }

                @if (fila.cambiandoEstado) {
                  <p class="text-sm text-gray-500" role="status">{{ textos.cambiandoEstado }}</p>
                } @else if (fila.errorDeEstado) {
                  <p class="text-sm text-red-700" role="alert">{{ fila.errorDeEstado }}</p>
                } @else if (fila.avisoEstado) {
                  <p class="text-sm text-green-700" role="status">{{ fila.avisoEstado }}</p>
                }
              </div>
            </li>
          }
        </ul>
      }

      <div class="mt-8">
        @if (!altaAbierta()) {
          <button
            type="button"
            (click)="abrirAlta()"
            class="rounded-full bg-indigo-600 px-6 py-2 font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {{ textos.agregarTitulo }}
          </button>
        } @else {
          <section
            aria-label="Agregar un trabajo"
            class="rounded-xl border border-gray-200 bg-white p-4"
          >
            <h3 class="text-base font-semibold text-gray-800">{{ textos.agregarTitulo }}</h3>
            <p class="mt-1 text-sm text-gray-500">El trabajo nuevo queda al final de la lista.</p>

            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label for="nuevo-trabajo-titulo" class="block text-sm font-medium text-gray-800">
                  {{ textos.etiquetaTitulo }}
                </label>
                <input
                  id="nuevo-trabajo-titulo"
                  type="text"
                  [value]="nuevo().titulo"
                  (input)="cambiarNuevoTitulo($event)"
                  class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                />
                @if (erroresNuevo().titulo; as mensaje) {
                  <p class="mt-1 text-sm text-red-700" role="alert">{{ mensaje }}</p>
                }
              </div>

              <div>
                <label for="nuevo-trabajo-categoria" class="block text-sm font-medium text-gray-800">
                  {{ textos.etiquetaCategoria }}
                </label>
                <select
                  id="nuevo-trabajo-categoria"
                  [value]="nuevo().categoria"
                  aria-describedby="ayuda-nueva-categoria"
                  (change)="cambiarNuevaCategoria($event)"
                  class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                >
                  @for (categoria of categorias; track categoria) {
                    <option [value]="categoria" [selected]="categoria === nuevo().categoria">
                      {{ categoria }}
                    </option>
                  }
                </select>
                <p id="ayuda-nueva-categoria" class="mt-1 text-xs text-gray-500">
                  {{ textos.ayudaCategoria }}
                </p>
              </div>

              <app-selector-de-foto
                [fotoUrl]="fotoNueva()"
                [carpeta]="'galeria'"
                (fotoSubida)="cambiarFotoNueva($event)"
              />
            </div>

            @if (erroresNuevo().foto; as mensaje) {
              <p class="mt-2 text-sm text-red-700" role="alert">{{ mensaje }}</p>
            }

            <div class="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                [disabled]="agregando()"
                (click)="agregar()"
                class="rounded-full bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {{ agregando() ? textos.agregando : textos.agregar }}
              </button>

              <button
                type="button"
                (click)="cerrarAlta()"
                class="rounded-full border border-gray-300 px-5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                {{ textos.cancelar }}
              </button>
            </div>
          </section>
        }

        @if (avisoAgregado()) {
          <p class="mt-3 text-sm text-green-700" role="status">{{ avisoAgregado() }}</p>
        }
        @if (errorAlAgregar()) {
          <p class="mt-3 text-sm text-red-700" role="alert">{{ errorAlAgregar() }}</p>
        }
      </div>
    </div>
  `,
})
export class SeccionGaleriaComponent implements OnInit {
  private readonly datos = inject(AppointmentService);

  readonly filas = signal<FilaDeTrabajo[]>([]);

  readonly mensajes = MENSAJES;
  readonly textos = TEXTOS_DEL_EDITOR;
  readonly categorias = CATEGORIAS;

  /** Lo escrito en el formulario de alta, separado de las filas. */
  readonly altaAbierta = signal(false);
  readonly nuevo = signal<ValoresDeTrabajo>({ titulo: '', categoria: 'Corte' });
  readonly fotoNueva = signal('');
  readonly erroresNuevo = signal<ErroresDeAlta>({});
  readonly agregando = signal(false);
  readonly avisoAgregado = signal<string | null>(null);
  readonly errorAlAgregar = signal<string | null>(null);

  /**
   * Las mismas tres reglas de cargando / error / vacío que el resto del panel,
   * tomadas de `components/estados.ts` y no reimplementadas acá.
   */
  private readonly carga = new CargaDeContenido<TrabajoDeGaleriaAdministrable[]>(
    () => this.datos.getTodaLaGaleria(),
    (trabajos) => this.filas.set(trabajos.map((trabajo) => this.aFila(trabajo))),
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

  /** Actualiza el título o la categoría mientras la persona edita. */
  cambiar(id: number, campo: CampoDeTrabajo, evento: Event): void {
    const elemento = evento.target as HTMLInputElement | HTMLSelectElement;
    const valor = elemento.value;

    const cambios: Partial<FilaDeTrabajo> = {
      // Cualquier edición invalida la confirmación anterior: lo que se ve en
      // pantalla ya no es lo que está guardado.
      seGuardo: false,
      error: null,
      errorTitulo: null,
    };

    if (campo === 'titulo') cambios.titulo = valor;
    else cambios.categoria = valor as CategoriaDeTrabajo;

    this.actualizar(id, cambios);
  }

  /**
   * Toma la URL que emite el selector de foto.
   *
   * Cuenta como cambio pendiente a propósito: la foto nueva todavía no está en
   * el sitio hasta que se guarde la fila.
   */
  cambiarFoto(id: number, url: string): void {
    this.actualizar(id, { imagenUrl: url, seGuardo: false, error: null });
  }

  /** Dice si hay algo distinto de lo último confirmado por la base. */
  hayCambios(fila: FilaDeTrabajo): boolean {
    return (
      fila.titulo.trim() !== fila.original.titulo ||
      fila.categoria !== fila.original.categoria ||
      fila.imagenUrl !== fila.original.imagenUrl
    );
  }

  /**
   * Guarda la fila, sólo si cambió y si el título no quedó vacío.
   *
   * El `guardando` repele un segundo clic aunque el botón esté deshabilitado: el
   * estado de la pantalla no es la única defensa, y un doble envío no tiene que
   * llegar a la base.
   */
  guardar(id: number): void {
    const fila = this.filas().find((candidata) => candidata.id === id);
    if (!fila || fila.guardando || !this.hayCambios(fila)) return;

    const titulo = fila.titulo.trim();
    if (!titulo) {
      // No se manda nada: el error queda al lado del campo.
      this.actualizar(id, {
        errorTitulo: TEXTOS_DEL_EDITOR.errorTitulo,
        seGuardo: false,
        error: null,
      });
      return;
    }

    const datos: DatosDeTrabajoDeGaleria = {
      titulo,
      categoria: fila.categoria,
      imagenUrl: fila.imagenUrl,
    };

    this.actualizar(id, {
      guardando: true,
      seGuardo: false,
      error: null,
      errorTitulo: null,
    });

    this.datos.actualizarTrabajoDeGaleria(id, datos).subscribe({
      next: () => {
        // Se confirma recién cuando la base aceptó. Y se guardan los datos
        // enviados, no lo que haya en los campos ahora: si la persona siguió
        // editando, ese cambio todavía no está guardado.
        this.actualizar(id, {
          guardando: false,
          seGuardo: true,
          error: null,
          errorTitulo: null,
          titulo: datos.titulo,
          categoria: datos.categoria,
          imagenUrl: datos.imagenUrl,
          original: datos,
        });
      },
      error: () => {
        // Una escritura bloqueada (por ejemplo por RLS) no puede parecer
        // exitosa: sería peor que fallar mostrando una confirmación falsa.
        this.actualizar(id, {
          guardando: false,
          seGuardo: false,
          error: TEXTOS_DEL_EDITOR.errorAlGuardar,
        });
      },
    });
  }

  /** Da de baja o vuelve a publicar, según el estado actual. */
  cambiarEstado(id: number): void {
    const fila = this.filas().find((candidata) => candidata.id === id);
    if (!fila || fila.cambiandoEstado) return;

    const activo = !fila.activo;
    this.actualizar(id, {
      cambiandoEstado: true,
      errorDeEstado: null,
      avisoEstado: null,
    });

    this.datos.cambiarActivoDeTrabajoDeGaleria(id, activo).subscribe({
      next: () => {
        this.actualizar(id, {
          cambiandoEstado: false,
          activo,
          avisoEstado: activo ? TEXTOS_DEL_EDITOR.yaSeVe : TEXTOS_DEL_EDITOR.yaNoSeVe,
        });
      },
      error: () => {
        // El estado no cambia: la fila sigue mostrando la acción que tenía.
        this.actualizar(id, {
          cambiandoEstado: false,
          errorDeEstado: TEXTOS_DEL_EDITOR.errorAlCambiarEstado,
        });
      },
    });
  }

  /** Abre el formulario de alta, siempre con los campos limpios. */
  abrirAlta(): void {
    this.altaAbierta.set(true);
    this.nuevo.set({ titulo: '', categoria: 'Corte' });
    this.fotoNueva.set('');
    this.erroresNuevo.set({});
    this.avisoAgregado.set(null);
    this.errorAlAgregar.set(null);
  }

  /**
   * Cierra y destruye el formulario de alta.
   *
   * Destruirlo no es cosmético: hace que el selector de foto se recree sin la
   * foto anterior, que si quedara a la vista parecería parte del trabajo nuevo.
   */
  cerrarAlta(): void {
    this.altaAbierta.set(false);
    this.nuevo.set({ titulo: '', categoria: 'Corte' });
    this.fotoNueva.set('');
    this.erroresNuevo.set({});
    this.errorAlAgregar.set(null);
  }

  /** Actualiza el título del trabajo nuevo. */
  cambiarNuevoTitulo(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.nuevo.update((actual) => ({ ...actual, titulo: valor }));

    // Al escribir, el error de ese campo deja de aplicar.
    this.erroresNuevo.update((actuales) => {
      const errores = { ...actuales };
      delete errores.titulo;
      return errores;
    });
  }

  /** Actualiza la categoría del trabajo nuevo. */
  cambiarNuevaCategoria(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value as CategoriaDeTrabajo;
    this.nuevo.update((actual) => ({ ...actual, categoria: valor }));
  }

  /** Toma la foto elegida en el alta. */
  cambiarFotoNueva(url: string): void {
    this.fotoNueva.set(url);
    this.erroresNuevo.update((actuales) => {
      const errores = { ...actuales };
      delete errores.foto;
      return errores;
    });
  }

  /** Agrega el trabajo y, si salió bien, recarga la lista. */
  agregar(): void {
    if (this.agregando()) return;

    const titulo = this.nuevo().titulo.trim();
    const foto = this.fotoNueva();

    const errores: ErroresDeAlta = {};
    if (!titulo) errores.titulo = TEXTOS_DEL_EDITOR.errorTitulo;
    // Un trabajo sin foto no se puede mostrar, así que no se crea.
    if (!foto) errores.foto = TEXTOS_DEL_EDITOR.errorFoto;

    this.erroresNuevo.set(errores);
    this.avisoAgregado.set(null);
    this.errorAlAgregar.set(null);

    if (!titulo || !foto) return;

    this.agregando.set(true);

    this.datos
      .crearTrabajoDeGaleria({ titulo, categoria: this.nuevo().categoria, imagenUrl: foto })
      .subscribe({
        next: () => {
          this.agregando.set(false);
          // El formulario se destruye al terminar bien: así el selector de foto
          // se recrea limpio si se abre otra vez.
          this.cerrarAlta();
          this.avisoAgregado.set(TEXTOS_DEL_EDITOR.agregado);
          // Recargar es lo que hace aparecer el trabajo nuevo en la lista.
          this.cargar();
        },
        error: () => {
          this.agregando.set(false);
          // El formulario sigue abierto para reintentar sin volver a escribir
          // todo, y el trabajo no se confirma ni se recarga la lista.
          this.errorAlAgregar.set(TEXTOS_DEL_EDITOR.errorAlAgregar);
        },
      });
  }

  /** Id del campo, para asociar la etiqueta y la ayuda. */
  campoDe(id: number, campo: CampoDeTrabajo): string {
    return `trabajo-${id}-${campo}`;
  }

  /** Id de la ayuda de la categoría. */
  ayudaDe(id: number): string {
    return `ayuda-trabajo-${id}-categoria`;
  }

  private aFila(trabajo: TrabajoDeGaleriaAdministrable): FilaDeTrabajo {
    const original: DatosDeTrabajoDeGaleria = {
      titulo: trabajo.titulo,
      categoria: trabajo.categoria,
      imagenUrl: trabajo.imagenUrl,
    };

    return {
      id: trabajo.id,
      titulo: trabajo.titulo,
      categoria: trabajo.categoria,
      imagenUrl: trabajo.imagenUrl,
      activo: trabajo.activo,
      original,
      guardando: false,
      seGuardo: false,
      error: null,
      errorTitulo: null,
      cambiandoEstado: false,
      avisoEstado: null,
      errorDeEstado: null,
    };
  }

  /**
   * Cambia una sola fila sin tocar las demás.
   *
   * Se reemplaza el array entero porque es un `signal`: mutar el objeto de
   * adentro no avisaría del cambio y la pantalla quedaría mostrando lo viejo.
   */
  private actualizar(id: number, cambios: Partial<FilaDeTrabajo>): void {
    this.filas.update((actuales) =>
      actuales.map((fila) => (fila.id === id ? { ...fila, ...cambios } : fila)),
    );
  }
}
