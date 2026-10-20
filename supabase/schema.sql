-- ============================================================================
-- Peluquería — esquema del contenido editable por la administradora
--
-- Cómo se usa:
--   1. Supabase → SQL Editor → New query
--   2. Pegar TODO este archivo y ejecutar (una sola vez)
--
-- Es idempotente: se puede volver a ejecutar sin romper nada.
--
-- Modelo de seguridad (ver S9 en odd/tasks/panel-admin.md):
--   - La `anon key` es pública por diseño. Lo que protege los datos es RLS,
--     no el secreto de la clave.
--   - Lectura pública: cualquiera puede LEER el contenido activo (es un sitio
--     público, esa es la idea).
--   - Escritura: sólo la administradora. No "cualquier sesión iniciada": la
--     tabla `public.administradores` dice QUIÉN es la administradora, y todas
--     las políticas de escritura la consultan. Si algún día se habilita el
--     registro público, o si se invita a alguien, esa cuenta nueva NO puede
--     tocar el contenido.
--   - Alta o baja de administradoras: se hace a mano desde el editor SQL.
--     A propósito: es una decisión operativa, no algo que deba poder hacer
--     nadie desde el navegador.
--   - `service_role` NO se usa en ningún lado del frontend. Nunca.
--
-- POR QUÉ UNA TABLA Y NO UN `security definer` NI UN UUID SUELTO:
--   Con el UUID hardcodeado en cada política, cambiar de administradora exige
--   editar 7 políticas y es fácil dejar una vieja atrás. Con una función
--   `security definer` quedaría más corto, pero sería una frontera de
--   privilegios que no se puede probar antes de ejecutarla, y un error ahí
--   (por ejemplo un `search_path` sin fijar) es una escalada de privilegios.
--   La tabla es lo más aburrido de las tres: sin superficie de escalada, con
--   un solo lugar donde está la verdad, y verificable a ojo.
--   Lo que se resigna: cualquier cuenta autenticada puede LEER la lista de
--   administradoras. No sirve para nada malo —`auth.uid()` viene firmado por
--   Supabase y no se puede falsificar— pero queda dicho.
-- ============================================================================


-- ============================================================================
-- 1. TABLAS
-- ============================================================================

-- Textos sueltos del sitio (hero y encabezados de sección).
-- Es clave/valor a propósito: `etiqueta` y `ayuda` son lo que el panel le
-- muestra a la administradora, así las etiquetas no quedan hardcodeadas
-- en el frontend y se pueden corregir sin tocar código.
create table if not exists public.textos_sitio (
  clave    text primary key,
  valor    text not null default '',
  etiqueta text not null,
  ayuda    text,
  orden    int  not null default 0
);

create table if not exists public.servicios (
  id               serial primary key,
  nombre           text not null,
  descripcion      text not null default '',
  duracion_minutos int  not null default 30 check (duracion_minutos > 0),
  precio           numeric(10,2) not null default 0 check (precio >= 0),
  orden            int  not null default 0,
  activo           boolean not null default true,
  actualizado_en   timestamptz not null default now()
);

create table if not exists public.peluqueros (
  id             serial primary key,
  nombre         text not null,
  rol            text not null default '',
  experiencia    text not null default '',
  titulo         text,          -- opcional: si es null o vacío, la línea no se muestra
  foto_url       text,          -- URL pública de la foto
  orden          int  not null default 0,
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);

create table if not exists public.galeria (
  id             serial primary key,
  titulo         text not null,
  categoria      text not null default '',
  imagen_url     text,          -- URL pública de la foto
  orden          int  not null default 0,
  activo         boolean not null default true,
  actualizado_en timestamptz not null default now()
);

-- Quién puede escribir. Una fila por administradora.
-- No tiene columnas de contenido a propósito: es sólo la lista de identidades.
create table if not exists public.administradores (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  creado_en  timestamptz not null default now()
);


-- ============================================================================
-- 2. GRANTS EXPLÍCITOS
--    Supabase ya los otorga por default; los dejamos escritos para que RLS
--    sea la única puerta y no una configuración implícita invisible.
-- ============================================================================

grant usage on schema public to anon, authenticated;

grant select
  on public.textos_sitio, public.servicios, public.peluqueros, public.galeria
  to anon, authenticated;

grant insert, update, delete
  on public.textos_sitio, public.servicios, public.peluqueros, public.galeria
  to authenticated;

-- La lista de administradoras se LEE (las políticas de escritura la consultan)
-- pero NO se escribe desde el navegador: no hay grant de insert/update/delete
-- ni política que lo permita. Se administra desde el editor SQL.
grant select on public.administradores to authenticated;

grant usage, select on all sequences in schema public to authenticated;


-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

alter table public.textos_sitio     enable row level security;
alter table public.servicios       enable row level security;
alter table public.peluqueros      enable row level security;
alter table public.galeria         enable row level security;
alter table public.administradores enable row level security;

-- --- administradores -------------------------------------------------------
-- Sólo lectura: la necesitan las políticas de abajo. Sin insert/update/delete,
-- nadie se hace administrador a sí mismo desde el navegador.
drop policy if exists "lectura administradoras" on public.administradores;
create policy "lectura administradoras"
  on public.administradores for select
  to authenticated
  using (true);

-- --- El predicado de escritura --------------------------------------------
-- Todas las políticas de escritura repiten el mismo. Se escribe entero en cada
-- una, sin función auxiliar, por el motivo del encabezado.
--
-- OJO, un detalle de PostgreSQL que no es obvio y que cambia el comportamiento:
-- las políticas PERMISIVAS del MISMO comando se combinan con OR. Entonces
-- `for all to authenticated` no significa sólo "escribir": su `using` también
-- habilita LEER. Con el predicado de administradora la consecuencia es la que
-- buscamos —la administradora ve también lo desactivado, que es justo lo que
-- necesita para poder reactivarlo— y una cuenta autenticada que NO es
-- administradora ve sólo lo activo, igual que el público. Si algún día se
-- agrega una segunda cuenta, esto ya está resuelto.

-- --- textos_sitio ---------------------------------------------------------
-- No tiene `activo`: son claves fijas del sitio, siempre se leen.
drop policy if exists "lectura publica textos" on public.textos_sitio;
create policy "lectura publica textos"
  on public.textos_sitio for select
  using (true);

drop policy if exists "admin administra textos" on public.textos_sitio;
create policy "admin administra textos"
  on public.textos_sitio for all
  to authenticated
  using (exists (select 1 from public.administradores where user_id = auth.uid()))
  with check (exists (select 1 from public.administradores where user_id = auth.uid()));

-- --- servicios ------------------------------------------------------------
-- El público sólo ve lo activo; la administradora ve todo (si no, no podría
-- reactivar algo que dio de baja).
drop policy if exists "lectura publica servicios activos" on public.servicios;
create policy "lectura publica servicios activos"
  on public.servicios for select
  using (activo = true);

drop policy if exists "admin administra servicios" on public.servicios;
create policy "admin administra servicios"
  on public.servicios for all
  to authenticated
  using (exists (select 1 from public.administradores where user_id = auth.uid()))
  with check (exists (select 1 from public.administradores where user_id = auth.uid()));

-- --- peluqueros -----------------------------------------------------------
drop policy if exists "lectura publica peluqueros activos" on public.peluqueros;
create policy "lectura publica peluqueros activos"
  on public.peluqueros for select
  using (activo = true);

drop policy if exists "admin administra peluqueros" on public.peluqueros;
create policy "admin administra peluqueros"
  on public.peluqueros for all
  to authenticated
  using (exists (select 1 from public.administradores where user_id = auth.uid()))
  with check (exists (select 1 from public.administradores where user_id = auth.uid()));

-- --- galeria --------------------------------------------------------------
drop policy if exists "lectura publica galeria activa" on public.galeria;
create policy "lectura publica galeria activa"
  on public.galeria for select
  using (activo = true);

drop policy if exists "admin administra galeria" on public.galeria;
create policy "admin administra galeria"
  on public.galeria for all
  to authenticated
  using (exists (select 1 from public.administradores where user_id = auth.uid()))
  with check (exists (select 1 from public.administradores where user_id = auth.uid()));


-- ============================================================================
-- 4. STORAGE DE FOTOS
--    Un bucket público de lectura (las fotos las ve todo el mundo en el
--    sitio) y de escritura sólo para la administradora autenticada.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

-- NOTA: si el editor SQL se queja porque no sos dueño de `storage.objects`,
-- creá estas 4 políticas desde el Dashboard: Storage → fotos → Policies.
drop policy if exists "lectura publica fotos" on storage.objects;
create policy "lectura publica fotos"
  on storage.objects for select
  using (bucket_id = 'fotos');

drop policy if exists "admin sube fotos" on storage.objects;
create policy "admin sube fotos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos'
    and exists (select 1 from public.administradores where user_id = auth.uid())
  );

drop policy if exists "admin reemplaza fotos" on storage.objects;
create policy "admin reemplaza fotos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fotos'
    and exists (select 1 from public.administradores where user_id = auth.uid())
  )
  with check (
    bucket_id = 'fotos'
    and exists (select 1 from public.administradores where user_id = auth.uid())
  );

drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin borra fotos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos'
    and exists (select 1 from public.administradores where user_id = auth.uid())
  );


-- ============================================================================
-- 5. SEED — el contenido que HOY está hardcodeado en appointment.service.ts
--    Objetivo: que el sitio no quede vacío al quitar los mocks.
--    Los textos del staff son PLACEHOLDER INVENTADO (ver A4): la
--    administradora tiene que reemplazarlos por datos reales.
-- ============================================================================

insert into public.textos_sitio (clave, valor, etiqueta, ayuda, orden) values
  ('hero_badge',       'Estilo & Vanguardia',
   'Frase chica arriba del título', 'La línea corta que aparece sobre el nombre del salón.', 1),
  ('hero_titulo',      'LA+ESTUDIO',
   'Nombre del salón', 'Es el título más grande de la página de inicio.', 2),
  ('hero_subtitulo',   'El lugar donde tu imagen se transforma con las últimas tendencias en cortes, barbas y estilismo.',
   'Frase de presentación', 'Una o dos líneas contando qué hace el salón.', 3),
  ('hero_cta',         'Ver Trabajos',
   'Texto del botón principal', 'El botón que lleva a la galería.', 4),
  ('servicios_titulo', 'Nuestros Servicios',
   'Título de la sección de servicios', null, 5),
  ('servicios_bajada', 'Precios claros, sin sorpresas. Elegí el tuyo.',
   'Frase debajo del título de servicios', null, 6),
  ('galeria_titulo',   'Galería de Trabajos',
   'Título de la sección de la galería', null, 7),
  ('galeria_bajada',   'Echale un vistazo a nuestros últimos cortes y estilos.',
   'Frase debajo del título de la galería', null, 8),
  ('staff_titulo',     'Nuestro Equipo',
   'Título de la sección del equipo', null, 9),
  ('staff_bajada',     'Profesionales apasionados por el cuidado de tu imagen.',
   'Frase debajo del título del equipo', null, 10)
on conflict (clave) do nothing;

insert into public.servicios (id, nombre, descripcion, duracion_minutos, precio, orden) values
  (1, 'Corte Clásico',   'Corte de cabello tradicional con tijera y máquina.',                30, 15.00, 1),
  (2, 'Corte y Barba',   'Corte completo de cabello y perfilado de barba con toalla caliente.', 45, 22.00, 2),
  (3, 'Tintura / Color', 'Aplicación de tintes profesionales y tratamientos de color.',         90, 40.00, 3)
on conflict (id) do nothing;

-- Los ids van explícitos para que re-ejecutar el archivo no duplique nada.
-- Después hay que adelantar el contador, si no el primer servicio nuevo que
-- cargue la administradora choca contra un id ya usado.
select setval(pg_get_serial_sequence('public.servicios', 'id'),
              coalesce((select max(id) from public.servicios), 1));

-- >>> PLACEHOLDER INVENTADO — REEMPLAZAR POR DATOS REALES <<<
insert into public.peluqueros (id, nombre, rol, experiencia, titulo, foto_url, orden) values
  (1, 'Carlos "El Maestro" Gómez', 'Especialista en cortes clásicos y navaja',
   'Corta y afeita desde 2018. Se formó en barbería tradicional y trabaja con navaja, toalla caliente y tijera. Es el referente del local para cortes clásicos y afeitados de precisión.',
   'Curso de Barbería Clásica — Escuela de Oficios (2018)',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop', 1),
  (2, 'Sofía Martínez', 'Experta en colorimetría y peinados',
   'Arrancó en 2020 en salones de estilismo. Domina tinturas, decoloraciones y tratamientos de color, y se encarga de los peinados de gala para eventos.',
   'Tecnicatura en Peluquería y Colorimetría (2021)',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop', 2),
  (3, 'Lucas Pérez', 'Especialista en Fade y estilos urbanos',
   'Trabaja desde 2022 con foco en degradados y cortes de tendencia. Se mantiene al día con las técnicas que se ven en redes y las adapta a cada tipo de cabello.',
   'Taller de Fade y Máquina — Certificación (2023)',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&auto=format&fit=crop', 3)
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.peluqueros', 'id'),
              coalesce((select max(id) from public.peluqueros), 1));

insert into public.galeria (id, titulo, categoria, imagen_url, orden) values
  (1, 'Fade Moderno',     'Corte',   'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=600&auto=format&fit=crop', 1),
  (2, 'Barba Estilizada', 'Barba',   'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=600&auto=format&fit=crop', 2),
  (3, 'Peinado de Gala',  'Peinado', 'https://images.unsplash.com/photo-1560869713-7d0a29430803?q=80&w=600&auto=format&fit=crop', 3)
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.galeria', 'id'),
              coalesce((select max(id) from public.galeria), 1));


-- ============================================================================
-- 6. ALTA DE LA ADMINISTRADORA  (PASO MANUAL, OBLIGATORIO)
--    Sin esto RLS bloquea TODA escritura y el panel queda de sólo lectura.
--    Reemplazá el correo por el de la cuenta que va a administrar el sitio
--    (la que ya existe en Authentication → Users).
-- ============================================================================

insert into public.administradores (user_id)
select id from auth.users where email = 'CAMBIAR-ESTE-CORREO@ejemplo.com'
on conflict (user_id) do nothing;

-- Si nadie quedó dado de alta, se corta acá con un error, A PROPÓSITO.
-- El silencio sería peor: el sitio se vería perfecto, no se podría guardar
-- nada, y el síntoma aparecería recién en el primer intento de editar.
do $$
begin
  if not exists (select 1 from public.administradores) then
    raise exception 'NO HAY NINGUNA ADMINISTRADORA DADA DE ALTA: reemplaza el correo del paso 6 por el de una cuenta real y vuelve a ejecutar el archivo.';
  end if;
end $$;


-- ============================================================================
-- 7. COMPROBACIÓN RÁPIDA
--    Después de ejecutar, esto tiene que devolver 10, 3, 3, 3, 1.
--    El último número es el de administradoras: si da 0, revisá el paso 6.
-- ============================================================================

select
  (select count(*) from public.textos_sitio)     as textos,
  (select count(*) from public.servicios)        as servicios,
  (select count(*) from public.peluqueros)       as peluqueros,
  (select count(*) from public.galeria)          as galeria,
  (select count(*) from public.administradores)  as administradoras;
