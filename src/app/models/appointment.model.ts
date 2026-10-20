export interface Cliente {
  id?: number;
  nombre: string;
  telefono: string;
  email: string;
}

export interface Servicio {
  id: number;
  nombre: string;
  descripcion: string;
  duracionMinutos: number;
  precio: number;
}

/**
 * Un servicio tal como lo necesita el panel: además de lo que se edita, si está
 * publicado. El sitio público no usa este tipo porque sólo ve los activos.
 */
export interface ServicioAdministrable extends Servicio {
  activo: boolean;
}

/** Lo que la administradora edita. El orden y la baja no se editan desde acá. */
export interface DatosDeServicio {
  nombre: string;
  descripcion: string;
  duracionMinutos: number;
  precio: number;
}

export interface Peluquero {
  id: number;
  nombre: string;
  rol: string;
  /** Descripción de la trayectoria. Texto libre. */
  experiencia: string;
  /** Título o capacitación. Opcional: si no está, la línea no se muestra. */
  titulo?: string;
  fotoUrl: string;
}

/**
 * Un perfil tal como lo necesita el panel: además de lo que se edita, si está
 * publicado. El sitio público no usa este tipo porque sólo ve los activos.
 */
export interface PeluqueroAdministrable extends Peluquero {
  activo: boolean;
}

/** Lo que la administradora edita de un perfil. El orden no se edita desde acá. */
export interface DatosDePeluquero {
  nombre: string;
  rol: string;
  experiencia: string;
  /** Vacío = sin título; el sitio no muestra esa línea. */
  titulo: string;
  /** Vacía = sin foto. */
  fotoUrl: string;
}
