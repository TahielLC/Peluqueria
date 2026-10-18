import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

/**
 * Cuánto se espera una respuesta de Supabase antes de darla por perdida.
 *
 * Una conexión que acepta el pedido y nunca contesta es peor que una que falla:
 * la promesa queda pendiente para siempre, la pantalla se queda en "Cargando…"
 * y el botón de reintentar no aparece nunca, porque nunca hubo error que
 * mostrar. Lo marcó la revisión nativa (R4-2).
 */
export const ESPERA_MAXIMA_MS = 10_000;

/**
 * Envuelve `fetch` para que ninguna llamada quede colgada.
 *
 * Se **compone** con la señal que ya traiga la llamada en vez de reemplazarla:
 * así el abort de quien llama (o el que use Supabase por dentro) sigue
 * funcionando. Reemplazarla es más corto y se lleva esa capacidad en silencio.
 */
export function fetchConEsperaMaxima(
  fetchBase: typeof fetch = fetch,
  esperaMs: number = ESPERA_MAXIMA_MS,
): typeof fetch {
  return (entrada, opciones = {}) => {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), esperaMs);

    opciones.signal?.addEventListener('abort', () => controlador.abort(), { once: true });

    return fetchBase(entrada, { ...opciones, signal: controlador.signal }).finally(() =>
      clearTimeout(temporizador),
    );
  };
}

/**
 * El cliente de Supabase, disponible para inyectar en cualquier servicio.
 *
 * POR QUÉ UN `InjectionToken` Y NO UNA CONSTANTE EXPORTADA
 * Porque así los tests pueden reemplazarlo. Un servicio que recibe el cliente
 * por inyección se puede probar con un doble (`providers: [{ provide: SUPABASE,
 * useValue: falso }]`) sin tocar la red ni necesitar claves reales. Una
 * constante importada no se puede sustituir: el test quedaría atado al proyecto
 * real de Supabase.
 *
 * POR QUÉ EL `throw` ESTÁ ADENTRO DE UNA FUNCIÓN
 * `providedIn: 'root'` con `factory` es perezoso: la función corre la PRIMERA
 * vez que alguien pide el cliente, no al arrancar la app. Si validara al
 * importar el archivo, el sitio no compilaría ni levantaría hasta que existan
 * las claves. Así, el error aparece recién cuando algo realmente necesita la
 * conexión, y con un mensaje que dice qué hacer.
 */
export const SUPABASE = new InjectionToken<SupabaseClient>('SUPABASE', {
  providedIn: 'root',
  factory: () => {
    if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
      throw new Error(
        'Faltan las claves de Supabase. Abrí src/app/environments/environment.ts ' +
          'y pegá supabaseUrl y supabaseAnonKey (Supabase → Settings → API).',
      );
    }
    // Con espera máxima incluida: sin ella, una conexión que se cuelga deja la
    // pantalla en "Cargando…" para siempre, que es el único estado sin salida.
    return createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      global: { fetch: fetchConEsperaMaxima() },
    });
  },
});
