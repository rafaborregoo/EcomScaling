# DB-07 - Alertas, tareas y Mi Camino

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-00, DB-02
- **Bloqueador:** ninguno
- **Evidencia:**
  - Migracion `supabase/migrations/20260717190000_db_07_alertas_tareas_plan.sql` aplicada en remoto.
  - El historial de `tasks.status` **si es automatico**: trigger `record_task_status_change` (`security definer`, `search_path = ''`) inserta en `task_status_history` en cada insert/update de estado, venga del API, del motor de reglas o de un update manual — no depende de que el codigo de aplicacion recuerde escribirlo.
  - El enlace cross-tenant **si esta bloqueado a nivel DB**: triggers `enforce_task_alert_same_org` y `enforce_milestone_task_link_same_org` impiden enlazar una tarea/hito con una alerta/tarea de otra organizacion. Esto contradice una lectura basada solo en el snapshot conceptual (retirado), que no reflejaba estos triggers.
  - Categorizacion de tareas por modulo (shopify/meta/klaviyo/general) anadida 2026-07-20, deterministica segun el origen (plantilla de alerta o agente), nunca decidida por el LLM.
- **Gaps identificados:**
  - Este documento agrupa reglas+alertas, tareas y Mi Camino en un solo bloque; separarlo (DB-07A/B/C) facilitaria auditar cada subdominio por separado.
  - Sin `cooldown`/`suppression window` explicito documentado para alertas (existe deduplicacion por `fingerprint`, pero no una ventana de reapertura documentada).
  - Sin SLA/overdue formalizado mas alla del campo `due_at`.
  - Sin evidencia de test automatizado que verifique los triggers de aislamiento cross-tenant (existen, pero no estan cubiertos por `rls-tenant-isolation.test.ts` todavia).
- **Siguiente accion:** anadir un test que intente enlazar una tarea de la organizacion A con una alerta de B y confirme que el trigger lo rechaza.

## Objetivo

Convertir datos en operacion: reglas, alertas, tareas accionables y plan estrategico vivo.

## Tablas

- `alert_rule_templates`
- `organization_alert_rules`
- `alerts`
- `tasks`
- `task_status_history`
- `task_comments`
- `strategic_plans`
- `strategic_plan_phases`
- `strategic_plan_milestones`
- `milestone_task_links`
- `milestone_internal_notes`

## Criterios de cierre

- Una alerta puede generar tarea idempotente.
- Cambios de estado de tarea tienen historial.
- Notas internas no son visibles para cliente.
- No se puede enlazar una tarea de A con una alerta, hito o plan de B.

