-- ============================================================================
-- PRUEBA DE RLS — ESCRITURA
--
-- ATENCIÓN: acá el error ES EL RESULTADO CORRECTO.
-- No está roto. Si esta prueba NO termina en error, la seguridad SÍ está rota.
--
-- Cómo se usa: Supabase → SQL Editor → pegar TODO esto → Run.
-- Nada queda guardado: todo termina en `rollback`.
--
-- Se corren dos escrituras, en este orden, a propósito:
--   1. la administradora (authenticated) escribe  -> tiene que ANDAR
--   2. un desconocido (anon) intenta escribir     -> tiene que FALLAR
-- Así, si falla la 1, el problema es otro (permisos rotos), no la seguridad.
-- ============================================================================

-- --- 1. La administradora PUEDE escribir. Esperado: INSERT 0 1 --------------
begin;
set local role authenticated;
insert into public.servicios (nombre, descripcion, duracion_minutos, precio)
values ('PRUEBA-RLS (borrar)', 'Prueba de escritura autenticada.', 30, 1.00);
rollback;

-- ============================================================================
-- --- 2. Un desconocido NO PUEDE escribir.
-- Esperado: ERROR — "permission denied for table servicios"
--        o  "new row violates row-level security policy for table servicios".
-- Cualquiera de los dos mensajes sirve: significan lo mismo, que no entró.
-- ============================================================================
begin;
set local role anon;
insert into public.servicios (nombre, descripcion, duracion_minutos, precio)
values ('NO DEBERÍA ENTRAR', 'Si esta fila existe, cualquiera puede editar el sitio.', 30, 1.00);
rollback;

-- ============================================================================
-- --- 3. Comprobación final: la tabla quedó limpia. Esperado: 3 --------------
-- ============================================================================
select 'servicios en la tabla' as prueba, count(*)::text as resultado, '3' as esperado
from public.servicios;
