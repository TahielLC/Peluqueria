import { Subject } from 'rxjs';
import { CargaDeContenido, MENSAJES } from './estados';

/**
 * La máquina de estados que antes estaba copiada en las tres secciones.
 *
 * Se prueba acá, una sola vez, porque es exactamente el punto del cambio: antes
 * estas cinco reglas vivían tres veces y nada obligaba a que siguieran iguales
 * (lo marcó la revisión nativa, R2-dup-estados). Los specs de cada componente
 * siguen verificando lo suyo, que es que la sección se vea como corresponde.
 */
describe('CargaDeContenido', () => {
  /**
   * Cada llamada a `cargar()` arma una fuente nueva, igual que en la app: no se
   * reintenta sobre el observable viejo (un observable que ya falló no vuelve a
   * emitir), se pide de nuevo.
   */
  const armar = () => {
    const fuentes: Subject<string[]>[] = [];
    let recibidos: string[] | null = null;

    const carga = new CargaDeContenido<string[]>(
      () => {
        const fuente = new Subject<string[]>();
        fuentes.push(fuente);
        return fuente.asObservable();
      },
      (datos) => {
        recibidos = datos;
      },
    );

    return { fuentes, carga, recibidos: () => recibidos };
  };

  it('arranca en cargando y sin error, sin afirmar que no hay contenido', () => {
    const { carga } = armar();

    expect(carga.cargando()).toBe(true);
    expect(carga.error()).toBeNull();
  });

  it('cuando la respuesta llega bien, entrega los datos y apaga cargando', () => {
    const { fuentes, carga, recibidos } = armar();

    carga.cargar();
    fuentes[0].next(['uno', 'dos']);

    expect(recibidos()).toEqual(['uno', 'dos']);
    expect(carga.cargando()).toBe(false);
    expect(carga.error()).toBeNull();
  });

  it('cuando falla, muestra el texto compartido y apaga cargando', () => {
    const { fuentes, carga, recibidos } = armar();

    carga.cargar();
    fuentes[0].error(new Error('se cayó la red'));

    expect(carga.error()).toBe(MENSAJES.errorAlCargar);
    expect(carga.cargando()).toBe(false);
    // Lo que no llegó no se inventa: el dato sigue sin estar.
    expect(recibidos()).toBeNull();
  });

  it('reintentar limpia el error viejo mientras la respuesta nueva está en camino', () => {
    const { fuentes, carga } = armar();

    carga.cargar();
    fuentes[0].error(new Error('se cayó la red'));
    carga.cargar();

    // Si el cartel de falla quedara mientras se reintenta, la persona vería el
    // error viejo junto al estado de carga y no sabría cuál de los dos es cierto.
    expect(carga.error()).toBeNull();
    expect(carga.cargando()).toBe(true);
  });

  it('reintentar después de un fallo termina bien', () => {
    const { fuentes, carga, recibidos } = armar();

    carga.cargar();
    fuentes[0].error(new Error('se cayó la red'));
    carga.cargar();
    fuentes[1].next(['tres']);

    expect(recibidos()).toEqual(['tres']);
    expect(carga.error()).toBeNull();
    expect(carga.cargando()).toBe(false);
  });
});
