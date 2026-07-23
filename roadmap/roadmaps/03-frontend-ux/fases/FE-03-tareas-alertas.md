# FE-03 - Tareas y alertas

## Estado

- **Estado real:** `functionally_complete_verification_pending` (los 2 gaps de RLS y el de paginacion ya
  cerrados 2026-07-22; quedan mejoras menores no bloqueantes)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-22
- **Dependencias:** DB-07, BE-05
- **Bloqueador:** ninguno
- **Evidencia:** `apps/web/src/app/tareas/page.tsx` — lista de tareas con badge de categoria
  (shopify/meta/klaviyo/general, anadido esta semana), prioridad y estado; filtro por estado y por
  categoria; alertas activas/resueltas con acciones de reconocer/descartar; comentarios por tarea.

### Matriz de visibilidad por rol (2026-07-22, verificada contra RLS real)

| Entidad | Cliente (owner/member) | Consultor asignado | `platform_admin` | Politica RLS |
| --- | --- | --- | --- | --- |
| `alerts` | Todas las de su organizacion | Todas | Todas | `alerts_select_authorized` — sin distincion interna/publica, no existe un concepto de "alerta interna". |
| `tasks` | Solo `is_visible_to_client = true` | Todas (internas incluidas) | Todas | `tasks_select_authorized`. |
| `task_status_history` | Solo si la tarea referenciada es visible (`is_visible_to_client = true`) | Todas | Todas | **Corregido 2026-07-22** (gap real encontrado documentando esta tabla): antes solo comprobaba `can_access_org`, sin mirar la visibilidad de la tarea — un cliente podia leer `reason`/`changed_by` de una tarea interna consultando esta tabla directamente aunque no pudiera ver la tarea en si. Migracion `db_07_task_status_history_visibility_fix`, tests en `rls-tenant-isolation.test.ts`. |
| `task_comments` | Solo `is_internal = false` | Todos (`is_internal` incluidos) | Todos | `task_comments_select_authorized` — ya correcto antes de esta auditoria. |
| `strategic_plans`/`_phases`/`_milestones`/`milestone_task_links` | Solo si el plan no esta en `draft` | Todos | Todos | **Corregido 2026-07-22** (gap real, mismo patron que `task_status_history`): antes no distinguian por `status`, un plan `draft` era visible al cliente igual que uno activo. Migracion `fe_03_strategic_plans_draft_visibility_fix`; `_phases`/`_milestones`/`milestone_task_links` heredan la visibilidad del plan padre via `exists`. Tests en `rls-tenant-isolation.test.ts`. |
| `milestone_internal_notes` | Nunca | Todas | Todas | `milestone_internal_notes_select_consultants` — unica tabla de plan estrategico con visibilidad restringida real. |

- **Gaps identificados:**
  - Es una lista simple, no tabla/kanban con paginacion, orden ni busqueda — a partir de un backlog
    grande esto no escala (mismo problema que se corrigio en el panel de Consultoria).
  - `task_status` en DB solo tiene `pending/in_progress/completed/ignored/cancelled` — no existe un
    estado `blocked` explicito; si se necesita, es un cambio de enum (ver DB-01, estrategia de
    evolucion de enums).
  - Sin filtros persistidos, sin busqueda de texto.
  - Sin optimistic UI ni manejo explicito de fallo de backend en un cambio de estado concurrente.
- **`strategic_plans.status = 'draft'` cerrado 2026-07-22**: ya no hace falta esperar a que FE-05 tenga
  frontend -- se corrigio la RLS ahora (ver matriz arriba) para no dejar la tabla expuesta sin filtro por
  `status` mientras tanto, mismo criterio que ya se aplico en `task_status_history`.
- **Paginacion de la lista de tareas cerrada 2026-07-22**: `apps/web/src/app/tareas/page.tsx` reutiliza
  `usePaginated`/`Pagination` (mismo patron ya en produccion en `shopify/diagnostico/page.tsx`), 20 tareas
  por pagina. **Verificado en navegador real** (Playwright headless contra el dev server real, no solo
  typecheck/lint): sembrada una organizacion efimera con 25 tareas, login real por UI, `/tareas` muestra
  "Tareas (25)" con paginacion visible, pagina 1 = tareas #1-20, click en "Siguiente" navega a pagina 2 =
  tareas #21-25, sin errores de consola. Limpiado el dato de prueba despues.
- **Siguiente accion:** ninguna pendiente critica en este documento; el resto de gaps listados arriba
  (busqueda de texto, filtros persistidos, optimistic UI) son mejoras menores, no bloqueantes.

## Objetivo

Dar al cliente una cola accionable y al consultor visibilidad operativa.

## Entregables

- Lista de tareas con estado, prioridad, origen y responsable.
- Alertas activas y resueltas.
- Comentarios e historial.
- Filtros por estado, prioridad y modulo.

## Criterios de cierre

- Cambiar estado llama al backend/RPC autorizado.
- Tareas internas del consultor no se exponen al cliente.
- Tareas vencidas son visibles para el consultor.
