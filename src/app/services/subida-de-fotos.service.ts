import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { SUPABASE } from './supabase.client';

/** Carpetas del bucket `fotos` donde puede ir una imagen. */
export type CarpetaDeFotos = 'peluqueros' | 'galeria';

/**
 * La extensión sale del MIME, nunca del nombre del archivo.
 *
 * El nombre lo elige quien sube la foto y puede mentir: un archivo llamado
 * `foto.png` puede ser en realidad un JPEG. El MIME lo asigna el navegador a
 * partir del contenido, así que es la única fuente confiable de la extensión.
 */
const EXTENSION_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const BUCKET = 'fotos';

/**
 * Sube fotos al Storage de Supabase.
 *
 * **No valida tipo ni tamaño.** Esa responsabilidad vive en el selector de foto,
 * que es el único lugar donde el error se puede mostrar al lado del campo. Si
 * este servicio rechazara archivos por su cuenta, el selector no tendría dónde
 * contar por qué no subió nada.
 *
 * Si la subida falla, el Observable **falla**: no se devuelve una URL vacía,
 * porque eso haría que el panel mostrara una foto rota como si hubiera salido
 * bien.
 */
@Injectable({ providedIn: 'root' })
export class SubidaDeFotosService {
  private readonly supabase = inject(SUPABASE);

  subirFoto(archivo: File, carpeta: CarpetaDeFotos): Observable<string> {
    return from(this.subir(archivo, carpeta));
  }

  private async subir(archivo: File, carpeta: CarpetaDeFotos): Promise<string> {
    // Para un tipo que no es de los tres conocidos no hay validación acá, pero
    // tampoco una extensión fiable: se usa una genérica en vez de inventar una.
    const extension = EXTENSION_POR_TIPO[archivo.type] ?? 'bin';
    const ruta = `${carpeta}/${crypto.randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage.from(BUCKET).upload(ruta, archivo, {
      contentType: archivo.type,
      upsert: false,
    });

    if (error) {
      throw new Error(`No se pudo subir la foto: ${error.message}`);
    }

    // `getPublicUrl` es síncrono y no pega a la red: arma la URL con la ruta.
    return this.supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
  }
}
