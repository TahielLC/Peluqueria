import { Component, OnInit, inject, signal } from '@angular/core';
import {
  DatosDePeluquero,
  PeluqueroAdministrable,
} from '../../../models/appointment.model';
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
  vacio: 'Todavía no hay perfiles cargados.',
  etiquetaNombre: 'Nombre',
  etiquetaRol: 'Rol',
  etiquetaExperiencia: 'Trayectoria',
  etiquetaTitulo: 'Título',
  ayudaTitulo: 'Si lo dejás vacío, no se muestra en el sitio.',
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
    'No se pudo guardar este perfil. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  darDeBaja: 'Dar de baja',
  volverAPublicar: 'Volver a publicar',
  cambiandoEstado: 'Cambiando…',
  dadoDeBaja: 'Dado de baja',
  yaNoSeVe: 'Dado de baja. Ya no se ve en el sitio.',
  yaSeVe: 'Publicado. Ya se ve en el sitio.',
  errorAlCambiarEstado:
    'No se pudo cambiar si este perfil se ve en el sitio. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  agregarTitulo: 'Agregar una persona',
  agregar: 'Agregar',
  agregando: 'Agregando…',
  agregado: 'Persona agregada. Ya se ve en el sitio.',
  errorAlAgregar:
    'No se pudo agregar la persona. Probá de nuevo; si el problema sigue, avisá a quien te dio el acceso al panel.',
  cancelar: 'Cancelar',
  errorNombre: 'Escribí un nombre para la persona.',
  errorFoto: 'Subí una foto para la persona.',
} as const;

/** Los cuatro campos de texto que se pueden editar de un perfil. */
type CampoDeTexto = 'nombre' | 'rol' | 'experiencia' | 'titulo';

/** Una fila del editor: el perfil de la base más lo que hace falta para editarlo. */
interface FilaDePerfil {
  id: number;
  nombre: string;
  rol: string;
  experiencia: string;
  titulo: string;
  fotoUrl: string;
  activo: boolean;
  /** Lo último que la base confirmó. El botón compara contra esto. */
  original: DatosDePeluquero;
  guardando: boolean;
  /** `true` recién después del primer guardado exitoso. */
  seGuardo: boolean;
  error: string | null;
  cambiandoEstado: boolean;
  avisoEstado: string | null;
  errorDeEstado: string | null;
}

/** Lo que hay escrito en el formulario de alta. */
interface ValoresDePerfil {
  nombre: string;
  rol: string;
  experiencia: string;
  titulo: string;
}

interface ErroresDeAlta {
  nombre?: string;
  foto?: string;
}

/**
 * Edición de los perfiles del staff desde el panel.
 *
 * **Una fila por perfil y un botón por fila**, igual que los editores de textos,
 * servicios y galería: así la confirmación es de ese perfil y no hay que reportar
 * éxitos y fracasos parciales.
 *
 * **El título es opcional.** La ayuda lo dice y el servicio lo guarda como NULL
 * cuando el campo queda vacío, que es lo que hace que el sitio no muestre la
 * línea.
 *
 * **Se ven los activos y los inactivos.** Los inactivos quedan atenuados, con la
 * leyenda "Dado de baja" y la acción "Volver a publicar". Sin eso, una baja por
 * error no tendría vuelta desde la pantalla, que es justo lo que hay que evitar
 * con alguien que no sabe de apps.
 *
 * **La baja es lógica**: se cambia `activo`, nunca se borra la fila. El sitio
 * público ya filtra los inactivos.
 *
 * **La foto se reemplaza subiendo un archivo**, nunca pegando una URL. El alta
 * exige foto: la tarjeta del equipo muestra una imagen y sin foto quedaría rota.
 * Por eso el formulario se destruye al cerrarse y al terminar bien, para que el
 * selector se recree limpio y no quede mostrando la foto anterior como si fuera
 * nueva.
 *
 * **Sin `@angular/forms`**: no es dependencia del proyecto. Se usan inputs,
 * textareas nativos y señales, como el resto del panel.
 */
@Component({
  selector: 'app-seccion-staff',
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
                </div>

                <div>
                  <label
                    [for]="campoDe(fila.id, 'rol')"
                    class="block text-sm font-medium text-gray-800"
                  >
                    {{ textos.etiquetaRol }}
                  </label>
                  <input
                    [id]="campoDe(fila.id, 'rol')"
                    type="text"
                    [value]="fila.rol"
                    (input)="cambiar(fila.id, 'rol', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  />
                </div>

                <div class="sm:col-span-2">
                  <label
                    [for]="campoDe(fila.id, 'experiencia')"
                    class="block text-sm font-medium text-gray-800"
                  >
                    {{ textos.etiquetaExperiencia }}
                  </label>
                  <textarea
                    [id]="campoDe(fila.id, 'experiencia')"
                    rows="3"
                    [value]="fila.experiencia"
                    (input)="cambiar(fila.id, 'experiencia', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  ></textarea>
                </div>

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
                    [attr.aria-describedby]="ayudaDe(fila.id)"
                    (input)="cambiar(fila.id, 'titulo', $event)"
                    class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                  />
                  <p [id]="ayudaDe(fila.id)" class="mt-1 text-xs text-gray-500">
                    {{ textos.ayudaTitulo }}
                  </p>
                </div>

                <app-selector-de-foto
                  [fotoUrl]="fila.fotoUrl"
                  [carpeta]="'peluqueros'"
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
            aria-label="Agregar una persona"
            class="rounded-xl border border-gray-200 bg-white p-4"
          >
            <h3 class="text-base font-semibold text-gray-800">{{ textos.agregarTitulo }}</h3>
            <p class="mt-1 text-sm text-gray-500">La persona nueva queda al final de la lista.</p>

            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label for="nueva-persona-nombre" class="block text-sm font-medium text-gray-800">
                  {{ textos.etiquetaNombre }}
                </label>
                <input
                  id="nueva-persona-nombre"
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
                <label for="nueva-persona-rol" class="block text-sm font-medium text-gray-800">
                  {{ textos.etiquetaRol }}
                </label>
                <input
                  id="nueva-persona-rol"
                  type="text"
                  [value]="nuevo().rol"
                  (input)="cambiarNuevo('rol', $event)"
                  class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                />
              </div>

              <div class="sm:col-span-2">
                <label
                  for="nueva-persona-experiencia"
                  class="block text-sm font-medium text-gray-800"
                >
                  {{ textos.etiquetaExperiencia }}
                </label>
                <textarea
                  id="nueva-persona-experiencia"
                  rows="3"
                  [value]="nuevo().experiencia"
                  (input)="cambiarNuevo('experiencia', $event)"
                  class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                ></textarea>
              </div>

              <div>
                <label for="nueva-persona-titulo" class="block text-sm font-medium text-gray-800">
                  {{ textos.etiquetaTitulo }}
                </label>
                <input
                  id="nueva-persona-titulo"
                  type="text"
                  [value]="nuevo().titulo"
                  [attr.aria-describedby]="'ayuda-nueva-persona-titulo'"
                  (input)="cambiarNuevo('titulo', $event)"
                  class="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-800"
                />
                <p id="ayuda-nueva-persona-titulo" class="mt-1 text-xs text-gray-500">
                  {{ textos.ayudaTitulo }}
                </p>
              </div>

              <app-selector-de-foto
                [fotoUrl]="fotoNueva()"
                [carpeta]="'peluqueros'"
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
export class SeccionStaffComponent implements OnInit {
  private readonly datos = inject(AppointmentService);

  readonly filas = signal<FilaDePerfil[]>([]);

  readonly mensajes = MENSAJES;
  readonly textos = TEXTOS_DEL_EDITOR;

  /** Lo escrito en el formulario de alta, separado de las filas. */
  readonly altaAbierta = signal(false);
  readonly nuevo = signal<ValoresDePerfil>({
    nombre: '',
    rol: '',
    experiencia: '',
    titulo: '',
  });
  readonly fotoNueva = signal('');
  readonly erroresNuevo = signal<ErroresDeAlta>({});
  readonly agregando = signal(false);
  readonly avisoAgregado = signal<string | null>(null);
  readonly errorAlAgregar = signal<string | null>(null);

  /**
   * Las mismas tres reglas de cargando / error / vacío que el resto del panel,
   * tomadas de `components/estados.ts` y no reimplementadas acá.
   */
  private readonly carga = new CargaDeContenido<PeluqueroAdministrable[]>(
    () => this.datos.getTodosLosPeluqueros(),
    (peluqueros) => this.filas.set(peluqueros.map((peluquero) => this.aFila(peluquero))),
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

  /** Actualiza un campo de texto mientras la persona escribe. */
  cambiar(id: number, campo: CampoDeTexto, evento: Event): void {
    const valor = (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
    const cambios: Partial<FilaDePerfil> = { seGuardo: false, error: null };

    if (campo === 'nombre') cambios.nombre = valor;
    else if (campo === 'rol') cambios.rol = valor;
    else if (campo === 'experiencia') cambios.experiencia = valor;
    else cambios.titulo = valor;

    this.actualizar(id, cambios);
  }

  /**
   * Toma la URL que emite el selector de foto.
   *
   * Cuenta como cambio pendiente a propósito: la foto nueva todavía no está en
   * el sitio hasta que se guarde la fila.
   */
  cambiarFoto(id: number, url: string): void {
    this.actualizar(id, { fotoUrl: url, seGuardo: false, error: null });
  }

  /** Dice si hay algo distinto de lo último confirmado por la base. */
  hayCambios(fila: FilaDePerfil): boolean {
    return (
      fila.nombre.trim() !== fila.original.nombre ||
      fila.rol.trim() !== fila.original.rol ||
      fila.experiencia !== fila.original.experiencia ||
      fila.titulo.trim() !== fila.original.titulo ||
      fila.fotoUrl !== fila.original.fotoUrl
    );
  }

  /**
   * Guarda la fila, sólo si cambió.
   *
   * El `guardando` repele un segundo clic aunque el botón esté deshabilitado: el
   * estado de la pantalla no es la única defensa, y un doble envío no tiene que
   * llegar a la base.
   */
  guardar(id: number): void {
    const fila = this.filas().find((candidata) => candidata.id === id);
    if (!fila || fila.guardando || !this.hayCambios(fila)) return;

    const datos = this.datosDe(fila);

    this.actualizar(id, { guardando: true, seGuardo: false, error: null });

    this.datos.actualizarPeluquero(id, datos).subscribe({
      next: () => {
        // Se confirma recién cuando la base aceptó. Y se guardan los datos
        // enviados, no lo que haya en los campos ahora: si la persona siguió
        // escribiendo, ese cambio todavía no está guardado.
        this.actualizar(id, {
          guardando: false,
          seGuardo: true,
          error: null,
          nombre: datos.nombre,
          rol: datos.rol,
          experiencia: datos.experiencia,
          titulo: datos.titulo,
          fotoUrl: datos.fotoUrl,
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

    this.datos.cambiarActivoDePeluquero(id, activo).subscribe({
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
    this.nuevo.set({ nombre: '', rol: '', experiencia: '', titulo: '' });
    this.fotoNueva.set('');
    this.erroresNuevo.set({});
    this.avisoAgregado.set(null);
    this.errorAlAgregar.set(null);
  }

  /**
   * Cierra y destruye el formulario de alta.
   *
   * Destruirlo no es cosmético: hace que el selector de foto se recree sin la
   * foto anterior, que si quedara a la vista parecería parte del perfil nuevo.
   */
  cerrarAlta(): void {
    this.altaAbierta.set(false);
    this.nuevo.set({ nombre: '', rol: '', experiencia: '', titulo: '' });
    this.fotoNueva.set('');
    this.erroresNuevo.set({});
    this.errorAlAgregar.set(null);
  }

  /** Actualiza un campo del perfil nuevo. */
  cambiarNuevo(campo: keyof ValoresDePerfil, evento: Event): void {
    const valor = (evento.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.nuevo.update((actual) => ({ ...actual, [campo]: valor }));

    // Al escribir, el error de ese campo deja de aplicar.
    if (campo === 'nombre') {
      this.erroresNuevo.update((actuales) => {
        const errores = { ...actuales };
        delete errores.nombre;
        return errores;
      });
    }
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

  /**
   * Agrega el perfil y, si salió bien, recarga la lista.
   *
   * Nombre y foto son obligatorios: sin foto la tarjeta del equipo quedaría
   * rota, y sin nombre no hay a quién identificar. Rol, trayectoria y título
   * pueden ir vacíos.
   */
  agregar(): void {
    if (this.agregando()) return;

    const nombre = this.nuevo().nombre.trim();
    const foto = this.fotoNueva();

    const errores: ErroresDeAlta = {};
    if (!nombre) errores.nombre = TEXTOS_DEL_EDITOR.errorNombre;
    if (!foto) errores.foto = TEXTOS_DEL_EDITOR.errorFoto;

    this.erroresNuevo.set(errores);
    this.avisoAgregado.set(null);
    this.errorAlAgregar.set(null);

    if (!nombre || !foto) return;

    const valores = this.nuevo();
    this.agregando.set(true);

    this.datos
      .crearPeluquero({
        nombre,
        rol: valores.rol.trim(),
        experiencia: valores.experiencia,
        titulo: valores.titulo.trim(),
        fotoUrl: foto,
      })
      .subscribe({
        next: () => {
          this.agregando.set(false);
          // El formulario se destruye al terminar bien: así el selector de foto
          // se recrea limpio si se abre otra vez.
          this.cerrarAlta();
          this.avisoAgregado.set(TEXTOS_DEL_EDITOR.agregado);
          // Recargar es lo que hace aparecer la persona nueva en la lista.
          this.cargar();
        },
        error: () => {
          this.agregando.set(false);
          // El formulario sigue abierto para reintentar sin volver a escribir
          // todo, y el perfil no se confirma ni se recarga la lista.
          this.errorAlAgregar.set(TEXTOS_DEL_EDITOR.errorAlAgregar);
        },
      });
  }

  /** Id del campo, para asociar la etiqueta y la ayuda. */
  campoDe(id: number, campo: CampoDeTexto): string {
    return `perfil-${id}-${campo}`;
  }

  /** Id de la ayuda del título. */
  ayudaDe(id: number): string {
    return `ayuda-perfil-${id}-titulo`;
  }

  private aFila(peluquero: PeluqueroAdministrable): FilaDePerfil {
    const titulo = peluquero.titulo ?? '';
    const fotoUrl = peluquero.fotoUrl ?? '';

    return {
      id: peluquero.id,
      nombre: peluquero.nombre,
      rol: peluquero.rol,
      experiencia: peluquero.experiencia,
      titulo,
      fotoUrl,
      activo: peluquero.activo,
      original: {
        nombre: peluquero.nombre,
        rol: peluquero.rol,
        experiencia: peluquero.experiencia,
        titulo,
        fotoUrl,
      },
      guardando: false,
      seGuardo: false,
      error: null,
      cambiandoEstado: false,
      avisoEstado: null,
      errorDeEstado: null,
    };
  }

  /**
   * Arma lo que se manda a la base.
   *
   * Nombre y rol se recortan porque los espacios de los costados no son parte
   * del nombre de nadie. El título también, para que un espacio suelto cuente
   * como vacío y el servicio lo guarde como NULL.
   */
  private datosDe(fila: FilaDePerfil): DatosDePeluquero {
    return {
      nombre: fila.nombre.trim(),
      rol: fila.rol.trim(),
      experiencia: fila.experiencia,
      titulo: fila.titulo.trim(),
      fotoUrl: fila.fotoUrl,
    };
  }

  /**
   * Cambia una sola fila sin tocar las demás.
   *
   * Se reemplaza el array entero porque es un `signal`: mutar el objeto de
   * adentro no avisaría del cambio y la pantalla quedaría mostrando lo viejo.
   */
  private actualizar(id: number, cambios: Partial<FilaDePerfil>): void {
    this.filas.update((actuales) =>
      actuales.map((fila) => (fila.id === id ? { ...fila, ...cambios } : fila)),
    );
  }
}
