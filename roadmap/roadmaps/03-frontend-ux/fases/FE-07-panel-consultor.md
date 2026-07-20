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
- **Gaps identificados:**
  - Sin busqueda, saved views, ni acciones masivas.
  - Sin registro explicito de "impersonation"/cambio de contexto (cambiar de cliente activo no queda
    auditado, solo el borrado si).
  - Organizacion/tienda activas se muestran en la mini barra de contexto del shell, pero no hay
    confirmacion contextual adicional en acciones sensibles mas alla del dialogo de borrado (p. ej. crear
    una tarea o aprobar un resumen no re-confirma "estas operando sobre X").
  - Sin distincion documentada de que acciones son exclusivas de `platform_admin` vs `consultant` mas
    alla del borrado (implementado en codigo, no tabulado aqui).
- **Siguiente accion:** documentar la matriz de acciones exclusivas admin vs consultant, y anadir
  confirmacion contextual (nombre de organizacion visible) en acciones sensibles fuera del borrado.

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

