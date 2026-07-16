# DB-07 - Alertas, tareas y Mi Camino

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

