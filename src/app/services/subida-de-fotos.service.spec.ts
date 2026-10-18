import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { SubidaDeFotosService } from './subida-de-fotos.service';
import { SUPABASE } from './supabase.client';

/** Cómo se pidió una subida, para poder verificarla después. */
interface Subida {
  bucket: string;
  ruta: string;
  archivo: File;
  opciones: { contentType: string; upsert: boolean };
}

/**
 * Cliente de Supabase falso con Storage.
 *
 * Registra el bucket, la ruta, el archivo y las opciones de cada subida, y
 * devuelve la URL pública con la misma forma que arma Supabase. Existe para que
 * los tests no suban archivos reales ni necesiten credenciales.
 */
function crearSupabaseFalso(errorDeSubida: { message: string } | null = null) {
  const subidas: Subida[] = [];
  const rutasPublicas: string[] = [];

  const cliente = {
    storage: {
      from(bucket: string) {
        return {
          async upload(
            ruta: string,
            archivo: File,
            opciones: { contentType: string; upsert: boolean },
          ) {
            subidas.push({ bucket, ruta, archivo, opciones });

            return errorDeSubida
              ? { data: null, error: errorDeSubida }
              : { data: { path: ruta }, error: null };
          },
          getPublicUrl(ruta: string) {
            rutasPublicas.push(ruta);
            return { data: { publicUrl: `https://fotos.test/${bucket}/${ruta}` } };
          },
        };
      },
    },
  };

  return { cliente: cliente as unknown as SupabaseClient, subidas, rutasPublicas };
}

describe('SubidaDeFotosService', () => {
  function armar(errorDeSubida: { message: string } | null = null) {
    const falso = crearSupabaseFalso(errorDeSubida);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SUPABASE, useValue: falso.cliente }],
    });

    return { service: TestBed.inject(SubidaDeFotosService), ...falso };
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('sube al bucket fotos con el contentType del archivo y sin sobrescribir', async () => {
    const { service, subidas } = armar();
    const archivo = new File(['contenido'], 'foto.jpg', { type: 'image/jpeg' });

    await firstValueFrom(service.subirFoto(archivo, 'peluqueros'));

    expect(subidas).toHaveLength(1);
    expect(subidas[0].bucket).toBe('fotos');
    expect(subidas[0].archivo).toBe(archivo);
    expect(subidas[0].opciones).toEqual({
      contentType: 'image/jpeg',
      upsert: false,
    });
  });

  it('arma la ruta bajo la carpeta pedida con un identificador único y la extensión del MIME', async () => {
    const { service, subidas } = armar();
    const archivo = new File(['contenido'], 'foto.jpg', { type: 'image/jpeg' });

    await firstValueFrom(service.subirFoto(archivo, 'peluqueros'));
    await firstValueFrom(service.subirFoto(archivo, 'peluqueros'));

    expect(subidas[0].ruta).toMatch(/^peluqueros\/[0-9a-f-]{36}\.jpg$/);
    // Dos subidas nunca comparten ruta: si no, la segunda pisaría la primera.
    expect(subidas[0].ruta).not.toBe(subidas[1].ruta);
  });

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('deriva la extensión del MIME %s, no del nombre del archivo', async (tipo, extension) => {
    const { service, subidas } = armar();
    // El nombre miente a propósito: la extensión tiene que salir del tipo real.
    const archivo = new File(['contenido'], 'nombre-que-miente.txt', { type: tipo });

    await firstValueFrom(service.subirFoto(archivo, 'galeria'));

    expect(subidas[0].ruta).toMatch(new RegExp(`^galeria/[0-9a-f-]{36}\\.${extension}$`));
  });

  it('devuelve la URL pública de la ruta subida', async () => {
    const { service, subidas, rutasPublicas } = armar();
    const archivo = new File(['contenido'], 'foto.png', { type: 'image/png' });

    const url = await firstValueFrom(service.subirFoto(archivo, 'peluqueros'));

    expect(url).toBe(`https://fotos.test/fotos/${subidas[0].ruta}`);
    expect(rutasPublicas).toEqual([subidas[0].ruta]);
  });

  it('si la subida falla, el Observable falla y no devuelve una URL', async () => {
    const { service, rutasPublicas } = armar({ message: 'sin permiso' });
    const archivo = new File(['contenido'], 'foto.jpg', { type: 'image/jpeg' });

    await expect(firstValueFrom(service.subirFoto(archivo, 'peluqueros'))).rejects.toThrow(
      /No se pudo subir la foto.*sin permiso/,
    );

    expect(rutasPublicas).toEqual([]);
  });
});
