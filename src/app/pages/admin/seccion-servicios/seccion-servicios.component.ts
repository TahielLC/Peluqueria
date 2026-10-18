import { Component, OnInit, inject, signal } from '@angular/core';
import { DatosDeServicio, ServicioAdministrable } from '../../../models/appointment.model';
import { AppointmentService } from '../../../services/appointment.service';
import { CargaDeContenido, MENSAJES } from '../../../components/estados';

/**
 * Lo que el editor dice en pantalla.
 *
 * Vive acá y no en `components/estados.ts` porque es texto de esta pantalla, no
 * de la máquina compartida de cargando / error / vacío. Los tres textos que sí
 * son de todos (`MENSAJES`) se usan tal cual, para que un fallo de lectura se
 * lea igual que en el resto del panel.
 */
const TEXTOS_DEL_EDITOR = {
  vacio: 'Todavía no hay servicios cargados.',
  etiquetaNombre: 'Nombre',
  etiquetaDescripcion: 'Descripción',
  etiquetaDuracion: 'Duración (minutos)',
  etiquetaPrecio: 'Precio',
  ayudaPrecio: 'Podés escribirlo con coma, por ejemplo 12,50.',
  guardar: 'Guardar',
  guardando: 'Guardando…',
  // La confirmación nombra el efecto, no la operación: "se guardó" no le dice
  // nada a quien no sabe de apps; "ya se ve en el sitio" sí.
  guardado: 'Guardado. Ya se ve en el sitio.',
  // No se muestra el error crudo de la base, ni se adivina la causa. Puede ser
  // la conexión, pero también que la cuenta haya dejado de ser la
  // administradora; mandar a revisar el wifi cuando el problema es otro le hace
  // perder tiempo a quien no puede resolverlo.
  errorAlGuardar:
    'No se pudo guardar este servicio. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  darDeBaja: 'Dar de baja',
  volverAPublicar: 'Volver a publicar',
  cambiandoEstado: 'Cambiando…',
  dadoDeBaja: 'Dado de baja',
  yaNoSeVe: 'Dado de baja. Ya no se ve en el sitio.',
  yaSeVe: 'Publicado. Ya se ve en el sitio.',
  errorAlCambiarEstado:
    'No se pudo cambiar si este servicio se ve en el sitio. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  agregarTitulo: 'Agregar servicio',
  agregar: 'Agregar',
  agregando: 'Agregando…',
  agregado: 'Servicio agregado. Ya se ve en el sitio.',
  errorAlAgregar:
    'No se pudo agregar el servicio. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  errorNombre: 'Escribí un nombre para el servicio.',
  errorDuracion: 'Poné la duración en minutos, sin decimales, y que sea mayor que cero.',
  errorPrecio: 'Poné el precio con números, por ejemplo 12,50. No puede ser negativo.',
} as const;

/** Los cuatro campos que se pueden editar de un servicio. */
type CampoDeServicio = 'nombre' | 'descripcion' | 'duracion' | 'precio';

/** Lo que hay escrito en los campos, siempre como texto. */
interface ValoresDeServicio {
  nombre: string;
  descripcion: string;
  duracion: string;
  precio: string;
}

interface ErroresDeServicio {
  nombre?: string;
  duracion?: string;
  precio?: string;
}

/** Una fila del editor: el servicio de la base más lo que hace falta para editarlo. */
interface FilaDeServicio extends ValoresDeServicio {
  id: number;
  activo: boolean;
  /** Lo último que la base confirmó. El botón compara contra esto. */
  original: DatosDeServicio;
  guardando: boolean;
  /** `true` recién después del primer guardado exitoso. */
  seGuardo: boolean;
  error: string | null;
  errores: ErroresDeServicio;
  cambiandoEstado: boolean;
  avisoEstado: string | null;
  errorDeEstado: string | null;
}

const SIN_DATOS: ValoresDeServicio = {
  nombre: '',
  descripcion: '',
  duracion: '',
  precio: '',
};

/**
 * La duración es un entero positivo de minutos.
 *
 * Se valida acá y no con `type="number"` para poder mostrar el error al lado del
 * campo, en castellano, en vez de dejar que el navegador decida qué es válido y
 * avise a su manera.
 */
function parsearDuracion(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;

  const minutos = Number(limpio);
  return minutos > 0 ? minutos : null;
}

/**
 * Acepta coma o punto como separador decimal y redondea a dos decimales.
 *
 * La administradora escribe con coma; `type="number"` la rechaza. Por eso el
 * precio se edita en un campo de texto y se normaliza acá.
 */
function parsearPrecio(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(limpio)) return null;

  const valor = Number(limpio.replace(',', '.'));
  if (!Number.isFinite(valor)) return null;

  return Math.round(valor * 100) / 100;
}

/**
 * Edición de servicios y precios desde el panel.
 *
 * **Una fila por servicio y un botón por fila**, igual que el editor de textos:
 * así la confirmación es de ese servicio y no hay que reportar éxitos y
 * fracasos parciales.
 *
 * **Se ven los activos y los inactivos.** Los inactivos quedan atenuados, con
 * la leyenda "Dado de baja" y la acción "Volver a publicar". Sin eso, una baja
 * por error no tendría vuelta desde la pantalla, que es justo lo que hay que
 * evitar con alguien que no sabe de apps.
 *
 * **La baja es lógica**: se cambia `activo`, nunca se borra la fila. Los turnos
 * que la referencien no tienen que romperse, y el sitio público ya filtra los
 * inactivos.
 *
 * **Sin `@angular/forms`**: no es dependencia del proyecto. Se usan inputs
 * nativos con señales, como el resto del panel.
 */
@Component({
  selector: 'app-seccion-servicios',
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
          @for (fila of filas(); track fila.id) {
            <li
              class="rounded-xl border border-gray-200 bg-white p-4"
              [class.opacity-60]="!fila.activo"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="font-medium text-gray-800">{{ fila.nombre }}</p>

                @if (!fila.activo) {
                  <span class="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                    {{ textos.dadoDeBaja }}
                  </span>
                }
              </div>

              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    [for]="campoDe(fila.id, 'nombre')"
                    class="block text-sm font-medium text-gray-800"
                  >
                    {{ textos.etiquetaNombre }}
                  </label>
                  <input
                    [id]="campoDe(fila.id, 'nombre')"
                    type="text"
                    [value]="fila.nombre"
                    (input)="cambiar(fila.id, 'nombre', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  />
                  @if (fila.errores.nombre; as mensaje) {
                    <p class="mt-1 text-sm text-red-700" role="alert">{{ mensaje }}</p>
                  }
                </div>

                <div>
                  <label
                    [for]="campoDe(fila.id, 'descripcion')"
                    class="block text-sm font-medium text-gray-800"
                  >
                    {{ textos.etiquetaDescripcion }}
                  </label>
                  <input
                    [id]="campoDe(fila.id, 'descripcion')"
                    type="text"
                    [value]="fila.descripcion"
                    (input)="cambiar(fila.id, 'descripcion', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  />
                </div>

                <div>
                  <label
                    [for]="campoDe(fila.id, 'duracion')"
                    class="block text-sm font-medium text-gray-800"
                  >
                    {{ textos.etiquetaDuracion }}
                  </label>
                  <input
                    [id]="campoDe(fila.id, 'duracion')"
                    type="text"
                    inputmode="numeric"
                    [value]="fila.duracion"
                    (input)="cambiar(fila.id, 'duracion', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  />
                  @if (fila.errores.duracion; as mensaje) {
                    <p class="mt-1 text-sm text-red-700" role="alert">{{ mensaje }}</p>
                  }
                </div>

                <div>
                  <label
                    [for]="campoDe(fila.id, 'precio')"
                    class="block text-sm font-medium text-gray-800"
                  >
                    {{ textos.etiquetaPrecio }}
                  </label>
                  <input
                    [id]="campoDe(fila.id, 'precio')"
                    type="text"
                    inputmode="decimal"
                    [value]="fila.precio"
                    [attr.aria-describedby]="ayudaDe(fila.id, 'precio')"
                    (input)="cambiar(fila.id, 'precio', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  />
                  <p [id]="ayudaDe(fila.id, 'precio')" class="mt-1 text-xs text-gray-500">
                    {{ textos.ayudaPrecio }}
                  </p>
                  @if (fila.errores.precio; as mensaje) {
                    <p class="mt-1 text-sm text-red-700" role="alert">{{ mensaje }}</p>
                  }
                </div>
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
                  <p class="text-sm text-green-700" role="status">{{ textos.guardado }}</p>
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

      <section
        aria-label="Agregar un servicio"
        class="mt-8 rounded-xl border border-gray-200 bg-white p-4"
      >
        <h3 class="text-base font-semibold text-gray-800">{{ textos.agregarTitulo }}</h3>
        <p class="mt-1 text-sm text-gray-500">El servicio nuevo queda al final de la lista.</p>

        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label for="nuevo-nombre" class="block text-sm font-medium text-gray-800">
              {{ textos.etiquetaNombre }}
            </label>
            <input
              id="nuevo-nombre"
              type="text"
              [value]="nuevo().nombre"
              (input)="cambiarNuevo('nombre', $event)"
              class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
            />
            @if (erroresNuevo().nombre; as mensaje) {
              <p class="mt-1 text-sm text-red-700" role="alert">{{ mensaje }}</p>
            }
          </div>

          <div>
            <label for="nuevo-descripcion" class="block text-sm font-medium text-gray-800">
              {{ textos.etiquetaDescripcion }}
            </label>
            <input
              id="nuevo-descripcion"
              type="text"
              [value]="nuevo().descripcion"
              (input)="cambiarNuevo('descripcion', $event)"
              class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
            />
          </div>

          <div>
            <label for="nuevo-duracion" class="block text-sm font-medium text-gray-800">
              {{ textos.etiquetaDuracion }}
            </label>
            <input
              id="nuevo-duracion"
              type="text"
              inputmode="numeric"
              [value]="nuevo().duracion"
              (input)="cambiarNuevo('duracion', $event)"
              class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
            />
            @if (erroresNuevo().duracion; as mensaje) {
              <p class="mt-1 text-sm text-red-700" role="alert">{{ mensaje }}</p>
            }
          </div>

          <div>
            <label for="nuevo-precio" class="block text-sm font-medium text-gray-800">
              {{ textos.etiquetaPrecio }}
            </label>
            <input
              id="nuevo-precio"
              type="text"
              inputmode="decimal"
              aria-describedby="ayuda-nuevo-precio"
              [value]="nuevo().precio"
              (input)="cambiarNuevo('precio', $event)"
              class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
            />
            <p id="ayuda-nuevo-precio" class="mt-1 text-xs text-gray-500">
              {{ textos.ayudaPrecio }}
            </p>
            @if (erroresNuevo().precio; as mensaje) {
              <p class="mt-1 text-sm text-red-700" role="alert">{{ mensaje }}</p>
            }
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            [disabled]="agregando()"
            (click)="agregar()"
            class="rounded-full bg-indigo-600 px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {{ agregando() ? textos.agregando : textos.agregar }}
          </button>

          @if (avisoAgregado()) {
            <p class="text-sm text-green-700" role="status">{{ avisoAgregado() }}</p>
          }
          @if (errorAlAgregar()) {
            <p class="text-sm text-red-700" role="alert">{{ errorAlAgregar() }}</p>
          }
        </div>
      </section>
    </div>
  `,
})
export class SeccionServiciosComponent implements OnInit {
  private readonly datos = inject(AppointmentService);

  readonly filas = signal<FilaDeServicio[]>([]);

  readonly mensajes = MENSAJES;
  readonly textos = TEXTOS_DEL_EDITOR;

  /** Lo escrito en el formulario de alta, separado de las filas. */
  readonly nuevo = signal<ValoresDeServicio>(SIN_DATOS);
  readonly erroresNuevo = signal<ErroresDeServicio>({});
  readonly agregando = signal(false);
  readonly avisoAgregado = signal<string | null>(null);
  readonly errorAlAgregar = signal<string | null>(null);

  /**
   * Las mismas tres reglas de cargando / error / vacío que el resto del panel,
   * tomadas de `components/estados.ts` y no reimplementadas acá.
   */
  private readonly carga = new CargaDeContenido<ServicioAdministrable[]>(
    () => this.datos.getTodosLosServicios(),
    (servicios) => this.filas.set(servicios.map((servicio) => this.aFila(servicio))),
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

  /** Actualiza un campo mientras la persona escribe. */
  cambiar(id: number, campo: CampoDeServicio, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;

    this.filas.update((filas) =>
      filas.map((fila) => {
        if (fila.id !== id) return fila;

        const errores = { ...fila.errores };
        if (campo === 'nombre' || campo === 'duracion' || campo === 'precio') {
          delete errores[campo];
        }

        return {
          ...fila,
          ...this.aCampo(campo, valor),
          errores,
          // Cualquier edición invalida la confirmación anterior: lo que se ve
          // en pantalla ya no es lo que está guardado.
          seGuardo: false,
          error: null,
        };
      }),
    );
  }

  /** Dice si hay algo distinto de lo último confirmado por la base. */
  hayCambios(fila: FilaDeServicio): boolean {
    return (
      fila.nombre.trim() !== fila.original.nombre ||
      fila.descripcion !== fila.original.descripcion ||
      parsearDuracion(fila.duracion) !== fila.original.duracionMinutos ||
      parsearPrecio(fila.precio) !== fila.original.precio
    );
  }

  /**
   * Guarda la fila, sólo si cambió y si los datos son válidos.
   *
   * El `guardando` repele un segundo clic aunque el botón esté deshabilitado: el
   * estado de la pantalla no es la única defensa, y un doble envío no tiene que
   * llegar a la base.
   */
  guardar(id: number): void {
    const fila = this.filas().find((candidata) => candidata.id === id);
    if (!fila || fila.guardando || !this.hayCambios(fila)) return;

    const { errores, datos } = this.revisar(fila);
    if (!datos) {
      // No se manda nada: el error queda al lado de cada campo.
      this.actualizar(id, { errores, seGuardo: false, error: null });
      return;
    }

    this.actualizar(id, { guardando: true, seGuardo: false, error: null, errores: {} });

    this.datos.actualizarServicio(id, datos).subscribe({
      next: () => {
        // Se confirma recién cuando la base aceptó. Y se guardan los datos
        // enviados, no lo que haya en los campos ahora: si la persona siguió
        // escribiendo, ese cambio todavía no está guardado.
        this.actualizar(id, {
          guardando: false,
          seGuardo: true,
          error: null,
          errores: {},
          nombre: datos.nombre,
          duracion: String(datos.duracionMinutos),
          precio: this.textoDePrecio(datos.precio),
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

    this.datos.cambiarActivoDeServicio(id, activo).subscribe({
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

  /** Actualiza un campo del formulario de alta. */
  cambiarNuevo(campo: CampoDeServicio, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;

    this.nuevo.update((actual) => ({ ...actual, ...this.aCampo(campo, valor) }));

    // Al escribir, el error de ese campo deja de aplicar.
    if (campo === 'nombre' || campo === 'duracion' || campo === 'precio') {
      this.erroresNuevo.update((actuales) => {
        const errores = { ...actuales };
        delete errores[campo];
        return errores;
      });
    }
  }

  /** Agrega el servicio y, si salió bien, recarga la lista. */
  agregar(): void {
    if (this.agregando()) return;

    const { errores, datos } = this.revisar(this.nuevo());
    this.erroresNuevo.set(errores);
    this.avisoAgregado.set(null);

    if (!datos) return;

    this.agregando.set(true);
    this.errorAlAgregar.set(null);

    this.datos.crearServicio(datos).subscribe({
      next: () => {
        this.agregando.set(false);
        this.nuevo.set(SIN_DATOS);
        this.erroresNuevo.set({});
        this.avisoAgregado.set(TEXTOS_DEL_EDITOR.agregado);
        // Recargar es lo que hace aparecer el servicio nuevo en la lista.
        this.cargar();
      },
      error: () => {
        this.agregando.set(false);
        this.errorAlAgregar.set(TEXTOS_DEL_EDITOR.errorAlAgregar);
      },
    });
  }

  /** Id del campo, para asociar la etiqueta y la ayuda. */
  campoDe(id: number, campo: CampoDeServicio): string {
    return `servicio-${id}-${campo}`;
  }

  /** Id de la ayuda del precio. */
  ayudaDe(id: number, campo: CampoDeServicio): string {
    return `ayuda-servicio-${id}-${campo}`;
  }

  private aFila(servicio: ServicioAdministrable): FilaDeServicio {
    return {
      id: servicio.id,
      activo: servicio.activo,
      nombre: servicio.nombre,
      descripcion: servicio.descripcion,
      duracion: String(servicio.duracionMinutos),
      precio: this.textoDePrecio(servicio.precio),
      original: {
        nombre: servicio.nombre,
        descripcion: servicio.descripcion,
        duracionMinutos: servicio.duracionMinutos,
        precio: servicio.precio,
      },
      guardando: false,
      seGuardo: false,
      error: null,
      errores: {},
      cambiandoEstado: false,
      avisoEstado: null,
      errorDeEstado: null,
    };
  }

  private textoDePrecio(precio: number): string {
    return String(precio);
  }

  /**
   * Valida los tres campos obligatorios y arma los datos para la base.
   *
   * La descripción puede quedar vacía: es texto libre de la administradora.
   */
  private revisar(valores: ValoresDeServicio): {
    errores: ErroresDeServicio;
    datos: DatosDeServicio | null;
  } {
    const nombre = valores.nombre.trim();
    const duracionMinutos = parsearDuracion(valores.duracion);
    const precio = parsearPrecio(valores.precio);

    const errores: ErroresDeServicio = {};
    if (!nombre) errores.nombre = TEXTOS_DEL_EDITOR.errorNombre;
    if (duracionMinutos === null) errores.duracion = TEXTOS_DEL_EDITOR.errorDuracion;
    if (precio === null) errores.precio = TEXTOS_DEL_EDITOR.errorPrecio;

    const datos =
      nombre && duracionMinutos !== null && precio !== null
        ? { nombre, descripcion: valores.descripcion, duracionMinutos, precio }
        : null;

    return { errores, datos };
  }

  /** Traduce el nombre del campo al cambio de la fila, sin indexar por string. */
  private aCampo(campo: CampoDeServicio, valor: string): Partial<FilaDeServicio> {
    const cambios: Partial<FilaDeServicio> = {};
    if (campo === 'nombre') cambios.nombre = valor;
    else if (campo === 'descripcion') cambios.descripcion = valor;
    else if (campo === 'duracion') cambios.duracion = valor;
    else cambios.precio = valor;
    return cambios;
  }

  /**
   * Cambia una sola fila sin tocar las demás.
   *
   * Se reemplaza el array entero porque es un `signal`: mutar el objeto de
   * adentro no avisaría del cambio y la pantalla quedaría mostrando lo viejo.
   */
  private actualizar(id: number, cambios: Partial<FilaDeServicio>): void {
    this.filas.update((actuales) =>
      actuales.map((fila) => (fila.id === id ? { ...fila, ...cambios } : fila)),
    );
  }
}
