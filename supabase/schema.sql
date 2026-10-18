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
--   - Escritura: sólo con sesión iniciada (la administradora).
--   - `service_role` NO se usa en ningún lado del frontend. Nunca.
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

grant usage, select on all sequences in schema public to authenticated;


-- ============================================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================================

alter table public.textos_sitio enable row level security;
alter table public.servicios   enable row level security;
alter table public.peluqueros  enable row level security;
alter table public.galeria     enable row level security;

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
  using (true) with check (true);

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
  using (true) with check (true);

-- --- peluqueros -----------------------------------------------------------
drop policy if exists "lectura publica peluqueros activos" on public.peluqueros;
create policy "lectura publica peluqueros activos"
  on public.peluqueros for select
  using (activo = true);

drop policy if exists "admin administra peluqueros" on public.peluqueros;
create policy "admin administra peluqueros"
  on public.peluqueros for all
  to authenticated
  using (true) with check (true);

-- --- galeria --------------------------------------------------------------
drop policy if exists "lectura publica galeria activa" on public.galeria;
create policy "lectura publica galeria activa"
  on public.galeria for select
  using (activo = true);

drop policy if exists "admin administra galeria" on public.galeria;
create policy "admin administra galeria"
  on public.galeria for all
  to authenticated
  using (true) with check (true);


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
  with check (bucket_id = 'fotos');

drop policy if exists "admin reemplaza fotos" on storage.objects;
create policy "admin reemplaza fotos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'fotos');

drop policy if exists "admin borra fotos" on storage.objects;
create policy "admin borra fotos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'fotos');


-- ============================================================================
-- 5. SEED — el contenido que HOY está hardcodeado en appointment.service.ts
--    Objetivo: que el sitio no quede vacío al quitar los mocks.
--    Los textos del staff son PLACEHOLDER INVENTADO (ver A4): la
--    administradora tiene que reemplazarlos por datos reales.
-- ============================================================================

insert into public.textos_sitio (clave, valor, etiqueta, ayuda, orden) values
  ('hero_badge',       'Estilo & Vanguardia',
   'Frase chica arriba del título', 'La línea corta que aparece sobre el nombre del salón.', 1),
  ('hero_titulo',      'Peluquería Estilo & Arte',
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
-- 6. COMPROBACIÓN RÁPIDA
--    Después de ejecutar, esto tiene que devolver 10, 3, 3, 3.
-- ============================================================================

select
  (select count(*) from public.textos_sitio) as textos,
  (select count(*) from public.servicios)   as servicios,
  (select count(*) from public.peluqueros)  as peluqueros,
  (select count(*) from public.galeria)     as galeria;
