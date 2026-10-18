import { fetchConEsperaMaxima } from './supabase.client';

/**
 * Un servidor que acepta la conexión y nunca contesta es peor que uno que falla:
 * sin espera máxima, la promesa queda pendiente para siempre, la pantalla se
 * queda en "Cargando…" y el botón de reintentar **no aparece**, porque nunca
 * hubo error que mostrar. Lo marcó la revisión nativa (R4-2).
 */
const servidorQueNuncaContesta = ((_entrada: unknown, opciones?: RequestInit) =>
  new Promise<Response>((_resolver, rechazar) => {
    opciones?.signal?.addEventListener('abort', () => rechazar(new Error('abortada')));
  })) as typeof fetch;

describe('fetchConEsperaMaxima', () => {
  it('deja pasar la respuesta cuando llega a tiempo', async () => {
    const respuesta = { ok: true } as Response;
    const conEspera = fetchConEsperaMaxima(async () => respuesta, 1000);

    await expect(conEspera('http://ejemplo')).resolves.toBe(respuesta);
  });

  it('corta la espera y falla, en vez de dejar la promesa colgada para siempre', async () => {
    const conEspera = fetchConEsperaMaxima(servidorQueNuncaContesta, 30);

    await expect(conEspera('http://ejemplo')).rejects.toThrow('abortada');
  });

  it('no pierde la señal que ya traía la llamada', async () => {
    // Reemplazar la señal en vez de componerla es más corto y se lleva puesto el
    // abort de quien llama, sin avisar. Este test es el que impide ese atajo.
    const conEspera = fetchConEsperaMaxima(servidorQueNuncaContesta, 5000);
    const controlador = new AbortController();

    const promesa = conEspera('http://ejemplo', { signal: controlador.signal });
    controlador.abort();

    await expect(promesa).rejects.toThrow('abortada');
  });

  it('deja de correr la espera cuando la respuesta ya llegó, para no abortar el cuerpo', async () => {
    // `fetch` resuelve cuando llegan las CABECERAS: el cuerpo se lee después. Si
    // la espera siguiera corriendo, una respuesta lenta pero válida moriría
    // abortada a mitad de la lectura. O sea: limpiar el temporizador no es
    // higiene, es lo que hace que el timeout corte el cuelgue y no el trabajo.
    let senalUsada: AbortSignal | undefined;
    const respuesta = { ok: true } as Response;
    const conEspera = fetchConEsperaMaxima(async (_entrada, opciones) => {
      senalUsada = opciones?.signal ?? undefined;
      return respuesta;
    }, 30);

    await conEspera('http://ejemplo');
    await new Promise((seguir) => setTimeout(seguir, 60));

    expect(senalUsada?.aborted).toBe(false);
  });
});
