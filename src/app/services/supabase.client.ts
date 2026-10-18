import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

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
    return createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  },
});
