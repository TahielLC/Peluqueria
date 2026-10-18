import { Injectable, inject } from '@angular/core';
import { Observable, from, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Servicio, Peluquero, Turno } from '../models/appointment.model';
import { ClaveDeTexto, TextoDeSitio, TrabajoGaleria } from '../models/salon.model';
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
