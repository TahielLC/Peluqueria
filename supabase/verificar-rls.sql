-- ============================================================================
-- PRUEBA DE RLS — LECTURA
-- Comprueba que el público sólo ve lo activo y que la administradora ve todo.
--
-- Cómo se usa: Supabase → SQL Editor → pegar TODO esto → Run.
--
-- CÓMO ESTÁ ARMADO (dos trampas de este editor, las dos aprendidas a golpes):
--
--   1. El editor muestra ÚNICAMENTE el resultado de la última sentencia que
--      devuelve filas. Por eso las observaciones se guardan en variables de
--      sesión con `set_config` y salen juntas en UN solo SELECT final.
--
--   2. NO hay `begin`/`rollback`. PostgreSQL revierte los `SET` de sesión si la
--      transacción que los contiene aborta: el `rollback` se llevaba puestas
--      las variables y la tabla salía vacía. Por eso la limpieza se hace con un
--      `delete` explícito y no con un rollback.
--
--   3. `set role` SOLO NO ALCANZA. `auth.uid()` no mira el rol de PostgreSQL:
--      mira el claim `sub` del token, que acá se simula con
--      set_config('request.jwt.claims', ...). Sin ese set_config, auth.uid()
--      devuelve NULL, nadie es administradora y el insert del paso 2 falla.
--
-- Por qué hace falta esta prueba: el editor corre como `postgres`, que es DUEÑO
-- de las tablas, y el dueño IGNORA RLS. Ejecutar el schema sin error NO prueba
-- nada sobre la seguridad. Acá se cambia de rol a mano (`set role`) para ver lo
-- que ve cada uno de verdad.
--
-- SOBRE LA BASURA: la fila temporal del paso 2 es INACTIVA a propósito, así que
-- aun si el `delete` del paso 5 no llegara a correr NO se vería en el sitio; y
-- el paso 0 la borra igual antes de empezar. La última fila del informe
-- comprueba que no quedó nada.
--
-- RESULTADO ESPERADO: 3, 4, 3, 3, 3, 0
--   El 3ro es el importante: el público NO ve lo desactivado.
--   El 4to es el nuevo: una sesión válida que NO es administradora ve
--   exactamente lo mismo que el público, no más.
-- ============================================================================


-- --- 0. Limpieza defensiva y quién es la administradora ---------------------
-- Si una corrida anterior se cortó a la mitad, esto borra lo que haya quedado.
reset role;
delete from public.servicios where nombre = 'PRUEBA-RLS-TEMP';

select set_config(
  'app.admin_uid',
  coalesce((select user_id::text from public.administradores limit 1), ''),
  false
) as administradora_dada_de_alta;


-- --- 1. Lo que ve un visitante anónimo --------------------------------------
set role anon;
select set_config('app.r1', (select count(*)::text from public.servicios), false);


-- --- 2. La administradora inserta un servicio DESACTIVADO -------------------
-- Es contenido que el público NO debe ver. Si apareciera, la política de
-- `activo` no está filtrando.
set role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('app.admin_uid', true), 'role', 'authenticated')::text,
  false
);

insert into public.servicios (nombre, descripcion, duracion_minutos, precio, activo)
values ('PRUEBA-RLS-TEMP', 'Fila de prueba: la borra el paso 5.', 30, 1.00, false);

select set_config('app.r2', (select count(*)::text from public.servicios), false);


-- --- 3. El público, con un desactivado presente -----------------------------
set role anon;
select set_config('app.r3', (select count(*)::text from public.servicios), false);


-- --- 4. Una sesión válida que NO es administradora --------------------------
-- Mismo rol de PostgreSQL que el paso 2, otra identidad. Tiene que ver lo mismo
-- que el público: ni una fila más. Antes de cerrar la escritura a la
-- administradora, esta cuenta era indistinguible de ella.
set role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-4000-8000-000000000001', 'role', 'authenticated')::text,
  false
);

select set_config('app.r4', (select count(*)::text from public.servicios), false);


-- --- 5. Limpieza: la fila de prueba desaparece ------------------------------
reset role;
delete from public.servicios where nombre = 'PRUEBA-RLS-TEMP';


-- --- 6. Todas las observaciones juntas. ÉSTA es la sentencia que se muestra -
select '0. administradora dada de alta' as prueba,
       case when coalesce(current_setting('app.admin_uid', true), '') = ''
            then 'NINGUNA — corré el paso 6 de schema.sql'
            else current_setting('app.admin_uid', true)
       end as resultado,
       'un uuid' as esperado
union all select '1. anon, contenido normal',
                 coalesce(current_setting('app.r1', true), 'NO SE CORRIÓ'), '3'
union all select '2. administradora, con un desactivado',
                 coalesce(current_setting('app.r2', true), 'NO SE CORRIÓ'), '4'
union all select '3. anon, con un desactivado',
                 coalesce(current_setting('app.r3', true), 'NO SE CORRIÓ'), '3'
union all select '4. sesión que NO es administradora',
                 coalesce(current_setting('app.r4', true), 'NO SE CORRIÓ'), '3'
union all select '5. filas reales tras limpiar',
                 (select count(*)::text from public.servicios), '3'
union all select '6. filas de prueba que quedaron',
                 (select count(*)::text from public.servicios where nombre = 'PRUEBA-RLS-TEMP'), '0';

-- ============================================================================
-- Si las siete filas coinciden con su `esperado`, la lectura está protegida.
-- La escritura se prueba en verificar-rls-escritura.sql.
-- ============================================================================
