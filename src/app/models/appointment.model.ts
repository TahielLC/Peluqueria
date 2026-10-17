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

export interface Peluquero {
  id: number;
  nombre: string;
  rol: string;
  experiencia: string;
  fotoUrl: string;
}

export interface Turno {
  id?: number;
  clienteId: number;
  servicioId: number;
  peluqueroId: number;
  fechaHora: string;
  estado: 'PENDIENTE' | 'CONFIRMADO' | 'CANCELADO';
}
