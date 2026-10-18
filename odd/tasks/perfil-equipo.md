# Perfil del equipo (Nuestro Equipo)

**Objetivo:** convertir la grilla estática de profesionales en un perfil deslizable (uno a la vez, horizontal, sin rotación 3D) que muestre la experiencia descripta y el título/capacitación de cada persona.

**Repo:** `/home/luislinx/Escritorio/projectTest` · **App:** `src/app` (Angular 22 standalone + Tailwind v4)
**Runner:** no hay infraestructura de tests. Verificación por `npx ng build` + checks textuales.
**Entrega:** local, sin PR.

## Specs

- **S1** — La sección de equipo muestra **un perfil a la vez**, no una grilla.
  *Criterio:* ya no existe `grid-cols-*` con las 3 tarjetas; hay un track con un perfil visible.
  *Check:* `grep` del template.

- **S2** — El pasaje de perfil es **horizontal** (`translateX`), sin `rotateY` ni `perspective`.
  *Criterio:* el movimiento es lateral, no rotativo (a diferencia de la galería).
  *Check:* el componente NO contiene `rotateY` ni `perspective`.

- **S3** — Se puede deslizar con el dedo: swipe izquierda → siguiente, swipe derecha → anterior, con umbral de 50px.
  *Criterio:* `touchstart`/`touchend` con umbral.
  *Check:* `grep` del umbral.

- **S4** — Cada perfil muestra: foto, nombre, rol y la **descripción de la experiencia**.
  *Criterio:* los 4 datos están en el template.

- **S5** — Si la persona tiene **título/capacitación**, se muestra como texto. Si NO tiene, esa línea no se renderiza (ni queda un hueco vacío).
  *Criterio:* el bloque está dentro de un `@if` sobre el campo.
  *Check:* el campo es opcional en el modelo y el template lo condiciona.

- **S6** — Navegación: flechas anterior/siguiente, puntos indicadores y teclado ← →, igual que la galería.
  *Criterio:* existen los 3 mecanismos.

- **S7** — Mantiene `id="staff"`.
  *Criterio:* `id="staff"` presente.

- **S8** — Estado vacío si no hay profesionales.

- **S9** — El campo nuevo es **aditivo y opcional** (`titulo?: string`): no rompe el modelo existente ni obliga a completarlo.
  *Criterio:* `titulo?` en la interfaz.

## Supuestos (ASUMIDOS — CONFIRMAR)

- **A1** — **El contenido es PLACEHOLDER.** Los títulos y descripciones de experiencia los inventé yo: no existen en ningún archivo previo. **Reemplazar por los reales** antes de publicar. Nadie debería mostrar credenciales inventadas en un sitio productivo.
- **A2** — Un solo campo de texto (`titulo`) para "título o capacitación". Si una persona necesita varias capacitaciones, hay que pasarlo a `string[]`.
- **A3** — Layout: foto a la izquierda y texto a la derecha en pantalla grande; apilado (foto arriba) en celular.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
| --- | --- | --- | --- | --- |
| T1 | S1-S9 | inline | **hecho** | build OK (sin cambios de bundle en staff); 14/14 checks en verde (ver L5) |

## Log

- **L1** (2026-10-18) — Pedido original del usuario, verbatim: *"me gutaria que en la seccion de Nuestro Equipo agregues tambien para ver las personas que trabajan y una descripcion de su experiencia ,y si tienen algun titulo o capacitacion que la puedan agregar ahi pero que solo sea texto ,basicamente el perfil basico de la persona que pueda atender a los clientes en la peluqueria, y en esa seccion vamos a implementar lo de deslizar para un lado , no como en el anterior que es rotativo."*
- **L2** (2026-10-18) — El usuario eligió: **"Un perfil a la vez"** (no tira con varias visibles).
- **L3** (2026-10-18) — Estado previo verificado: `Peluquero` = `id, nombre, rol, experiencia, fotoUrl` (sin campo de título); `experiencia` era un texto corto (`'8 años de experiencia'`); la sección era una grilla de 3 tarjetas. `staff.component.ts` es el único consumidor de `Peluquero`.
- **L4** (2026-10-18) — Clasificación: **tarea chica**. Documento creado porque el usuario pidió el flujo SDD.
- **L5** (2026-10-18) — T1 implementada. Archivos: `models/appointment.model.ts` (campo `titulo?: string`, aditivo y opcional), `services/appointment.service.ts` (experiencia descriptiva + título placeholder, con aviso `ATENCIÓN: datos PLACEHOLDER`), `components/staff/staff.component.ts` (reescrito: grilla → track `translateX` de un perfil por vez). **Verificación:** `npx ng build` compila; 14/14 checks textuales en verde (S1-S9). **NO verificado visualmente** — no hay navegador disponible.
- **L6** (2026-10-18) — Nota de geometría CSS: el track es block-level dentro de un contenedor `overflow-hidden`, así que sus hijos `w-full shrink-0` miden el 100% de la ventana y `translateX(-index * 100%)` avanza exactamente un perfil. El porcentaje se resuelve contra el ancho del track (el de la ventana), NO contra el ancho del contenido desbordado — de ahí que el paso sea 100% y no `100/n`%.
- **L7** (2026-10-18) — **Verificación visual CERRADA por el usuario**: probó la sección en `npm start` con la ventana en modo celular y reportó que se ve perfecto. Los 14 checks automatizados siguen válidos; esto cubre el hueco de estética. Commiteado en `275dabc`.
- **L8** (2026-10-18) — **A1 SIGUE ABIERTO**: el contenido (experiencia y títulos) continúa siendo PLACEHOLDER inventado. La verificación visual confirma que el *layout* funciona, no que las credenciales sean reales. Reemplazar antes de publicar el sitio.
