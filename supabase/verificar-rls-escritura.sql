-- ============================================================================
-- PRUEBA DE RLS — ESCRITURA
--
-- Cómo se usa: Supabase → SQL Editor → pegar TODO esto → Run.
--
-- Acá NO hay que esperar un error: el resultado se lee en la última tabla.
-- Buscá la columna `resultado` y comparala con `esperado`.
--
-- Se prueban TRES escrituras:
--   1. la administradora                           -> tiene que PODER
--   2. una sesión válida que NO es administradora  -> tiene que quedar BLOQUEADA
--   3. un visitante sin sesión (anon)              -> tiene que quedar BLOQUEADO
--
-- El orden importa: si falla la 1, el problema es otro (la administradora no
-- está dada de alta, o los permisos se rompieron), no la seguridad.
--
-- DOS TRAMPAS DE ESTE ENTORNO, las dos aprendidas a golpes:
--
--   1. El editor corre como `postgres`, que es DUEÑO de las tablas, y el dueño
--      IGNORA RLS. Ejecutar el schema sin error NO prueba nada sobre la
--      seguridad. Hay que cambiar de rol a mano (`set role`) para ver lo que
--      ve cada uno de verdad.
--
--   2. `set role` SOLO NO ALCANZA. `auth.uid()` no mira el rol de PostgreSQL:
--      mira el claim `sub` del token, que acá se simula con
--      set_config('request.jwt.claims', ...). Sin ese set_config, auth.uid()
--      devuelve NULL, NADIE es administradora y hasta la prueba 1 falla. Es la
--      trampa que hace que una prueba así "pase" sin probar nada.
--
-- POR QUÉ ESTA PRUEBA NO DEJA BASURA (antes sí podía):
--   Cada escritura vive adentro de un bloque `do` con manejador de excepciones.
--   En PL/pgSQL, si un bloque termina por excepción, TODOS los cambios de ese
--   bloque se revierten. Entonces:
--     - la prueba 1 inserta y borra; si el borrado fallara, la excepción
--       revierte también el insert, así que es IMPOSIBLE que quede una fila
--       visible en el sitio;
--     - las pruebas 2 y 3 ni siquiera llegan a insertar.
--   El paso 0 igual limpia restos de corridas viejas: no cuesta nada.
-- ============================================================================


-- --- 0. Limpieza defensiva y quién es la administradora ---------------------
reset role;
delete from public.servicios where nombre = 'PRUEBA-RLS-TEMP';

select set_config(
  'app.admin_uid',
  coalesce((select user_id::text from public.administradores limit 1), ''),
  false
) as administradora_dada_de_alta;


-- --- 1. La administradora tiene que PODER escribir --------------------------
set role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('app.admin_uid', true), 'role', 'authenticated')::text,
  false
);

do $$
begin
  insert into public.servicios (nombre, descripcion, duracion_minutos, precio)
  values ('PRUEBA-RLS-TEMP', 'Fila de prueba: la borra este mismo bloque.', 30, 1.00);

  delete from public.servicios where nombre = 'PRUEBA-RLS-TEMP';

  perform set_config('app.w1', 'PUDO escribir', false);
exception when others then
  -- Cualquier error revierte el bloque entero: no queda ninguna fila.
  perform set_config('app.w1', 'NO PUDO — revisá el paso 6 de schema.sql', false);
end $$;


-- --- 2. Una sesión válida que NO es administradora: BLOQUEADA ---------------
-- Se le da un `sub` bien formado que NO está en public.administradores. Es el
-- caso "se habilitó el registro y entró alguien", o "se invitó a una cuenta".
-- Antes de este cambio esta prueba ENTRABA.
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  false
);

do $$
begin
  insert into public.servicios (nombre, descripcion, duracion_minutos, precio)
  values ('PRUEBA-RLS-TEMP', 'NO DEBERÍA ENTRAR.', 30, 1.00);

  perform set_config('app.w2', 'ENTRÓ — LA SEGURIDAD ESTÁ ROTA', false);
exception when others then
  perform set_config('app.w2', 'BLOQUEADA', false);
end $$;


-- --- 3. Un visitante sin sesión (anon): BLOQUEADO ---------------------------
-- Si este bloque se corta con "permission denied for language plpgsql", el
-- proyecto tiene revocado el uso de `plpgsql` para `anon`: avisá y se prueba
-- este caso por separado con un insert pelado.
set role anon;
select set_config('request.jwt.claims', '', false);

do $$
begin
  insert into public.servicios (nombre, descripcion, duracion_minutos, precio)
  values ('PRUEBA-RLS-TEMP', 'NO DEBERÍA ENTRAR.', 30, 1.00);

  perform set_config('app.w3', 'ENTRÓ — LA SEGURIDAD ESTÁ ROTA', false);
exception when others then
  perform set_config('app.w3', 'BLOQUEADO', false);
end $$;


-- --- 4. Limpieza y resultado, todo junto ------------------------------------
reset role;
delete from public.servicios where nombre = 'PRUEBA-RLS-TEMP';

select '0. administradora dada de alta' as prueba,
       case when coalesce(current_setting('app.admin_uid', true), '') = ''
            then 'NINGUNA — corré el paso 6 de schema.sql'
            else current_setting('app.admin_uid', true)
       end as resultado,
       'un uuid' as esperado
union all select '1. la administradora escribe',
                 coalesce(current_setting('app.w1', true), 'NO SE CORRIÓ'), 'PUDO escribir'
union all select '2. sesión que NO es administradora',
                 coalesce(current_setting('app.w2', true), 'NO SE CORRIÓ'), 'BLOQUEADA'
union all select '3. visitante sin sesión (anon)',
                 coalesce(current_setting('app.w3', true), 'NO SE CORRIÓ'), 'BLOQUEADO'
union all select '4. filas en servicios, sin restos',
                 (select count(*)::text from public.servicios), '3'
union all select '5. filas de prueba que quedaron',
                 (select count(*)::text from public.servicios where nombre = 'PRUEBA-RLS-TEMP'), '0';

-- ============================================================================
-- Si las seis filas coinciden con su `esperado`, la escritura está cerrada.
-- La lectura se prueba en verificar-rls.sql.
-- ============================================================================
