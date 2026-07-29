# FE-07 - Panel consultor

## Estado

- **Estado real:** `in_progress_core_product` (es correctamente el producto central ahora que la
  estrategia es consultor-first; ya tiene bastante mas de lo que este documento de 4 lineas sugiere).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** BE-01, BE-05, DB-07
- **Bloqueador:** ninguno
- **Evidencia real (mucho mas que "F2: lista de clientes"):** `apps/web/src/app/consultor/page.tsx` —
  tabla real de clientes (no lista simple) con conteo de tiendas, health score, alertas vivas, tareas,
  plan; panel expandible por cliente con CRUD (editar nombre/estado/timezone/moneda, anadir tienda,
  borrar tienda/cliente con confirmacion de nombre exacto, solo `platform_admin`).
- **El health score SI es deterministico** (exactamente lo que pide la auditoria: "la IA puede explicar,
  el ranking debe ser reproducible"): `listConsultantOrganizations` en `apps/api/src/consultant.ts`
  calcula `score = severityScore(alertas por peso: critical=10/high=5/medium=2/low=1) +
  min(dias_alerta_mas_antigua, 14) + tareas_vencidas*3` en Node, ordenado server-side — ningun LLM decide
  el orden de clientes.
- **Resuelto 2026-07-22**: el CRUD de borrado tenia texto engañoso ("irreversible") y las rutas de
  restauracion del backend (`POST .../restore`, anadidas 2026-07-21 junto al soft-delete de R-008) no
  tenian ningun consumidor en el frontend -- borrar una tienda o cliente los dejaba en `pending_deletion`
  sin ninguna forma de deshacerlo desde la UI, contradiciendo lo que el propio dialogo de confirmacion
  ahora promete ("30 dias para restaurar"). `apps/web/src/app/consultor/page.tsx` ya muestra el estado
  `pending_deletion` (tabla y panel expandible) con un boton "Restaurar" real, y `ConfirmDangerDialog`
  gano un campo `note` para declarar el periodo de gracia en vez de decir "irreversible".

### Matriz de acciones: `platform_admin` vs `consultant` (2026-07-22, verificada contra backend real)

| Accion | Consultor | `platform_admin` | Enforcement |
| --- | --- | --- | --- |
| Ver lista de clientes con health score (`/v1/consultant/organizations`) | Si | Si | `listConsultantOrganizations` — ambos roles pasan el chequeo. |
| Ver tiendas de un cliente | Si | Si | `listOrganizationStores` — ambos roles. |
| Editar organizacion (nombre/estado/timezone/moneda) | **No** | Si | `updateOrganization` — `requirePlatformAdmin`. |
| Borrar cliente entero (soft-delete) | **No** | Si | `deleteOrganization` — `requirePlatformAdmin`. |
| Restaurar cliente dentro del periodo de gracia | **No** | Si | `restoreOrganization` — `requirePlatformAdmin`. |
| Borrar tienda (soft-delete) | **No** | Si | `deleteOrganizationStore` — `requirePlatformAdmin`. |
| Restaurar tienda | **No** | Si | `restoreOrganizationStore` — `requirePlatformAdmin`. |
| Aprobar/rechazar salida IA pendiente (`decideAgentOutput`) | Si (si asignado) | Si | Rol en `["platform_admin","consultant"]`. **Alineado 2026-07-22** (ver nota abajo). |
| Publicar/rechazar resumen de llamada (`decideSummary`) | Si (si asignado) | Si | `requireConsultant` — mismo criterio que `decideAgentOutput` desde 2026-07-22. |

**Resumen**: dentro del panel `/consultor`, el consultor solo tiene permisos de **lectura** — toda mutacion
(editar/borrar/restaurar cliente o tienda) es exclusiva de `platform_admin`, verificado en los 5 puntos de
`requirePlatformAdmin` de `apps/api/src/consultant.ts`. Fuera del panel, en aprobacion de salidas IA y
resumenes de llamadas, el consultor asignado si puede actuar (ademas del `platform_admin`).

**Hallazgo corregido 2026-07-22**: `decideAgentOutput` admitia tambien al owner/manager del propio cliente
como aprobador, distinto de `decideSummary` (solo consultor/`platform_admin`) — y
`ai-diagnostic-section.tsx` no ocultaba el boton de aprobar por rol, solo dependia de que RLS ocultara las
salidas `pending_approval` a los clientes. Era inofensivo en la practica (el cliente nunca veia el boton
sin ver antes la fila), pero era una capacidad de backend sin decision de producto explicita detras.
Alineado al mismo criterio que `decideSummary`: ahora ambos flujos de aprobacion exigen
consultor/`platform_admin`, sin excepcion para owner/manager.

- **Cerrado 2026-07-29 (busqueda)**: `consultor/page.tsx` no tenia forma de filtrar la tabla de clientes --
  con muchos clientes habia que escanear la tabla entera a ojo. Anadido un campo de busqueda (filtro por
  nombre o slug, en el propio navegador sobre la lista ya cargada, sin request nueva); mensaje explicito
  "Sin resultados" cuando el filtro no matchea nada. El resumen "Qué cliente necesita atención hoy" sigue
  usando la lista completa sin filtrar (es una senal global de salud, no algo que deba ocultar la
  busqueda). Build de produccion limpio; sin verificar visualmente en navegador (sin Playwright/Chromium
  en este entorno). Saved views y acciones masivas siguen sin hacer -- necesitan mas decision de producto
  sobre que significa "accion masiva" aqui, no son un pick limpio como la busqueda.
- **Gaps identificados que siguen abiertos:**
  - Sin saved views ni acciones masivas (necesitan decision de producto sobre su alcance).
  - Sin registro explicito de "impersonation"/cambio de contexto (cambiar de cliente activo no queda
    auditado, solo el borrado si).
  - Organizacion/tienda activas se muestran en la mini barra de contexto del shell, pero no hay
    confirmacion contextual adicional en acciones sensibles mas alla del dialogo de borrado (p. ej. crear
    una tarea o aprobar un resumen no re-confirma "estas operando sobre X").
- **Siguiente accion:** decidir el alcance de saved views/acciones masivas antes de construirlas; evaluar
  si el registro de cambio de contexto se vuelve necesario para auditoria mas alla del borrado.

## Objetivo

Dar a Ricardo y futuros consultores una vista de control transversal.

## Entregables por madurez

- F2: lista de clientes, estado y asignaciones.
- F5-F6: salud de datos y dashboard por cliente.
- F7-F9: alertas, tareas, llamadas y planes.
- F11-F14: retencion, stock, IA, conocimiento y contenido.

## Criterios de cierre

- Solo se ven organizaciones asignadas salvo platform admin.
- El panel prioriza clientes con riesgos reales.
- Acciones sensibles quedan auditadas.

