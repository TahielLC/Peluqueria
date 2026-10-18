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
-- Por qué hace falta esta prueba: el editor corre como `postgres`, que es DUEÑO
-- de las tablas, y el dueño IGNORA RLS. Ejecutar el schema sin error NO prueba
-- nada sobre la seguridad. Acá se cambia de rol a mano (`set role`) para ver lo
-- que ve cada uno de verdad.
--
-- RESULTADO ESPERADO: 3, 4, 3, 3
--   El tercer número es el importante: el público NO ve lo desactivado.
-- ============================================================================


-- --- 0. Limpieza defensiva --------------------------------------------------
-- Si una corrida anterior se cortó a la mitad, esto borra lo que haya quedado.
reset role;
delete from public.servicios where nombre = 'PRUEBA-RLS-TEMP';


-- --- 1. Lo que ve un visitante anónimo --------------------------------------
set role anon;
select set_config('app.r1', (select count(*)::text from public.servicios), false);


-- --- 2. La administradora inserta un servicio DESACTIVADO -------------------
-- Es contenido que el público NO debe ver. Si apareciera, la política de
-- `activo` no está filtrando.
set role authenticated;
insert into public.servicios (nombre, descripcion, duracion_minutos, precio, activo)
values ('PRUEBA-RLS-TEMP', 'Renta de prueba: la borra el paso 5.', 30, 1.00, false);

select set_config('app.r2', (select count(*)::text from public.servicios), false);


-- --- 3. El público, con un desactivado presente -----------------------------
set role anon;
select set_config('app.r3', (select count(*)::text from public.servicios), false);


-- --- 4. Limpieza: la fila de prueba desaparece ------------------------------
reset role;
delete from public.servicios where nombre = 'PRUEBA-RLS-TEMP';


-- --- 5. Todas las observaciones juntas. ÉSTA es la sentencia que se muestra -
select '1. anon, contenido normal'                       as prueba,
       coalesce(current_setting('app.r1', true), 'NO SE CORRIÓ') as resultado,
       '3'                                                as esperado
union all select '2. authenticated, con un desactivado', coalesce(current_setting('app.r2', true), 'NO SE CORRIÓ'), '4'
union all select '3. anon, con un desactivado',          coalesce(current_setting('app.r3', true), 'NO SE CORRIÓ'), '3'
union all select '4. filas reales tras limpiar',         (select count(*)::text from public.servicios), '3';

-- ============================================================================
-- Si los cuatro coinciden: la lectura está protegida.
-- La escritura se prueba en verificar-rls-escritura.sql (ahí el error es el
-- resultado correcto).
-- ============================================================================
