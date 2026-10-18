# Sección de Servicios y precios

**Objetivo:** mostrar en la home los servicios de la peluquería con precio y duración, consumiendo los datos que ya expone `AppointmentService`.

**Repo:** `/home/luislinx/Escritorio/projectTest` · **App:** `src/app` (Angular 22 standalone + Tailwind v4)
**Runner:** no hay infraestructura de tests (`npm test` no ejecuta nada). Verificación por `npx ng build` + revisión visual.
**Entrega:** local, sin PR. Push queda a decisión del usuario.

## Specs

- **S1** — La home renderiza una sección nueva de servicios.
  *Alcance:* `src/app/components/servicios/servicios.component.ts` (nuevo) y `src/app/pages/home/home.component.ts` (agregar `<app-servicios>`).
  *Criterio:* el componente aparece en el DOM de la home.
  *Check:* inspección del bundle compilado + revisión visual.

- **S2** — Los servicios se obtienen de `AppointmentService.getServicios()`.
  *Criterio:* el componente NO contiene datos hardcodeados; llama al servicio.
  *Check:* `grep -c "getServicios" src/app/components/servicios/servicios.component.ts` debe dar al menos 1.

- **S3** — Cada servicio muestra los 4 campos del modelo `Servicio`: `nombre`, `descripcion`, `duracionMinutos`, `precio`.
  *Criterio:* los 4 campos están presentes en el template.
  *Check:* los textos de los 3 servicios mock ("Corte Clásico", "Corte y Barba", "Tintura / Color") son visibles.

- **S4** — La duración se muestra con la unidad: `30 min`, `45 min`, `90 min`.
  *Criterio:* el número de `duracionMinutos` no se muestra desnudo.

- **S5** — Se reutiliza el patrón visual de `staff.component.ts`: `<section>` con `id`, título `<h2>`, subtítulo `<p>`, grid responsive (`grid-cols-1 md:grid-cols-3`) y tarjetas con Tailwind.
  *Criterio:* consistencia visual con la sección de equipo existente.
  *Check:* revisión visual comparando ambas secciones.

- **S6** — Estado vacío: si la lista de servicios viene vacía, no se renderiza una grilla rota.
  *Criterio:* hay un `@if` que cubre `length === 0`.
  *Check:* revisión de código.

- **S7** — La sección lleva `id="servicios"` para permitir anclas futuras.
  *Criterio:* `id="servicios"` presente en el `<section>`.

## Supuestos (ASUMIDOS, no pedidos — CONFIRMAR)

- **A1** — **Posición en la página:** Hero → **Servicios** → Galería → Equipo.
  *Motivo:* en una peluquería los precios deberían verse temprano. El orden actual es Hero → Galería → Equipo.
- **A2** — **Formato de precio:** se muestra como `$15`, `$22`, `$40` (prefijo `$`, sin decimales).
  *Motivo:* el mock trae `15.00`, `22.00`, `40.00` y no hay campo de moneda en el modelo. **No sé si son ARS, USD u otra cosa.** No lo invento.
- **A3** — **Sin botón "Reservar".** Reservar requiere backend, que no existe todavía. No agrego un botón que no va a funcionar.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
| --- | --- | --- | --- | --- |
| T1 | S1-S7 | inline | **hecho** | `npx ng build` OK (308.91 kB) · S2 `getServicios()`=1 · S3 los 4 campos=1 c/u · S4 `}} min`=1 · S6 estado vacío=1 · S7 `id="servicios"`=1 · S1 `<app-servicios>` en home=1 · orden servicios→galería→staff confirmado · `precio()` probado: 15→`$15`, 22→`$22`, 40→`$40`, 15.5→`$15.50` · ancla `#galeria` intacta |

## Log

- **L1** (2026-10-17) — Pedido original del usuario, verbatim: *"me gustaria crearte agentes para que manejes.. para que delegues trabajos, asi hacemos sdd"*. Tras aclarar que "SDD" = Spec-Driven Development (spec → tareas → delegar) y que los agentes ya están instalados, el usuario eligió como primera feature: *"Seccion de Servicios y precios (Recomendado)"*.
- **L2** (2026-10-17) — Evidencia recolectada: `getServicios()` está definido en `src/app/services/appointment.service.ts:33` y **no es llamado en ningún lado** (código muerto). El mock expone 3 servicios. `home.component.ts` sólo renderiza `<app-gallery>` y `<app-staff>`.
- **L3** (2026-10-17) — Clasificación de tamaño: **tarea chica** (un componente, riesgo contenido, reanudable con el diff). Por contrato iría inline sin artefactos. El documento se crea porque el usuario pidió el flujo SDD explícitamente.
- **L4** (2026-10-17) — Espejo en Engram **pendiente**: Engram está degradado (no resuelve proyecto).
- **L5** (2026-10-17) — T1 implementado inline. Archivos: `src/app/components/servicios/servicios.component.ts` (nuevo) y `src/app/pages/home/home.component.ts` (import + `<app-servicios>` antes de `<app-gallery>`). Verificación: build de producción OK + los 7 checks de la spec ejecutados con evidencia. **No verificado visualmente en navegador** — pendiente del usuario (`npm start`). Sin commit: la tarea es chica, los commits quedan a decisión del usuario.
- **L6** (2026-10-17) — Error propio registrado: el primer check de S4 usó el patrón `min }}` en vez de `}} min` y dio falso negativo. Corregido y re-ejecutado. Lección: los checks también se verifican.
