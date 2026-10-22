import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';

/*
 * El sitio siempre se entra por la portada.
 *
 * POR QUÉ
 * El nombre del salón se enciende una sola vez, al cargar, y ese encendido es
 * la primera impresión del sitio. Dos cosas lo arruinaban:
 *
 *   1. El navegador restaura la posición de scroll al recargar o al volver
 *      atrás. Quien había bajado hasta los precios volvía a entrar ahí mismo.
 *   2. Los enlaces internos dejaban el ancla en la URL (`#servicios`), así que
 *      reabrir el sitio saltaba derecho a esa sección.
 *
 * `scrollRestoration = 'manual'` apaga lo primero; limpiar el fragmento antes
 * de arrancar cubre lo segundo, incluso para enlaces viejos ya compartidos.
 * Después de eso, moverse por el sitio lo maneja `EnlaceInternoDirective`.
 */
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

if (window.location.hash) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

bootstrapApplication(AppComponent, appConfig).catch((error) => console.error(error));
