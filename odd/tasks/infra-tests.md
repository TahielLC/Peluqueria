# Infraestructura de tests

**Objetivo:** darle al proyecto la capacidad de detectar regresiones. Hoy `npm test` sale con error y no existe un solo test: cada cambio es a ciegas.

**Repo:** `/home/luislinx/Escritorio/projectTest` · **App:** `src/app` (Angular 22.2.3, Node 22, npm 12)
**Runner:** **Vitest** — es el default del builder `@angular/build:unit-test` en Angular 22 (`runner` default = `"vitest"`), con entorno DOM **jsdom**.
**Entrega:** local, sin PR. **Riesgo declarado:** item 5 (dependencias + configuración de build).

## Specs

- **S1** — `npm test` ejecuta la suite y ya no termina con `exit 1`.
  *Criterio:* el script `test` de `package.json` invoca `ng test`.
  *Check:* `npm test` sale con código 0 y reporta tests ejecutados.

- **S2** — El runner es **Vitest** con entorno **jsdom**.
  *Criterio:* `vitest` y `jsdom` están en `devDependencies`; el builder no se queja de falta de DOM.
  *Check:* `ng test` corre sin el error `A DOM environment is required`.

- **S3** — El target `test` existe en `angular.json` con el builder `@angular/build:unit-test`.
  *Criterio:* `projects.peluqueria-app.architect.test.builder` = `@angular/build:unit-test`.

- **S4** — Existe `tsconfig.spec.json` para los archivos de test, separado del de la app.
  *Criterio:* el archivo incluye `**/*.spec.ts` y declara los tipos de Vitest.

- **S5** — Hay tests de la lógica que **ya existe**, no de código nuevo:
  servicio (`getServicios`, `getPeluqueros`, `getGaleria`, `agendarTurno`) y los tres componentes.
  *Criterio:* existen archivos `.spec.ts` junto a cada unidad.

- **S6** — Los tests cubren los **casos límite reales**, no sólo el camino feliz:
  - wrap-around: de la última posición se vuelve a la primera y viceversa;
  - umbral de swipe: 49px NO cambia de slide, 50px SÍ;
  - `goTo` fuera de rango no cambia nada;
  - estado vacío con lista de longitud 1 (no debe haber flechas ni puntos).

- **S7** — El **build de producción sigue funcionando** y NO arrastra código de test.
  *Criterio:* `npx ng build` compila; ningún `.spec.ts` aparece en el bundle.
  *Check:* build OK + `grep` de nombres de test en `dist/`.

- **S8** — El **cálculo de geometría de la galería** queda pinneado por un test.
  *Criterio:* con 3 fotos el ángulo es 120°, y el radio se mantiene por encima del ancho del
  panel para que los paneles vecinos no queden tapados (el bug que se detectó a mano).

## Supuestos (ASUMIDOS — CONFIRMAR)

- **A1** — Se usan las versiones que el propio CLI de Angular fija: `vitest ^5.0.0`, `jsdom ^30.0.0`.
  No se eligen versiones a mano.
- **A2** — Los tests son unitarios y **no** abren navegador. No se configura browser-mode
  (`@vitest/browser-playwright`) porque no hay Playwright en el proyecto.
- **A3** — No se instala coverage todavía (`@vitest/coverage-v8`). Primero que la suite exista y corra.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
| --- | --- | --- | --- | --- |
| T1 | S1-S4 | inline | **hecho** | `npm test` exit 0 · builder `@angular/build:unit-test` · vitest 5.0.5 + jsdom 30.1.3 · `tsconfig.spec.json` con `types: ["vitest/globals"]` |
| T2 | S5, S6 | inline | **hecho** | `services/appointment.service.spec.ts` — 6 tests |
| T3 | S5, S6, S8 | inline | **hecho** | `components/gallery/gallery.component.spec.ts` — 19 tests |
| T4 | S5, S6 | inline | **hecho** | `components/staff/staff.component.spec.ts` (13) + `components/servicios/servicios.component.spec.ts` (5) |
| T5 | S7 | inline | **hecho** | build de producción OK · `grep` de `vitest\|TestBed\|spec.ts` en `dist/` = LIMPIO |

**Suite total: 43 tests / 4 archivos / 4.3s.**

## Log

- **L1** (2026-10-18) — Pedido original del usuario, verbatim: *"eso lo vamos a encarar al ultimo quiero agregar le robustes al proyecto"*. Al separarle los huecos reales (tests, manejo de errores, estados de carga, guardrails), el usuario eligió: **"Infra de tests"**.
- **L2** (2026-10-18) — Estado verificado antes de tocar nada: `npm test` = `echo "Error: no test specified" && exit 1`; sin `tsconfig.spec.json`; sin dependencias de testing; `angular.json` sin target `test`. Lo que YA está bien y no se toca: `strict`, `strictTemplates`, `noImplicitReturns`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch` — el tsconfig es serio.
- **L3** (2026-10-18) — Elección del runner resuelta con evidencia del paquete instalado, no de memoria: `@angular/build` 22.2.3 declara el builder `unit-test` con `runner` default `"vitest"` (enum `["karma","vitest"]`), y su check exige `jsdom` o `happy-dom` para tests sin navegador. El schematic `application/index.js:281-290` confirma que para Vitest genera `{ builder: "@angular/build:unit-test", options: {} }` sin más.
- **L4** (2026-10-18) — Clasificación: **tarea grande**. No por cantidad de archivos, sino porque el criterio de reanudación falla: el alcance (qué se testea y por qué) no se reconstruye desde el diff. Se trackea con este documento.
- **L5** (2026-10-18) — T1-T5 implementadas inline. Config: `angular.json` (+target `test` con `options: {}`, la forma exacta que genera el schematic del CLI), `tsconfig.spec.json` (nuevo), `package.json` (`test: ng test --watch=false`, `test:watch: ng test`). Specs: 4 archivos junto a cada unidad.
- **L6** (2026-10-18) — **Prueba de mutación sobre la regresión del radio.** Se inyectó a propósito la fórmula vieja (`touching * 1.8` → 177px) y la suite pasó a **5 tests fallidos con exit code 1**, incluyendo `el radio supera el ancho del panel para que los vecinos asomen`. Restaurado con `git checkout` y reverificado en verde. Esto demuestra que los tests no son vacíos: fallan cuando el código está mal. **Alcance de la prueba: sólo la geometría del radio.** El resto de la suite (swipe, navegación, formato de precio) no fue mutada todavía — queda como verificación independiente.
- **L7** (2026-10-18) — Error propio registrado: el primer `setup()` de los specs no llamaba a `TestBed.resetTestingModule()`, y el test que prueba 3 tamaños distintos (`for cantidad of [3,4,6]`) falló con `Cannot configure the test module when the test module has already been instantiated`. `TestBed.configureTestingModule` sólo puede llamarse una vez por instancia. Corregido moviendo el reset dentro de `setup()` en los tres specs, lo que además vuelve al helper auto-contenido.
