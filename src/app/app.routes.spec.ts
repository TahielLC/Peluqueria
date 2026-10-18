import { routes } from './app.routes';

/**
 * El panel y el login no tienen que viajar en el paquete inicial.
 *
 * No es una optimización teórica: medido con `npm run build`, la portada pasó de
 * 320.90 kB a 567.27 kB cuando el panel entró en las rutas de forma eager. Un
 * visitante anónimo que sólo mira la portada se bajaba el panel entero y
 * `supabase-js` sin poder usarlos. Lo marcó la revisión nativa (R4-4).
 *
 * Este test fija la **intención** (que las rutas sean diferidas); la prueba de
 * que el paquete se partió de verdad es la medida del build, que no se puede
 * asertar desde un test unitario.
 */
describe('configuración de rutas', () => {
  const buscar = (path: string) => routes.find((ruta) => ruta.path === path);

  it('carga el panel y el login sólo cuando se navega hacia ellos', () => {
    for (const path of ['admin', 'admin/login']) {
      const ruta = buscar(path);

      expect(ruta).toBeDefined();
      expect(ruta?.loadComponent).toBeTypeOf('function');
      expect(ruta?.component).toBeUndefined();
    }
  });

  it('la portada sigue siendo lo único que se carga siempre', () => {
    const portada = buscar('');

    expect(portada?.component).toBeDefined();
    expect(portada?.loadComponent).toBeUndefined();
  });
});
