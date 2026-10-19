import { Injectable, inject } from '@angular/core';
import { Observable, from, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  DatosDePeluquero,
  DatosDeServicio,
  Peluquero,
  Servicio,
  ServicioAdministrable,
  Turno,
} from '../models/appointment.model';
import {
  ClaveDeTexto,
  DatosDeTrabajoDeGaleria,
  TextoDeSitio,
  TrabajoDeGaleriaAdministrable,
  TrabajoGaleria,
} from '../models/salon.model';
import { SUPABASE } from './supabase.client';

/**
 * Fila cruda de `public.servicios`, con los nombres de columna tal como están
 * en Postgres. Se declaran aparte del modelo de la app a propósito: la base usa
 * snake_case y la app camelCase, y la traducción entre los dos es justamente lo
 * que hace este servicio.
 */
interface FilaServicio {
  id: number;
  nombre: string;
  descripcion: string;
  duracion_minutos: number;
  precio: number;
}

/** Igual que `FilaServicio`, más el estado que sólo necesita el panel. */
interface FilaServicioAdministrable extends FilaServicio {
  activo: boolean;
}

interface FilaPeluquero {
  id: number;
  nombre: string;
  rol: string;
  experiencia: string;
  titulo: string | null;
  foto_url: string | null;
}

interface FilaGaleria {
  id: number;
  titulo: string;
  categoria: string;
  imagen_url: string | null;
}

/** Igual que `FilaGaleria`, más el estado que sólo necesita el panel. */
interface FilaGaleriaAdministrable extends FilaGaleria {
  activo: boolean;
}

function aServicio(fila: FilaServicio): Servicio {
  return {
    id: fila.id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    duracionMinutos: fila.duracion_minutos,
    // `precio` es `numeric` en Postgres. Se pasa por Number() porque si llegara
    // como texto, el formateador de la UI (`Number.isInteger`) daría false y
    // después llamaría a `.toFixed()`, que sobre un string explota.
    precio: Number(fila.precio),
  };
}

function aServicioAdministrable(fila: FilaServicioAdministrable): ServicioAdministrable {
  return {
    ...aServicio(fila),
    // La columna es `not null default true` en la base, así que acá siempre
    // llega un booleano; el `=== true` no adivina un estado.
    activo: fila.activo === true,
  };
}

/**
 * Lo que se dice cuando una escritura no afectó la fila esperada.
 *
 * No adivina la causa: puede ser la conexión, pero también que la cuenta haya
 * dejado de ser la administradora. Mandar a revisar el wifi cuando el problema
 * es otro le hace perder tiempo a quien no puede resolverlo.
 */
const NO_ACEPTO_EL_CAMBIO =
  'la base no aceptó el cambio. Probá de nuevo; si sigue igual, avisá a quien te dio el acceso al panel.';

function aPeluquero(fila: FilaPeluquero): Peluquero {
  return {
    id: fila.id,
    nombre: fila.nombre,
    rol: fila.rol,
    experiencia: fila.experiencia,
    // `titulo` es opcional en el modelo: en la base puede ser NULL y la UI
    // decide no mostrar esa línea cuando el campo no está.
    titulo: fila.titulo ?? undefined,
    fotoUrl: fila.foto_url ?? '',
  };
}

function aTrabajoGaleria(fila: FilaGaleria): TrabajoGaleria {
  return {
    id: fila.id,
    titulo: fila.titulo,
    // La columna es texto libre en la base; el modelo la restringe a un conjunto
    // cerrado. El panel de administración sólo ofrece esas opciones, así que el
    // valor siempre viene de ahí.
    categoria: fila.categoria as TrabajoGaleria['categoria'],
    imagenUrl: fila.imagen_url ?? '',
  };
}

interface FilaTexto {
  clave: string;
  valor: string;
  etiqueta: string;
  ayuda: string | null;
}

function aTrabajoDeGaleriaAdministrable(
  fila: FilaGaleriaAdministrable,
): TrabajoDeGaleriaAdministrable {
  return {
    ...aTrabajoGaleria(fila),
    // La columna es `not null default true` en la base, así que acá siempre
    // llega un booleano; el `=== true` no adivina un estado.
    activo: fila.activo === true,
  };
}

function aTexto(fila: FilaTexto): TextoDeSitio {
  return {
    // La columna es texto libre en la base; el modelo la restringe al conjunto
    // cerrado de claves. Las filas las carga el mismo schema que define el
    // modelo, así que el valor siempre viene de ahí.
    clave: fila.clave as ClaveDeTexto,
    valor: fila.valor,
    etiqueta: fila.etiqueta,
    ayuda: fila.ayuda,
  };
}

/**
 * Acceso al contenido del sitio, guardado en Supabase.
 *
 * El contrato no cambió: sigue devolviendo `Observable<T[]>` y los componentes
 * lo consumen igual que antes. Lo único que cambió es de dónde salen los datos.
 *
 * Sobre errores: si Supabase falla, el Observable **falla**. No se devuelve una
 * lista vacía, porque una lista vacía es un mensaje distinto ("todavía no hay
 * contenido cargado") y confundirlos haría que un problema de red pareciera un
 * sitio sin cargar.
 */
@Injectable({
  providedIn: 'root',
})
export class AppointmentService {
  private supabase = inject(SUPABASE);

  getServicios(): Observable<Servicio[]> {
    return from(
      this.supabase
        .from('servicios')
        .select('id, nombre, descripcion, duracion_minutos, precio')
        .eq('activo', true)
        .order('orden')
        .order('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudieron leer los servicios: ${error.message}`);
        return ((data ?? []) as FilaServicio[]).map(aServicio);
      }),
    );
  }

  /**
   * Los servicios tal como los necesita el panel: **activos e inactivos**.
   *
   * No lleva `.eq('activo', true)` a propósito. Si el panel sólo viera los
   * activos, una baja por error sería irreversible desde la pantalla, que es
   * justo lo que hay que evitar con alguien que no sabe de apps.
   */
  getTodosLosServicios(): Observable<ServicioAdministrable[]> {
    return from(
      this.supabase
        .from('servicios')
        .select('id, nombre, descripcion, duracion_minutos, precio, activo')
        .order('orden')
        .order('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudieron leer los servicios: ${error.message}`);
        return ((data ?? []) as FilaServicioAdministrable[]).map(aServicioAdministrable);
      }),
    );
  }

  /**
   * Agrega un servicio al final del orden actual.
   *
   * El `orden` se calcula leyendo la tabla entera (son tres filas, no hace falta
   * paginar ni ordenar). El `.select('id')` del insert pide la fila de vuelta:
   * sin eso no habría forma de distinguir "se agregó" de "no se insertó nada".
   */
  crearServicio(datos: DatosDeServicio): Observable<void> {
    return from(this.crearServicioEnLaBase(datos));
  }

  private async crearServicioEnLaBase(datos: DatosDeServicio): Promise<void> {
    const { data: filas, error } = await this.supabase.from('servicios').select('orden');
    if (error) throw new Error(`No se pudo leer el orden de los servicios: ${error.message}`);

    const filasConOrden = (filas ?? []) as Array<{ orden: number | null }>;
    // Con la tabla vacía, el primero entra en 1 (el máximo no existe todavía).
    const orden =
      filasConOrden.reduce((maximo, fila) => Math.max(maximo, Number(fila.orden ?? 0)), 0) + 1;

    const { data: creadas, error: errorDelInsert } = await this.supabase
      .from('servicios')
      .insert({
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        duracion_minutos: datos.duracionMinutos,
        precio: datos.precio,
        orden,
        activo: true,
      })
      .select('id');

    if (errorDelInsert) {
      throw new Error(`No se pudo agregar el servicio: ${errorDelInsert.message}`);
    }

    // Exactamente una fila: cero significa que no se insertó, y más de una no es
    // lo que pidió un insert de un solo servicio.
    if (!creadas || creadas.length !== 1) {
      throw new Error(`No se agregó el servicio: ${NO_ACEPTO_EL_CAMBIO}`);
    }
  }

  /**
   * Cambia los cuatro campos editables de un servicio.
   *
   * El `.select('id')` no es decorativo: una política RLS de UPDATE **no lanza
   * error**, filtra las filas en silencio y vuelve como éxito. Si no se miran
   * las filas devueltas, el panel diría "guardado" sin haber guardado nada.
   */
  actualizarServicio(id: number, datos: DatosDeServicio): Observable<void> {
    return from(
      this.supabase
        .from('servicios')
        .update({
          nombre: datos.nombre,
          descripcion: datos.descripcion,
          duracion_minutos: datos.duracionMinutos,
          precio: datos.precio,
        })
        .eq('id', id)
        .select('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudo guardar el servicio: ${error.message}`);
        if (!data || data.length !== 1) {
          throw new Error(`No se guardó el servicio: ${NO_ACEPTO_EL_CAMBIO}`);
        }
      }),
    );
  }

  /**
   * Da de baja o vuelve a publicar un servicio.
   *
   * Es una baja **lógica**: se cambia `activo`, nunca se borra la fila. Los
   * turnos que la referencien no tienen que romperse, y el sitio público ya
   * filtra los inactivos. Verifica la fila devuelta por el mismo motivo que
   * `actualizarServicio`: un UPDATE bloqueado por RLS no avisa.
   */
  cambiarActivoDeServicio(id: number, activo: boolean): Observable<void> {
    return from(
      this.supabase.from('servicios').update({ activo }).eq('id', id).select('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudo cambiar el estado del servicio: ${error.message}`);
        if (!data || data.length !== 1) {
          throw new Error(`No se cambió el estado del servicio: ${NO_ACEPTO_EL_CAMBIO}`);
        }
      }),
    );
  }

  getPeluqueros(): Observable<Peluquero[]> {
    return from(
      this.supabase
        .from('peluqueros')
        .select('id, nombre, rol, experiencia, titulo, foto_url')
        .eq('activo', true)
        .order('orden')
        .order('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudieron leer los perfiles: ${error.message}`);
        return ((data ?? []) as FilaPeluquero[]).map(aPeluquero);
      }),
    );
  }

  /**
   * Cambia los cinco campos editables de un perfil del staff.
   *
   * `titulo` y `foto_url` son opcionales en la base: se guardan como NULL cuando
   * el campo queda vacío, no como cadena vacía. `aPeluquero` ya traduce NULL a
   * "sin título" y "sin foto", así que el sitio no muestra una línea en blanco.
   *
   * El `.select('id')` no es decorativo: una política RLS de UPDATE **no lanza
   * error**, filtra las filas en silencio y vuelve como éxito. Si no se miran
   * las filas devueltas, el panel diría "guardado" sin haber guardado nada.
   */
  actualizarPeluquero(id: number, datos: DatosDePeluquero): Observable<void> {
    const titulo = datos.titulo.trim();
    const fotoUrl = datos.fotoUrl.trim();

    return from(
      this.supabase
        .from('peluqueros')
        .update({
          nombre: datos.nombre,
          rol: datos.rol,
          experiencia: datos.experiencia,
          titulo: titulo === '' ? null : titulo,
          foto_url: fotoUrl === '' ? null : fotoUrl,
        })
        .eq('id', id)
        .select('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudo guardar el perfil: ${error.message}`);
        if (!data || data.length !== 1) {
          throw new Error(`No se guardó el perfil: ${NO_ACEPTO_EL_CAMBIO}`);
        }
      }),
    );
  }

  getGaleria(): Observable<TrabajoGaleria[]> {
    return from(
      this.supabase
        .from('galeria')
        .select('id, titulo, categoria, imagen_url')
        .eq('activo', true)
        .order('orden')
        .order('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudieron leer los trabajos: ${error.message}`);
        return ((data ?? []) as FilaGaleria[]).map(aTrabajoGaleria);
      }),
    );
  }

  /**
   * Los trabajos tal como los necesita el panel: **activos e inactivos**.
   *
   * No lleva `.eq('activo', true)` a propósito. Si el panel sólo viera los
   * activos, una baja por error sería irreversible desde la pantalla, que es
   * justo lo que hay que evitar con alguien que no sabe de apps.
   */
  getTodaLaGaleria(): Observable<TrabajoDeGaleriaAdministrable[]> {
    return from(
      this.supabase
        .from('galeria')
        .select('id, titulo, categoria, imagen_url, activo')
        .order('orden')
        .order('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudieron leer los trabajos: ${error.message}`);
        return ((data ?? []) as FilaGaleriaAdministrable[]).map(aTrabajoDeGaleriaAdministrable);
      }),
    );
  }

  /**
   * Agrega un trabajo al final del orden actual.
   *
   * El `orden` se calcula leyendo la tabla entera (son tres filas, no hace falta
   * paginar ni ordenar). El `.select('id')` del insert pide la fila de vuelta:
   * sin eso no habría forma de distinguir "se agregó" de "no se insertó nada".
   */
  crearTrabajoDeGaleria(datos: DatosDeTrabajoDeGaleria): Observable<void> {
    return from(this.crearTrabajoDeGaleriaEnLaBase(datos));
  }

  private async crearTrabajoDeGaleriaEnLaBase(
    datos: DatosDeTrabajoDeGaleria,
  ): Promise<void> {
    const { data: filas, error } = await this.supabase.from('galeria').select('orden');
    if (error) throw new Error(`No se pudo leer el orden de los trabajos: ${error.message}`);

    const filasConOrden = (filas ?? []) as Array<{ orden: number | null }>;
    // Con la tabla vacía, el primero entra en 1 (el máximo no existe todavía).
    const orden =
      filasConOrden.reduce((maximo, fila) => Math.max(maximo, Number(fila.orden ?? 0)), 0) + 1;

    const { data: creadas, error: errorDelInsert } = await this.supabase
      .from('galeria')
      .insert({
        titulo: datos.titulo,
        categoria: datos.categoria,
        imagen_url: datos.imagenUrl,
        orden,
        activo: true,
      })
      .select('id');

    if (errorDelInsert) {
      throw new Error(`No se pudo agregar el trabajo: ${errorDelInsert.message}`);
    }

    // Exactamente una fila: cero significa que no se insertó, y más de una no es
    // lo que pidió un insert de un solo trabajo.
    if (!creadas || creadas.length !== 1) {
      throw new Error(`No se agregó el trabajo: ${NO_ACEPTO_EL_CAMBIO}`);
    }
  }

  /**
   * Cambia los tres campos editables de un trabajo de la galería.
   *
   * El `.select('id')` no es decorativo: una política RLS de UPDATE **no lanza
   * error**, filtra las filas en silencio y vuelve como éxito. Si no se miran
   * las filas devueltas, el panel diría "guardado" sin haber guardado nada.
   */
  actualizarTrabajoDeGaleria(
    id: number,
    datos: DatosDeTrabajoDeGaleria,
  ): Observable<void> {
    return from(
      this.supabase
        .from('galeria')
        .update({
          titulo: datos.titulo,
          categoria: datos.categoria,
          imagen_url: datos.imagenUrl,
        })
        .eq('id', id)
        .select('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudo guardar el trabajo: ${error.message}`);
        if (!data || data.length !== 1) {
          throw new Error(`No se guardó el trabajo: ${NO_ACEPTO_EL_CAMBIO}`);
        }
      }),
    );
  }

  /**
   * Da de baja o vuelve a publicar un trabajo.
   *
   * Es una baja **lógica**: se cambia `activo`, nunca se borra la fila. El sitio
   * público ya filtra los inactivos. Verifica la fila devuelta por el mismo
   * motivo que `actualizarTrabajoDeGaleria`: un UPDATE bloqueado por RLS no avisa.
   */
  cambiarActivoDeTrabajoDeGaleria(id: number, activo: boolean): Observable<void> {
    return from(
      this.supabase.from('galeria').update({ activo }).eq('id', id).select('id'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudo cambiar el estado del trabajo: ${error.message}`);
        if (!data || data.length !== 1) {
          throw new Error(`No se cambió el estado del trabajo: ${NO_ACEPTO_EL_CAMBIO}`);
        }
      }),
    );
  }

  /**
   * Los textos editables del sitio, en el orden en que los muestra el panel.
   *
   * Devuelve también la etiqueta y la ayuda de cada uno: son lo que hace que la
   * pantalla de edición se lea en castellano en vez de mostrar `hero_titulo`.
   */
  getTextos(): Observable<TextoDeSitio[]> {
    return from(
      this.supabase
        .from('textos_sitio')
        .select('clave, valor, etiqueta, ayuda')
        .order('orden'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudieron leer los textos del sitio: ${error.message}`);
        return ((data ?? []) as FilaTexto[]).map(aTexto);
      }),
    );
  }

  /**
   * Guarda el valor de un texto. La clave no se toca: es la identidad de la fila.
   *
   * El `.select('clave')` del final no es decorativo, y el motivo importa. Una
   * política RLS de UPDATE se comporta distinto que una de INSERT: donde el
   * INSERT falla con error, el UPDATE **no actualiza las filas que no pasan el
   * filtro y no dice nada**. Si esta sesión dejara de ser la administradora, el
   * UPDATE afectaría cero filas y volvería como éxito, y el panel diría
   * "guardado" sin haber guardado nada. Pidiendo la fila de vuelta se distingue
   * "se guardó" de "no se tocó nada", que es la única diferencia que le importa
   * a quien está del otro lado de la pantalla.
   */
  guardarTexto(clave: ClaveDeTexto, valor: string): Observable<void> {
    return from(
      this.supabase
        .from('textos_sitio')
        .update({ valor })
        .eq('clave', clave)
        .select('clave'),
    ).pipe(
      map(({ data, error }) => {
        if (error) throw new Error(`No se pudo guardar el texto: ${error.message}`);
        if (!data || data.length === 0) {
          throw new Error(
            'No se guardó el texto: la base no aceptó el cambio. Probá de nuevo; si sigue igual, avisá a quien te dio el acceso.',
          );
        }
      }),
    );
  }

  /**
   * ESTE MÉTODO TODAVÍA NO GUARDA NADA. Devuelve éxito sin persistir, igual que
   * antes de este cambio. Reservar turnos está fuera del alcance de esta feature
   * (son turnos, no contenido, y necesitan su propia tabla y sus propias
   * políticas). Queda anotado como deuda, no como algo resuelto.
   */
  agendarTurno(turno: Turno): Observable<{ success: boolean; message: string }> {
    return of({ success: true, message: '¡Turno registrado con éxito!' }).pipe(delay(500));
  }
}
