import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/**
 * Desplaza a una sección del sitio sin dejar el ancla en la URL.
 *
 * POR QUÉ NO ALCANZA CON UN `<a href="#servicios">` PELADO
 * Un ancla de HTML escribe el fragmento en la barra de direcciones y ahí queda
 * pegado. Desde ese momento, cada vez que la persona vuelve a abrir el sitio
 * —recarga, reabre la pestaña, entra de nuevo desde el celular— el navegador
 * salta derecho a esa sección. En un sitio de una sola página eso significa
 * caer en el medio, sin ver la portada y sin ver el nombre encenderse.
 *
 * Así que el clic se toma, se desplaza igual de suave que antes y la URL queda
 * limpia. El `href` se conserva a propósito: el enlace sigue siendo un enlace,
 * con foco de teclado y con lector de pantalla.
 *
 * No se interpone si el clic viene con modificador o con otro botón: ahí la
 * persona quiere abrir en otra pestaña o descargar el enlace, y no corresponde
 * secuestrarle el clic.
 *
 * El selector es `a[href]` y no `a[href^="#"]` a propósito: el compilador de
 * Angular no matchea ese tipo de prefijo y la directiva quedaría sin aplicarse
 * en silencio. El filtro por ancla se hace en el código, que además es más
 * legible.
 */
@Directive({
  selector: 'a[href]',
  standalone: true,
})
export class EnlaceInternoDirective {
  private readonly elemento = inject(ElementRef) as ElementRef<HTMLAnchorElement>;

  @HostListener('click', ['$event'])
  alHacerClic(evento: MouseEvent): void {
    if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) {
      return;
    }

    const destino = this.elemento.nativeElement.getAttribute('href');
    if (!destino || !destino.startsWith('#') || destino === '#') {
      return;
    }

    const seccion = document.querySelector(destino);
    if (!seccion) {
      return;
    }

    evento.preventDefault();
    seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
}
