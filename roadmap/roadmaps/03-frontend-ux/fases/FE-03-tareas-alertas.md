# FE-03 - Tareas y alertas

## Estado

- **Estado real:** `implementation_documentation_incomplete`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-07, BE-05
- **Bloqueador:** ninguno
- **Evidencia:** `apps/web/src/app/tareas/page.tsx` — lista de tareas con badge de categoria
  (shopify/meta/klaviyo/general, anadido esta semana), prioridad y estado; filtro por estado y por
  categoria; alertas activas/resueltas con acciones de reconocer/descartar; comentarios por tarea.
- **Gaps identificados:**
  - Es una lista simple, no tabla/kanban con paginacion, orden ni busqueda — a partir de un backlog
    grande esto no escala (mismo problema que se corrigio en el panel de Consultoria).
  - `task_status` en DB solo tiene `pending/in_progress/completed/ignored/cancelled` — no existe un
    estado `blocked` explicito; si se necesita, es un cambio de enum (ver DB-01, estrategia de
    evolucion de enums).
  - Sin filtros persistidos, sin busqueda de texto.
  - Sin matriz de visibilidad documentada (que campo ve cliente/consultor/admin) mas alla de lo que ya
    impone RLS — la nota interna vs comentario visible funciona en backend pero no esta tabulada aqui.
  - Sin optimistic UI ni manejo explicito de fallo de backend en un cambio de estado concurrente.
- **Siguiente accion:** documentar la matriz de visibilidad por campo/rol, y evaluar si migrar la lista a
  tabla real con paginacion (mismo patron ya aplicado en Consultoria y en la tabla de tiendas del
  dashboard).

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

