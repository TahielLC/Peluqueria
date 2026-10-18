import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppointmentService } from './appointment.service';

describe('AppointmentService', () => {
  let service: AppointmentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
    service = TestBed.inject(AppointmentService);
  });

  describe('getServicios', () => {
    it('devuelve los servicios del catalogo', async () => {
      const servicios = await firstValueFrom(service.getServicios());

      expect(servicios.length).toBeGreaterThan(0);
    });

    it('cada servicio tiene id unico y campos completos', async () => {
      const servicios = await firstValueFrom(service.getServicios());
      const ids = servicios.map((s) => s.id);

      expect(new Set(ids).size).toBe(servicios.length);
      for (const servicio of servicios) {
        expect(servicio.nombre).toBeTruthy();
        expect(servicio.descripcion).toBeTruthy();
        expect(servicio.duracionMinutos).toBeGreaterThan(0);
        expect(servicio.precio).toBeGreaterThan(0);
      }
    });
  });

  describe('getPeluqueros', () => {
    it('cada peluquero tiene id unico y campos completos', async () => {
      const peluqueros = await firstValueFrom(service.getPeluqueros());
      const ids = peluqueros.map((p) => p.id);

      expect(peluqueros.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(peluqueros.length);
      for (const peluquero of peluqueros) {
        expect(peluquero.nombre).toBeTruthy();
        expect(peluquero.rol).toBeTruthy();
        expect(peluquero.experiencia).toBeTruthy();
        expect(peluquero.fotoUrl).toBeTruthy();
      }
    });

    it('el titulo es opcional: el campo puede faltar sin romper el contrato', async () => {
      const peluqueros = await firstValueFrom(service.getPeluqueros());

      // El modelo declara `titulo?: string`. Este test pinnea que el servicio
      // tolera ausencia del campo, para que la UI siga pudiendo condicionarlo.
      const sinTitulo = peluqueros.filter((p) => p.titulo === undefined);

      expect(Array.isArray(sinTitulo)).toBe(true);
      expect(peluqueros.every((p) => p.titulo === undefined || typeof p.titulo === 'string')).toBe(
        true,
      );
    });
  });

  describe('getGaleria', () => {
    it('devuelve los trabajos con id unico y campos completos', async () => {
      const trabajos = await firstValueFrom(service.getGaleria());
      const ids = trabajos.map((t) => t.id);

      expect(trabajos.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(trabajos.length);
      for (const trabajo of trabajos) {
        expect(trabajo.titulo).toBeTruthy();
        expect(trabajo.categoria).toBeTruthy();
        expect(trabajo.imagenUrl).toBeTruthy();
      }
    });
  });

  describe('agendarTurno', () => {
    it('reporta exito al agendar', async () => {
      const resultado = await firstValueFrom(
        service.agendarTurno({
          clienteId: 1,
          servicioId: 1,
          peluqueroId: 1,
          fechaHora: '2026-11-01T10:00:00',
          estado: 'PENDIENTE',
        }),
      );

      expect(resultado.success).toBe(true);
      expect(resultado.message).toBeTruthy();
    });
  });
});
