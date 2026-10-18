import { Injectable, inject } from '@angular/core';
import { Observable, from, map, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Servicio, Peluquero, Turno } from '../models/appointment.model';
import { TrabajoGaleria } from '../models/salon.model';
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
   * ESTE MÉTODO TODAVÍA NO GUARDA NADA. Devuelve éxito sin persistir, igual que
   * antes de este cambio. Reservar turnos está fuera del alcance de esta feature
   * (son turnos, no contenido, y necesitan su propia tabla y sus propias
   * políticas). Queda anotado como deuda, no como algo resuelto.
   */
  agendarTurno(turno: Turno): Observable<{ success: boolean; message: string }> {
    return of({ success: true, message: '¡Turno registrado con éxito!' }).pipe(delay(500));
  }
}
