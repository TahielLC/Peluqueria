import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnlaceInternoDirective } from './enlace-interno.directive';

@Component({
  standalone: true,
  imports: [EnlaceInternoDirective],
  template: `
    <section id="servicios">servicios</section>
    <a id="ir-a-servicios" href="#servicios">Ir a servicios</a>
    <a id="sin-destino" href="#no-existe">Ir a ninguna parte</a>
  `,
})
class AnfitrionComponent {}

describe('EnlaceInternoDirective', () => {
  let desplazado: ReturnType<typeof vi.fn>;
  const scrollIntoViewOriginal = Element.prototype.scrollIntoView;

  beforeEach(() => {
    // jsdom no implementa el desplazamiento: se reemplaza para poder observar
    // a qué elemento se le pidió moverse.
    desplazado = vi.fn();
    Element.prototype.scrollIntoView = desplazado as unknown as typeof Element.prototype.scrollIntoView;

    TestBed.configureTestingModule({ imports: [AnfitrionComponent] });
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = scrollIntoViewOriginal;
    document.body.innerHTML = '';
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  function clic(id: string, opciones: MouseEventInit = {}): MouseEvent {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();

    // El fixture se engancha al documento porque la directiva busca la sección
    // destino en el documento, igual que en el sitio real.
    document.body.appendChild(fixture.nativeElement);

    const enlace = fixture.nativeElement.querySelector(`#${id}`) as HTMLAnchorElement;
    const evento = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...opciones });
    enlace.dispatchEvent(evento);

    return evento;
  }

  it('desplaza a la sección y deja la URL sin ancla', () => {
    const evento = clic('ir-a-servicios');

    expect(evento.defaultPrevented).toBe(true);
    expect(desplazado).toHaveBeenCalledTimes(1);

    const destino = desplazado.mock.calls[0][0] as unknown as Element;
    expect(destino).toBeDefined();

    expect(window.location.hash).toBe('');
  });

  it('si la URL ya venía con un ancla de una visita anterior, la limpia', () => {
    window.history.replaceState(null, '', '/#galeria');
    expect(window.location.hash).toBe('#galeria');

    clic('ir-a-servicios');

    expect(window.location.hash).toBe('');
  });

  it('no se mete si la sección no existe', () => {
    const evento = clic('sin-destino');

    expect(evento.defaultPrevented).toBe(false);
    expect(desplazado).not.toHaveBeenCalled();
  });

  it('respeta el clic con Ctrl o Cmd, que es para abrir en otra pestaña', () => {
    const evento = clic('ir-a-servicios', { ctrlKey: true });

    expect(evento.defaultPrevented).toBe(false);
    expect(desplazado).not.toHaveBeenCalled();
  });
});
