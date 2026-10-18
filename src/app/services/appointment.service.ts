import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Servicio, Peluquero, Turno } from '../models/appointment.model';
import { TrabajoGaleria } from '../models/salon.model';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService {
  private http = inject(HttpClient);
  private apiUrl = 'https://api.tupeluqueria.com/api'; 

  private mockServicios: Servicio[] = [
    { id: 1, nombre: 'Corte Clásico', descripcion: 'Corte de cabello tradicional con tijera y máquina.', duracionMinutos: 30, precio: 15.00 },
    { id: 2, nombre: 'Corte y Barba', descripcion: 'Corte completo de cabello y perfilado de barba con toalla caliente.', duracionMinutos: 45, precio: 22.00 },
    { id: 3, nombre: 'Tintura / Color', descripcion: 'Aplicación de tintes profesionales y tratamientos de color.', duracionMinutos: 90, precio: 40.00 }
  ];

  // ---------------------------------------------------------------------------
  // ATENCIÓN: datos PLACEHOLDER.
  // Los textos de `experiencia` y `titulo` son inventados para poblar la UI.
  // NO son credenciales reales. Reemplazar por la información verdadera de cada
  // profesional antes de publicar el sitio.
  // ---------------------------------------------------------------------------
  private mockPeluqueros: Peluquero[] = [
    {
      id: 1,
      nombre: 'Carlos "El Maestro" Gómez',
      rol: 'Especialista en cortes clásicos y navaja',
      experiencia: 'Corta y afeita desde 2018. Se formó en barbería tradicional y trabaja con navaja, toalla caliente y tijera. Es el referente del local para cortes clásicos y afeitados de precisión.',
      titulo: 'Curso de Barbería Clásica — Escuela de Oficios (2018)',
      fotoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 2,
      nombre: 'Sofía Martínez',
      rol: 'Experta en colorimetría y peinados',
      experiencia: 'Arrancó en 2020 en salones de estilismo. Domina tinturas, decoloraciones y tratamientos de color, y se encarga de los peinados de gala para eventos.',
      titulo: 'Tecnicatura en Peluquería y Colorimetría (2021)',
      fotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop'
    },
    {
      id: 3,
      nombre: 'Lucas Pérez',
      rol: 'Especialista en Fade y estilos urbanos',
      experiencia: 'Trabaja desde 2022 con foco en degradados y cortes de tendencia. Se mantiene al día con las técnicas que se ven en redes y las adapta a cada tipo de cabello.',
      titulo: 'Taller de Fade y Máquina — Certificación (2023)',
      fotoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop'
    }
  ];

  private mockGaleria: TrabajoGaleria[] = [
    { id: 1, titulo: 'Fade Moderno', categoria: 'Corte', imagenUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=600&auto=format&fit=crop' },
    { id: 2, titulo: 'Barba Estilizada', categoria: 'Barba', imagenUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=600&auto=format&fit=crop' },
    { id: 3, titulo: 'Peinado de Gala', categoria: 'Peinado', imagenUrl: 'https://images.unsplash.com/photo-1560869713-7d0a29430803?q=80&w=600&auto=format&fit=crop' }
  ];

  getServicios(): Observable<Servicio[]> { return of(this.mockServicios).pipe(delay(300)); }
  getPeluqueros(): Observable<Peluquero[]> { return of(this.mockPeluqueros).pipe(delay(300)); }
  getGaleria(): Observable<TrabajoGaleria[]> { return of(this.mockGaleria).pipe(delay(300)); }
  agendarTurno(turno: Turno): Observable<{ success: boolean; message: string }> {
    console.log('Turno a guardar en SQL:', turno);
    return of({ success: true, message: '¡Turno registrado con éxito!' }).pipe(delay(500));
  }
}
